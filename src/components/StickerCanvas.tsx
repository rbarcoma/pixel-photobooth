import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import {Maximize2,Pencil,RotateCw,Trash2} from 'lucide-react';
import {getComposition,getStickerRect,identifyOverlay,loadImage} from '../lib/compositor';
import type {Draft,StickerOverlay} from '../lib/types';

type StickerChange=Partial<Pick<StickerOverlay,'x'|'y'|'size'|'rotation'>>;
interface StickerCanvasProps {
 canvasRef:RefObject<HTMLCanvasElement|null>;
 draft:Draft;
 selectedId:string|null;
 onSelect:(id:string|null)=>void;
 onChange:(id:string,change:StickerChange)=>void;
 onDelete:()=>void;
}
interface Gesture {
 id:string;
 pointerId:number;
 target:HTMLCanvasElement|HTMLButtonElement;
 mode:'move'|'resize'|'rotate';
 sticker:StickerOverlay;
 start:{x:number;y:number};
 clientX:number;
 clientY:number;
 moved:boolean;
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const normalizeAngle=(value:number)=>((Math.round(value)+180)%360+360)%360-180;

export default function StickerCanvas({canvasRef,draft,selectedId,onSelect,onChange,onDelete}:StickerCanvasProps){
 const [size,setSize]=useState({width:0,height:0});
 const [loadedSrc,setLoadedSrc]=useState<string>();
 const [editing,setEditing]=useState(false);
 const gesture=useRef<Gesture|null>(null);
 const skipClick=useRef(false);
 const selected=draft.stickers.find(item=>item.id===selectedId);
 const layout=getComposition(draft.layout);
 useLayoutEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  const measure=()=>{const rect=canvas.getBoundingClientRect();setSize({width:rect.width,height:rect.height});};
  measure();const observer=new ResizeObserver(measure);observer.observe(canvas);
  return()=>observer.disconnect();
 },[canvasRef]);
 useEffect(()=>{setEditing(false);},[selectedId]);
 useEffect(()=>{
  let active=true;
  if(selected)void loadImage(selected.src).then(()=>{if(active)setLoadedSrc(selected.src);}).catch(()=>{if(active)setLoadedSrc(undefined);});
  return()=>{active=false;};
 },[selected?.src]);
 const point=(event:ReactPointerEvent)=>{
  const rect=canvasRef.current!.getBoundingClientRect();
  return {x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};
 };
 const begin=(event:ReactPointerEvent<HTMLCanvasElement|HTMLButtonElement>,mode:Gesture['mode'],sticker:StickerOverlay)=>{
  event.preventDefault();event.stopPropagation();skipClick.current=false;
  event.currentTarget.setPointerCapture(event.pointerId);
  gesture.current={id:sticker.id,pointerId:event.pointerId,target:event.currentTarget,mode,sticker:{...sticker},start:point(event),clientX:event.clientX,clientY:event.clientY,moved:false};
 };
 const select=(event:ReactPointerEvent<HTMLCanvasElement>)=>{
  if(event.button!==0||gesture.current)return;
  const p=point(event);const id=identifyOverlay(draft,p.x,p.y);onSelect(id);
  const sticker=draft.stickers.find(item=>item.id===id);if(sticker)begin(event,'move',sticker);
 };
 const transform=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const active=gesture.current;if(!active||active.pointerId!==event.pointerId)return;
  if(!active.moved&&Math.hypot(event.clientX-active.clientX,event.clientY-active.clientY)<3)return;
  active.moved=true;const p=point(event);const initial=active.sticker;
  if(active.mode==='move'){
   onChange(active.id,{x:clamp(initial.x+p.x-active.start.x,0,1),y:clamp(initial.y+p.y-active.start.y,0,1)});
  }else{
   const dx=(p.x-initial.x)*layout.width,dy=(p.y-initial.y)*layout.height;
   const startX=(active.start.x-initial.x)*layout.width,startY=(active.start.y-initial.y)*layout.height;
   if(active.mode==='resize')onChange(active.id,{size:clamp(initial.size*Math.hypot(dx,dy)/Math.max(1,Math.hypot(startX,startY)),.05,.48)});
   else onChange(active.id,{rotation:normalizeAngle(initial.rotation+(Math.atan2(dy,dx)-Math.atan2(startY,startX))*180/Math.PI)});
  }
 };
 const finish=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const active=gesture.current;if(!active||active.pointerId!==event.pointerId)return;
  skipClick.current=active.mode!=='move'&&active.moved&&event.type!=='pointercancel';gesture.current=null;
  if(active.target.hasPointerCapture(event.pointerId))active.target.releasePointerCapture(event.pointerId);
 };
 const startControl=(event:ReactPointerEvent<HTMLButtonElement>,mode:'resize'|'rotate')=>{
  if(event.button===0&&!gesture.current&&selected)begin(event,mode,selected);
 };
 const change=(patch:StickerChange)=>{if(selected)onChange(selected.id,patch);};
 const rect=selected?getStickerRect(selected,layout):null;
 const scale=size.width/layout.width;
 const angle=(selected?.rotation??0)*Math.PI/180;
 const center=rect?{x:rect.x*scale,y:rect.y*scale}:{x:0,y:0};
 const width=(rect?.w??0)*scale,height=(rect?.h??0)*scale;
 const extentY=(Math.abs(width*Math.sin(angle))+Math.abs(height*Math.cos(angle)))/2;
 const toolbarX=clamp(center.x,64,size.width-64);
 const toolbarY=clamp(center.y-extentY<48?center.y+extentY+28:center.y-extentY-28,24,size.height-24);
 const popoverWidth=Math.min(220,size.width-16);
 const popoverX=clamp(toolbarX-popoverWidth/2,8,size.width-popoverWidth-8);
 const popoverY=clamp(toolbarY+26+154>size.height?toolbarY-180:toolbarY+26,8,size.height-162);
 return <div className="sticker-canvas" onPointerMove={transform} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={event=>{if(gesture.current?.pointerId===event.pointerId)gesture.current=null;}} onKeyDown={event=>{
  if(event.key==='Escape'){setEditing(false);onSelect(null);}
  else if((event.key==='Delete'||event.key==='Backspace')&&selected&&!(event.target instanceof HTMLInputElement)){event.preventDefault();onDelete();}
 }}>
  <canvas ref={canvasRef} className="editor-canvas" tabIndex={0} aria-label="Editable photobooth composition. Select and drag stickers, or use their edit controls." onPointerDown={select}/>
  {selected&&loadedSrc===selected.src&&size.width>0&&<div className="sticker-control-layer" style={{width:size.width,height:size.height}}>
   <div className="sticker-selection" style={{left:center.x,top:center.y,width,height,transform:`translate(-50%, -50%) rotate(${selected.rotation}deg)`}}/>
   <div className="sticker-toolbar" role="group" aria-label="Selected sticker controls" style={{left:toolbarX,top:toolbarY}}>
    <button type="button" className="sticker-action" title="Edit sticker" aria-label="Edit sticker" aria-expanded={editing} aria-controls="sticker-inline-editor" onClick={()=>setEditing(value=>!value)}><Pencil size={16}/></button>
    <button type="button" className="sticker-action" title="Rotate sticker: drag or tap" aria-label="Rotate sticker" onPointerDown={event=>startControl(event,'rotate')} onClick={()=>{if(skipClick.current){skipClick.current=false;return;}change({rotation:normalizeAngle(selected.rotation+15)});}} onKeyDown={event=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key)){event.preventDefault();change({rotation:normalizeAngle(selected.rotation+(['ArrowLeft','ArrowDown'].includes(event.key)?-5:5))});}}}><RotateCw size={16}/></button>
    <button type="button" className="sticker-action sticker-delete" title="Delete sticker" aria-label="Delete sticker" onClick={onDelete}><Trash2 size={16}/></button>
   </div>
   <div className="sticker-resize-handle" style={{left:clamp(center.x+(width*Math.cos(angle)-height*Math.sin(angle))/2,22,size.width-22),top:clamp(center.y+(width*Math.sin(angle)+height*Math.cos(angle))/2,22,size.height-22)}}>
    <button type="button" className="sticker-action" title="Resize sticker: drag the corner" aria-label="Resize sticker" onPointerDown={event=>startControl(event,'resize')} onClick={()=>{if(skipClick.current){skipClick.current=false;return;}setEditing(true);}} onKeyDown={event=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key)){event.preventDefault();change({size:clamp(selected.size+(['ArrowLeft','ArrowDown'].includes(event.key)?-.01:.01),.05,.48)});}}}><Maximize2 size={16}/></button>
   </div>
   {editing&&<div id="sticker-inline-editor" className="sticker-inline-editor" role="group" aria-label="Edit sticker on photo" style={{left:popoverX,top:popoverY,width:popoverWidth}}>
    <label className="range-label" htmlFor="inline-sticker-size">Size <span>{Math.round(selected.size*100)}%</span></label>
    <input id="inline-sticker-size" aria-label="Sticker size on photo" type="range" min={.05} max={.48} step={.01} value={selected.size} onChange={event=>change({size:Number(event.target.value)})}/>
    <label className="range-label" htmlFor="inline-sticker-rotation">Rotate <span>{selected.rotation}°</span></label>
    <input id="inline-sticker-rotation" aria-label="Sticker rotation on photo" type="range" min={-180} max={180} value={selected.rotation} onChange={event=>change({rotation:Number(event.target.value)})}/>
   </div>}
  </div>}
 </div>;
}
