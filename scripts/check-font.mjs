import {readFile} from 'node:fs/promises';
import {FONT_PATH,validateFont,readFontResponse} from './font-asset.mjs';

try {
  const origin = process.argv[2];
  if (origin) {
    const site = new URL(origin);
    if (site.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(site.hostname)) {
      throw Error('Production font checks require HTTPS.');
    }
    const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? {'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET} : {};
    const response = await fetch(new URL(`/${FONT_PATH}`, site), {headers, signal: AbortSignal.timeout(20_000), redirect: 'manual'});
    await readFontResponse(response);
    console.log('PASS: the deployed URL serves the original Arcade Classic font bytes.');
  } else {
    validateFont(await readFile(`dist/${FONT_PATH}`));
    console.log(`PASS: dist/${FONT_PATH} contains the original Arcade Classic font.`);
  }
} catch (error) {
  console.error(error instanceof Error && !/https?:\/\//.test(error.message) ? error.message : 'Font verification failed.');
  process.exitCode = 1;
}
