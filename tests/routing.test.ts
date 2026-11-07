import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {getTransformedRoutes} from '@vercel/routing-utils';

test('Vercel rewrites validate and the SPA fallback cannot capture API or static asset paths',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 const transformed=getTransformedRoutes(config);assert.equal(transformed.error,null);
 const rules=transformed.routes?.filter(route=>'dest' in route)??[];
 const resolve=(pathname:string)=>rules.find(route=>new RegExp(route.src!).test(pathname));
 for(const path of ['/api/health','/api/gallery','/api/gallery/00000000-0000-4000-8000-000000000001/image','/api/feedback/x/like','/api/does-not-exist'])assert.equal(new URL(resolve(path)?.dest||'','https://example.test').pathname,'/api');
 for(const path of ['/','/layouts','/layouts/meme','/booth','/decorate','/gallery','/feedback','/privacy','/terms','/cookies'])assert.equal(new URL(resolve(path)?.dest||'','https://example.test').pathname,'/index.html');
 for(const path of ['/assets/test.js','/fonts/arcadeclassic.ttf'])assert.equal(resolve(path),undefined);
 assert.equal(config.framework,'vite');assert.equal(config.outputDirectory,'dist');
 assert.ok(config.headers.flatMap((rule:{headers:{key:string;value:string}[]})=>rule.headers).some((header:{key:string;value:string})=>header.key==='Permissions-Policy'&&header.value.includes('camera=(self)')));
});
test('production prebuild refuses a missing font instead of silently changing the design',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pixel-booth-font-test-'));
 try{
  const script=fileURLToPath(new URL('../scripts/prepare-assets.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script],{cwd:directory,encoding:'utf8',env:{...process.env,ARCADE_FONT_URL:'',ARCADE_FONT_BASE64:''}});
  assert.equal(result.status,1);assert.match(result.stderr,/font is missing/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('font provisioning rejects invalid data, a different font and insecure remote sources without writing an asset',async()=>{
 const script=fileURLToPath(new URL('../scripts/prepare-assets.mjs',import.meta.url));
 const differentFont=Buffer.alloc(12);differentFont.writeUInt32BE(0x00010000);
 for(const [source,expected] of [
  [{ARCADE_FONT_BASE64:'not-a-font!'},/Base64-encoded/],
  [{ARCADE_FONT_BASE64:differentFont.toString('base64')},/does not match/],
  [{ARCADE_FONT_URL:'http://example.test/font.ttf'},/must use HTTPS/],
 ] as const){
  const directory=await mkdtemp(path.join(tmpdir(),'pixel-booth-font-invalid-'));
  try{
   const env=Object.assign({},process.env,{ARCADE_FONT_URL:'',ARCADE_FONT_BASE64:''},source);
   const result=spawnSync(process.execPath,[script],{cwd:directory,encoding:'utf8',env});
   assert.equal(result.status,1);assert.match(result.stderr,expected);
   await assert.rejects(readFile(path.join(directory,'public/fonts/arcadeclassic.ttf')),{code:'ENOENT'});
  }finally{await rm(directory,{recursive:true,force:true});}
 }
});
