import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
const target='public/fonts/arcadeclassic.ttf';
if(!existsSync(target)&&process.env.ARCADE_FONT_URL){
 const url=new URL(process.env.ARCADE_FONT_URL);
 if(url.protocol!=='https:')throw Error('ARCADE_FONT_URL must use HTTPS.');
 const response=await fetch(url,{signal:AbortSignal.timeout(20_000)});
 if(!response.ok)throw Error('The configured font asset could not be downloaded.');
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length<4||data.length>2*1024*1024||!(data.readUInt32BE(0)===0x00010000||data.subarray(0,4).toString()==='OTTO'))throw Error('The configured font is not a supported font file.');
 mkdirSync('public/fonts',{recursive:true});writeFileSync(target,data);
}
if(!existsSync(target))throw Error('The existing Arcade Classic font is missing. Deploy the local checkout with Vercel CLI, or configure ARCADE_FONT_URL for Git builds. See DEPLOYMENT.md.');
console.log('Existing Pixel Booth font is available.');
