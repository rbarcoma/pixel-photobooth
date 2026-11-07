// Isolated browser QA service: real PostgreSQL semantics with in-memory test photos.
// This file is excluded from Vercel uploads and is never used by the production handler.
import express from 'express';
import {getPayloadFromClientToken} from '@vercel/blob/client';
import {fixture} from './fixtures.js';
import {ApiError,MAX_PHOTO_BYTES} from '../server/config.js';
const f=await fixture();const port=3101;
f.dependencies.config.origins.add('http://127.0.0.1:5180');f.dependencies.config.origins.add('http://localhost:5180');
f.storage.origin=`http://127.0.0.1:${port}/api/__test/blob`;
const app=express();
app.put('/api/__test/blob',express.raw({type:()=>true,limit:MAX_PHOTO_BYTES}),async(req,res)=>{
 try{
  const token=req.get('authorization')?.replace(/^Bearer /,'');if(!token)throw Error('Test upload token missing');
  const payload=getPayloadFromClientToken(token);const pathname=payload.pathname;
  if(!/^gallery\/[a-f0-9-]{36}\.png$/.test(pathname))throw Error('Unexpected test pathname');
  const blob=await f.storage.put(pathname,req.body as Buffer);res.json({...blob,contentDisposition:`inline; filename="${pathname.split('/').at(-1)}"`});
 }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Test upload failed'});}
});
app.get('/api/__test/blob/*',async(req,res)=>{
 try{const pathname=(req.params as Record<string,string>)['0'];const image=f.storage.objects.get(pathname);if(!image)throw new ApiError(404,'Image not found');if(req.query.download==='1')res.set('Content-Disposition','attachment; filename="pixel-booth.png"');res.type('png').send(image);}
 catch{res.status(404).end();}
});
app.use(f.app);
const server=app.listen(port,'127.0.0.1',()=>console.log(`Isolated Pixel Booth test API: http://127.0.0.1:${port}`));
async function close(){server.close();await f.db.close();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
