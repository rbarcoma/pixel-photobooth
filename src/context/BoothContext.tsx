import {createContext,useCallback,useContext,useMemo,useState,type PropsWithChildren} from 'react';
import {createDraft,getLayoutInfo,type BoothKind,type BoothLayout,type Draft} from '../lib/types';
import {assets} from '../generated/assets';
type BoothContextValue = {draft:Draft; update:(fn:(current:Draft)=>Draft)=>void; selectLayout:(kind:BoothKind,layout:BoothLayout)=>void; reset:()=>void; setShot:(slot:number,src:string)=>void;};
const Context=createContext<BoothContextValue|null>(null);
export function BoothProvider({children}:PropsWithChildren){
 const [draft,setDraft]=useState<Draft>(()=>createDraft());
 const update=useCallback((fn:(current:Draft)=>Draft)=>setDraft(current=>fn(current)),[]);
 const selectLayout=useCallback((kind:BoothKind,layout:BoothLayout)=>{
  const next=createDraft(kind,layout);
  const defaults=['animal-cat7','animal-monkey3','animation-animation3','people-people6'];
  if(kind==='meme')next.memeImages=Array.from({length:getLayoutInfo(layout).count},(_,i)=>assets.memes.find(m=>m.id===defaults[i%defaults.length])?.src||assets.memes[i%assets.memes.length].src);
  setDraft(next);
 },[]);
 const reset=useCallback(()=>setDraft(createDraft()),[]);
 const setShot=useCallback((slot:number,src:string)=>setDraft(current=>({...current,dateTaken:current.shots.some(Boolean)?current.dateTaken:new Date().toISOString(),shots:current.shots.map((value,index)=>index===slot?src:value)})),[]);
 const value=useMemo(()=>({draft,update,selectLayout,reset,setShot}),[draft,update,selectLayout,reset,setShot]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBooth(){const value=useContext(Context);if(!value)throw Error('BoothProvider is missing');return value;}
