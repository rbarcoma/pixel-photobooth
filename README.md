# Pixel Booth

The React 19 + TypeScript + Vite photobooth, with an Express API supporting local MySQL and local gallery photos, or Vercel Functions with Neon PostgreSQL and Vercel Blob.

**Start with [LOCAL_SETUP.md](LOCAL_SETUP.md)** for local MySQL, or [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel hosting, cloud provisioning and production verification. Local setup does not deploy the application.

## Development

Use Node.js 24.x and Docker Desktop for local MySQL. See [LOCAL_SETUP.md](LOCAL_SETUP.md) for an existing MySQL server, data import and troubleshooting.

```bash
npm install
npm run setup:local
npm run dev
```

The frontend uses `http://localhost:5173`, with `/api` proxied to API port `3001` or `PORT`. MySQL runs on `127.0.0.1:3307` with a persistent Docker volume, and PNGs are stored in `server/data/photos/`. Setup generates ignored local credentials and uses automatic feedback publication. `API_PROXY_TARGET` can override the development proxy. `npm run build` generates `dist`; `npm run start` serves the built site with the configured API. Vercel instead serves `dist` and invokes `api/index.ts` without a listening server.

## Existing features retained

- Existing pixel/pastel design, animations, font files, navigation, portrait category cards and responsive styles.
- Plain strip/grid layouts and Meme layouts; side-by-side meme references, per-photo meme selection and the existing meme categories.
- Browser camera permission, mirrored camera capture, flip, automatic/manual capture, 3/5/10-second timers, retakes and PNG/JPEG/WEBP/GIF photo uploads.
- Existing filters, frame colors, editable/hideable footer caption, independent date display, pixel sticker categories, PokéAPI Pikachu, and direct sticker drag/resize/rotate/edit/delete controls.
- PNG exports, actual recorded-camera GIFs, upload-only GIF slideshows, browser printing, supported device file sharing, social links and clipboard flows.
- Optional gallery save with the existing **Cancel** and **Submit & save** confirmation. Photos upload to local disk or directly to Blob, according to server configuration.
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
- `server/db/schema.sql`, `server/db/schema.mysql.sql`: PostgreSQL and MySQL schemas.
- `server/db/mysql.ts`: MySQL queries, connection pool and transactional likes/rate limits.
- `server/db/repository.ts`: parameterized queries and atomic likes/rate limits.
- `server/blob.ts`, `server/local-storage.ts`: Vercel Blob and local photo storage adapters.
- `server/security.ts`, `server/validation.ts`: session ownership, authorization, limits and validation.
- `server/index.ts`: local standalone listener/static frontend only.
- `scripts/`: migrations, moderation, font preparation and deployment smoke verification.
- `tests/`: isolated API/routing and browser regression checks; excluded from Vercel uploads.
- `public/`: existing stickers, memes, font and license files.

## Existing fonts and artwork

The existing Arcade Classic file is `public/fonts/arcadeclassic.ttf`, with its license text in `public/fonts/pizzadudedotdk.txt`. It remains excluded from Git. Obtain the author's public webfont hosting/redistribution permission before publishing it, plus commercial permission when applicable. After permission, Git builds can provision the same exact asset through the build-only `ARCADE_FONT_BASE64` or `ARCADE_FONT_URL`; a local CLI deployment retains the file through `.vercelignore`. Prebuild and postbuild verify the original font, without replacing the typography. Use `npm run build` in Vercel so both hooks run. Follow the [font hosting and verification guide](./public/fonts/README.md).

[Arcade Classic's source page](https://www.1001fonts.com/arcadeclassic-font.html) and the bundled license retain their existing terms; this project does not grant redistribution/commercial permissions. The original DM Sans loading, styles and bundled sticker/meme assets remain unchanged. Keep any required artwork and font permissions when deploying.

## Troubleshooting

- **Local API returns 503:** start Docker Desktop, run `npm run setup:local`, and restart `npm run dev`. For cloud storage, follow the environment/schema steps in `DEPLOYMENT.md`.
- **Upload returns 413:** gallery PNGs are limited to 13 MiB and must use the current direct-upload client. Function JSON requests are limited to 4 MiB.
- **Write returns 403:** check `APP_ORIGIN`, allow essential ownership cookies, and verify the frontend calls the same-origin API. Only a saving browser or administrator can delete its photo.
- **Feedback is not public:** the default is manual moderation; review and approve the note with the administrator CLI.
- **A like does not increase again:** the server stores one like per browser/note and returns the existing count on repeated requests.
- **Camera unavailable:** use localhost or the deployed HTTPS origin, allow camera access, check device availability, or use Upload Photos. No microphone permission is requested.
- **Print/share unavailable:** allow print popups or use the existing PNG download/manual social upload fallback. Native file sharing depends on the browser/device.
