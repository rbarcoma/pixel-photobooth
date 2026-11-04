import {getLayoutInfo,type BoothLayout,type BoothKind} from '../lib/types';
import {assets} from '../generated/assets';
export function LayoutPreview({layout,kind,color='#ffd7e5',className=''}:{layout:BoothLayout;kind:BoothKind;color?:string;className?:string}){
 const info=getLayoutInfo(layout);const meme=kind==='meme';
 const photoCount=info.count;
 const animals=[assets.memes[2].src,assets.memes[8].src,assets.memes[16].src,assets.memes[23].src,assets.memes[4].src,assets.memes[10].src];
 return <div className={'layout-preview '+(meme?'layout-preview-meme ':'')+className} style={{backgroundColor:color,maxWidth:info.cols===1&&!meme?138:240}}>
 <div className="layout-preview-title">PIXEL BOOTH ✦</div><div className="layout-preview-photos" style={{gridTemplateColumns:`repeat(${meme?2:info.cols},1fr)`}}>{Array.from({length:photoCount},(_,i)=><div key={i} className="layout-preview-pair"><div className="layout-preview-photo"><img src={animals[i%animals.length]} alt="" loading="lazy"/></div>{meme&&<div className="layout-preview-photo meme-cell"><img src={assets.memes[(i+19)%assets.memes.length].src} alt="" loading="lazy"/></div>}</div>)}</div><div className="layout-preview-footer">✦  good times  ✦</div></div>;
}
