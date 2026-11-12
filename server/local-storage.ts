import {mkdir,readFile,writeFile,stat,rm,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {ApiError,MAX_PHOTO_BYTES} from './config.js';
import type {PhotoStorage} from './blob.js';

export function localStorage(directory:string):PhotoStorage {
 const root=path.resolve(directory);
 function file(pathname:string){
  if(!/^gallery\/[0-9a-f-]{36}\.png$/.test(pathname))throw new ApiError(400,'Invalid photo path.');
  return path.join(root,pathname);
 }
 return {
  async health(){await mkdir(path.join(root,'gallery'),{recursive:true});await access(root,constants.R_OK|constants.W_OK);},
  async put(pathname,image){
   if(image.length>MAX_PHOTO_BYTES)throw new ApiError(413,'The photo is too large (13 MB maximum).');
   const target=file(pathname);await mkdir(path.dirname(target),{recursive:true});
   await writeFile(target,image,{flag:'wx'});return this.head(pathname);
  },
  async head(pathname){
   try{
    const info=await stat(file(pathname));
    return {pathname,url:`local:${pathname}`,downloadUrl:`local:${pathname}`,contentType:'image/png',size:info.size};
   }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new ApiError(404,'Photo not found.');throw error;}
  },
  async read(blob){if(blob.size>MAX_PHOTO_BYTES)throw new ApiError(413,'The photo is too large (13 MB maximum).');return readFile(file(blob.pathname));},
  async delete(pathname){await rm(file(pathname),{force:true});},
 };
}
