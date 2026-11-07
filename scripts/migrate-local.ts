import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {getConfig,ApiError,UUID} from '../server/config.js';
import {Repository,neonQuery} from '../server/db/repository.js';
import {vercelStorage} from '../server/blob.js';
import {metadataSchema,validatePng} from '../server/validation.js';

async function readJson(name:string){try{return JSON.parse(await readFile(new URL(`../server/data/${name}.json`,import.meta.url),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}}
const gallery=z.array(z.object({id:UUID,title:z.string(),kind:z.enum(['plain','meme']),layout:z.string(),createdAt:z.iso.datetime()})).parse(await readJson('gallery'));
const feedback=z.array(z.object({id:UUID,name:z.string().min(1).max(35),message:z.string().min(5).max(600),rating:z.number().int().min(1).max(5),likes:z.number().int().min(0),createdAt:z.iso.datetime()})).parse(await readJson('feedback'));
for(const record of gallery){metadataSchema.parse({title:record.title,kind:record.kind,layout:record.layout});await validatePng(await readFile(new URL(`../server/data/gallery/${record.id}.png`,import.meta.url)));}
if(!process.argv.includes('--apply')){
 console.log(`Dry run: ${gallery.length} valid gallery photos and ${feedback.length} feedback notes. No uploads or database writes performed. Use --apply after backing up server/data.`);
}else{
 const config=getConfig(),repo=new Repository(neonQuery(config.databaseUrl)),storage=vercelStorage(config.blobToken);
 let photos=0,notes=0;
 for(const record of gallery){
  if(await repo.gallery(record.id))continue;
  const meta=metadataSchema.parse({title:record.title,kind:record.kind,layout:record.layout});
  const original=await readFile(new URL(`../server/data/gallery/${record.id}.png`,import.meta.url));
  const intent=await repo.upload(record.id)||await repo.createUpload(record.id,null,meta,record.createdAt);
  let blob;
  try{blob=await storage.head(intent.pathname);const saved=await storage.read(blob);if(!saved.equals(original))throw Error('Existing cloud photo differs from the local migration source.');}
  catch(error){if(!(error instanceof ApiError)||error.status!==404)throw error;blob=await storage.put(intent.pathname,original);}
  if(!await repo.finalize(intent.id,blob.url))throw Error('A migration upload expired. Review the upload intent before retrying.');photos++;
 }
 for(const record of feedback){
  if(await repo.feedbackById(record.id))continue;
  await repo.createFeedback({...record,owner:null,status:'pending',fingerprint:createHash('sha256').update(record.message).digest('hex')});notes++;
 }
 console.log(`Migrated ${photos} gallery photos and ${notes} feedback notes. Feedback awaits admin approval. Legacy photos require administrator deletion. Original local files were not changed.`);
}
