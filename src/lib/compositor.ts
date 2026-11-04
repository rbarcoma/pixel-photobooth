import type {Draft,BoothLayout,FilterName,StickerOverlay,TextOverlay} from './types';
import {getLayoutInfo} from './types';
import {BODY_FONT_FAMILY,PIXEL_FONT_FAMILY,loadBodyFont,loadPixelFont} from './fonts';

export interface Composition {width:number;height:number;frameRects:{x:number;y:number;w:number;h:number}[];memeRects:{x:number;y:number;w:number;h:number}[];footerY:number;}
export function getComposition(layout:BoothLayout):Composition{
 const info=getLayoutInfo(layout);
 const isMeme=layout.startsWith('meme-');
 const isStrip=!isMeme&&info.cols===1;
 const margin=isStrip?39:42, gap=isStrip?19:23, header=isStrip?62:78, footer=isStrip?105:128;
 const cellW=isStrip?360:isMeme?365:info.cols===3?315:415;
 const cellH=isStrip?292:isMeme?305:info.cols===3?335:385;
 const cols=isMeme?2:info.cols;
 const width=margin*2+cols*cellW+(cols-1)*gap;
 const height=header+info.rows*cellH+(info.rows-1)*gap+footer;
 const frameRects=[] as Composition['frameRects'];const memeRects=[] as Composition['memeRects'];
 for(let i=0;i<info.count;i++){
  const row=isMeme?i:Math.floor(i/cols),col=isMeme?0:i%cols;
  frameRects.push({x:margin+col*(cellW+gap),y:header+row*(cellH+gap),w:cellW,h:cellH});
  if(isMeme)memeRects.push({x:margin+cellW+gap,y:header+row*(cellH+gap),w:cellW,h:cellH});
 }
 return {width,height,frameRects,memeRects,footerY:height-footer};
}
const cache=new Map<string,Promise<HTMLImageElement>>();
export function loadImage(src:string):Promise<HTMLImageElement>{
 if(!cache.has(src)) cache.set(src,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{cache.delete(src);reject(Error(`Could not load image: ${src}`));};img.src=src;}));
 return cache.get(src)!;
}
export function drawCover(ctx:CanvasRenderingContext2D,img:CanvasImageSource,rect:{x:number;y:number;w:number;h:number},mirror=false){
 const dimensions=img as HTMLImageElement;const iw=dimensions.naturalWidth||dimensions.width,ih=dimensions.naturalHeight||dimensions.height;
 if(!iw||!ih)return;
 const scale=Math.max(rect.w/iw,rect.h/ih);const w=iw*scale,h=ih*scale;
 ctx.save();ctx.beginPath();ctx.rect(rect.x,rect.y,rect.w,rect.h);ctx.clip();
 if(mirror){ctx.translate(2*rect.x+rect.w,0);ctx.scale(-1,1);}
 ctx.drawImage(img,rect.x+(rect.w-w)/2,rect.y+(rect.h-h)/2,w,h);ctx.restore();
}
const filterMap:Record<FilterName,string>={
 original:'none',bnw:'grayscale(1) contrast(1.17)',retro:'sepia(.68) saturate(1.35) contrast(1.07)',soft:'saturate(.75) brightness(1.11) contrast(.91)',warm:'sepia(.25) saturate(1.22) brightness(1.06)',cool:'hue-rotate(19deg) saturate(.80) contrast(1.06)',pixel:'contrast(1.12) saturate(1.12)'
};
function drawPhoto(ctx:CanvasRenderingContext2D,img:HTMLImageElement,rect:{x:number;y:number;w:number;h:number},filter:FilterName){
 ctx.save();ctx.filter=filterMap[filter];
 if(filter==='pixel'){
  const tiny=document.createElement('canvas');tiny.width=75;tiny.height=65;
  const t=tiny.getContext('2d')!;drawCover(t,img,{x:0,y:0,w:tiny.width,h:tiny.height});
  ctx.imageSmoothingEnabled=false;ctx.drawImage(tiny,rect.x,rect.y,rect.w,rect.h);
 }else drawCover(ctx,img,rect);
 ctx.restore();
}
function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawPlaceholder(ctx:CanvasRenderingContext2D,rect:{x:number;y:number;w:number;h:number},index:number){
 ctx.fillStyle='#fffaf5';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
 ctx.fillStyle='#eee6e2';ctx.fillRect(rect.x+rect.w/2-18,rect.y+rect.h/2-30,36,36);
 ctx.fillStyle='#afa2ab';ctx.textAlign='center';ctx.font=`18px ${BODY_FONT_FAMILY}`;ctx.fillText(`PHOTO ${index+1}`,rect.x+rect.w/2,rect.y+rect.h/2+42);
}
export async function renderComposition(canvas:HTMLCanvasElement,draft:Draft,selectedId?:string){
 await Promise.all([loadPixelFont(),loadBodyFont()]);
 const composition=getComposition(draft.layout);
 canvas.width=composition.width;canvas.height=composition.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas is not available.');
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle=draft.frameColor;ctx.fillRect(0,0,canvas.width,canvas.height);
 const dark=['#3d3b4d','#24202c'].includes(draft.frameColor.toLowerCase());
 const ink=dark?'#fffaf5':'#65566c';
 ctx.textAlign='center';ctx.fillStyle=ink;ctx.font=`22px ${PIXEL_FONT_FAMILY}`;
 ctx.fillText('PIXEL  BOOTH  ★',canvas.width/2,39);
 for(let i=0;i<composition.frameRects.length;i++){
  const rect=composition.frameRects[i];const src=draft.shots[i];
  ctx.fillStyle='#ffffff';roundedRect(ctx,rect.x-6,rect.y-6,rect.w+12,rect.h+12,4);ctx.fill();
  if(src){try{drawPhoto(ctx,await loadImage(src),rect,draft.filter);}catch{drawPlaceholder(ctx,rect,i);}}else drawPlaceholder(ctx,rect,i);
  if(draft.kind==='meme'){
   const memeRect=composition.memeRects[i];const memeSrc=draft.memeImages[i];
   ctx.fillStyle='#ffffff';roundedRect(ctx,memeRect.x-6,memeRect.y-6,memeRect.w+12,memeRect.h+12,4);ctx.fill();
   if(memeSrc){try{drawPhoto(ctx,await loadImage(memeSrc),memeRect,draft.filter);}catch{drawPlaceholder(ctx,memeRect,i);}}else drawPlaceholder(ctx,memeRect,i);
  }
 }
 // All stickers and text are positioned by canvas-relative coordinates so previews and exports match.
 for(const sticker of draft.stickers)await drawSticker(ctx,sticker,composition,selectedId);
 for(const overlay of draft.texts)drawText(ctx,overlay,composition,selectedId);
 ctx.textAlign='center';ctx.fillStyle=ink;ctx.font=`18px ${BODY_FONT_FAMILY}`;
 ctx.fillText('a little moment, forever yours',canvas.width/2,composition.footerY+44);
 if(draft.showDate){const label=new Date(draft.dateTaken).toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}).toUpperCase();ctx.font=`16px ${BODY_FONT_FAMILY}`;ctx.fillText(label,canvas.width/2,composition.footerY+75);}
 ctx.font=`22px ${BODY_FONT_FAMILY}`;ctx.fillText('✦    ♡    ✦',canvas.width/2,composition.height-17);
}
async function drawSticker(ctx:CanvasRenderingContext2D,sticker:StickerOverlay,layout:Composition,selectedId?:string){
 try{
  const img=await loadImage(sticker.src);const w=sticker.size*layout.width;const h=w*(img.naturalHeight/img.naturalWidth);const x=sticker.x*layout.width,y=sticker.y*layout.height;
  ctx.save();ctx.translate(x,y);ctx.rotate(sticker.rotation*Math.PI/180);ctx.drawImage(img,-w/2,-h/2,w,h);
  if(selectedId===sticker.id){ctx.setLineDash([12,8]);ctx.strokeStyle='#f0679d';ctx.lineWidth=4;ctx.strokeRect(-w/2,-h/2,w,h);}
  ctx.restore();
 }catch{/* Skip a missing sticker without losing the rest of the photo. */}
}
function drawText(ctx:CanvasRenderingContext2D,item:TextOverlay,layout:Composition,selectedId?:string){
 const x=item.x*layout.width,y=item.y*layout.height;
 ctx.save();ctx.translate(x,y);ctx.rotate(item.rotation*Math.PI/180);
 ctx.font=`${item.size}px ${BODY_FONT_FAMILY}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#ffffff';ctx.strokeText(item.value,0,0,layout.width*.86);ctx.fillStyle=item.color;ctx.fillText(item.value,0,0,layout.width*.86);
 if(selectedId===item.id){const w=Math.min(ctx.measureText(item.value).width,layout.width*.86);ctx.strokeStyle='#f0679d';ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.strokeRect(-w/2-12,-item.size/2-12,w+24,item.size+24);}
 ctx.restore();
}
export function identifyOverlay(draft:Draft,x:number,y:number):string|null{
 const layout=getComposition(draft.layout);
 for(const item of [...draft.texts].reverse()){
  const w=Math.min(item.value.length*item.size*.78,layout.width*.86)/layout.width,h=(item.size+30)/layout.height;
  if(Math.abs(x-item.x)<w/2+.02&&Math.abs(y-item.y)<h/2+.02)return item.id;
 }
 for(const item of [...draft.stickers].reverse()){
  const w=item.size,h=item.size*layout.width/layout.height;
  if(Math.abs(x-item.x)<w/2+.02&&Math.abs(y-item.y)<h/2+.02)return item.id;
 }
 return null;
}
export function canvasPng(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not save the image.')),'image/png'));}
export function downloadBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);}
export function fileToDataUrl(file:File):Promise<string>{return new Promise((resolve,reject)=>{if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){reject(Error('Please select a PNG, JPEG, WEBP or GIF image.'));return;}if(file.size>15_000_000){reject(Error('The image is too large (15MB max).'));return;}const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Unable to read file.'));reader.readAsDataURL(file);});}
export function makeFileName(prefix='pixel-booth'){return `${prefix}-${new Date().toISOString().slice(0,10)}.png`;}
