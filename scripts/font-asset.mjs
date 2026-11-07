import {createHash} from 'node:crypto';

export const FONT_PATH = 'fonts/arcadeclassic.ttf';
export const FONT_MAX_BYTES = 2 * 1024 * 1024;
// Pin the existing asset so provisioning cannot silently replace the typography.
const FONT_SHA256 = 'af1addeae051a313bcc1964cec895e112a7a06c941ac8f7694e4b278442c048c';

export function validateFont(data) {
  if (data.length < 12 || data.length > FONT_MAX_BYTES || data.readUInt32BE(0) !== 0x00010000) {
    throw Error('The Arcade Classic asset is not a supported TrueType font. HTML error pages are not font files.');
  }
  if (createHash('sha256').update(data).digest('hex') !== FONT_SHA256) {
    throw Error('The font does not match the existing Arcade Classic asset. No replacement font was installed.');
  }
  return data;
}

export async function readFontResponse(response) {
  if (!response.ok) throw Error(`The font asset request returned HTTP ${response.status}.`);
  if (/text\/html|application\/json|text\/plain/i.test(response.headers.get('content-type') || '')) {
    throw Error('The font URL returned a document instead of a font. Check the asset path and SPA routing.');
  }
  if (Number(response.headers.get('content-length')) > FONT_MAX_BYTES) throw Error('The font asset is too large.');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > FONT_MAX_BYTES) {
      throw Error('The font asset is too large.');
    }
    chunks.push(chunk);
  }
  return validateFont(Buffer.concat(chunks));
}
