// Vercel invokes this handler directly; a serverless function must not call listen().
import {createApp} from '../server/app.js';
import {serverlessHandler} from '../server/handler.js';
export default serverlessHandler(createApp());
