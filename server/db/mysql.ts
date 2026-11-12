import {createPool,type Pool,type PoolConnection,type ResultSetHeader,type RowDataPacket} from 'mysql2/promise';
import type {Repository,Query,Row,Metadata,Cursor,UploadRow,GalleryRow,FeedbackRow} from './repository.js';

type Executor=Pool|PoolConnection;
type Values=(string|number|boolean|Date|Buffer|null)[];
async function rows<T=Row>(db:Executor,sql:string,params:Values=[]):Promise<T[]>{
 const [result]=await db.execute<RowDataPacket[]>(sql,params);return result as T[];
}
async function run(db:Executor,sql:string,params:Values=[]){const [result]=await db.execute<ResultSetHeader>(sql,params);return result;}
const timestamp=(value?:string)=>value?new Date(value):null;

// Multi-statement operations use one connection and row locks so concurrent API
// requests cannot lose rate increments, publish rejected uploads, or double-like.
export class MysqlRepository implements Repository {
 readonly pool:Pool;readonly query:Query;
 constructor(url:string){
  const connection=new URL(url);
  this.pool=createPool({host:connection.hostname,port:Number(connection.port||3306),user:decodeURIComponent(connection.username),password:decodeURIComponent(connection.password),database:decodeURIComponent(connection.pathname.slice(1)),timezone:'Z',charset:'utf8mb4',connectionLimit:5,connectTimeout:10_000});
  this.query=async(sql,params=[])=>{const [result]=await this.pool.execute(sql,params as Values);return Array.isArray(result)?result as Row[]:[];};
 }
 async close(){await this.pool.end();}
 private async transaction<T>(work:(db:PoolConnection)=>Promise<T>):Promise<T>{
  const db=await this.pool.getConnection();
  try{await db.beginTransaction();const result=await work(db);await db.commit();return result;}
  catch(error){await db.rollback();throw error;}finally{db.release();}
 }
 async health(){await this.query('SELECT 1 AS ok');}
 async rate(key:string,seconds:number){
  return this.transaction(async db=>{
   await run(db,`INSERT INTO rate_limits(\`key\`,used,expires_at) VALUES(?,1,TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)))
    ON DUPLICATE KEY UPDATE used=IF(expires_at<=UTC_TIMESTAMP(3),1,used+1),expires_at=IF(expires_at<=UTC_TIMESTAMP(3),TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)),expires_at)`,[key,seconds,seconds]);
   const [row]=await rows<{used:number;expires_at:Date}>(db,'SELECT used,expires_at FROM rate_limits WHERE `key`=?',[key]);
   return {used:row.used,expiresAt:row.expires_at};
  });
 }
 async createUpload(id:string,owner:string|null,meta:Metadata,createdAt?:string){
  await run(this.pool,`INSERT INTO upload_intents(id,owner_id,pathname,title,kind,layout,created_at) VALUES(?,?,?,?,?,?,COALESCE(?,UTC_TIMESTAMP(3)))`,[id,owner,`gallery/${id}.png`,meta.title,meta.kind,meta.layout,timestamp(createdAt)]);
  return (await this.upload(id))!;
 }
 async upload(id:string){return (await rows<UploadRow>(this.pool,'SELECT * FROM upload_intents WHERE id=?',[id]))[0];}
 async authorizeUpload(id:string,owner:string,pathname:string){
  return this.transaction(async db=>{
   const result=await run(db,`UPDATE upload_intents SET token_requests=token_requests+1 WHERE id=? AND owner_id=? AND pathname=? AND state='pending' AND expires_at>UTC_TIMESTAMP(3) AND token_requests<3`,[id,owner,pathname]);
   return result.affectedRows?(await rows<UploadRow>(db,'SELECT * FROM upload_intents WHERE id=?',[id]))[0]:undefined;
  });
 }
 async rejectUpload(id:string){await run(this.pool,"UPDATE upload_intents SET state='rejected' WHERE id=? AND state='pending'",[id]);}
 async finalize(id:string,url:string){
  return this.transaction(async db=>{
   const [intent]=await rows<UploadRow>(db,'SELECT * FROM upload_intents WHERE id=? FOR UPDATE',[id]);
   if(!intent||intent.state==='rejected'||(intent.state==='pending'&&new Date(intent.expires_at)<=new Date()))return undefined;
   await run(db,`INSERT INTO gallery(id,owner_id,title,kind,layout,blob_path,blob_url,created_at)
    SELECT id,owner_id,title,kind,layout,pathname,?,created_at FROM upload_intents WHERE id=?
    ON DUPLICATE KEY UPDATE id=gallery.id`,[url,id]);
   await run(db,"UPDATE upload_intents SET state='complete' WHERE id=?",[id]);
   return (await rows<GalleryRow>(db,'SELECT * FROM gallery WHERE id=?',[id]))[0];
  });
 }
 async galleries(cursor:Cursor|null=null){return rows<GalleryRow>(this.pool,`SELECT * FROM gallery WHERE deleted_at IS NULL ${cursor?'AND (created_at,id)<(?,?)':''} ORDER BY created_at DESC,id DESC LIMIT 101`,cursor?[timestamp(cursor.createdAt),cursor.id]:[]);}
 async gallery(id:string){return (await rows<GalleryRow>(this.pool,'SELECT * FROM gallery WHERE id=?',[id]))[0];}
 async deleteGallery(id:string){await run(this.pool,'UPDATE gallery SET deleted_at=COALESCE(deleted_at,UTC_TIMESTAMP(3)) WHERE id=?',[id]);}
 async blobDeleted(id:string){
  await this.transaction(async db=>{
   // Keep the same lock order as finalize: upload first, then gallery.
   await rows(db,'SELECT id FROM upload_intents WHERE id=? FOR UPDATE',[id]);
   const result=await run(db,'DELETE FROM gallery WHERE id=? AND deleted_at IS NOT NULL',[id]);
   if(result.affectedRows)await run(db,"UPDATE upload_intents SET state='rejected',owner_id=NULL,title='Deleted memory',expires_at=GREATEST(expires_at,TIMESTAMPADD(MINUTE,15,UTC_TIMESTAMP(3))) WHERE id=?",[id]);
  });
 }
 async expiredUploads(){return this.query("SELECT pathname FROM upload_intents WHERE state<>'complete' AND expires_at<UTC_TIMESTAMP(3) AND NOT EXISTS(SELECT 1 FROM gallery WHERE gallery.id=upload_intents.id) LIMIT 25");}
 async removeExpiredUpload(pathname:string){await run(this.pool,'DELETE FROM upload_intents WHERE pathname=? AND NOT EXISTS(SELECT 1 FROM gallery WHERE gallery.id=upload_intents.id)',[pathname]);}
 async pendingDeletes(){return this.query('SELECT id,blob_path FROM gallery WHERE deleted_at IS NOT NULL LIMIT 25');}
 async cleanupRates(){await run(this.pool,'DELETE FROM rate_limits WHERE expires_at<TIMESTAMPADD(DAY,-1,UTC_TIMESTAMP(3))');}
 async feedback(owner:string|null,cursor:Cursor|null=null){
  return rows<FeedbackRow>(this.pool,`SELECT f.*,EXISTS(SELECT 1 FROM feedback_likes l WHERE l.feedback_id=f.id AND l.visitor_id=?) AS liked FROM feedback f
   WHERE (status='approved' OR (owner_id=? AND status='pending')) ${cursor?'AND (created_at,id)<(?,?)':''} ORDER BY created_at DESC,id DESC LIMIT 101`,[owner,owner,...(cursor?[timestamp(cursor.createdAt),cursor.id]:[])]);
 }
 async createFeedback(input:Parameters<Repository['createFeedback']>[0]){
  try{await run(this.pool,`INSERT INTO feedback(id,owner_id,name,message,rating,fingerprint,status,likes,created_at) VALUES(?,?,?,?,?,?,?,?,COALESCE(?,UTC_TIMESTAMP(3)))`,[input.id,input.owner,input.name,input.message,input.rating,input.fingerprint,input.status,input.likes??0,timestamp(input.createdAt)]);}
  catch(error){if((error as {code?:string}).code==='ER_DUP_ENTRY')return undefined;throw error;}
  return this.feedbackById(input.id);
 }
 async like(id:string,owner:string){
  return this.transaction(async db=>{
   const [note]=await rows<FeedbackRow>(db,"SELECT * FROM feedback WHERE id=? AND status='approved' FOR UPDATE",[id]);
   if(!note)return undefined;
   const existing=await rows(db,'SELECT feedback_id FROM feedback_likes WHERE feedback_id=? AND visitor_id=?',[id,owner]);
   if(!existing.length){
    await run(db,'INSERT INTO feedback_likes(feedback_id,visitor_id) VALUES(?,?)',[id,owner]);
    await run(db,'UPDATE feedback SET likes=likes+1 WHERE id=?',[id]);note.likes++;
   }
   return {...note,liked:true};
  });
 }
 async moderate(status:string){return rows<FeedbackRow>(this.pool,'SELECT * FROM feedback WHERE status=? ORDER BY created_at ASC LIMIT 100',[status]);}
 async setFeedbackStatus(id:string,status:string){
  return this.transaction(async db=>{
   await run(db,'UPDATE feedback SET status=? WHERE id=?',[status,id]);
   return (await rows<FeedbackRow>(db,'SELECT * FROM feedback WHERE id=?',[id]))[0];
  });
 }
 async removeFeedback(id:string){const result=await run(this.pool,'DELETE FROM feedback WHERE id=?',[id]);return result.affectedRows?{id}:undefined;}
 async feedbackById(id:string){return (await rows<FeedbackRow>(this.pool,'SELECT * FROM feedback WHERE id=?',[id]))[0];}
}
