# Pixel Booth on Vercel

This checkout is prepared for Vercel, Vercel Blob and Neon PostgreSQL. **No production deployment has been performed or verified by this preparation.** A successful local build or isolated test is not evidence that production credentials, cloud permissions, camera access or persistent writes work. Complete the production verification below before calling the deployment complete.

The React application, CSS, components, assets, camera pipeline and browser-side exports are retained. The Express API runs as a Vercel Node.js function, and optional local `npm run start` still serves the built frontend with that same API. Runtime gallery/feedback storage no longer writes JSON or photos to the local filesystem.

## 1. Requirements and exact Vercel settings

Run commands from the existing project root:

```bash
cd "/Users/renantebarcoma/Downloads/PHOTOBOOTH/WEBSITE/pixel-booth 3"
node --version
npm ci
```

Use Node.js **24.x**. `.nvmrc` and `package.json#engines` select this major version. With nvm, run `nvm install` followed by `nvm use`.

| Vercel setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root directory | This project directory, the one containing `package.json` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 24.x |
| API function | `api/index.ts` |
| Function maximum duration | 60 seconds, declared in `vercel.json` |
| Production domain | Your Vercel HTTPS domain or custom HTTPS domain |
| Function/database region | Choose the same region in Vercel and Neon where practical; the code does not force a region |

Do not configure a frontend development server or `npm run start` as a Vercel start command. Vercel serves `dist` and invokes the API function. Do not add an unconditional SPA rewrite above the `/api` rule.

`vercel.json` handles `/api/*` first, then frontend deep links. `/assets/*` and `/fonts/*` remain static requests. Unknown API endpoints return JSON 404 responses. The adapter in `server/handler.ts` supports both original API URLs and Vercel's rewritten `/api?path=...` form. The configured `Permissions-Policy` permits same-origin webcam access and does not grant microphone or location access.

## 2. Provision separate cloud resources

1. Create/link a Vercel project. You may use the dashboard or run:

   ```bash
   npx vercel@latest login
   npx vercel@latest link
   ```

2. In the Vercel project's Storage area, create/connect a **public Vercel Blob store**. The existing gallery is public and only publishes after the user confirms submission. Connect the store to Production. Its server credential is `BLOB_READ_WRITE_TOKEN`.
3. Create a **Neon PostgreSQL** project/database, directly in Neon or through the Vercel Marketplace integration. Copy its provided connection string to `DATABASE_URL`. The HTTP-based Neon driver is used, so a separate long-lived connection pool is unnecessary. A supplied `POSTGRES_URL` remains an accepted fallback.
4. Use separate Blob stores, Neon databases/branches and secrets for Preview/Development and Production. A preview must not write test content into the production gallery.
5. Keep the Blob store public; switching it to private requires a different image delivery design and is not configured here. Photos are intentionally public after confirmation.

No Vercel account, Neon database or Blob store is created by merely installing the npm packages or running `npm run build`.

## 3. Required environment variables

Set these in Vercel Project Settings → Environment Variables for **each environment that you use**. Copy `.env.example` to `.env.local` only for development and fill it locally. Never paste credentials into source, Git, screenshots or chat.

| Variable | Required | Value/purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string, including its supplied SSL parameters. `POSTGRES_URL` is an accepted fallback. |
| `BLOB_READ_WRITE_TOKEN` | Yes | Server read/write token for that environment's public Blob store. |
| `SESSION_SECRET` | Yes | Independent random secret of at least 32 characters; signs anonymous ownership cookies and hashes rate-limit identities. Keep stable across redeployments. |
| `ADMIN_API_TOKEN` | Yes | Different random secret of at least 32 characters; server/CLI moderation and administrator deletion only. |
| `CRON_SECRET` | Yes | Different random secret of at least 32 characters; authenticates Vercel's maintenance cron. |
| `APP_ORIGIN` | Yes for a predictable setup | Exact frontend origin, such as `https://your-project.vercel.app`, without a path. HTTPS is mandatory in production. If omitted, the Vercel production project hostname is used when available. |
| `FEEDBACK_MODERATION` | Optional | `manual` by default; notes await approval. `auto` publishes validated notes immediately while retaining rate limits, deduplication and admin removal. Use `manual` for the public launch. |
| `PORT` | Local only | Existing local API port, default `3001`. Vercel does not use `app.listen()`. |
| `API_PROXY_TARGET` | Local only, optional | Vite development proxy override. Default is `http://localhost:${PORT or 3001}`. |
| `ARCADE_FONT_URL` | Conditional, build only | HTTPS URL of your permitted copy of the existing Arcade Classic font, only when the deployment checkout does not already contain it. |
| `ARCADE_FONT_BASE64` | Conditional, build only | Alternative to `ARCADE_FONT_URL`: Base64 of the exact existing TTF, after permission for public webfont hosting is obtained. Never use a `VITE_` prefix. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional, verification tools only | An authorized deployment-protection bypass secret for testing a protected preview. Never expose it to frontend code. |

Generate **three independent values**, one for each secret:

```bash
openssl rand -hex 32
```

Run the command separately for `SESSION_SECRET`, `ADMIN_API_TOKEN` and `CRON_SECRET`. Store the values in the environment-variable dashboard or your password manager. Do not reuse the sample test fixtures, change-me placeholders or one secret across all environments.

Do not use `VITE_` prefixes for any credentials. Vite exposes `VITE_*` values to browser bundles. `.env*`, `.vercel/` and local photo data are ignored; `.env.example` contains no credentials. Vercel's normal system hostname variables allow that deployment's preview origin in addition to `APP_ORIGIN`; arbitrary request Host/Origin headers are not trusted.

### Existing font and assets

The local `public/fonts/arcadeclassic.ttf` is intentionally Git-ignored by the existing project because of its license restrictions. **A Git deployment will not receive that ignored file automatically.** The production prebuild fails if the font is absent or differs from the existing asset; postbuild checks the copied asset in `dist`. Public webfont delivery requires the author's hosting/redistribution permission, and commercial use requires the applicable permission. The bundled license alone does not establish those rights. Do not deploy/upload the font while permission is unconfirmed.

After obtaining permission, choose one method:

- **Local CLI upload:** use `npx vercel@latest` from this checkout. `.vercelignore` excludes secrets, local data and tests while retaining the existing local font and public assets.
- **Git integration:** configure `ARCADE_FONT_BASE64` or `ARCADE_FONT_URL` to provision your permitted font only when it is missing. The Base64 option avoids needing a publicly hosted build source; it still requires permission for the resulting webfont distribution. Configure only one source. Keep the Vercel build command `npm run build`, including its hooks.

Keep `public/fonts/pizzadudedotdk.txt` and the other existing assets. No font or image is replaced by this deployment change.

See [the font hosting guide](./public/fonts/README.md) for the exact clipboard/environment-variable steps, observed production 404, licensing requirements and `npm run check:font -- https://YOUR-DOMAIN` verification. Redeploy after configuring the font source. A successful build alone does not confirm that the current production deployment serves it.

## 4. Initialize PostgreSQL before serving requests

Apply the schema to **each environment's database**. The migration consists of idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements and does not delete existing local files.

For a local development configuration:

```bash
cp .env.example .env.local
# Fill the development cloud credentials in .env.local.
npm run db:migrate
npm run dev
```

For Vercel Production, pull its environment into a Git-ignored file and use that file explicitly:

```bash
npx vercel@latest env pull .env.production.local --environment=production
node --env-file=.env.production.local --import tsx scripts/migrate.ts
```

For a separate Preview database:

```bash
npx vercel@latest env pull .env.preview.local --environment=preview
node --env-file=.env.preview.local --import tsx scripts/migrate.ts
```

Alternatively, execute `server/db/schema.sql` in the appropriate Neon SQL editor. A deployment build does not perform database migrations automatically. Never put production connection strings directly in shell arguments. Use a database role with only the runtime privileges needed after initializing the schema if your operational setup supports separate roles.

## 5. Migrate existing local gallery/feedback, if present

Back up `server/data/` first. The migration script reads the existing PNG/JSON files and leaves them unchanged. It validates image bytes and metadata before applying anything.

```bash
npm run data:migrate
```

This is a **dry run** by default and needs no cloud credentials. To copy the data into your production cloud stores:

```bash
node --env-file=.env.production.local --import tsx scripts/migrate-local.ts --apply
```

The migration preserves original record IDs, timestamps and feedback like totals, and skips records already imported. Legacy photos have no reliable historical browser owner; they are administrator-deletable rather than being assigned to an arbitrary visitor. Imported feedback starts pending and must be reviewed/approved through the moderation commands below. If the script reports an invalid legacy record or a conflicting existing cloud object, resolve it explicitly; it does not silently overwrite the data.

## 6. Deploy Preview, verify, then deploy Production

From this existing checkout:

```bash
npm test
npm run build
npx vercel@latest
```

Run read-only checks against the literal Preview HTTPS URL returned by Vercel:

```bash
npm run smoke -- https://YOUR-PREVIEW-URL.vercel.app
```

For protected previews, set the authorized `VERCEL_AUTOMATION_BYPASS_SECRET` for the smoke-test process. The script sends it only to the tested Vercel origin, not to Blob image URLs.

Run the write verification with **Preview environment credentials**. It creates temporary test photos/feedback and cleans them up:

```bash
SMOKE_ALLOW_WRITES=true node --env-file=.env.preview.local --import tsx scripts/smoke.ts https://YOUR-PREVIEW-URL.vercel.app --write
```

After Preview verification succeeds, deploy the same checkout to Production:

```bash
npx vercel@latest --prod
```

Then repeat verification with the actual Production URL and **Production credentials**:

```bash
node --env-file=.env.production.local --import tsx scripts/smoke.ts https://YOUR-PRODUCTION-DOMAIN
SMOKE_ALLOW_WRITES=true node --env-file=.env.production.local --import tsx scripts/smoke.ts https://YOUR-PRODUCTION-DOMAIN --write
```

The write script uploads a PNG larger than the Vercel Function body limit directly to Blob, finalizes its database record, retrieves its image, verifies unauthorized deletion is refused, submits/moderates feedback, checks duplicate likes and deletes its test records. Do not call the deployment complete if any check fails or photo deletion remains pending.

Do not set a storage token in the frontend to make failed uploads work. Fix the server environment, database schema, store access mode or origin configuration and redeploy.

## 7. Manual production browser verification (required)

The automated HTTP test cannot verify physical webcam permissions, actual printing or an operating-system share sheet. On the deployed HTTPS URL, verify:

- Open/refresh `/layouts`, `/layouts/plain`, `/layouts/meme`, `/gallery`, `/feedback`, `/privacy`, `/terms` and `/cookies` directly. Confirm the existing fonts, colors, card layout, animations and responsive behavior.
- Allow the webcam on that origin. Test camera startup, front/back flip where supported, 3/5/10-second timers, auto capture, click capture, retakes and uploaded PNG/JPEG/WEBP/GIF photos. Deny permission once and verify Upload Photos still works.
- In Meme mode, choose per-photo references beside the camera. Confirm references follow the active shot and the choices remain in the editor.
- Test all filters, sticker categories, actual PokéAPI Pikachu loading, drag/resize/rotate/edit/delete controls, caption editing/hiding, independent date toggle, and frame colors.
- Download PNG and a live-recorded GIF. Start another session using only uploaded photos and download its GIF slideshow. Confirm exported images contain no editing controls.
- Open Print and verify the real print dialog. Test device file sharing on a supported phone/browser. Test social-link/clipboard flows without assuming a browser can post images automatically to social platforms.
- Open Add to gallery and **Cancel**: no upload should occur. Submit a test photo: confirm it appears after page reload and a new browser session, and remains after a redeploy.
- In the saving browser, confirm Delete Cancel preserves the photo and Delete photo removes it. In another browser, confirm the owner-only Delete control is absent and the server refuses unauthorized deletion.
- Submit feedback. With manual moderation it is visible only to its submitting browser until approved. Approve it, verify public display and persistent likes, and confirm repeat likes from the same browser do not increase the count.
- Run the daily maintenance endpoint with its authorization in a controlled verification if deletion or unfinished-upload cleanup needs checking. Confirm the Vercel cron is present in the project's Cron Jobs settings.

Camera access requires HTTPS or localhost, a user permission grant and usable device hardware. The code and permissions header enable same-origin camera access; they cannot bypass user/device permission denial. Some desktop browsers do not support file sharing, and some devices do not have a rear camera. Existing download/upload fallbacks are retained.

## 8. Administration and maintenance

Keep `ADMIN_API_TOKEN` on the server or in a local ignored environment file. The application does not add an admin token field or a new login UI.

```bash
# Review up to 100 oldest pending notes.
node --env-file=.env.production.local --import tsx scripts/moderate.ts https://YOUR-PRODUCTION-DOMAIN list pending
# Approve or reject an individually reviewed note.
node --env-file=.env.production.local --import tsx scripts/moderate.ts https://YOUR-PRODUCTION-DOMAIN approve FEEDBACK_UUID
node --env-file=.env.production.local --import tsx scripts/moderate.ts https://YOUR-PRODUCTION-DOMAIN reject FEEDBACK_UUID
# Remove a note or a legacy/owner-requested gallery photo.
node --env-file=.env.production.local --import tsx scripts/moderate.ts https://YOUR-PRODUCTION-DOMAIN delete-note FEEDBACK_UUID
node --env-file=.env.production.local --import tsx scripts/moderate.ts https://YOUR-PRODUCTION-DOMAIN delete-photo PHOTO_UUID
```

The daily cron calls `GET /api/maintenance` at **03:17 UTC (11:17 AM Asia/Manila)**, using Vercel's `Authorization: Bearer <CRON_SECRET>` header. It retries failed photo deletions, removes expired/abandoned uploads in bounded batches, and prunes expired abuse-prevention counters. A high-volume deployment should increase the maintenance frequency/batch processing according to its Vercel plan; each invocation handles at most 25 unfinished uploads and 25 pending photo deletions.

Deleting a photo first hides its API/gallery entry. Successful Blob deletion removes its gallery metadata. A redacted rejected upload intent temporarily remains so an already-issued upload token cannot leave an untracked re-upload; maintenance removes it after expiration. If storage is temporarily unavailable, the API returns `202` and maintenance retries deletion. Previously public CDN copies can remain cached briefly; Blob cache TTL is set to 60 seconds for new uploads. Published photos and approved feedback do not otherwise expire automatically.

## 9. API compatibility, limits and protections

| Existing endpoint | Production behavior |
| --- | --- |
| `GET /api/health` | Checks PostgreSQL and Blob access; returns 503 when unavailable/misconfigured. |
| `GET /api/gallery` | Same array shape, plus owner-specific `canDelete` and `downloadUrl`; paged through `X-Next-Cursor`. The existing frontend follows pages automatically. |
| `POST /api/gallery` | Finalizes an owned direct upload by `{uploadId}`. Legacy small `{title,kind,layout,dataUrl}` PNG requests remain supported. |
| `GET /api/gallery/:id/image` | Same route; redirects to the stored Blob image, avoiding Function response-size limits. `?download=1` uses Blob's download URL. |
| `DELETE /api/gallery/:id` | Owner-authorized or administrator-authorized deletion; can also cancel an unfinished owned upload. |
| `GET /api/feedback` | Approved public notes plus the caller's pending notes, paged with the same array response. |
| `POST /api/feedback` | Validated, rate-limited, duplicate-protected submission; pending by default. |
| `POST /api/feedback/:id/like` | Persistent, atomic, idempotent one-like-per-browser operation for approved notes. |

New supporting endpoints are `GET /api/session`, `POST /api/gallery/prepare`, `POST /api/gallery/upload`, `GET/PATCH/DELETE /api/admin/feedback[...]` and `GET /api/maintenance`.

Limits are enforced on the server, not just HTML fields:

- Gallery PNGs: **13 MiB**, complete PNG signature and decoder validation, at most **16 megapixels**, each dimension at most **8192**. The original local photo-upload formats/15 MB browser limit remain unchanged.
- Function JSON body: **4 MiB**; larger gallery photos use browser → Blob uploads and small metadata requests. Vercel has a 4.5 MB Function payload limit. Direct legacy JSON uploads larger than that platform limit cannot be supported by a Function; the current UI transparently uses direct Blob uploads instead.
- Upload authorization: signed short-lived Blob tokens, one exact server-generated filename, PNG content type, no overwrite, at most three token requests for an owned pending intent. Finalization never trusts a client-supplied remote image URL.
- Gallery submissions: **10/hour** per network address and browser; token generation **30/hour**; finalization **60/hour**; deletion **30/hour**.
- Feedback submissions: **5/hour** per network address/browser; strict name/message/rating checks, duplicate-content protection, repeated-character/excessive-link rejection and a honeypot field check.
- Likes: **60/hour** per network address/browser and a database uniqueness constraint per note/browser. This is not proof of one vote per human; clearing cookies changes the browser identity, while network limits still apply.
- General mutations: **120/minute**; reads **600/minute** per network address; health **20/minute**; session creation/checks **60/10 minutes**.
- Ownership cookie: signed, HttpOnly, SameSite=Lax, Secure on HTTPS, host-only, up to one year. Clearing it, changing browsers or rotating `SESSION_SECRET` loses anonymous ownership proof; the administrator can process deletion requests.

Rate-limit counters live in PostgreSQL and survive separate/cold Function instances. Network identifiers are stored as keyed hashes, not raw IP addresses. Browser write requests require an allowed Origin, a session cookie and a custom header; the API does not enable wildcard CORS. Administrator and cron routes require their independent bearer secrets. Responses do not reveal owner IDs, Blob tokens or database credentials.

## 10. Local verification and its limits

```bash
npm test
npm run check
npm run build
npm audit
```

API tests use the real PostgreSQL engine in PGlite and an isolated in-memory photo-store adapter. They validate SQL constraints/concurrency, ownership, upload tokens/limits, PNG decoding, moderation, like deduplication, pagination, deletion recovery, and Vercel rewrite transformation. They do not contact or verify your actual Neon/Blob accounts.

To run the complete browser test harness without using a real webcam or cloud account:

```bash
# Terminal 1: isolated test API, bound to 127.0.0.1:3101
npm run test:server
# Terminal 2: separate frontend using only that isolated API
API_PROXY_TARGET=http://127.0.0.1:3101 npm run dev:web -- --port 5180 --host 127.0.0.1
```

Open `http://127.0.0.1:5180/tests/browser.html`. This harness runs the existing components with a simulated camera, test-only Blob transport, and simulated print/share/device-download actions. It verifies camera/editor flows and actual client API integration while keeping test content isolated. Its test-only credentials are not production secrets. `tests/` is excluded from Vercel uploads and no test entry is part of `dist`.

Physical camera, print/share UI, true cloud persistence and cold starts, deployment protection, provider permissions, HTTPS behavior, cron execution, and redeploy persistence must still be verified on the real deployment. Keep the existing operator/privacy/retention information current for your actual service; the policy pages remain operator templates.

## References

- [Vite deployments and SPA deep links](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel Blob client uploads](https://vercel.com/docs/vercel-blob/client-upload)
- [Vercel Function payload limits](https://vercel.com/docs/functions/limitations)
- [Neon serverless driver and SQL transactions](https://neon.com/docs/serverless/serverless-driver)
- [Vercel environment-variable CLI](https://vercel.com/docs/cli/env)
- [Securing Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
