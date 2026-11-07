import express,{type Request,type Response,type NextFunction} from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {handleUpload} from '@vercel/blob/client';
import {z} from 'zod';
import {ApiError,getConfig,MAX_PHOTO_BYTES,UUID,type Config} from './config.js';
import {Repository,neonQuery,type GalleryRow,type FeedbackRow,type Cursor} from './db/repository.js';
import {vercelStorage,type PhotoStorage} from './blob.js';
import {hasBearer,guardWrite,isAdmin,limit,requireAdmin,session,visitor} from './security.js';
import {decodeDataUrl,feedbackSchema,metadataSchema,validatePng} from './validation.js';

export interface Dependencies {config:Config;repo:Repository;storage:PhotoStorage;}
const date=(value:string|Date)=>new Date(value).toISOString();
function photo(row:GalleryRow,owner:string|null,admin=false){return {id:row.id,title:row.title,kind:row.kind,layout:row.layout,createdAt:date(row.created_at),imageUrl:`/api/gallery/${row.id}/image`,downloadUrl:`/api/gallery/${row.id}/image?download=1`,canDelete:admin||Boolean(owner&&row.owner_id===owner)};}
function review(row:FeedbackRow){return {id:row.id,name:row.name,message:row.message,rating:row.rating,likes:row.likes,createdAt:date(row.created_at),moderationStatus:row.status,liked:Boolean(row.liked)};}
function cursor(req:Request):Cursor|null {
 if(req.query.cursor===undefined)return null;
 const raw=z.string().max(512).parse(req.query.cursor);
 try{return z.object({createdAt:z.iso.datetime(),id:UUID}).parse(JSON.parse(Buffer.from(raw,'base64url').toString()));}
 catch{throw new ApiError(400,'Invalid page cursor.');}
}
function page<T extends {created_at:string|Date;id:string}>(rows:T[],res:Response){
 if(rows.length>100){const last=rows[99];res.set('X-Next-Cursor',Buffer.from(JSON.stringify({createdAt:date(last.created_at),id:last.id})).toString('base64url'));}
 return rows.slice(0,100);
}
const asyncRoute=(handler:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{void handler(req,res).catch(next);};
export function createApp(injected?:Dependencies){
 const app=express();let dependencies=injected;
 const runtime=()=>dependencies??=(function(){const config=getConfig();return {config,repo:new Repository(neonQuery(config.databaseUrl)),storage:vercelStorage(config.blobToken)};})();
 app.disable('x-powered-by');
 app.use('/api',(_req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});next();});
 // Reject unauthorized writes before parsing potentially large request bodies.
 app.use('/api',(req,res,next)=>{
  if(!['POST','PATCH','DELETE'].includes(req.method)){next();return;}
  void (async()=>{
   const {config,repo}=runtime();
   if(req.path.startsWith('/admin/')){requireAdmin(req,config);next();return;}
   const owner=isAdmin(req,config)?null:guardWrite(req,config);
   await limit(req,res,repo,config,'mutations',120,60,owner);next();
  })().catch(next);
 });
 // Image bytes go directly to Blob. This limit stays below Vercel's 4.5 MB function limit.
 app.use('/api',(req,_res,next)=>{
  const suppliedLength=Number(req.get('content-length')||0);
  const preParsed=req.body===undefined?'':typeof req.body==='string'?req.body:JSON.stringify(req.body);
  // Raw requests are drained by express.json on 413; pre-parsed platform bodies need a separate check.
  if(req.body!==undefined&&(suppliedLength>4*1024*1024||Buffer.byteLength(preParsed)>4*1024*1024)){next(new ApiError(413,'This request is too large. Use direct photo uploads for gallery images up to 13 MB.'));return;}
  next();
 });
 app.use('/api',express.json({limit:'4mb',strict:true}));
 app.get('/api/session',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();await limit(req,res,repo,config,'session',60,600);
  session(req,res,config);res.json({ok:true,maxPhotoBytes:MAX_PHOTO_BYTES});
 }));
 app.get('/api/health',asyncRoute(async(req,res)=>{
  const {config,repo,storage}=runtime();await limit(req,res,repo,config,'health',20,60);await repo.health();await storage.health();
  res.json({ok:true,service:'Pixel Booth',database:'postgresql',photos:'vercel-blob'});
 }));
 app.get('/api/gallery',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();await limit(req,res,repo,config,'read',600,60);
  const rows=page(await repo.galleries(cursor(req)),res);res.json(rows.map(row=>photo(row,visitor(req,config),isAdmin(req,config))));
 }));
 app.post('/api/gallery/prepare',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();const owner=guardWrite(req,config);
  await limit(req,res,repo,config,'gallery',10,3600,owner);
  const meta=metadataSchema.parse(req.body);const intent=await repo.createUpload(randomUUID(),owner,meta);
  res.status(201).json({uploadId:intent.id,pathname:intent.pathname,maxPhotoBytes:MAX_PHOTO_BYTES});
 }));
 app.post('/api/gallery/upload',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();const owner=guardWrite(req,config);await limit(req,res,repo,config,'upload-token',30,3600,owner);
  const body=z.object({type:z.literal('blob.generate-client-token'),payload:z.object({pathname:z.string().max(100),clientPayload:z.string().max(256),multipart:z.boolean().default(false)})}).parse(req.body);
  // Completion is finalized by POST /api/gallery, so local development needs no public webhook tunnel.
  const result=await handleUpload({request:req,body,token:config.blobToken,onBeforeGenerateToken:async(pathname,clientPayload)=>{
   let parsed:unknown;try{parsed=JSON.parse(clientPayload||'');}catch{throw new ApiError(400,'Invalid upload authorization.');}
   const {uploadId}=z.object({uploadId:UUID}).parse(parsed);
   const intent=await repo.authorizeUpload(uploadId,owner,pathname);
   if(!intent)throw new ApiError(403,'This upload is expired, already used, or belongs to another browser.');
   return {allowedContentTypes:['image/png'],maximumSizeInBytes:MAX_PHOTO_BYTES,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60,validUntil:Math.min(Date.now()+10*60_000,new Date(intent.expires_at).getTime())};
  }});
  res.json(result);
 }));
 app.post('/api/gallery',asyncRoute(async(req,res)=>{
  const {config,repo,storage}=runtime();const owner=guardWrite(req,config);
  let id:string;
  if(req.body?.dataUrl!==undefined){
   await limit(req,res,repo,config,'gallery',10,3600,owner);
   const meta=metadataSchema.parse(req.body);const image=decodeDataUrl(req.body.dataUrl);await validatePng(image);
   const intent=await repo.createUpload(randomUUID(),owner,meta);id=intent.id;
   const blob=await storage.put(intent.pathname,image);
   const result=await repo.finalize(id,blob.url);if(!result)throw new ApiError(410,'This upload has expired.');
   res.status(201).json(photo(result,owner));return;
  }
  ({uploadId:id}=z.object({uploadId:UUID}).strict().parse(req.body));
  await limit(req,res,repo,config,'gallery-finalize',60,3600,owner);
  const intent=await repo.upload(id);
  if(!intent||intent.owner_id!==owner)throw new ApiError(403,'This upload belongs to another browser.');
  const existing=await repo.gallery(id);
  if(existing){if(existing.deleted_at)throw new ApiError(410,'This photo has been deleted.');res.json(photo(existing,owner));return;}
  if(intent.state!=='pending'||new Date(intent.expires_at).getTime()<=Date.now())throw new ApiError(410,'This upload has expired. Please submit the photo again.');
  let url:string;
  try{
   const blob=await storage.head(intent.pathname);
   if(blob.pathname!==intent.pathname||blob.contentType.split(';')[0]!=='image/png')throw new ApiError(400,'A PNG image is required.');
   const bytes=await storage.read(blob);await validatePng(bytes);url=blob.url;
  }catch(error){
   if(error instanceof ApiError&&[400,413].includes(error.status)){
    await repo.rejectUpload(id);try{await storage.delete(intent.pathname);}catch{/* Daily cleanup retries rejected uploads. */}
   }
   throw error;
  }
  const result=await repo.finalize(id,url);if(!result)throw new ApiError(410,'This upload has expired.');
  res.status(201).json(photo(result,owner));
 }));
 app.get('/api/gallery/:id/image',asyncRoute(async(req,res)=>{
  const {config,repo,storage}=runtime();await limit(req,res,repo,config,'read',600,60);
  const id=UUID.parse(req.params.id),row=await repo.gallery(id);
  if(!row||row.deleted_at)throw new ApiError(404,'Photo not found.');
  const blob=await storage.head(row.blob_path);
  // A redirect preserves the existing image route without proxying large photos through a Function.
  res.redirect(307,req.query.download==='1'?blob.downloadUrl:blob.url);
 }));
 app.delete('/api/gallery/:id',asyncRoute(async(req,res)=>{
  const {config,repo,storage}=runtime();const admin=isAdmin(req,config);const owner=admin?null:guardWrite(req,config);
  await limit(req,res,repo,config,'delete',30,3600,owner);
  const id=UUID.parse(req.params.id),row=await repo.gallery(id);
  if(!row){
   const intent=await repo.upload(id);if(!intent)throw new ApiError(404,'Photo not found.');
   if(!admin&&intent.owner_id!==owner)throw new ApiError(403,'Only the browser that started this upload or an administrator can cancel it.');
   await repo.rejectUpload(id);
   try{await storage.delete(intent.pathname);res.json({ok:true});}catch{res.status(202).json({ok:true,pending:true});}
   return;
  }
  if(!admin&&row.owner_id!==owner)throw new ApiError(403,'Only the browser that saved this photo or an administrator can delete it.');
  await repo.deleteGallery(id);
  try{await storage.delete(row.blob_path);await repo.blobDeleted(id);res.json({ok:true});}
  catch{res.status(202).json({ok:true,pending:true});}
 }));
 app.get('/api/feedback',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();await limit(req,res,repo,config,'read',600,60);res.json(page(await repo.feedback(visitor(req,config),cursor(req)),res).map(review));
 }));
 app.post('/api/feedback',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();const owner=guardWrite(req,config);await limit(req,res,repo,config,'feedback',5,3600,owner);
  const input=feedbackSchema.parse(req.body);
  const result=await repo.createFeedback({...input,id:randomUUID(),owner,status:config.feedbackModeration==='manual'?'pending':'approved',fingerprint:createHash('sha256').update(`${input.message.normalize('NFKC').toLowerCase()}\n${input.rating}`).digest('hex')});
  if(!result)throw new ApiError(409,'You have already submitted this feedback.');res.status(201).json(review(result));
 }));
 app.post('/api/feedback/:id/like',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();const owner=guardWrite(req,config);await limit(req,res,repo,config,'like',60,3600,owner);
  const result=await repo.like(UUID.parse(req.params.id),owner);
  if(!result)throw new ApiError(404,'This feedback is not available for likes.');res.json(review(result));
 }));
 app.get('/api/admin/feedback',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();requireAdmin(req,config);const status=z.enum(['pending','approved','rejected']).parse(req.query.status||'pending');
  res.json((await repo.moderate(status)).map(review));
 }));
 app.patch('/api/admin/feedback/:id',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();requireAdmin(req,config);const {status}=z.object({status:z.enum(['pending','approved','rejected'])}).strict().parse(req.body);
  const result=await repo.setFeedbackStatus(UUID.parse(req.params.id),status);if(!result)throw new ApiError(404,'Feedback not found.');res.json(review(result));
 }));
 app.delete('/api/admin/feedback/:id',asyncRoute(async(req,res)=>{
  const {config,repo}=runtime();requireAdmin(req,config);const result=await repo.removeFeedback(UUID.parse(req.params.id));if(!result)throw new ApiError(404,'Feedback not found.');res.json({ok:true});
 }));
 app.get('/api/maintenance',asyncRoute(async(req,res)=>{
  const {config,repo,storage}=runtime();
  if(!hasBearer(req,config.cronSecret))throw new ApiError(401,'Maintenance authorization is required.');
  let deleted=0,expired=0,failed=0;
  for(const row of await repo.pendingDeletes())try{await storage.delete(String(row.blob_path));await repo.blobDeleted(String(row.id));deleted++;}catch{failed++;}
  for(const row of await repo.expiredUploads())try{await storage.delete(String(row.pathname));await repo.removeExpiredUpload(String(row.pathname));expired++;}catch{failed++;}
  await repo.cleanupRates();res.json({ok:failed===0,deleted,expired,failed});
 }));
 app.use('/api',(_req,res)=>{res.status(404).json({error:'API route not found.'});});
 app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(res.headersSent)return;
  if(error instanceof z.ZodError){res.status(400).json({error:'Invalid request. Check the required fields and allowed lengths.'});return;}
  if(error instanceof ApiError){res.status(error.status).json({error:error.message});return;}
  if(typeof error==='object'&&error!==null&&'type' in error){
   if(error.type==='entity.too.large'){res.status(413).json({error:'This request is too large. Gallery images up to 13 MB must use the direct upload flow.'});return;}
   if(error.type==='entity.parse.failed'){res.status(400).json({error:'Invalid JSON request.'});return;}
  }
  // Never log bodies, database connection strings, tokens, or photo bytes.
  const reference=randomUUID();console.error(`Pixel Booth API error ${reference}: ${error instanceof Error?error.name:'UnknownError'}`);
  res.status(503).json({error:'The storage service is temporarily unavailable. Please try again.',reference});
 });
 return app;
}
