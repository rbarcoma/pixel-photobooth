import type {Config} from './config.js';
import {Repository,neonQuery} from './db/repository.js';
import {MysqlRepository} from './db/mysql.js';
import {localStorage} from './local-storage.js';
import {vercelStorage} from './blob.js';

export function createRepository(config:Config){return config.database==='mysql'?new MysqlRepository(config.databaseUrl):new Repository(neonQuery(config.databaseUrl));}
export function createStorage(config:Config){return config.photoStorage==='local'?localStorage(config.photoDirectory):vercelStorage(config.blobToken);}
