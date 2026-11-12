import {useEffect,useState,type CSSProperties} from 'react';

const scenes=[
 {name:'Pink and violet',back:'#eddfff',front:'#ffcadb',glowStart:'#ffe1ec',glowMiddle:'#f6e8f2',glowEnd:'#f4e0f0',
  backPhotos:[['cappy','Capybaras together'],['cat4','Two kittens together'],['monkey1','A funny monkey by the water']],
  frontPhotos:[['cat1','Two expressive cats'],['cat7','A laughing cat'],['monkey3','A monkey making a hand gesture']],
  decorations:[{id:'flower',src:'flowers-violet.png'},{id:'panda',src:'panda2.png'},{id:'banana',src:'banana-cat.png'}]},
 {name:'Mint and sky blue',back:'#ccebd8',front:'#cce6fb',glowStart:'#e0f3df',glowMiddle:'#dff0ed',glowEnd:'#dcecfb',
  backPhotos:[['cat2','Two cats cuddling'],['cat3','Two curious kittens'],['monkey2','Two playful monkeys']],
  frontPhotos:[['cat6','A funny cat portrait'],['monkey4','A playful monkey portrait'],['cat5','A surprised cat']],
  decorations:[{id:'tulip',src:'tulips.png'},{id:'cat',src:'strawberry-cat.png'},{id:'mew',src:'pokemon-pink.png'}]},
] as const;

export default function HeroPhotoStrips(){
 const [active,setActive]=useState(0);
 useEffect(()=>{
  const timer=window.setInterval(()=>setActive(index=>(index+1)%scenes.length),5000);
  return()=>window.clearInterval(timer);
 },[]);
 return <div className="hero-art hero-showcase" aria-label="Photo strip inspiration">
  {scenes.map((scene,index)=><div key={scene.name} className={`hero-scene${index===active?' is-active':''}`} aria-hidden={index!==active} style={{'--strip-back':scene.back,'--strip-front':scene.front,'--glow-start':scene.glowStart,'--glow-middle':scene.glowMiddle,'--glow-end':scene.glowEnd} as CSSProperties}>
   <div className="hero-blob" aria-hidden="true"/>
   <div className="hero-strip hero-strip-back">
    <div className="mini-strip-label"/>
    {scene.backPhotos.map(([id,alt])=><img key={id} src={`/assets/memes/animal/${id}.jpg`} alt={alt} decoding="async"/>)}
   </div>
   <div className="hero-strip hero-strip-front">
    <div className="mini-strip-label"/>
    {scene.frontPhotos.map(([id,alt])=><img key={id} src={`/assets/memes/animal/${id}.jpg`} alt={alt} decoding="async"/>)}
   </div>
   {scene.decorations.map(sticker=><div key={sticker.id} className={`hero-sticker hero-decoration-${sticker.id}`} aria-hidden="true"><img src={`/assets/stickers/${sticker.src}`} alt="" decoding="async"/></div>)}
  </div>)}
 </div>;
}
