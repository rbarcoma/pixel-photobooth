import {GIFEncoder,quantize,applyPalette} from 'gifenc';
import type {Draft} from './types';
import {DEFAULT_CAPTION} from './types';
import {drawCover,loadImage} from './compositor';
import {BODY_FONT_FAMILY,loadBodyFont} from './fonts';

// A real animated GIF of live camera frames recorded during the capture session.
// When the user uploaded photos instead, create a slideshow from those images.
export async function makeSessionGif(draft:Draft):Promise<Blob>{
 await loadBodyFont();
 const width=320,height=260;
 const output=document.createElement('canvas');output.width=width;output.height=height;
 const ctx=output.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('GIF canvas unavailable.');
 const encoder=GIFEncoder();
 const live=draft.liveFrames.slice(0,36);
 const imageSources=live.length?[]:draft.shots.filter((src):src is string=>!!src);
 const frames=live.length?live.length:Math.max(imageSources.length,1);
 for(let index=0;index<frames;index++){
  ctx.fillStyle=draft.frameColor;ctx.fillRect(0,0,width,height);
  ctx.textAlign='center';
  if(live.length){
   const frame=live[index];const videoCanvas=document.createElement('canvas');videoCanvas.width=frame.width;videoCanvas.height=frame.height;
   videoCanvas.getContext('2d')!.putImageData(frame,0,0);
   drawCover(ctx,videoCanvas,{x:10,y:35,w:300,h:196});
  }else if(imageSources.length){
   try{drawCover(ctx,await loadImage(imageSources[index%imageSources.length]),{x:10,y:35,w:300,h:196});}catch{ /* Keep frame background. */ }
  }
  const caption=(draft.caption??DEFAULT_CAPTION).trim();
  ctx.fillStyle=draft.frameColor.toLowerCase()==='#3d3b4d'?'#fffaf5':'#59475f';ctx.font=`12px ${BODY_FONT_FAMILY}`;
  if((draft.showCaption??true)&&caption)ctx.fillText(caption,width/2,250,width-20);
  const rgba=ctx.getImageData(0,0,width,height).data;
  const palette=quantize(rgba,64,{format:'rgb444'});
  const pixels=applyPalette(rgba,palette,'rgb444');
  encoder.writeFrame(pixels,width,height,{palette,delay:live.length?240:680});
 }
 encoder.finish();
 return new Blob([new Uint8Array(encoder.bytes())],{type:'image/gif'});
}
