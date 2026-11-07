import {UUID} from '../server/config.js';
const [site,action='list',argument='pending']=process.argv.slice(2);
if(!site||!process.env.ADMIN_API_TOKEN)throw Error('Usage: npm run moderate -- https://your-site.vercel.app list|approve|reject|delete-note|delete-photo [status|id]. Set ADMIN_API_TOKEN in .env.local.');
const base=new URL(site);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Use HTTPS for administration.');
let path:string,method='GET',body:string|undefined;
if(action==='list'){if(!['pending','approved','rejected'].includes(argument))throw Error('Status must be pending, approved or rejected.');path=`/api/admin/feedback?status=${argument}`;}
else{UUID.parse(argument);if(action==='delete-photo'){path=`/api/gallery/${argument}`;method='DELETE';}
 else if(action==='delete-note'){path=`/api/admin/feedback/${argument}`;method='DELETE';}
 else if(action==='approve'||action==='reject'){path=`/api/admin/feedback/${argument}`;method='PATCH';body=JSON.stringify({status:action==='approve'?'approved':'rejected'});}
 else throw Error('Unknown moderation action.');}
const response=await fetch(new URL(path,base),{method,body,headers:{Authorization:`Bearer ${process.env.ADMIN_API_TOKEN}`,'Content-Type':'application/json'}});
const data=await response.json();if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
console.log(JSON.stringify(data,null,2));
