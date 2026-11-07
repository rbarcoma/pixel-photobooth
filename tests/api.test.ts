import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import request from 'supertest';
import express from 'express';
import sharp from 'sharp';
import {getPayloadFromClientToken} from '@vercel/blob/client';
import {createApp} from '../server/app.js';
import {serverlessHandler} from '../server/handler.js';
import {MAX_PHOTO_BYTES,getConfig} from '../server/config.js';
import {fixture,meta,png,testConfig} from './fixtures.js';
let f:Awaited<ReturnType<typeof fixture>>;
const headers={'Origin':'http://localhost:5173','X-Pixel-Booth':'1'};
const asData=(image:Buffer)=>`data:image/png;base64,${image.toString('base64')}`;
async function visitor(){const agent=request.agent(f.app);await agent.get('/api/session').expect(200);return agent;}
async function save(agent:ReturnType<typeof request.agent>){return (await agent.post('/api/gallery').set(headers).send({...meta,dataUrl:asData(await png())}).expect(201)).body;}
before(async()=>{f=await fixture();});beforeEach(async()=>{await f.reset();});after(async()=>{await f.db.close();});

test('health, session cookies, missing configuration, and unknown API routes return JSON',async()=>{
 await request(f.app).get('/api/health').expect(200).expect('Cache-Control','private, no-store');
 const response=await request(f.app).get('/api/session').expect(200);assert.match(String(response.headers['set-cookie']),/HttpOnly/);assert.match(String(response.headers['set-cookie']),/SameSite=Lax/);assert.equal(response.body.maxPhotoBytes,MAX_PHOTO_BYTES);
 await request(f.app).get('/api/missing').expect(404).expect('Content-Type',/json/);
 const missing=createApp();const names=['DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','SESSION_SECRET','ADMIN_API_TOKEN','CRON_SECRET'];const previous=new Map(names.map(name=>[name,process.env[name]]));for(const name of names)delete process.env[name];try{await request(missing).get('/api/health').expect(503);}finally{for(const [name,value] of previous)if(value!==undefined)process.env[name]=value;}
});
test('cross-site writes, absent sessions, and forged ownership cookies are rejected',async()=>{
 const agent=await visitor();await agent.post('/api/gallery/prepare').set({'Origin':'https://attacker.example','X-Pixel-Booth':'1'}).send(meta).expect(403);
 await request(f.app).post('/api/gallery/prepare').set(headers).send(meta).expect(401);
 await request(f.app).post('/api/gallery/prepare').set(headers).set('Cookie','pixel-booth-session=00000000-0000-4000-8000-000000000001.9999999999.invalid').send(meta).expect(401);
 assert.equal((await f.repo.galleries()).length,0);
});
test('legacy gallery route remains compatible and only its owner or an administrator can delete',async()=>{
 const owner=await visitor(),stranger=await visitor(),photo=await save(owner);
 assert.equal(photo.canDelete,true);assert.equal(photo.owner_id,undefined);assert.equal(photo.kind,'meme');
 const ownList=await owner.get('/api/gallery').expect(200);assert.equal(ownList.body[0].canDelete,true);
 const publicList=await stranger.get('/api/gallery').expect(200);assert.equal(publicList.body[0].canDelete,false);
 await owner.get(photo.imageUrl).expect(307).expect('Location',/public\.blob\.vercel-storage\.com/);
 await owner.get(photo.downloadUrl).expect(307).expect('Location',/download=1/);
 await stranger.delete(`/api/gallery/${photo.id}`).set(headers).expect(403);
 await owner.delete(`/api/gallery/${photo.id}`).set(headers).expect(200);await owner.get(photo.imageUrl).expect(404);assert.equal(f.storage.objects.size,0);assert.equal(await f.repo.gallery(photo.id),undefined);assert.equal((await f.repo.upload(photo.id))?.title,'Deleted memory');
 const second=await save(owner);await request(f.app).delete(`/api/gallery/${second.id}`).set('Authorization',`Bearer ${testConfig.adminToken}`).expect(200);
});
test('a new function instance sees persisted records, ownership and rate limits',async()=>{
 const owner=await visitor();const photo=await save(owner);const app2=createApp(f.dependencies);
 const response=await request(app2).get('/api/gallery').expect(200);assert.equal(response.body[0].id,photo.id);
 for(let i=0;i<9;i++)await owner.post('/api/gallery/prepare').set(headers).send(meta).expect(201);
 await request.agent(app2).get('/api/session').expect(200);
 await owner.post('/api/gallery/prepare').set(headers).send(meta).expect(429).expect('Retry-After',/\d+/);
});
test('direct upload grants are owned, restricted to PNG, size-limited, short-lived and path-bound',async()=>{
 const owner=await visitor(),stranger=await visitor();const prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta).expect(201)).body;
 const event={type:'blob.generate-client-token',payload:{pathname:prepared.pathname,clientPayload:JSON.stringify({uploadId:prepared.uploadId}),multipart:false}};
 await stranger.post('/api/gallery/upload').set(headers).send(event).expect(403);
 await owner.post('/api/gallery/upload').set(headers).send({...event,payload:{...event.payload,pathname:'unapproved.png'}}).expect(403);
 const granted=await owner.post('/api/gallery/upload').set(headers).send(event).expect(200);const token=getPayloadFromClientToken(granted.body.clientToken);
 assert.deepEqual(token.allowedContentTypes,['image/png']);assert.equal(token.maximumSizeInBytes,MAX_PHOTO_BYTES);assert.equal(token.pathname,prepared.pathname);assert.equal(token.allowOverwrite,false);assert.ok(token.validUntil<=Date.now()+10*60_000);assert.ok(!granted.text.includes(testConfig.blobToken));
 await owner.post('/api/gallery/upload').set(headers).send({type:'blob.upload-completed',payload:{}}).expect(400);
});
test('large photos bypass JSON, finalize once, and cannot be finalized by another visitor',async()=>{
 const owner=await visitor(),stranger=await visitor();const prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta).expect(201)).body;
 const image=await sharp(randomBytes(2048*768*4),{raw:{width:2048,height:768,channels:4}}).png().toBuffer();assert.ok(image.length>4.5*1024*1024&&image.length<MAX_PHOTO_BYTES);
 await f.storage.put(prepared.pathname,image);
 await stranger.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(403);
 const one=await owner.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(201);
 const two=await owner.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(200);assert.equal(one.body.id,two.body.id);assert.equal((await f.repo.galleries()).length,1);
});
test('PNG decoding, layout validation, upload limits and malicious finalize bodies are enforced',async()=>{
 const owner=await visitor();await owner.post('/api/gallery/prepare').set(headers).send({...meta,layout:'plain-2'}).expect(400);
 await owner.post('/api/gallery').set(headers).send({...meta,dataUrl:asData(Buffer.from('not an image'))}).expect(400);
 await owner.post('/api/gallery').set(headers).send({...meta,dataUrl:asData(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(40)]))}).expect(400);
 await owner.post('/api/gallery').set(headers).send({uploadId:'https://attacker.example/image.png'}).expect(400);
 await owner.post('/api/gallery').set(headers).send({dataUrl:'x'.repeat(4*1024*1024+1)}).expect(413);
 const prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta).expect(201)).body;await f.storage.put(prepared.pathname,Buffer.alloc(64));
 await owner.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(400);assert.equal(f.storage.objects.size,0);assert.equal((await f.repo.upload(prepared.uploadId))?.state,'rejected');
});
test('deletions are hidden immediately and failed Blob deletions are retried by authorized maintenance',async()=>{
 const owner=await visitor(),photo=await save(owner);f.storage.failDelete=true;
 await owner.delete(`/api/gallery/${photo.id}`).set(headers).expect(202);assert.equal((await owner.get('/api/gallery')).body.length,0);await owner.get(photo.imageUrl).expect(404);
 await request(f.app).get('/api/maintenance').expect(401);f.storage.failDelete=false;
 const cleaned=await request(f.app).get('/api/maintenance').set('Authorization',`Bearer ${testConfig.cronSecret}`).expect(200);assert.equal(cleaned.body.deleted,1);assert.equal(f.storage.objects.size,0);
});
test('expired abandoned uploads are removed without touching completed gallery photos',async()=>{
 const owner=await visitor();const saved=await save(owner);const prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta)).body;await f.storage.put(prepared.pathname,await png());
 await f.repo.query("UPDATE upload_intents SET expires_at=now()-interval '1 day'");
 await request(f.app).get('/api/maintenance').set('Authorization',`Bearer ${testConfig.cronSecret}`).expect(200);
 assert.equal(f.storage.objects.size,1);assert.ok(await f.repo.gallery(saved.id));assert.equal(await f.repo.upload(prepared.uploadId),undefined);
});
test('feedback stays private to its author until approval and moderation requires the admin token',async()=>{
 const owner=await visitor(),other=await visitor();const created=await owner.post('/api/feedback').set(headers).send({name:'Tester',rating:5,message:'Great photo booth!'}).expect(201);const id=created.body.id;
 assert.equal(created.body.moderationStatus,'pending');assert.equal((await other.get('/api/feedback')).body.length,0);assert.equal((await owner.get('/api/feedback')).body.length,1);
 await owner.post(`/api/feedback/${id}/like`).set(headers).expect(404);
 await request(f.app).patch(`/api/admin/feedback/${id}`).send({status:'approved'}).expect(401);
 await request(f.app).patch(`/api/admin/feedback/${id}`).set('Authorization',`Bearer ${testConfig.adminToken}`).send({status:'approved'}).expect(200);
 assert.equal((await other.get('/api/feedback')).body.length,1);
 await request(f.app).patch(`/api/admin/feedback/${id}`).set('Authorization',`Bearer ${testConfig.adminToken}`).send({status:'rejected'}).expect(200);assert.equal((await owner.get('/api/feedback')).body.length,0);
});
test('concurrent duplicate likes remain one per browser and survive handler recreation',async()=>{
 const owner=await visitor(),other=await visitor();const note=await owner.post('/api/feedback').set(headers).send({name:'Tester',rating:5,message:'Such a lovely camera booth!'});
 const id=note.body.id;await f.repo.setFeedbackStatus(id,'approved');
 const replies=await Promise.all(Array.from({length:8},()=>owner.post(`/api/feedback/${id}/like`).set(headers)));
 assert.ok(replies.every(reply=>reply.status===200));assert.equal((await f.repo.feedbackById(id))?.likes,1);
 await other.post(`/api/feedback/${id}/like`).set(headers).expect(200);assert.equal((await f.repo.feedbackById(id))?.likes,2);assert.equal((await owner.get('/api/feedback')).body[0].liked,true);
});
test('feedback rejects malformed content, honeypot submissions, duplicates and burst submissions',async()=>{
 const owner=await visitor();const valid={name:'Tester',rating:5,message:'This is a useful photo booth.'};
 await owner.post('/api/feedback').set(headers).send({...valid,rating:'5'}).expect(400);
 await owner.post('/api/feedback').set(headers).send({...valid,website:'spam.example'}).expect(400);
 await owner.post('/api/feedback').set(headers).send({...valid,message:'x'.repeat(601)}).expect(400);
 await owner.post('/api/feedback').set(headers).send(valid).expect(201);
 await owner.post('/api/feedback').set(headers).send(valid).expect(409);
 await owner.post('/api/feedback').set(headers).send({...valid,message:'Another valid message.'}).expect(429);
});
test('keyset pagination preserves the existing array response and does not lose older photos',async()=>{
 for(let n=0;n<102;n++){const id=`00000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`;await f.repo.createUpload(id,null,meta,'2026-11-07T00:00:00.123Z');await f.repo.finalize(id,`https://teststore.public.blob.vercel-storage.com/gallery/${id}.png`);}
 const first=await request(f.app).get('/api/gallery').expect(200);assert.equal(first.body.length,100);assert.ok(first.headers['x-next-cursor']);
 const second=await request(f.app).get(`/api/gallery?cursor=${encodeURIComponent(first.headers['x-next-cursor'])}`).expect(200);assert.equal(second.body.length,2);assert.equal(new Set([...first.body,...second.body].map(row=>row.id)).size,102);
 await request(f.app).get('/api/gallery?cursor=invalid').expect(400);
});

test('the Vercel rewrite adapter preserves API paths, queries and non-API 404 isolation',async()=>{
 const app=serverlessHandler(f.app);
 await request(app).get('/api?path=health').expect(200);
 await request(app).get('/api?path=gallery').expect(200);
 await request(app).get('/api?path=not-a-route').expect(404).expect('Content-Type',/json/);
 await request(app).get('/api?path=../secret').expect(400);
 await request(app).get('/api/gallery').expect(200);
});
test('an owner can cancel an unfinished upload and its issued grant cannot finalize a photo',async()=>{
 const owner=await visitor();const prepared=(await owner.post('/api/gallery/prepare').set(headers).send(meta)).body;
 await owner.delete(`/api/gallery/${prepared.uploadId}`).set(headers).expect(200);
 await owner.post('/api/gallery').set(headers).send({uploadId:prepared.uploadId}).expect(410);
});

test('production ownership cookies are Secure and production origins must use HTTPS',async()=>{
 const env={NODE_ENV:'production',APP_ORIGIN:'https://pixel-booth.example',DATABASE_URL:testConfig.databaseUrl,BLOB_READ_WRITE_TOKEN:testConfig.blobToken,SESSION_SECRET:testConfig.sessionSecret,ADMIN_API_TOKEN:testConfig.adminToken,CRON_SECRET:testConfig.cronSecret};
 const config=getConfig(env);const app=createApp({...f.dependencies,config});const response=await request(app).get('/api/session').expect(200);assert.match(String(response.headers['set-cookie']),/Secure/);assert.match(String(response.headers['set-cookie']),/HttpOnly/);
 assert.throws(()=>getConfig({...env,APP_ORIGIN:'http://pixel-booth.example'}),/HTTPS/);
});
test('platform-preparsed JSON cannot bypass the Function request-body limit',async()=>{
 const app=express();app.use((req,_res,next)=>{req.body={payload:'x'.repeat(4*1024*1024+1)};next();});app.use(f.app);
 await request(app).post('/api/gallery').set('Authorization',`Bearer ${testConfig.adminToken}`).send({}).expect(413);
});
