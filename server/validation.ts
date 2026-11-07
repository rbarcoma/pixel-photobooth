import {z} from 'zod';
import sharp from 'sharp';
import {ApiError,MAX_IMAGE_PIXELS,MAX_PHOTO_BYTES} from './config.js';

const clean=z.string().trim().refine(value=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),'Control characters are not allowed.');
export const metadataSchema=z.object({title:clean.max(70).default('Little moment').transform(value=>value||'Little moment'),kind:z.enum(['plain','meme']),layout:z.enum(['plain-2','plain-3','plain-4','plain-2x2','plain-3x2','meme-2x2','meme-3x2','meme-4x2'])}).refine(value=>value.layout.startsWith(`${value.kind}-`),'The layout must match its category.');
export const feedbackSchema=z.object({name:clean.min(1).max(35),message:clean.min(5).max(600).refine(value=>(value.match(/https?:\/\//gi)||[]).length<=1&&!/(.)\1{19,}/u.test(value),'Please remove repeated characters or excessive links.'),rating:z.number().int().min(1).max(5),website:z.string().max(0).optional()});
export async function validatePng(image:Buffer){
 if(image.length>MAX_PHOTO_BYTES)throw new ApiError(413,'The photo is too large (13 MB maximum).');
 if(image.length<32||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new ApiError(400,'A valid PNG image is required.');
 try{
  const decoder=sharp(image,{limitInputPixels:MAX_IMAGE_PIXELS,animated:false,failOn:'warning'});
  const metadata=await decoder.metadata();
  if(metadata.format!=='png'||!metadata.width||!metadata.height||metadata.width>8192||metadata.height>8192||metadata.width*metadata.height>MAX_IMAGE_PIXELS||(metadata.pages??1)>1)throw Error('Invalid image dimensions');
  await decoder.stats();
 }catch{throw new ApiError(400,'The PNG image is damaged or exceeds the supported dimensions (16 megapixels).');}
}
export function decodeDataUrl(value:unknown){
 if(typeof value!=='string'||!/^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new ApiError(400,'A PNG image is required.');
 const data=value.slice('data:image/png;base64,'.length);
 if(data.length>Math.ceil(MAX_PHOTO_BYTES/3)*4)throw new ApiError(413,'The photo is too large (13 MB maximum).');
 return Buffer.from(data,'base64');
}
