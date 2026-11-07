import type {FeedbackRecord,GalleryRecord} from './types';

class ApiClientError extends Error {constructor(message:string,public status:number){super(message);}}
let sessionPromise:Promise<{ok:boolean;maxPhotoBytes:number}>|undefined;
async function request<T>(url:string,init?:RequestInit):Promise<{data:T;response:Response}>{
 let response:Response;
 try{response=await fetch(url,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Pixel-Booth':'1',...init?.headers}});}
 catch{throw new ApiClientError('Cannot connect to the server. Check your connection and try again.',0);}
 const data=await response.json().catch(()=>({error:'Unexpected response from the server.'}));
 if(!response.ok)throw new ApiClientError(data.error||`Request failed (${response.status})`,response.status);
 return {data:data as T,response};
}
function ensureSession(){
 return sessionPromise??=request<{ok:boolean;maxPhotoBytes:number}>('/api/session').then(result=>result.data).catch(error=>{sessionPromise=undefined;throw error;});
}
async function json<T>(url:string,init?:RequestInit):Promise<T>{await ensureSession();return (await request<T>(url,init)).data;}
async function listAll<T extends {id:string}>(url:string):Promise<T[]>{
 await ensureSession();const items=new Map<string,T>();const seen=new Set<string>();let cursor:string|null=null;
 do{
  const result:{data:T[];response:Response}=await request<T[]>(`${url}${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);
  for(const item of result.data)items.set(item.id,item);
  cursor=result.response.headers.get('X-Next-Cursor');
  if(cursor){if(seen.has(cursor))throw new Error('The server returned an invalid page cursor.');seen.add(cursor);}
 }while(cursor);
 return [...items.values()];
}
export const galleryApi={
 list:()=>listAll<GalleryRecord>('/api/gallery'),
 save:async(input:{title:string;kind:'plain'|'meme';layout:string;dataUrl:string}):Promise<GalleryRecord>=>{
  const session=await ensureSession();
  const image=await fetch(input.dataUrl).then(response=>response.blob());
  if(image.type!=='image/png'||image.size>session.maxPhotoBytes)throw new Error('Gallery photos must be PNG images up to 13 MB.');
  const prepared=await json<{uploadId:string;pathname:string}>('/api/gallery/prepare',{method:'POST',body:JSON.stringify({title:input.title,kind:input.kind,layout:input.layout})});
  const {upload}=await import('@vercel/blob/client');
  await upload(prepared.pathname,image,{access:'public',contentType:'image/png',handleUploadUrl:'/api/gallery/upload',clientPayload:JSON.stringify({uploadId:prepared.uploadId}),headers:{'X-Pixel-Booth':'1'}});
  for(let attempt=0;;attempt++){
   try{return await json<GalleryRecord>('/api/gallery',{method:'POST',body:JSON.stringify({uploadId:prepared.uploadId})});}
   catch(error){if(!(error instanceof ApiClientError)||![0,409,503].includes(error.status)||attempt>=2)throw error;await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));}
  }
 },
 delete:(id:string)=>json<{ok:boolean}>(`/api/gallery/${encodeURIComponent(id)}`,{method:'DELETE'})
};
export const feedbackApi={
 list:()=>listAll<FeedbackRecord>('/api/feedback'),
 create:(input:{name:string;message:string;rating:number})=>json<FeedbackRecord>('/api/feedback',{method:'POST',body:JSON.stringify(input)}),
 like:(id:string)=>json<FeedbackRecord>(`/api/feedback/${encodeURIComponent(id)}/like`,{method:'POST'})
};
