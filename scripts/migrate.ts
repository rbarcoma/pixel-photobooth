import {readFile} from 'node:fs/promises';
import {neon} from '@neondatabase/serverless';
import {MysqlRepository} from '../server/db/mysql.js';
const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
if(!url)throw Error('Set DATABASE_URL before running migrations.');
const mysql=url.startsWith('mysql://');
const schema=await readFile(new URL(`../server/db/${mysql?'schema.mysql.sql':'schema.sql'}`,import.meta.url),'utf8');
const statements=schema.split('-- statement-breakpoint').map(statement=>statement.trim()).filter(Boolean);
if(mysql){
 const repo=new MysqlRepository(url);
 try{for(const statement of statements)await repo.query(statement);}finally{await repo.close();}
}else{
 const sql=neon(url);await sql.transaction(statements.map(statement=>sql.query(statement)));
}
console.log(`Pixel Booth ${mysql?'MySQL':'PostgreSQL'} database schema is ready.`);
