import express from 'express';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './app.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=createApp();
const builtSite=path.join(root,'dist');
if(existsSync(builtSite)){
 app.use(express.static(builtSite));
 app.get('*',(_req,res)=>res.sendFile(path.join(builtSite,'index.html')));
}
const port=Number(process.env.PORT||3001);
app.listen(port,()=>console.log(`Pixel Booth API running at http://localhost:${port}`));
