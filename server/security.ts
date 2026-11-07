import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import type {Request,Response} from 'express';
import {ApiError,SESSION_COOKIE,SESSION_SECONDS,UUID,type Config} from './config.js';
import type {Repository} from './db/repository.js';

export function digest(config:Config,value:string){return createHmac('sha256',config.sessionSecret).update(value).digest('hex');}
function equal(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function visitor(request:Request,config:Config):string|null {
 const value=request.headers.cookie?.split(';').map(item=>item.trim()).find(item=>item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length+1);
 if(!value)return null;
 const [id,issued,signature,...rest]=value.split('.');
 const age=Date.now()/1000-Number(issued);
 if(rest.length||!UUID.safeParse(id).success||!Number.isInteger(Number(issued))||age< -300||age>SESSION_SECONDS||!signature||!equal(signature,digest(config,`${id}.${issued}`)))return null;
 return id;
}
export function session(request:Request,response:Response,config:Config){
 const existing=visitor(request,config);if(existing)return existing;
 const id=randomUUID(),issued=String(Math.floor(Date.now()/1000));
 response.cookie(SESSION_COOKIE,`${id}.${issued}.${digest(config,`${id}.${issued}`)}`,{httpOnly:true,secure:config.secureCookies,sameSite:'lax',path:'/',maxAge:SESSION_SECONDS*1000});
 return id;
}
export function hasBearer(request:Request,secret:string){const auth=request.get('authorization');return Boolean(secret&&auth?.startsWith('Bearer ')&&equal(auth.slice(7),secret));}
export function isAdmin(request:Request,config:Config){return hasBearer(request,config.adminToken);}
export function requireAdmin(request:Request,config:Config){if(!isAdmin(request,config))throw new ApiError(401,'Administrator authorization is required.');}
export function guardWrite(request:Request,config:Config):string {
 if(!config.origins.has(request.get('origin')||'')||request.get('x-pixel-booth')!=='1')throw new ApiError(403,'This request must come from the Pixel Booth website.');
 const owner=visitor(request,config);if(!owner)throw new ApiError(401,'Your browser session has expired. Refresh the page and try again.');
 return owner;
}
function address(request:Request,config:Config){
 const forwarded=config.vercel?(request.get('x-vercel-forwarded-for')||request.get('x-forwarded-for'))?.split(',')[0].trim():undefined;
 return forwarded&&isIP(forwarded)?forwarded:request.socket.remoteAddress||'unknown';
}
export async function limit(request:Request,response:Response,repo:Repository,config:Config,scope:string,max:number,seconds:number,owner?:string|null){
 for(const identity of [`ip:${address(request,config)}`,...(owner?[`owner:${owner}`]:[])]){
  const result=await repo.rate(digest(config,`${scope}:${identity}`),seconds);
  if(result.used>max){response.set('Retry-After',String(Math.max(1,Math.ceil((result.expiresAt.getTime()-Date.now())/1000))));throw new ApiError(429,'Too many requests. Please wait before trying again.');}
 }
}
