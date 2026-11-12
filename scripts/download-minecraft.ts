import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {minecraftStickers} from '../src/lib/minecraft-stickers.js';

await mkdir('public/assets/stickers/minecraft',{recursive:true});
// Fetch in small batches; save the API's original PNG bytes without flattening
// their alpha channel or altering the pixel artwork.
for(let offset=0;offset<minecraftStickers.length;offset+=4){
 const results=await Promise.allSettled(minecraftStickers.slice(offset,offset+4).map(async sticker=>{
  const response=await fetch(sticker.sourceUrl,{signal:AbortSignal.timeout(60_000)});
  if(!response.ok)throw Error(`${sticker.name}: Block Render returned ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const image=sharp(bytes),metadata=await image.metadata(),stats=await image.stats();
  if(metadata.format!=='png'||metadata.width!==512||metadata.height!==512||!metadata.hasAlpha||stats.channels[3]?.min!==0)throw Error(`${sticker.name}: expected a transparent 512px PNG`);
  await writeFile(`public${sticker.src}`,bytes);console.log(`Saved ${sticker.name} (transparent PNG).`);
 }));
 const failures=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected');
 if(failures.length)throw new AggregateError(failures.map(result=>result.reason),'Minecraft sticker download failed.');
}
