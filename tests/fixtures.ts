import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import sharp from 'sharp';
import {getConfig,ApiError} from '../server/config.js';
import {Repository,type Row} from '../server/db/repository.js';
import type {BlobInfo,PhotoStorage} from '../server/blob.js';
import {createApp,type Dependencies} from '../server/app.js';

export const testConfig=getConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/pixel_booth',BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_teststore_testonlynotasecret',SESSION_SECRET:'test-session-secret-only-for-isolated-tests-123456789',ADMIN_API_TOKEN:'test-admin-token-only-for-isolated-tests-123456789',CRON_SECRET:'test-cron-secret-only-for-isolated-tests-123456789',APP_ORIGIN:'http://localhost:5173',FEEDBACK_MODERATION:'manual'});
export class MemoryPhotos implements PhotoStorage {
 objects=new Map<string,Buffer>();failDelete=false;origin='https://teststore.public.blob.vercel-storage.com';
 async health(){}
 async put(pathname:string,image:Buffer){if(this.objects.has(pathname))throw Error('Blob already exists');this.objects.set(pathname,image);return this.head(pathname);}
 async head(pathname:string):Promise<BlobInfo>{const image=this.objects.get(pathname);if(!image)throw new ApiError(404,'Photo not found.');const url=`${this.origin}/${pathname}`;return {pathname,url,downloadUrl:`${url}?download=1`,size:image.length,contentType:'image/png'};}
 async read(blob:BlobInfo){return this.objects.get(blob.pathname)!;}
 async delete(pathname:string){if(this.failDelete)throw Error('Test deletion failure');this.objects.delete(pathname);}
}
export async function fixture(){
 const db=new PGlite();await db.exec(await readFile(new URL('../server/db/schema.sql',import.meta.url),'utf8'));
 const repo=new Repository(async(text,params=[])=>{const result=await db.query(text,params);return result.rows as Row[];});
 const storage=new MemoryPhotos();const dependencies:Dependencies={config:testConfig,repo,storage};
 return {db,repo,storage,dependencies,app:createApp(dependencies),reset:async()=>{await db.exec('TRUNCATE feedback_likes,feedback,gallery,upload_intents,rate_limits CASCADE');storage.objects.clear();storage.failDelete=false;}};
}
export async function png(){return sharp({create:{width:32,height:48,channels:4,background:'#ffd7e5'}}).png().toBuffer();}
export const meta={title:'Test memory',kind:'meme' as const,layout:'meme-2x2'};
