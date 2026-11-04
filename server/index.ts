import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(root, 'server', 'data');
const galleryDirectory = path.join(dataDirectory, 'gallery');
mkdirSync(galleryDirectory, { recursive: true });
const galleryFile = path.join(dataDirectory, 'gallery.json');
const feedbackFile = path.join(dataDirectory, 'feedback.json');
const port = Number(process.env.PORT || 3001);

interface GalleryRecord { id: string; title: string; kind: 'plain' | 'meme'; layout: string; createdAt: string; imageUrl: string; }
interface FeedbackRecord { id: string; name: string; rating: number; message: string; likes: number; createdAt: string; }
function load<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, 'utf8')) as T[]; } catch { return []; }
}
function save<T>(file: string, value: T[]) { writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); }
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit: '19mb'}));
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.get('/api/health', (_request, response) => response.json({ok:true, service:'Pixel Booth'}));
app.get('/api/gallery', (_request, response) => response.json(load<GalleryRecord>(galleryFile).reverse()));
app.post('/api/gallery', (request, response) => {
  const {title, kind, layout, dataUrl} = request.body ?? {};
  if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,[\w+/=]+$/.test(dataUrl)) {
    response.status(400).json({error:'A PNG image is required.'}); return;
  }
  const image = Buffer.from(dataUrl.substring('data:image/png;base64,'.length), 'base64');
  if (image.length > 13 * 1024 * 1024 || image.length < 32 || image.subarray(1,4).toString('ascii') !== 'PNG') {
    response.status(413).json({error:'Invalid or oversized image (13 MB maximum).'}); return;
  }
  if (kind !== 'plain' && kind !== 'meme') { response.status(400).json({error:'Invalid layout category.'}); return; }
  const id = randomUUID();
  const record: GalleryRecord = {
    id, title: typeof title === 'string' ? title.trim().slice(0, 70) || 'Little moment' : 'Little moment',
    kind, layout: String(layout || '').slice(0, 30), createdAt: new Date().toISOString(), imageUrl: `/api/gallery/${id}/image`
  };
  writeFileSync(path.join(galleryDirectory, `${id}.png`), image);
  const all = load<GalleryRecord>(galleryFile);
  all.push(record); save(galleryFile, all);
  response.status(201).json(record);
});
app.get('/api/gallery/:id/image', (request, response) => {
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) { response.status(404).end(); return; }
  const file = path.join(galleryDirectory, `${request.params.id}.png`);
  if (!existsSync(file)) { response.status(404).end(); return; }
  response.setHeader('Cache-Control','public, max-age=3600');
  response.type('png').sendFile(file);
});
app.delete('/api/gallery/:id', (request, response) => {
  const records = load<GalleryRecord>(galleryFile);
  const record = records.find(item => item.id === request.params.id);
  if (!record) { response.status(404).json({error:'Photo not found.'}); return; }
  // In this local demo deletion is intentionally allowed without accounts.
  const imageFile = path.join(galleryDirectory, `${record.id}.png`);
  if (existsSync(imageFile)) unlinkSync(imageFile);
  save(galleryFile, records.filter(item => item.id !== record.id));
  response.json({ok: true});
});
app.get('/api/feedback', (_request, response) => response.json(load<FeedbackRecord>(feedbackFile).reverse()));
app.post('/api/feedback', (request, response) => {
  const name = String(request.body?.name || '').trim().slice(0, 35);
  const message = String(request.body?.message || '').trim().slice(0, 600);
  const rating = Number(request.body?.rating);
  if (!name || message.length < 5 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    response.status(400).json({error:'Please enter your name, a short review, and a rating from 1 to 5.'}); return;
  }
  const feedback: FeedbackRecord = {id:randomUUID(), name, message, rating, likes:0, createdAt:new Date().toISOString()};
  const all = load<FeedbackRecord>(feedbackFile); all.push(feedback); save(feedbackFile, all);
  response.status(201).json(feedback);
});
app.post('/api/feedback/:id/like', (request, response) => {
  const all = load<FeedbackRecord>(feedbackFile);
  const review = all.find(item => item.id === request.params.id);
  if (!review) { response.status(404).json({error:'Feedback not found.'}); return; }
  review.likes += 1; save(feedbackFile, all); response.json(review);
});

const builtSite = path.join(root, 'dist');
if (existsSync(builtSite)) {
  app.use(express.static(builtSite));
  app.get('*', (_request,response) => response.sendFile(path.join(builtSite, 'index.html')));
}
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('Pixel Booth API error', error);
  response.status(500).json({error:'Something went wrong. Please try again.'});
});
app.listen(port, () => console.log(`Pixel Booth API running at http://localhost:${port}`));
