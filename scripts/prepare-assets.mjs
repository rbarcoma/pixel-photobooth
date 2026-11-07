import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {FONT_PATH,FONT_MAX_BYTES,validateFont,readFontResponse} from './font-asset.mjs';

const target = `public/${FONT_PATH}`;
try {
  if (!existsSync(target)) {
    let data;
    if (process.env.ARCADE_FONT_BASE64 && process.env.ARCADE_FONT_URL) {
      throw Error('Configure only one font source: ARCADE_FONT_BASE64 or ARCADE_FONT_URL.');
    }
    if (process.env.ARCADE_FONT_BASE64) {
      const encoded = process.env.ARCADE_FONT_BASE64.replace(/\s/g, '');
      if (encoded.length > Math.ceil(FONT_MAX_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
        throw Error('ARCADE_FONT_BASE64 must contain only the Base64-encoded existing TTF file.');
      }
      data = validateFont(Buffer.from(encoded, 'base64'));
    } else if (process.env.ARCADE_FONT_URL) {
      const url = new URL(process.env.ARCADE_FONT_URL);
      if (url.protocol !== 'https:') throw Error('ARCADE_FONT_URL must use HTTPS.');
      const response = await fetch(url, {signal: AbortSignal.timeout(20_000)});
      data = await readFontResponse(response);
    } else {
      throw Error('The existing Arcade Classic font is missing. After obtaining web-hosting permission, configure ARCADE_FONT_BASE64 or ARCADE_FONT_URL for Git builds, or use the permitted local asset. See public/fonts/README.md.');
    }
    mkdirSync('public/fonts', {recursive: true});
    writeFileSync(target, data);
  }
  validateFont(readFileSync(target));
  console.log('Existing Pixel Booth font is available and matches the original asset.');
} catch (error) {
  // Do not log configured URLs, Base64 font contents or credential-bearing errors.
  console.error(error instanceof Error && !/https?:\/\//.test(error.message) ? error.message : 'Font provisioning failed. Check your permitted build-time font source.');
  process.exitCode = 1;
}
