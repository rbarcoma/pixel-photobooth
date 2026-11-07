import {useState} from 'react';
import {Image as ImageIcon} from 'lucide-react';
import {assets} from '../generated/assets';
import {Modal} from './Shell';

interface MemeReferenceProps {
 memeImages:string[];
 count:number;
 activeSlot:number;
 disabled:boolean;
 onSelectSlot:(slot:number)=>void;
 onChange:(slot:number,src:string)=>void;
}
const categories=[{id:'all',label:'All'},{id:'animal',label:'Animals'},{id:'animation',label:'Animation'},{id:'people',label:'People'}] as const;

export default function MemeReference({memeImages,count,activeSlot,disabled,onSelectSlot,onChange}:MemeReferenceProps){
 const [open,setOpen]=useState(false);
 const [category,setCategory]=useState<typeof categories[number]['id']>('all');
 const getSource=(slot:number)=>memeImages[slot]||assets.memes[slot%assets.memes.length].src;
 const source=getSource(activeSlot);
 const name=assets.memes.find(item=>item.src===source)?.name??'Selected meme';
 return <aside className="capture-meme-reference" aria-label={`Meme reference for photo ${activeSlot+1}`}>
  <div className="capture-meme-heading"><h3>Match this meme</h3><p aria-live="polite">Photo {activeSlot+1} of {count}</p></div>
  <div className="capture-meme-slots" role="group" aria-label="Meme photo slots">
   {Array.from({length:count},(_,slot)=><button type="button" key={slot} disabled={disabled} aria-label={`View meme for photo ${slot+1}`} aria-pressed={activeSlot===slot} className={activeSlot===slot?'selected':''} onClick={()=>onSelectSlot(slot)}><img src={getSource(slot)} alt=""/><span>{slot+1}</span></button>)}
  </div>
  <div className="capture-meme-image"><img src={source} alt={`Meme to match for photo ${activeSlot+1}: ${name}`}/></div>
  <button type="button" disabled={disabled} className="btn btn-outline btn-small" onClick={()=>setOpen(true)}><ImageIcon size={14}/> Change meme</button>
  {open&&<Modal title={`Choose a meme for photo ${activeSlot+1}`} description="Pick the expression you want to copy. Your selected meme will appear beside this photo in your finished layout." onClose={()=>setOpen(false)}>
   <div className="meme-categories capture-meme-categories" role="group" aria-label="Meme categories">
    {categories.map(item=><button type="button" key={item.id} className={category===item.id?'active':''} aria-pressed={category===item.id} onClick={()=>setCategory(item.id)}>{item.label}</button>)}
   </div>
   <div className="meme-library capture-meme-library" aria-label="Available memes">
    {assets.memes.filter(item=>category==='all'||item.category===category).map(item=><button type="button" title={item.name} key={item.id} aria-label={`Choose ${item.name}`} aria-pressed={source===item.src} className={source===item.src?'selected':''} onClick={()=>{onChange(activeSlot,item.src);setOpen(false);}}><img src={item.src} alt={item.name} loading="lazy"/></button>)}
   </div>
  </Modal>}
 </aside>;
}
