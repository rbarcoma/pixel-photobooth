import {readFile} from 'node:fs/promises';
import {neon} from '@neondatabase/serverless';
const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
if(!url)throw Error('Set DATABASE_URL before running migrations.');
const sql=neon(url);
const schema=await readFile(new URL('../server/db/schema.sql',import.meta.url),'utf8');
const statements=schema.split('-- statement-breakpoint').map(statement=>statement.trim()).filter(Boolean);
await sql.transaction(statements.map(statement=>sql.query(statement)));
console.log('Pixel Booth database schema is ready.');
