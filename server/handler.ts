import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Express} from 'express';

// Vercel can forward a rewrite as /api?path=gallery/...; standalone Express receives /api/gallery/....
export function serverlessHandler(app:Express){
 return (request:IncomingMessage&{query?:Record<string,string|string[]|undefined>},response:ServerResponse)=>{
  const url=new URL(request.url||'/api','http://localhost');
  if(['/api','/api/','/api/index','/api/index.ts'].includes(url.pathname)){
   const captured=request.query?.path??url.searchParams.get('path');
   if(captured!==undefined&&captured!==null){
    const tail=(Array.isArray(captured)?captured.join('/'):captured).replace(/^\/+/, '');
    if(tail.length>512||/[?#\\\u0000-\u001f]/.test(tail)||tail.split('/').some(part=>part==='.'||part==='..')){
     response.statusCode=400;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({error:'Invalid API path.'}));return;
    }
    url.searchParams.delete('path');request.url=`/api/${tail}${url.search}`;
   }
  }
  app(request,response);
 };
}
