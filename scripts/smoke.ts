import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {put} from '@vercel/blob/client';
const site=process.argv[2];if(!site)throw Error('Usage: npm run smoke -- https://your-site.vercel.app [--write]');
const base=new URL(site);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Production smoke tests require HTTPS.');
const origin=base.origin;let cookie='';
const bypass:Record<string,string>=process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
const siteFetch=(path:string)=>fetch(new URL(path,base),{headers:bypass});
async function api(path:string,method='GET',body?:unknown,admin=false){
 const response=await fetch(new URL(path,base),{method,headers:{...bypass,'Content-Type':'application/json','X-Pixel-Booth':'1',Origin:origin,...(cookie?{Cookie:cookie}:{}),...(admin?{Authorization:`Bearer ${process.env.ADMIN_API_TOKEN}`}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 const next=response.headers.getSetCookie().find(value=>value.startsWith('pixel-booth-session='));if(next)cookie=next.split(';')[0];
 return response;
}
for(const path of ['/','/layouts','/layouts/meme','/booth','/decorate','/gallery','/feedback','/privacy','/terms','/cookies']){const response=await siteFetch(path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type')||'',/text\/html/,path);}
const font=await siteFetch('/fonts/arcadeclassic.ttf');assert.equal(font.status,200,'Existing font is missing');assert.ok((await font.arrayBuffer()).byteLength>1000);
const health=await api('/api/health');assert.equal(health.status,200,'Cloud storage health failed');assert.equal((await health.json()).ok,true);
const session=await api('/api/session');assert.equal(session.status,200);assert.ok(cookie,'Ownership cookie missing');if(base.protocol==='https:')assert.match(session.headers.get('set-cookie')||'',/Secure/,'Production ownership cookie is not Secure');
assert.equal((await api('/api/not-a-route')).status,404,'Unknown API path fell through to SPA');
for(const path of ['/api/gallery','/api/feedback']){const response=await api(path);assert.equal(response.status,200);assert.ok(Array.isArray(await response.json()));}
console.log(`PASS: ${base.protocol==='https:'?'HTTPS':'Local HTTP'} pages/deep links, font, API health, session, gallery/feedback reads and API 404 isolation.`);
if(process.argv.includes('--write')){
 if(process.env.SMOKE_ALLOW_WRITES!=='true'||!process.env.ADMIN_API_TOKEN)throw Error('Write checks create temporary test content and clean it up. Set SMOKE_ALLOW_WRITES=true and ADMIN_API_TOKEN to run them.');
 assert.equal((await api('/api/admin/feedback?status=pending','GET',undefined,true)).status,200,'Admin authorization must be verified before write tests');
 const tag=`Deployment smoke ${Date.now()}`;let photoId:string|undefined,noteId:string|undefined;
 try{
  const preparedResponse=await api('/api/gallery/prepare','POST',{title:tag,kind:'plain',layout:'plain-2'});assert.equal(preparedResponse.status,201);const prepared=await preparedResponse.json();photoId=prepared.uploadId;
  const tokenResponse=await api('/api/gallery/upload','POST',{type:'blob.generate-client-token',payload:{pathname:prepared.pathname,clientPayload:JSON.stringify({uploadId:photoId}),multipart:false}});assert.equal(tokenResponse.status,200);const {clientToken}=await tokenResponse.json();
  const image=await sharp(randomBytes(2048*768*4),{raw:{width:2048,height:768,channels:4}}).png().toBuffer();assert.ok(image.length>4.5*1024*1024);
  await put(prepared.pathname,image,{token:clientToken,access:'public',contentType:'image/png'});
  const finalized=await api('/api/gallery','POST',{uploadId:photoId});assert.equal(finalized.status,201);const photo=await finalized.json();assert.equal(photo.canDelete,true);
  const imageResponse=await api(photo.imageUrl);assert.equal(imageResponse.status,307);const downloaded=await fetch(imageResponse.headers.get('location')!);assert.equal(downloaded.status,200);assert.ok(Buffer.from(await downloaded.arrayBuffer()).equals(image));
  const noteResponse=await api('/api/feedback','POST',{name:'Deployment test',message:`Automated verification ${tag}.`,rating:5});assert.equal(noteResponse.status,201);const note=await noteResponse.json();noteId=note.id;
  assert.equal((await api(`/api/admin/feedback/${noteId}`,'PATCH',{status:'approved'},true)).status,200);
  const first=await api(`/api/feedback/${noteId}/like`,'POST');assert.equal(first.status,200);const liked=await first.json();const second=await api(`/api/feedback/${noteId}/like`,'POST');assert.equal((await second.json()).likes,liked.likes);
  const ownerCookie=cookie;cookie='';await api('/api/session');assert.equal((await api(`/api/gallery/${photoId}`,'DELETE')).status,403);cookie=ownerCookie;
  console.log('PASS: real Blob upload over 4.5 MB, PNG retrieval, database writes, ownership checks, feedback moderation and idempotent likes.');
 }finally{
  const failures:string[]=[];
  if(noteId)try{const response=await api(`/api/admin/feedback/${noteId}`,'DELETE',undefined,true);if(response.status!==200)failures.push('Test feedback cleanup failed.');}catch{failures.push('Test feedback cleanup failed.');}
  if(photoId)try{const response=await api(`/api/gallery/${photoId}`,'DELETE',undefined,true);if(![200,404].includes(response.status))failures.push('Test photo deletion is pending or failed; verify authorized maintenance cleanup.');}catch{failures.push('Test photo cleanup failed.');}
  if(failures.length)throw Error(failures.join(' '));
 }
}
