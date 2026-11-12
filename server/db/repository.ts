import {neon} from '@neondatabase/serverless';

export type Row=Record<string,unknown>;
export interface Cursor {createdAt:string;id:string;}
export type Query=(text:string,params?:unknown[])=>Promise<Row[]>;
export interface Metadata {title:string;kind:'plain'|'meme';layout:string;}
export interface GalleryRow extends Row {id:string;owner_id:string|null;title:string;kind:'plain'|'meme';layout:string;blob_path:string;blob_url:string;created_at:string|Date;deleted_at:string|Date|null;}
export interface UploadRow extends Row {id:string;owner_id:string|null;pathname:string;title:string;kind:'plain'|'meme';layout:string;state:'pending'|'complete'|'rejected';expires_at:string|Date;}
export interface FeedbackRow extends Row {id:string;owner_id:string|null;name:string;message:string;rating:number;likes:number;status:'pending'|'approved'|'rejected';created_at:string|Date;liked?:boolean;}
export function neonQuery(url:string):Query {
 const sql=neon(url);
 return async(text,params=[])=>await sql.query(text,params,{fetchOptions:{signal:AbortSignal.timeout(15_000)}}) as Row[];
}
export class Repository {
 constructor(public query:Query){}
 async health(){await this.query('SELECT 1 AS ok');}
 async rate(key:string,seconds:number){
  const [row]=await this.query(`INSERT INTO rate_limits(key,used,expires_at) VALUES($1,1,now()+$2*interval '1 second')
   ON CONFLICT(key) DO UPDATE SET used=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.used+1 END,
   expires_at=CASE WHEN rate_limits.expires_at<=now() THEN now()+$2*interval '1 second' ELSE rate_limits.expires_at END RETURNING used,expires_at`,[key,seconds]);
  return {used:Number(row.used),expiresAt:new Date(String(row.expires_at))};
 }
 async createUpload(id:string,owner:string|null,meta:Metadata,createdAt?:string){
  const [row]=await this.query(`INSERT INTO upload_intents(id,owner_id,pathname,title,kind,layout,created_at) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,now())) RETURNING *`,[id,owner,`gallery/${id}.png`,meta.title,meta.kind,meta.layout,createdAt??null]);
  return row as UploadRow;
 }
 async upload(id:string){return (await this.query('SELECT * FROM upload_intents WHERE id=$1',[id]))[0] as UploadRow|undefined;}
 async authorizeUpload(id:string,owner:string,pathname:string){
  return (await this.query(`UPDATE upload_intents SET token_requests=token_requests+1 WHERE id=$1 AND owner_id=$2 AND pathname=$3 AND state='pending' AND expires_at>now() AND token_requests<3 RETURNING *`,[id,owner,pathname]))[0] as UploadRow|undefined;
 }
 async rejectUpload(id:string){await this.query("UPDATE upload_intents SET state='rejected' WHERE id=$1 AND state='pending'",[id]);}
 async finalize(id:string,url:string){
  const [row]=await this.query(`INSERT INTO gallery(id,owner_id,title,kind,layout,blob_path,blob_url,created_at)
   SELECT id,owner_id,title,kind,layout,pathname,$2,created_at FROM upload_intents WHERE id=$1 AND state IN ('pending','complete') AND (expires_at>now() OR state='complete')
   ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id WHERE gallery.blob_path=EXCLUDED.blob_path RETURNING *`,[id,url]);
  if(row)await this.query("UPDATE upload_intents SET state='complete' WHERE id=$1",[id]);
  return row as GalleryRow|undefined;
 }
 async galleries(cursor:Cursor|null=null){return await this.query('SELECT * FROM gallery WHERE deleted_at IS NULL AND ($1::timestamptz IS NULL OR (created_at,id)<($1::timestamptz,$2::uuid)) ORDER BY created_at DESC,id DESC LIMIT 101',[cursor?.createdAt??null,cursor?.id??null]) as GalleryRow[];}
 async gallery(id:string){return (await this.query('SELECT * FROM gallery WHERE id=$1',[id]))[0] as GalleryRow|undefined;}
 async deleteGallery(id:string){await this.query('UPDATE gallery SET deleted_at=COALESCE(deleted_at,now()) WHERE id=$1',[id]);}
 async blobDeleted(id:string){await this.query(`WITH removed AS (DELETE FROM gallery WHERE id=$1 AND deleted_at IS NOT NULL RETURNING id) UPDATE upload_intents SET state='rejected',owner_id=NULL,title='Deleted memory',expires_at=GREATEST(expires_at,now()+interval '15 minutes') WHERE id IN(SELECT id FROM removed)`,[id]);}
 async expiredUploads(){return await this.query(`SELECT pathname FROM upload_intents WHERE state<>'complete' AND expires_at<now() AND NOT EXISTS(SELECT 1 FROM gallery WHERE gallery.id=upload_intents.id) LIMIT 25`);}
 async removeExpiredUpload(pathname:string){await this.query('DELETE FROM upload_intents WHERE pathname=$1 AND NOT EXISTS(SELECT 1 FROM gallery WHERE gallery.id=upload_intents.id)',[pathname]);}
 async pendingDeletes(){return await this.query('SELECT id,blob_path FROM gallery WHERE deleted_at IS NOT NULL LIMIT 25');}
 async cleanupRates(){await this.query("DELETE FROM rate_limits WHERE expires_at<now()-interval '1 day'");}
 async feedback(owner:string|null,cursor:Cursor|null=null){return await this.query(`SELECT f.*,EXISTS(SELECT 1 FROM feedback_likes l WHERE l.feedback_id=f.id AND l.visitor_id=$1) AS liked FROM feedback f WHERE (status='approved' OR (owner_id=$1 AND status='pending')) AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT 101`,[owner,cursor?.createdAt??null,cursor?.id??null]) as FeedbackRow[];}
 async createFeedback(input:{id:string;owner:string|null;name:string;message:string;rating:number;fingerprint:string;status:string;likes?:number;createdAt?:string}){
  const [row]=await this.query(`INSERT INTO feedback(id,owner_id,name,message,rating,fingerprint,status,likes,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz,now())) ON CONFLICT DO NOTHING RETURNING *`,[input.id,input.owner,input.name,input.message,input.rating,input.fingerprint,input.status,input.likes??0,input.createdAt??null]);
  return row as FeedbackRow|undefined;
 }
 async like(id:string,owner:string){
  const [row]=await this.query(`WITH inserted AS (INSERT INTO feedback_likes(feedback_id,visitor_id) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM feedback WHERE id=$1 AND status='approved') ON CONFLICT DO NOTHING RETURNING feedback_id)
   UPDATE feedback SET likes=likes+(SELECT count(*)::integer FROM inserted) WHERE id=$1 AND status='approved' RETURNING *,true AS liked`,[id,owner]);
  return row as FeedbackRow|undefined;
 }
 async moderate(status:string){return await this.query('SELECT * FROM feedback WHERE status=$1 ORDER BY created_at ASC LIMIT 100',[status]) as FeedbackRow[];}
 async setFeedbackStatus(id:string,status:string){return (await this.query('UPDATE feedback SET status=$2 WHERE id=$1 RETURNING *',[id,status]))[0] as FeedbackRow|undefined;}
 async removeFeedback(id:string):Promise<Row|undefined>{return (await this.query('DELETE FROM feedback WHERE id=$1 RETURNING id',[id]))[0];}
 async feedbackById(id:string){return (await this.query('SELECT * FROM feedback WHERE id=$1',[id]))[0] as FeedbackRow|undefined;}
}
