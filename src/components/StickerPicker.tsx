import {useEffect,useState} from 'react';
import {getPikachuSticker,stickerCategories,stickers,type StickerCategory} from '../lib/stickers';

interface StickerPickerProps {
 onAdd:(src:string)=>void;
 selectedSrc?:string;
}

export default function StickerPicker({onAdd,selectedSrc}:StickerPickerProps){
 const [category,setCategory]=useState<StickerCategory>('All');
 const [pikachuSrc,setPikachuSrc]=useState<string>();
 const [pokemonStatus,setPokemonStatus]=useState<'loading'|'ready'|'fallback'>('loading');
 useEffect(()=>{
  let active=true;
  void getPikachuSticker().then(src=>{
   if(active){setPikachuSrc(src);setPokemonStatus('ready');}
  }).catch(()=>{if(active)setPokemonStatus('fallback');});
  return()=>{active=false;};
 },[]);
 return <>
  <h3>Pixel stickers </h3>
  <p className="panel-caption">Tap to add. Then drag the sticker anywhere on your photo.</p>
  <div className="meme-categories sticker-categories" role="group" aria-label="Sticker categories">
   {stickerCategories.map(item=><button type="button" key={item} className={category===item?'active':''} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}
  </div>
  {category==='Pokémon'&&pokemonStatus!=='ready'&&<p className="panel-caption" role="status">{pokemonStatus==='loading'?'Loading Pikachu from PokéAPI…':'PokéAPI is unavailable. Using the local Pikachu sticker.'}</p>}
  <div className="sticker-grid" aria-label={`${category} stickers`}>
   {stickers.filter(item=>category==='All'||item.category===category).map(item=>{
    const src=item.id==='pikachu'&&pikachuSrc?pikachuSrc:item.src;
    return <button type="button" key={item.id} title={item.name} onClick={()=>onAdd(src)} className={'sticker-choice '+(selectedSrc===src?'selected':'')}><img src={src} alt={item.name} loading="lazy"/></button>;
   })}
  </div>
 </>;
}
