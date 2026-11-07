import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 return {plugins:[react()],server:{port:5173,host:'0.0.0.0',proxy:{'/api':process.env.API_PROXY_TARGET||env.API_PROXY_TARGET||`http://localhost:${process.env.PORT||env.PORT||3001}`}},build:{outDir:'dist'}};
});
