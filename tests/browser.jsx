// Runs the real UI. Only camera hardware, external sharing/printing and the Blob transport are simulated.
// Use exclusively with tests/preview-server.ts and the isolated Vite proxy documented in DEPLOYMENT.md.
import {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useLocation,useNavigate} from 'react-router-dom';
import {AppShell} from '../src/components/Shell';
import {BoothProvider,useBooth} from '../src/context/BoothContext';
import {LayoutsLanding,LayoutPicker} from '../src/pages/Layouts';
import Booth from '../src/pages/Booth';
import Decorate from '../src/pages/Decorate';
import Gallery from '../src/pages/Gallery';
import Feedback from '../src/pages/Feedback';
import {getComposition,getStickerRect,renderComposition} from '../src/lib/compositor';
import {makeSessionGif} from '../src/lib/gif';
import {stickerCategories} from '../src/lib/stickers';
import '../src/styles.css';

const nativeFetch=window.fetch.bind(window),downloads=[],objectUrls=new Map(),cameraCalls=[],shared=[],opened=[],printJobs=[];
let state,path,navigateRoute,prepareCalls=0,pokemonCalls=0;
const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
const assert=(value,message)=>{if(!value)throw Error(message);};
const until=async(predicate,message)=>{for(let n=0;n<250;n++){if(predicate())return;await wait();}throw Error(message);};
const report=message=>{const root=document.querySelector('#qa-status');if(root.textContent==='Running…')root.textContent='';const line=document.createElement('p');line.textContent=message;root.append(line);};
const clickText=(text,scope=document)=>{const node=[...scope.querySelectorAll('button,a')].find(item=>item.textContent.trim()===text);assert(node,`Missing control: ${text}`);node.click();};
const setValue=(input,value)=>{Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
const sample=document.createElement('canvas');sample.width=640;sample.height=480;const ctx=sample.getContext('2d');
const paint=()=>{const gradient=ctx.createLinearGradient(0,0,640,480);gradient.addColorStop(0,'#ffd7e5');gradient.addColorStop(1,'#b9d9fa');ctx.fillStyle=gradient;ctx.fillRect(0,0,640,480);ctx.fillStyle='#936283';ctx.beginPath();ctx.arc(320,220,90,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fffaf5';ctx.fillRect(278,200,16,16);ctx.fillRect(346,200,16,16);ctx.fillRect(285,255,75,12);ctx.fillStyle='#51465b';ctx.font='16px sans-serif';ctx.fillText('Simulated camera',245,370);ctx.fillRect(Date.now()%600,440,24,12);};paint();setInterval(paint,100);
Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{cameraCalls.push(constraints);return sample.captureStream(10);}});
Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{shared.push(payload);}});
Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{shared.push({clipboard:text});}}});
const originalCreate=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=originalCreate(blob);objectUrls.set(url,blob);return url;};
const originalClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){downloads.push({filename:this.download,blob:objectUrls.get(this.href),url:this.href});return;}originalClick.call(this);};
window.open=(url)=>{if(url){opened.push(url);return {close(){}};}const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-10000px;width:10px;height:10px';document.body.append(frame);return {document:frame.contentDocument,focus(){},print(){printJobs.push(true);frame.remove();},close(){frame.remove();}};};
window.fetch=async(input,init)=>{
 const raw=input instanceof Request?input.url:String(input),url=new URL(raw,location.href);
 if(url.hostname==='vercel.com'&&url.pathname.startsWith('/api/blob'))return nativeFetch('/api/__test/blob',{...init,method:'PUT'});
 if(url.hostname==='pokeapi.co'){pokemonCalls++;return Response.json({name:'pikachu',sprites:{front_default:'/assets/stickers/pikachu.png'}});}
 if(url.pathname==='/api/gallery/prepare')prepareCalls++;
 return nativeFetch(input,init);
};
function Probe(){const {draft}=useBooth();state=draft;path=useLocation().pathname;navigateRoute=useNavigate();return null;}
function TestApp(){useEffect(()=>{void run().catch(error=>{report(`FAIL: ${error.stack||error.message}`);document.title='Pixel Booth QA: FAIL';console.error(error);});},[]);return <MemoryRouter initialEntries={['/layouts/meme']}><BoothProvider><Probe/><AppShell><Routes><Route path="/layouts" element={<LayoutsLanding/>}/><Route path="/layouts/:kind" element={<LayoutPicker/>}/><Route path="/booth" element={<Booth/>}/><Route path="/decorate" element={<Decorate/>}/><Route path="/gallery" element={<Gallery/>}/><Route path="/feedback" element={<Feedback/>}/></Routes></AppShell></BoothProvider></MemoryRouter>;}
async function run(){
 await until(()=>document.querySelector('.pick-card'),'Layout picker did not mount');
 const cookie=[...document.querySelectorAll('button')].find(item=>item.textContent==='Essential only');if(cookie)cookie.click();
 document.querySelector('.pick-card').click();await until(()=>path==='/booth'&&document.querySelector('video')?.readyState>=2,'Camera did not become ready');
 assert(state.kind==='meme'&&state.shots.length===2,'Layout selection failed');assert(cameraCalls[0].audio===false,'Unexpected microphone access');
 const before=cameraCalls.length;clickText('Flip camera');await until(()=>cameraCalls.length>before&&document.querySelector('video')?.readyState>=2,'Flip camera failed');
 clickText('5s');await wait();assert(state.timer===5,'5-second timer failed');clickText('10s');await wait();assert(state.timer===10,'10-second timer failed');clickText('3s');
 document.querySelector('[aria-label="View meme for photo 2"]').click();await wait();assert(document.querySelector('.capture-meme-reference').getAttribute('aria-label').includes('2'),'Meme slot reference failed');
 clickText('Change meme');await until(()=>document.querySelector('[aria-label="Available memes"]'),'Meme library did not open');
 const picker=document.querySelector('[role="dialog"]');clickText('People',picker);await wait();document.querySelector('.capture-meme-library button').click();await wait();const expectedMemes=[...state.memeImages];
 document.querySelector('[aria-label="Select photo 1"]').click();const seen=new Set();
 const observer=new MutationObserver(()=>{const node=document.querySelector('.capture-meme-reference');if(node)seen.add(node.getAttribute('aria-label'));});observer.observe(document.querySelector('.camera-frame'),{subtree:true,attributes:true,childList:true});
 clickText('Start auto capture');await until(()=>path==='/decorate'&&document.querySelector('.editor-canvas')?.width>300,'Auto capture did not open editor');observer.disconnect();
 assert(state.shots.every(Boolean)&&state.liveFrames.length>1&&state.liveFrames.length<=36,'Capture/GIF recording failed');assert(seen.size===2,'Meme reference did not follow capture');assert(state.memeImages.every((src,index)=>src===expectedMemes[index]),'Meme selections were lost');
 report('PASS: layout selection, camera/flip, 3/5/10 timers, auto capture, meme reference/picker and GIF frame recording.');
 const baseline=document.querySelector('.editor-canvas').toDataURL();document.querySelectorAll('.filter-option')[1].click();await until(()=>state.filter==='bnw','Filter selection failed');await wait();assert(document.querySelector('.editor-canvas').toDataURL()!==baseline,'Filter was not rendered');
 for(const button of document.querySelectorAll('.filter-option')){button.click();await wait();}assert(state.filter==='pixel','Not all filters were selectable');
 document.querySelector('[title="Stickers"]').click();await until(()=>document.querySelector('[title="Pikachu"] img')?.getAttribute('src')?.startsWith('data:'),'PokéAPI sticker did not load');assert(pokemonCalls>0,'PokéAPI was not requested');
 for(const category of stickerCategories){clickText(category,document.querySelector('[aria-label="Sticker categories"]'));await wait();const grid=document.querySelector('.sticker-grid');assert(grid.scrollWidth<=grid.clientWidth,`Sticker side scroll: ${category}`);}
 clickText('All',document.querySelector('[aria-label="Sticker categories"]'));await until(()=>document.querySelector('[title="Apple"]'),'All sticker category did not render');document.querySelector('[title="Apple"]').click();await until(()=>document.querySelector('[aria-label="Edit sticker"]'),'Sticker controls missing');
 document.querySelector('[aria-label="Edit sticker"]').click();await wait();setValue(document.querySelector('#inline-sticker-size'),'.29');await until(()=>state.stickers[0].size===.29,'Sticker resizing failed');setValue(document.querySelector('#inline-sticker-rotation'),'35');await until(()=>state.stickers[0].rotation===35,'Sticker rotation failed');
 document.querySelector('[aria-label="Delete sticker"]').click();await wait();assert(state.stickers.length===0,'Sticker delete failed');document.querySelector('[title="Pikachu"]').click();await wait();assert(state.stickers[0].src.startsWith('data:image/png'),'Pikachu image is not canvas-safe');
 const canvas=document.querySelector('.editor-canvas'),rect=canvas.getBoundingClientRect(),selected=state.stickers[0],position=getStickerRect(selected,getComposition(state.layout));
 const original={set:canvas.setPointerCapture,has:canvas.hasPointerCapture,release:canvas.releasePointerCapture};canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;canvas.releasePointerCapture=()=>{};
 const start={x:rect.left+selected.x*rect.width,y:rect.top+selected.y*rect.height};for(const [type,dx] of [['pointerdown',0],['pointermove',25],['pointerup',25]]){canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:1,isPrimary:true,clientX:start.x+dx,clientY:start.y+dx}));await wait();}Object.assign(canvas,{setPointerCapture:original.set,hasPointerCapture:original.has,releasePointerCapture:original.release});assert(state.stickers[0].x>selected.x&&position.w>0,'Sticker dragging failed');
 document.querySelector('[title="Text"]').click();await wait();setValue(document.querySelector('#new-text'),'Production QA caption');await until(()=>state.caption==='Production QA caption','Caption editing failed');const caption=[...document.querySelectorAll('label')].find(label=>label.textContent.includes('Show caption on frame')).querySelector('input');caption.click();await wait();assert(!state.showCaption&&state.showDate,'Caption toggle changed the date');caption.click();
 document.querySelector('[title="Frame color"]').click();await wait();document.querySelectorAll('.color-swatches button')[3].click();await wait();assert(state.frameColor==='#cceadd','Frame swatch failed');setValue(document.querySelector('.color-label input'),'#bbccdd');await until(()=>state.frameColor==='#bbccdd','Custom frame color failed');
 document.querySelector('[title="Memes"]').click();await wait();assert([...document.querySelectorAll('.meme-row-select img')].every((img,index)=>img.getAttribute('src')===expectedMemes[index]),'Editor meme rows differ from capture');
 report('PASS: all filters, sticker categories, PokéAPI-to-canvas pipeline, sticker resize/rotation/drag/delete, caption/date controls and frame colors.');
 clickText('PNG');await until(()=>downloads.some(item=>item.filename.endsWith('.png')),'PNG download failed');const png=downloads.find(item=>item.filename.endsWith('.png')).blob;assert(new Uint8Array(await png.arrayBuffer())[0]===137,'PNG bytes invalid');
 const exported=document.createElement('canvas');await renderComposition(exported,state);assert(exported.toDataURL()===document.querySelector('.editor-canvas').toDataURL(),'Controls leaked into final photo');
 clickText('GIF');await until(()=>downloads.some(item=>item.filename.endsWith('.gif')),'GIF download failed');const gif=downloads.find(item=>item.filename.endsWith('.gif')).blob;assert(new TextDecoder().decode((await gif.arrayBuffer()).slice(0,6))==='GIF89a','GIF bytes invalid');
 clickText('Print');await until(()=>printJobs.length===1,'Print document did not render');clickText('Share');await until(()=>document.querySelector('[aria-label="Share the happy vibes"]'),'Share dialog missing');clickText('Share photo via device',document.querySelector('[aria-label="Share the happy vibes"]'));await until(()=>shared.some(item=>item.files?.[0]?.type==='image/png'),'Device share did not receive PNG');document.querySelector('[aria-label="Share the happy vibes"] [aria-label="Close"]').click();
 report('PASS: clean PNG export, animated GIF export, print document and native sharing payload (device actions simulated).');
 clickText('Add to gallery');await wait();const preparedBefore=prepareCalls;const saveDialog=document.querySelector('[aria-label="Save to the gallery?"]');clickText('Cancel',saveDialog);await wait();assert(prepareCalls===preparedBefore,'Cancel initiated an upload');
 clickText('Add to gallery');await wait();clickText('Submit & save',document.querySelector('[aria-label="Save to the gallery?"]'));
 await until(()=>document.querySelector('.notice')?.textContent.includes('Your creation is now in the gallery!'),'Gallery save did not complete');assert(prepareCalls===preparedBefore+1,'Confirmed save did not use direct upload');
 navigateRoute('/gallery');await until(()=>document.querySelector('.gallery-photo'),'Gallery photo not listed');document.querySelector('.gallery-photo').click();await until(()=>document.querySelector('.gallery-modal-photo img')?.complete,'Gallery image did not load');assert(document.querySelector('.gallery-modal-photo img').naturalWidth>0,'Gallery image bytes missing');clickText('Delete',document.querySelector('[role="dialog"]'));await wait();clickText('Cancel',document.querySelector('[aria-label="Remove this memory?"]'));await wait();assert(document.querySelector('.gallery-photo'),'Delete Cancel removed the photo');clickText('Delete',document.querySelector('[role="dialog"]'));await wait();clickText('Delete photo',document.querySelector('[aria-label="Remove this memory?"]'));await until(()=>!document.querySelector('.gallery-photo'),'Authorized gallery delete failed');
 report('PASS: gallery Cancel/Submit confirmation, real client Blob SDK with isolated transport, cloud-style image route, preview and owner-authorized delete.');
 navigateRoute('/feedback');await until(()=>document.querySelector('.feedback-empty'),'Feedback did not load');clickText('Add feedback');await wait();setValue(document.querySelector('#review-name'),'Browser QA');setValue(document.querySelector('#review-message'),`Browser verification ${Date.now()}: lovely booth.`);await wait();clickText('Submit feedback',document.querySelector('[role="dialog"]'));
 await until(()=>document.querySelector('.notice')?.textContent.includes('awaiting moderation'),'Pending feedback notice missing');assert(document.querySelector('.note-bottom button').disabled,'Unapproved note can be liked');
 const pending=await nativeFetch('/api/admin/feedback',{headers:{Authorization:'Bearer test-admin-token-only-for-isolated-tests-123456789'}}).then(response=>response.json());assert(pending.length===1,'Pending review missing');const id=pending[0].id;
 await nativeFetch(`/api/admin/feedback/${id}`,{method:'PATCH',headers:{Authorization:'Bearer test-admin-token-only-for-isolated-tests-123456789','Content-Type':'application/json'},body:JSON.stringify({status:'approved'})});
 navigateRoute('/gallery');await wait();navigateRoute('/feedback');await until(()=>document.querySelector('.note-bottom button')&&!document.querySelector('.note-bottom button').disabled,'Approved note did not load');document.querySelector('.note-bottom button').click();await until(()=>document.querySelector('.note-bottom button').disabled,'Like did not persist');assert(document.querySelector('.note-bottom button').textContent.trim()==='1','Like count is incorrect');
 await nativeFetch(`/api/admin/feedback/${id}`,{method:'DELETE',headers:{Authorization:'Bearer test-admin-token-only-for-isolated-tests-123456789'}});
 report('PASS: feedback submission, pending moderation visibility, admin approval, persistent like and duplicate-like protection.');
 navigateRoute('/layouts/plain');await until(()=>document.querySelector('.pick-card'),'Plain picker missing');document.querySelector('.pick-card').click();await until(()=>path==='/booth'&&document.querySelector('video')?.readyState>=2,'Plain booth missing');assert(!document.querySelector('.capture-meme-reference'),'Meme UI changed the plain booth');
 const blob=await new Promise(resolve=>sample.toBlob(resolve,'image/png')),files=new DataTransfer();for(let n=0;n<2;n++)files.items.add(new File([blob],`upload-${n}.png`,{type:'image/png'}));const input=document.querySelector('input[type="file"]');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));await until(()=>state.shots.every(Boolean),'Multi-image upload failed');document.querySelector('.continue-button').click();await until(()=>path==='/decorate','Uploaded photos did not open editor');assert(state.liveFrames.length===0,'Upload-only session recorded live frames');const slideshow=await makeSessionGif(state);assert(slideshow.type==='image/gif'&&slideshow.size>0,'Uploaded-photo GIF slideshow failed');
 report('PASS: plain layouts, multi-image uploads, editor continuation and upload-only GIF slideshow.');
 document.title='Pixel Booth QA: PASS';report('ALL BROWSER CHECKS PASSED. Production cloud services and actual device print/share still require verification on the deployed HTTPS URL.');
}
createRoot(document.querySelector('#root')).render(<TestApp/>);
