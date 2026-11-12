import {z} from 'zod';

export const MAX_PHOTO_BYTES=13*1024*1024;
export const MAX_IMAGE_PIXELS=16_000_000;
export const SESSION_COOKIE='pixel-booth-session';
export const SESSION_SECONDS=365*24*60*60;
export const UUID=z.uuid();
export class ApiError extends Error {
 constructor(public status:number,message:string){super(message);this.name='ApiError';}
}
export interface Config {
 databaseUrl:string;blobToken:string;sessionSecret:string;adminToken:string;cronSecret:string;
 database:'mysql'|'postgresql';photoStorage:'local'|'vercel-blob';photoDirectory:string;
 origins:Set<string>;secureCookies:boolean;vercel:boolean;feedbackModeration:'manual'|'auto';
}
const secret=z.string().min(32).refine(value=>!/replace|changeme|your-secret/i.test(value));
export function getConfig(env:NodeJS.ProcessEnv=process.env):Config {
 const parsed=z.object({
  DATABASE_URL:z.url().refine(value=>/^(mysql|postgres|postgresql):\/\//.test(value)),
  PHOTO_STORAGE:z.enum(['local','vercel-blob']).default('vercel-blob'),
  BLOB_READ_WRITE_TOKEN:z.string().default(''),SESSION_SECRET:secret,
  ADMIN_API_TOKEN:secret,CRON_SECRET:secret,
  APP_ORIGIN:z.url(),FEEDBACK_MODERATION:z.enum(['manual','auto']).default('manual'),
 }).safeParse({...env,DATABASE_URL:env.DATABASE_URL||env.POSTGRES_URL,APP_ORIGIN:env.APP_ORIGIN||(env.VERCEL_PROJECT_PRODUCTION_URL?`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`:'http://localhost:5173')});
 if(!parsed.success)throw new ApiError(503,'Server storage is not configured. For local MySQL, run npm run setup:local. See LOCAL_SETUP.md.');
 const values=parsed.data;const origin=new URL(values.APP_ORIGIN);
 if(values.PHOTO_STORAGE==='vercel-blob'&&values.BLOB_READ_WRITE_TOKEN.length<20)throw new ApiError(503,'Configure BLOB_READ_WRITE_TOKEN or use PHOTO_STORAGE=local for local development. See LOCAL_SETUP.md.');
 if(values.PHOTO_STORAGE==='local'&&env.VERCEL==='1')throw new ApiError(503,'Local photo storage requires a persistent server filesystem and cannot run on Vercel.');
 if((env.NODE_ENV==='production'||env.VERCEL==='1')&&origin.protocol!=='https:')throw new ApiError(503,'APP_ORIGIN must use HTTPS in production.');
 const origins=new Set([origin.origin]);
 for(const hostname of [env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL]){
  if(hostname&&/^[a-zA-Z0-9.-]+$/.test(hostname))origins.add(`https://${hostname}`);
 }
 if(env.NODE_ENV!=='production'&&env.VERCEL!=='1')for(const url of ['http://localhost:5173','http://127.0.0.1:5173','http://localhost:3001','http://127.0.0.1:3001'])origins.add(url);
 return {databaseUrl:values.DATABASE_URL,database:values.DATABASE_URL.startsWith('mysql:')?'mysql':'postgresql',photoStorage:values.PHOTO_STORAGE,photoDirectory:env.PHOTO_DIRECTORY||'server/data/photos',blobToken:values.BLOB_READ_WRITE_TOKEN,sessionSecret:values.SESSION_SECRET,adminToken:values.ADMIN_API_TOKEN,cronSecret:values.CRON_SECRET,origins,secureCookies:origin.protocol==='https:'||env.VERCEL==='1',vercel:env.VERCEL==='1',feedbackModeration:values.FEEDBACK_MODERATION};
}
