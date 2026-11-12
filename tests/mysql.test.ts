import {after,before,beforeEach,describe,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';
import {MysqlRepository} from '../server/db/mysql.js';
import {localStorage} from '../server/local-storage.js';
import {createApp} from '../server/app.js';
import {getConfig} from '../server/config.js';
import {testConfig,meta,png} from './fixtures.js';

describe('MySQL with local photos',{skip:!process.env.MYSQL_TEST_URL},()=>{
 let repo:MysqlRepository,directory:string,app:ReturnType<typeof createApp>;
 const config={...testConfig,databaseUrl:process.env.MYSQL_TEST_URL!,database:'mysql' as const,photoStorage:'local' as const};
 const headers={Origin:'http://localhost:5173','X-Pixel-Booth':'1'};
 before(async()=>{
  repo=new MysqlRepository(config.databaseUrl);
  directory=await mkdtemp(path.join(tmpdir(),'pixel-booth-mysql-'));
  const schema=await readFile(new URL('../server/db/schema.mysql.sql',import.meta.url),'utf8');
  // Apply twice to verify the migration is safe to repeat.
  for(let i=0;i<2;i++)for(const sql of schema.split('-- statement-breakpoint'))if(sql.trim())await repo.query(sql);
  app=createApp({config,repo,storage:localStorage(directory)});
 });
 beforeEach(async()=>{for(const table of ['feedback_likes','feedback','gallery','upload_intents','rate_limits'])await repo.query(`DELETE FROM ${table}`);});
 after(async()=>{await repo?.close();if(directory)await rm(directory,{recursive:true,force:true});});
 async function visitor(){const agent=request.agent(app);await agent.get('/api/session').expect(200);return agent;}
 test('health, raw uploads above 4 MiB, persistence, ownership, downloads and deletion',async()=>{
  const health=await request(app).get('/api/health').expect(200);assert.equal(health.body.database,'mysql');assert.equal(health.body.photos,'local');
  const owner=await visitor(),stranger=await visitor();
  const prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta).expect(201)).body;
  const bytes=await sharp(randomBytes(2048*768*4),{raw:{width:2048,height:768,channels:4}}).png().toBuffer();assert.ok(bytes.length>4*1024*1024);
  const upload=`/api/gallery/${prepared.uploadId}/upload`;
  await stranger.post(upload).set(headers).set('Content-Type','image/png').send(bytes).expect(403);
  await owner.post(upload).set(headers).set('Content-Type','image/png').send(bytes).expect(201);
  await stranger.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(403);
  const photo=(await owner.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(201)).body;
  await owner.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(200);
  const reopenedRepo=new MysqlRepository(config.databaseUrl);
  try{
   const reopened=createApp({config,repo:reopenedRepo,storage:localStorage(directory)});
   const list=await request(reopened).get('/api/gallery').expect(200);assert.equal(list.body[0].id,photo.id);
   const image=await request(reopened).get(photo.imageUrl).expect(200).expect('Content-Type',/image\/png/);assert.deepEqual(image.body,bytes);
  }finally{await reopenedRepo.close();}
  await owner.get(photo.downloadUrl).expect(200).expect('Content-Disposition',/attachment/);
  await stranger.delete(`/api/gallery/${photo.id}`).set(headers).expect(403);
  await owner.delete(`/api/gallery/${photo.id}`).set(headers).expect(200);
  await owner.get(photo.imageUrl).expect(404);assert.equal((await repo.upload(photo.id))?.state,'rejected');
 });
 test('feedback moderation, duplicate detection, concurrent likes and admin removal',async()=>{
  const owner=await visitor(),other=await visitor();const input={name:'MySQL test',message:'Lovely photo booth with MySQL.',rating:5};
  const note=(await owner.post('/api/feedback').set(headers).send(input).expect(201)).body;
  await owner.post('/api/feedback').set(headers).send(input).expect(409);
  assert.equal((await other.get('/api/feedback')).body.length,0);
  assert.equal((await owner.get('/api/feedback')).body[0].moderationStatus,'pending');
  const auth={Authorization:`Bearer ${config.adminToken}`};
  await request(app).patch(`/api/admin/feedback/${note.id}`).set(auth).send({status:'approved'}).expect(200);
  const replies=await Promise.all(Array.from({length:8},()=>owner.post(`/api/feedback/${note.id}/like`).set(headers)));
  assert.ok(replies.every(reply=>reply.status===200));assert.equal((await repo.feedbackById(note.id))?.likes,1);
  await other.post(`/api/feedback/${note.id}/like`).set(headers).expect(200);assert.equal((await repo.feedbackById(note.id))?.likes,2);
  assert.equal((await owner.get('/api/feedback')).body[0].liked,true);
  await request(app).get('/api/admin/feedback?status=approved').set(auth).expect(200);
  await request(app).delete(`/api/admin/feedback/${note.id}`).set(auth).expect(200);
  await request(app).delete(`/api/admin/feedback/${note.id}`).set(auth).expect(404);
 });
 test('concurrent rate counters, expiry, rejected uploads and bounded cleanup',async()=>{
  const key='a'.repeat(64),results=await Promise.all(Array.from({length:12},()=>repo.rate(key,60)));
  assert.deepEqual(results.map(row=>row.used).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
  await repo.query('UPDATE rate_limits SET expires_at=TIMESTAMPADD(DAY,-2,UTC_TIMESTAMP(3))');
  assert.equal((await repo.rate(key,60)).used,1);
  await repo.query('UPDATE rate_limits SET expires_at=TIMESTAMPADD(DAY,-2,UTC_TIMESTAMP(3))');await repo.cleanupRates();
  assert.equal((await repo.query('SELECT * FROM rate_limits')).length,0);
  const id=randomUUID();await repo.createUpload(id,randomUUID(),meta);await repo.rejectUpload(id);
  assert.equal(await repo.finalize(id,'local:ignored'),undefined);
  await repo.query('UPDATE upload_intents SET expires_at=TIMESTAMPADD(DAY,-1,UTC_TIMESTAMP(3))');
  assert.equal((await repo.expiredUploads()).length,1);await repo.removeExpiredUpload(`gallery/${id}.png`);assert.equal(await repo.upload(id),undefined);
 });
 test('pagination preserves tied millisecond timestamps and validation rejects corrupt PNGs',async()=>{
  for(let i=0;i<102;i++){const id=randomUUID();await repo.createUpload(id,null,meta,'2026-11-07T00:00:00.123Z');await repo.finalize(id,`local:gallery/${id}.png`);}
  const first=await request(app).get('/api/gallery').expect(200);assert.equal(first.body.length,100);assert.ok(first.headers['x-next-cursor']);
  const second=await request(app).get(`/api/gallery?cursor=${encodeURIComponent(first.headers['x-next-cursor'])}`).expect(200);
  assert.equal(second.body.length,2);assert.equal(new Set([...first.body,...second.body].map(row=>row.id)).size,102);
  const owner=await visitor(),prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta)).body;
  await owner.post(`/api/gallery/${prepared.uploadId}/upload`).set(headers).set('Content-Type','image/png').send(Buffer.from('invalid')).expect(400);
  const bytes=await png();await owner.post(`/api/gallery/${prepared.uploadId}/upload`).set(headers).set('Content-Type','image/png').send(bytes).expect(201);
 });
});

test('MySQL/local configuration needs no Blob token and refuses Vercel local files',()=>{
 const env={DATABASE_URL:'mysql://user:password@localhost/pixel_booth',PHOTO_STORAGE:'local',SESSION_SECRET:testConfig.sessionSecret,ADMIN_API_TOKEN:testConfig.adminToken,CRON_SECRET:testConfig.cronSecret};
 assert.equal(getConfig(env).database,'mysql');assert.equal(getConfig(env).photoStorage,'local');
 assert.throws(()=>getConfig({...env,VERCEL:'1',APP_ORIGIN:'https://example.com'}),/persistent server filesystem/);
});
