import {assets} from '../generated/assets';
import {loadImage} from './compositor';
import {minecraftStickers} from './minecraft-stickers';

export const stickerCategories=['All','Animals','Flowers','Pokémon','Minecraft','Food & Drinks','Characters','Extras'] as const;
export type StickerCategory=typeof stickerCategories[number];

const categoryById={
 apple:'Food & Drinks','banana-cat':'Animals',banana:'Food & Drinks',
 'black-cat':'Animals','black-cat2':'Animals','black-cat3':'Animals',
 'black-crystal':'Extras','black-heart':'Extras','car-blue':'Extras',
 charizard:'Pokémon',cherry:'Food & Drinks',clouds:'Extras',coffee:'Food & Drinks',
 dog:'Animals',egg:'Food & Drinks','flowers-violet':'Flowers','gray-cat':'Animals',
 gwen:'Characters',headset:'Extras',matcha:'Food & Drinks',minecraft:'Characters',
 'orange-cat':'Animals',panda:'Animals',panda2:'Animals','perler-kitty':'Characters',
 pikachu:'Pokémon','pokemon-pink':'Pokémon',ribbon:'Extras',song:'Extras',
 'spiderman-logo':'Characters',spiderman:'Characters',spiderman2:'Characters',
 'strawberry-cat':'Animals',sword:'Extras',tulips:'Flowers',
} satisfies Record<typeof assets.stickers[number]['id'],Exclude<StickerCategory,'All'>>;

export const stickers=[...assets.stickers.map(item=>({...item,category:categoryById[item.id]})),...minecraftStickers];

interface PokemonResponse {
 name:string;
 sprites:{
  front_default:string|null;
  other?:{'official-artwork'?:{front_default:string|null};showdown?:{front_default:string|null}};
  versions?:{'generation-v'?:{'black-white'?:{animated?:{front_default:string|null}}}};
 };
}

export async function getPokemon(name:string){
 const response=await fetch(`https://pokeapi.co/api/v2/pokemon/${name.trim().toLowerCase()}`,{signal:AbortSignal.timeout(10_000)});
 if(!response.ok)throw new Error('Pokémon not found');
 const data:PokemonResponse=await response.json();
 return {
  name:data.name,
  pixelImage:data.sprites.front_default,
  artwork:data.sprites.other?.['official-artwork']?.front_default??null,
  animatedGif:data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default??data.sprites.other?.showdown?.front_default??null,
 };
}

let pikachuSticker:Promise<string>|undefined;
export function getPikachuSticker():Promise<string>{
 if(!pikachuSticker)pikachuSticker=(async()=>{
  const pokemon=await getPokemon('pikachu');
  const src=pokemon.pixelImage??pokemon.artwork;
  if(!src)throw new Error('Pikachu image is unavailable');
  const response=await fetch(src,{signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new Error('Pikachu image could not be loaded');
  // Store the sprite as a data URL so canvas previews and exports remain origin-clean.
  const blob=await response.blob();
  const dataUrl=await new Promise<string>((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result));
   reader.onerror=()=>reject(new Error('Pikachu image could not be read'));
   reader.readAsDataURL(blob);
  });
  await loadImage(dataUrl);
  return dataUrl;
 })().catch(error=>{pikachuSticker=undefined;throw error;});
 return pikachuSticker;
}
