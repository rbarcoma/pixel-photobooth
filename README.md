# Pixel Booth

The existing React 19 + TypeScript + Vite photobooth, with an Express API prepared for Vercel Functions, public Vercel Blob gallery photos, and Neon PostgreSQL metadata/feedback/likes.

**Start with [DEPLOYMENT.md](DEPLOYMENT.md)** for the exact Vercel settings, cloud provisioning, environment variables, schema migration, legacy-data migration, moderation commands and production verification. Preparation does not mean a production deployment has been completed.

## Development

Use Node.js 24.x. Configure development cloud credentials in the ignored `.env.local` file; no production runtime storage uses local JSON/PNG files.

```bash
npm ci
cp .env.example .env.local
# Fill the required values using development-only cloud resources.
npm run db:migrate
npm run dev
```

The frontend uses `http://localhost:5173`, with `/api` proxied to the existing local API port `3001` or `PORT`. `API_PROXY_TARGET` can override the development proxy. `npm run build` generates `dist`; `npm run start` can still serve the built site and cloud-backed API together on the configured local port. Vercel instead serves `dist` and invokes `api/index.ts` without a listening server.

## Existing features retained

- Existing pixel/pastel design, animations, font files, navigation, portrait category cards and responsive styles.
- Plain strip/grid layouts and Meme layouts; side-by-side meme references, per-photo meme selection and the existing meme categories.
- Browser camera permission, mirrored camera capture, flip, automatic/manual capture, 3/5/10-second timers, retakes and PNG/JPEG/WEBP/GIF photo uploads.
- Existing filters, frame colors, editable/hideable footer caption, independent date display, pixel sticker categories, PokéAPI Pikachu, and direct sticker drag/resize/rotate/edit/delete controls.
- PNG exports, actual recorded-camera GIFs, upload-only GIF slideshows, browser printing, supported device file sharing, social links and clipboard flows.
- Optional gallery save with the existing **Cancel** and **Submit & save** confirmation. Photos now upload directly to Blob without crossing the Function body-size limit.
- Public gallery viewing/download/sharing and browser-owner/administrator-authorized deletion.
- Feedback wall, ratings and persistent likes, with pending moderation by default, one stored like per browser/note, input validation and persistent rate limits.

Camera frames, draft photos, editor state and GIF frames stay in browser memory until the user explicitly submits a final PNG to the public gallery. The application never automatically posts images to social platforms.

## Verification

```bash
npm test
npm run check
npm run build
npm audit
```

The SQL/API tests use an isolated PostgreSQL engine and test photo adapter; they do not need real cloud credentials. The browser harness and real deployment smoke tests are documented in [DEPLOYMENT.md](DEPLOYMENT.md). Production is unverified until both its HTTPS browser features and backend/cloud writes pass.

## Source layout

- `src/`: retained React pages/components/styles and browser photobooth/export logic.
- `api/index.ts`: Vercel serverless entry point.
- `server/app.ts`: shared Express REST API.
- `server/handler.ts`: Vercel rewrite adapter.
- `server/db/schema.sql`: persistent PostgreSQL schema.
- `server/db/repository.ts`: parameterized queries and atomic likes/rate limits.
- `server/blob.ts`: Vercel Blob storage adapter.
- `server/security.ts`, `server/validation.ts`: session ownership, authorization, limits and validation.
- `server/index.ts`: local standalone listener/static frontend only.
- `scripts/`: migrations, moderation, font preparation and deployment smoke verification.
- `tests/`: isolated API/routing and browser regression checks; excluded from Vercel uploads.
- `public/`: existing stickers, memes, font and license files.

## Existing fonts and artwork

The existing Arcade Classic file is `public/fonts/arcadeclassic.ttf`, with its license text in `public/fonts/pizzadudedotdk.txt`. The existing project intentionally excludes that font from Git. A local Vercel CLI upload retains it through `.vercelignore`; Git builds must supply the same permitted asset through `ARCADE_FONT_URL` or their build checkout. The prebuild refuses a missing font so the design does not silently fall back.

[Arcade Classic's source page](https://www.1001fonts.com/arcadeclassic-font.html) and the bundled license retain their existing terms; this project does not grant redistribution/commercial permissions. The original DM Sans loading, styles and bundled sticker/meme assets remain unchanged. Keep any required artwork and font permissions when deploying.

## Troubleshooting

- **API returns 503:** configure all required server environment variables, initialize the schema, check the Blob store is public, and verify the credentials target the intended environment.
- **Upload returns 413:** gallery PNGs are limited to 13 MiB and must use the current direct-upload client. Function JSON requests are limited to 4 MiB.
- **Write returns 403:** check `APP_ORIGIN`, allow essential ownership cookies, and verify the frontend calls the same-origin API. Only a saving browser or administrator can delete its photo.
- **Feedback is not public:** the default is manual moderation; review and approve the note with the administrator CLI.
- **A like does not increase again:** the server stores one like per browser/note and returns the existing count on repeated requests.
- **Camera unavailable:** use localhost or the deployed HTTPS origin, allow camera access, check device availability, or use Upload Photos. No microphone permission is requested.
- **Print/share unavailable:** allow print popups or use the existing PNG download/manual social upload fallback. Native file sharing depends on the browser/device.
