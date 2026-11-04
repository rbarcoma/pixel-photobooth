import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Camera,CameraOff,Check,CheckCircle2,ImagePlus,RefreshCw,RotateCcw,Sparkles,Timer,Upload,Video} from 'lucide-react';
import {useBooth} from '../context/BoothContext';
import {getLayoutInfo} from '../lib/types';
import {fileToDataUrl} from '../lib/compositor';
import {Notice} from '../components/Shell';

const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export default function Booth(){
 const navigate=useNavigate();const {draft,update,setShot}=useBooth();
 const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
 const running=useRef(false);const mounted=useRef(true);const recordTimer=useRef<ReturnType<typeof setInterval>|null>(null);const capturedGifFrames=useRef<ImageData[]>([]);const frameTick=useRef(0);const sampleEvery=useRef(1);
 const [status,setStatus]=useState<'loading'|'ready'|'denied'>('loading');
 const [cameraError,setCameraError]=useState('');const [message,setMessage]=useState('');
 const [facing,setFacing]=useState<'user'|'environment'>('user');
 const [countdown,setCountdown]=useState<number|null>(null);const [busy,setBusy]=useState(false);
 const [activeSlot,setActiveSlot]=useState(0);const uploadInput=useRef<HTMLInputElement>(null);
 const info=getLayoutInfo(draft.layout);const completed=draft.shots.filter(Boolean).length;
 const startCamera=useCallback(async()=>{
  setStatus('loading');setCameraError('');
  if(!navigator.mediaDevices?.getUserMedia){setStatus('denied');setCameraError('Camera access requires HTTPS or localhost. You can upload pictures instead.');return;}
  try{
   stream.current?.getTracks().forEach(track=>track.stop());
   const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:facing,width:{ideal:1280},height:{ideal:960}}});
   if(!mounted.current){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;if(video.current){video.current.srcObject=media;await video.current.play().catch(()=>{});}
   setStatus('ready');
  }catch(error){setStatus('denied');setCameraError(error instanceof Error?`${error.message}. You can upload photos instead.`:'Camera unavailable. Try uploading your photos instead.');}
 },[facing]);
 useEffect(()=>{mounted.current=true;void startCamera();return()=>{mounted.current=false;stream.current?.getTracks().forEach(track=>track.stop());if(recordTimer.current)clearInterval(recordTimer.current);};},[startCamera]);
 const recordMoment=()=>{
  if(!video.current||video.current.readyState<2)return;
  frameTick.current+=1;
  if(frameTick.current%sampleEvery.current!==0)return;
  // Keep samples from the whole capture session, even if a long countdown is selected.
  if(capturedGifFrames.current.length>=36){capturedGifFrames.current=capturedGifFrames.current.filter((_,index)=>index%2===0);sampleEvery.current*=2;}
  const c=document.createElement('canvas');c.width=240;c.height=180;const ctx=c.getContext('2d');if(!ctx)return;
  ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(video.current,0,0,c.width,c.height);
  capturedGifFrames.current.push(ctx.getImageData(0,0,c.width,c.height));
 };
 const beginRecording=()=>{if(recordTimer.current)return;recordMoment();recordTimer.current=setInterval(recordMoment,220);};
 const finishRecording=()=>{if(recordTimer.current){clearInterval(recordTimer.current);recordTimer.current=null;}update(current=>({...current,liveFrames:capturedGifFrames.current}));};
 const captureNow=()=>{
  if(!video.current||video.current.readyState<2)throw Error('Camera is still starting.');
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=720;
  const ctx=canvas.getContext('2d')!;ctx.translate(canvas.width,0);ctx.scale(-1,1);
  ctx.drawImage(video.current,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.9);
 };
 const countDown=async(seconds:number)=>{
  for(let n=seconds;n>0;n--){if(!mounted.current)throw Error('Capture cancelled');setCountdown(n);await wait(1000);}
  setCountdown(0);await wait(250);setCountdown(null);
 };
 const capture=async()=>{
  if(running.current||status!=='ready')return;
  running.current=true;setBusy(true);setMessage('');beginRecording();
  const targets=draft.mode==='auto'?draft.shots.map((photo,i)=>!photo||i===activeSlot?i:-1).filter(i=>i>=0):[activeSlot];
  const newShots=[...draft.shots];
  try{
   for(const slot of targets){if(!mounted.current)return;
    setActiveSlot(slot);await countDown(draft.timer);
    newShots[slot]=captureNow();setShot(slot,newShots[slot]!);
    await wait(320);
   }
   finishRecording();
   const next=newShots.findIndex(photo=>!photo);
   if(next>=0){setActiveSlot(next);setMessage('Cute shot! Select the next slot or capture again.');}
   else if(mounted.current){setMessage('All photos are ready! You can retake one or decorate now.');if(draft.mode==='auto')navigate('/decorate');}
  }catch(error){setMessage(error instanceof Error?error.message:'Could not capture your photo.');finishRecording();}
  finally{running.current=false;if(mounted.current){setBusy(false);setCountdown(null);}}
 };
 const upload=async(event:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.target.files||[]);if(!files.length)return;
  const available=draft.shots.map((item,i)=>!item||i===activeSlot?i:-1).filter(i=>i>=0);
  let added=0;
  try{
   for(const file of files.slice(0,available.length)){
    const src=await fileToDataUrl(file);
    setShot(available[added],src);added++;
   }
   const next=draft.shots.findIndex((item,i)=>!item&&!available.slice(0,added).includes(i));
   if(next>=0)setActiveSlot(next);
   setMessage(`${added} photo${added===1?'':'s'} uploaded! ${files.length>added?'Extra files were skipped.':''}`);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to upload images.');}
  event.target.value='';
 };
 return <section className="booth-page"><div className="container"><div className="studio-topline"><Link to={`/layouts/${draft.kind}`}><ArrowLeft size={17}/> Back to layouts</Link><div><span className="step-badge current">01 CAPTURE</span><span className="step-line"/><span className="step-badge">02 DECORATE</span><span className="step-line"/><span className="step-badge">03 SAVE</span></div></div><div className="studio-title"><span className="eyebrow">✦ LIGHTS, CAMERA, YOU!</span><h1>It's picture time! <span>♡</span></h1><p>{info.label} · {draft.kind==='meme'?'Meme booth':'Plain booth'} · {completed} of {info.count} photos ready</p></div><div className="booth-workspace"><div className="capture-area"><div className="camera-frame"><div className="camera-head"><span><span className="record-dot"/> LIVE CAMERA</span><span>{status==='ready'?'● CONNECTED':status==='loading'?'CONNECTING...':'CAMERA OFF'}</span></div><div className="camera-screen">{status==='ready'||status==='loading'?<video ref={video} autoPlay muted playsInline className="camera-video"/>:null}{status==='loading'&&<div className="camera-empty"><Camera size={42}/><h3>Waking up the camera...</h3></div>}{status==='denied'&&<div className="camera-empty"><CameraOff size={48}/><h3>Your camera is unavailable</h3><p>{cameraError}</p><button onClick={()=>void startCamera()} className="btn btn-outline btn-small"><RefreshCw size={14}/> Retry camera</button></div>}{countdown!==null&&<div className="countdown-overlay"><div>{countdown===0?'SMILE!':countdown}</div><span>{countdown===0?'✦ click! ✦':'get ready... ♡'}</span></div>}{status==='ready'&&countdown===null&&<div className="camera-hint">♡ look right here ♡</div>}</div><div className="camera-toolbar"><span><Video size={15}/> {status==='ready'?'Ready to capture':'Upload works without camera'}</span><button disabled={busy} title="Switch front/back camera" onClick={()=>setFacing(item=>item==='user'?'environment':'user')}><RotateCcw size={16}/> Flip camera</button></div></div><div className="capture-main-actions"><button disabled={busy||status!=='ready'} onClick={()=>void capture()} className="btn btn-primary btn-large"><Camera size={18}/>{busy?'Capturing...':draft.mode==='auto'?'Start auto capture':'Capture this photo'}</button><button disabled={busy} onClick={()=>uploadInput.current?.click()} className="btn btn-outline btn-large"><Upload size={18}/> Upload photos</button><input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={event=>void upload(event)}/></div>{message&&<Notice type="info" onClose={()=>setMessage('')}>{message}</Notice>}{completed===info.count&&<button className="btn btn-dark btn-large continue-button" onClick={()=>{finishRecording();navigate('/decorate')}}><Check size={18}/> All done — decorate! <ArrowRight size={18}/></button>}</div><aside className="booth-sidebar"><div className="studio-panel"><h3><Sparkles size={18}/> Your session</h3><div className="session-progress"><div><span>Photos ready</span><strong>{completed}/{info.count}</strong></div><div className="progress-bar"><div style={{width:`${completed/info.count*100}%`}}/></div></div><div className="setting-group"><label>Capture mode</label><div className="segment"><button className={draft.mode==='auto'?'selected':''} disabled={busy} onClick={()=>update(current=>({...current,mode:'auto'}))}>Auto capture</button><button className={draft.mode==='click'?'selected':''} disabled={busy} onClick={()=>update(current=>({...current,mode:'click'}))}>Click to capture</button></div><small>{draft.mode==='auto'?'Automatically takes each remaining photo after a countdown.':'Capture one selected photo at a time.'}</small></div><div className="setting-group"><label><Timer size={15}/> Countdown timer</label><div className="timer-row">{([3,5,10] as const).map(time=><button disabled={busy} className={draft.timer===time?'selected':''} onClick={()=>update(current=>({...current,timer:time}))} key={time}>{time}s</button>)}</div></div><div className="setting-group"><label><ImagePlus size={15}/> Your shots <span className="muted">(tap to retake)</span></label><div className="shot-grid">{draft.shots.map((src,index)=><button key={index} className={'shot-thumb '+(activeSlot===index?'active':'')} onClick={()=>setActiveSlot(index)} disabled={busy} aria-label={`Select photo ${index+1}`}>{src?<img src={src} alt={`Captured photo ${index+1}`}/>:<span>{String(index+1).padStart(2,'0')}</span>}{src&&<span className="shot-check"><CheckCircle2 size={14}/></span>}</button>)}</div></div></div><div className="studio-help"><span>✿</span><p><strong>Little tip:</strong> Make a new pose for every shot! Tap any photo to choose which one to retake.</p></div></aside></div></div></section>;
}
