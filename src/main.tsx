import {createRoot} from 'react-dom/client';
import {BrowserRouter,Route,Routes,Link} from 'react-router-dom';
import {AppShell} from './components/Shell';
import {BoothProvider} from './context/BoothContext';
import Landing from './pages/Landing';
import HowItWorks from './pages/HowItWorks';
import {LayoutPicker,LayoutsLanding} from './pages/Layouts';
import Booth from './pages/Booth';
import Decorate from './pages/Decorate';
import Gallery from './pages/Gallery';
import Feedback from './pages/Feedback';
import Legal from './pages/Legal';
import './styles.css';
function App(){return <BrowserRouter><BoothProvider><AppShell><Routes><Route path="/" element={<Landing/>}/><Route path="/how-it-works" element={<HowItWorks/>}/><Route path="/layouts" element={<LayoutsLanding/>}/><Route path="/layouts/:kind" element={<LayoutPicker/>}/><Route path="/booth" element={<Booth/>}/><Route path="/decorate" element={<Decorate/>}/><Route path="/gallery" element={<Gallery/>}/><Route path="/feedback" element={<Feedback/>}/><Route path="/privacy" element={<Legal page="privacy"/>}/><Route path="/terms" element={<Legal page="terms"/>}/><Route path="/cookies" element={<Legal page="cookies"/>}/><Route path="*" element={<div className="container empty-state" style={{padding:'100px 0'}}><h1>Oops! A little detour</h1><p>That page doesn't seem to exist.</p><Link className="btn btn-primary" to="/">Back home</Link></div>}/></Routes></AppShell></BoothProvider></BrowserRouter>}
createRoot(document.getElementById('root')!).render(<App/>);
