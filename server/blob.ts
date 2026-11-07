import {put,head,del,list,BlobNotFoundError} from '@vercel/blob';
import {ApiError,MAX_PHOTO_BYTES} from './config.js';

export interface BlobInfo {url:string;downloadUrl:string;pathname:string;contentType:string;size:number;}
export interface PhotoStorage {
 health:()=>Promise<void>;
 put:(pathname:string,image:Buffer)=>Promise<BlobInfo>;
 head:(pathname:string)=>Promise<BlobInfo>;
 read:(blob:BlobInfo)=>Promise<Buffer>;
 delete:(pathname:string)=>Promise<void>;
}
export function vercelStorage(token:string):PhotoStorage {
 return {
  async health(){await list({token,limit:1});},
  async put(pathname,image){const blob=await put(pathname,image,{token,access:'public',contentType:'image/png',addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60});return {...blob,size:image.length};},
  async head(pathname){try{return await head(pathname,{token});}catch(error){if(error instanceof BlobNotFoundError)throw new ApiError(404,'Photo not found.');throw error;}},
  async read(blob){
   if(blob.size>MAX_PHOTO_BYTES)throw new ApiError(413,'The photo is too large (13 MB maximum).');
   const url=new URL(blob.url);
   if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com'))throw new ApiError(400,'The photo must come from the configured Blob store.');
   const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20_000),cache:'no-store'});
   if(!response.ok||!response.body)throw new ApiError(503,'The uploaded image could not be read. Please retry.');
   const parts:Uint8Array[]=[];let bytes=0;
   const reader=response.body.getReader();
   try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>MAX_PHOTO_BYTES){await reader.cancel();throw new ApiError(413,'The photo is too large (13 MB maximum).');}parts.push(part.value);}}finally{reader.releaseLock();}
   return Buffer.concat(parts);
  },
  async delete(pathname){await del(pathname,{token});},
 };
}
