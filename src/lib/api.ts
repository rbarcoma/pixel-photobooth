import type {FeedbackRecord,GalleryRecord} from './types';
async function json<T>(url:string,init?:RequestInit):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{...init,headers:{'Content-Type':'application/json',...init?.headers}});}catch{throw Error('Cannot connect to the gallery server. Make sure npm run dev is running.');}
 const data=await response.json().catch(()=>({error:'Unexpected response from the server.'}));
 if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
 return data as T;
}
export const galleryApi={
 list:()=>json<GalleryRecord[]>('/api/gallery'),
 save:(input:{title:string;kind:'plain'|'meme';layout:string;dataUrl:string})=>json<GalleryRecord>('/api/gallery',{method:'POST',body:JSON.stringify(input)}),
 delete:(id:string)=>json<{ok:boolean}>(`/api/gallery/${id}`,{method:'DELETE'})
};
export const feedbackApi={
 list:()=>json<FeedbackRecord[]>('/api/feedback'),
 create:(input:{name:string;message:string;rating:number})=>json<FeedbackRecord>('/api/feedback',{method:'POST',body:JSON.stringify(input)}),
 like:(id:string)=>json<FeedbackRecord>(`/api/feedback/${id}/like`,{method:'POST'})
};
