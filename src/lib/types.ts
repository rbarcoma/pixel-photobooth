export type BoothKind = 'plain' | 'meme';
export type PlainLayout = 'plain-2'|'plain-3'|'plain-4'|'plain-2x2'|'plain-3x2';
export type MemeLayout = 'meme-2x2'|'meme-3x2'|'meme-4x2';
export type BoothLayout = PlainLayout | MemeLayout;
export type FilterName = 'original'|'bnw'|'retro'|'soft'|'warm'|'cool'|'pixel';
export type CaptureMode = 'auto'|'click';
export interface StickerOverlay {id:string; src:string; x:number; y:number; size:number; rotation:number;}
export interface Draft {
  kind:BoothKind;
  layout:BoothLayout;
  mode:CaptureMode;
  timer:3|5|10;
  shots:(string|null)[];
  memeImages:string[];
  filter:FilterName;
  frameColor:string;
  stickers:StickerOverlay[];
  caption:string;
  showCaption:boolean;
  showDate:boolean;
  dateTaken:string;
  liveFrames:ImageData[];
}
export interface GalleryRecord { id:string; title:string; kind:BoothKind; layout:string; imageUrl:string; createdAt:string; }
export interface FeedbackRecord {id:string; name:string; message:string; rating:number; likes:number; createdAt:string;}
export interface LayoutInfo {id:BoothLayout; label:string; description:string; count:number; rows:number; cols:number;}
export const plainLayouts:LayoutInfo[] = [
  {id:'plain-2',label:'2 strips',description:'Two sweet snapshots, one classic strip.',count:2,rows:2,cols:1},
  {id:'plain-3',label:'3 strips',description:'The original booth feeling.',count:3,rows:3,cols:1},
  {id:'plain-4',label:'4 strips',description:'Four little moments together.',count:4,rows:4,cols:1},
  {id:'plain-2x2',label:'2 × 2',description:'Four photos in a tidy square.',count:4,rows:2,cols:2},
  {id:'plain-3x2',label:'3 × 2',description:'Six photos in a playful grid.',count:6,rows:2,cols:3}
];
export const memeLayouts:LayoutInfo[] = [
  {id:'meme-2x2',label:'2 × 2',description:'2 photos + 2 meme reactions.',count:2,rows:2,cols:2},
  {id:'meme-3x2',label:'3 × 2',description:'3 photos + 3 meme reactions.',count:3,rows:3,cols:2},
  {id:'meme-4x2',label:'4 × 2',description:'4 photos + 4 meme reactions.',count:4,rows:4,cols:2}
];
export const getLayoutInfo = (layout: BoothLayout) => [...plainLayouts,...memeLayouts].find(item => item.id === layout)!;
export const DEFAULT_CAPTION='a little moment, forever yours';
export const frameColors = ['#ffd7e5','#fff5dc','#dcd4ff','#cceadd','#b9d9fa','#faf0e8','#3d3b4d','#ffffff','#fac7b4','#d6f2ef'];
export const filters:{id:FilterName;label:string;description:string}[] = [
 {id:'original',label:'Original',description:'All natural'},
 {id:'bnw',label:'B&W',description:'Classic monochrome'},
 {id:'retro',label:'Retro',description:'Warm film vibes'},
 {id:'soft',label:'Soft',description:'Dreamy pastel'},
 {id:'warm',label:'Golden',description:'Sunny and cozy'},
 {id:'cool',label:'Cool',description:'Blue hour'},
 {id:'pixel',label:'Pixel',description:'Chunky pixels'}
];
export function createDraft(kind:BoothKind='plain',layout:BoothLayout='plain-3'):Draft {
 return {kind,layout,mode:'auto',timer:3,shots:Array(getLayoutInfo(layout).count).fill(null),memeImages:[],filter:'original',frameColor:'#ffd7e5',stickers:[],caption:DEFAULT_CAPTION,showCaption:true,showDate:true,dateTaken:new Date().toISOString(),liveFrames:[]};
}
