import {useEffect,useState,type ReactNode} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {ArrowUpRight,Camera,Heart,Instagram,Menu, X, Sparkles} from 'lucide-react';

const routes=[['/','Home'],['/how-it-works','How it works'],['/layouts','Layouts'],['/gallery','Gallery'],['/feedback','Feedback']];
export function Logo(){return <Link to="/" className="logo" aria-label="Pixel Booth home"><span className="logo-icon"><Camera size={19} strokeWidth={2.5}/></span><span>PIXEL<span className="logo-accent">BOOTH</span><small>✦ smile, it's your moment</small></span></Link>}
export function Header(){
 const [open,setOpen]=useState(false);const location=useLocation();
 useEffect(()=>setOpen(false),[location.pathname]);
 return <header className="site-header"><div className="header-inner container"><Logo/><nav className={'nav-links '+(open?'nav-open':'')} aria-label="Main navigation">{routes.map(([to,label])=><NavLink key={to} to={to} end={to==='/'} className={({isActive})=>isActive?'nav-active':''}>{label}</NavLink>)}<Link to="/layouts" className="btn btn-small btn-primary mobile-start">Start booth <ArrowUpRight size={15}/></Link></nav><div className="header-actions"><Link to="/layouts" className="btn btn-small btn-primary desktop-start">Start booth <ArrowUpRight size={16}/></Link><button className="menu-button" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?<X/>:<Menu/>}</button></div></div></header>;
}
export function Footer(){return <footer className="footer"><div className="container footer-main"><div className="footer-brand"><Logo/><p>A cozy little corner of the internet to capture faces, create memories, and keep the fun forever.</p><a className="footer-instagram" href="https://www.instagram.com/rnzxx1" target="_blank" rel="noreferrer"><Instagram size={18}/> @rnzxx1 <ArrowUpRight size={16}/></a></div><div className="footer-col"><h4>Explore</h4><Link to="/how-it-works">How it works</Link><Link to="/layouts">All layouts</Link><Link to="/gallery">Community gallery</Link><Link to="/feedback">Leave feedback</Link></div><div className="footer-col"><h4>Studio</h4><Link to="/layouts/plain">Plain booth</Link><Link to="/layouts/meme">Meme booth</Link><Link to="/layouts">Coming soon</Link></div><div className="footer-col"><h4>The important stuff</h4><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms of use</Link><Link to="/cookies">Cookie policy</Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Pixel Booth. Made with <Heart size={12} fill="currentColor"/> and a little pixel magic.</span><span>Capture the moment. Keep the memory. ✦</span></div></footer>}
export function CookieBanner(){
 const [visible,setVisible]=useState(()=>!localStorage.getItem('pixel-booth-cookie-choice'));
 const choose=(value:'essential'|'preferences')=>{localStorage.setItem('pixel-booth-cookie-choice',value);setVisible(false);};
 if(!visible)return null;
 return <div className="cookie-banner" role="dialog" aria-label="Browser storage notice"><div className="cookie-icon"><Sparkles size={19}/></div><div><strong>Just a tiny cookie note! 🍪</strong><p>We use essential browser storage for your preferences. No advertising or analytics cookies are configured in this starter project. <Link to="/cookies">Read our cookie policy</Link>.</p></div><div className="cookie-actions"><button className="btn btn-ghost btn-small" onClick={()=>choose('essential')}>Essential only</button><button className="btn btn-primary btn-small" onClick={()=>choose('preferences')}>Allow preferences</button></div></div>;
}
export function PageBanner({eyebrow,title,description,children}: {eyebrow:string;title:string;description:string;children?:ReactNode}){
 return <div className="page-banner"><div className="container"><div className="eyebrow"><span className="tiny-star">✦</span>{eyebrow}</div><h1>{title}</h1><p>{description}</p>{children}</div><span className="banner-star banner-star-a">✳</span><span className="banner-star banner-star-b">✦</span></div>;
}
export function SectionTitle({eyebrow,title,description}: {eyebrow:string;title:string;description?:string}){return <div className="section-title"><span className="eyebrow">✦ {eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>}
export function Modal({title,description,onClose,children}: {title:string;description?:string;onClose:()=>void;children:ReactNode}){
 useEffect(()=>{const fn=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose]);
 return <div className="modal-backdrop" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={event=>event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={onClose}><X size={20}/></button><div className="modal-decoration">✦</div><h2>{title}</h2>{description&&<p className="muted">{description}</p>}{children}</div></div>;
}
export function Notice({children,onClose,type='info'}:{children:ReactNode;onClose:()=>void;type?:'error'|'info'|'success'}){return <div className={'notice notice-'+type} role="status"><span>{children}</span><button aria-label="Dismiss" onClick={onClose}><X size={15}/></button></div>}
export function AppShell({children}: {children:ReactNode}){const location=useLocation();useEffect(()=>{window.scrollTo({top:0,behavior:'auto'});},[location.pathname]);return <><Header/><main>{children}</main><Footer/><CookieBanner/></>}
