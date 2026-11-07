# Deployment preparation verification

Final local verification: November 8, 2026 (Asia/Manila).

**Status: prepared locally; this checkout has not been deployed or fully production-verified.** No real Vercel Blob store, Neon database or production credentials were available for backend verification. The user subsequently supplied an existing production URL for the font investigation below. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) to provision resources, apply the schema, deploy and complete production verification.

## Automated checks

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | 20 passed, 0 failed | 17 API integration tests and 3 routing/font tests. Real PostgreSQL execution through isolated PGlite; an in-memory photo-store adapter replaces cloud storage. |
| `npm run build` | Passed | TypeScript validation and Vite production bundle; original local font present. |
| `npm audit --offline --json` | 0 reported vulnerabilities | Cached advisory data; this is not a guarantee against newly published vulnerabilities. The earlier online audit also reported zero. |
| `git diff --check` | Passed | No whitespace errors. |
| `npm run data:migrate` dry run | Passed during preparation | 7 gallery photos and 8 feedback records validated; no source records changed and nothing uploaded. |

The sandbox initially prevented the API tests from listening on localhost (`listen EPERM`). Running the same isolated tests with localhost access succeeded; no test was skipped or weakened.

API coverage includes signed ownership cookies, cross-origin rejection, missing configuration, preserved routes, large direct uploads, token ownership/path/type/size/expiry constraints, malformed PNG rejection, request-body limits, repeated finalization, authorized deletion, cleanup retries, pending-upload cancellation, persistent SQL rate limits, feedback moderation, concurrent like deduplication and pagination across matching timestamps. Routing tests use Vercel's routing transformer and verify API/static paths remain outside the SPA fallback.

## Browser checks completed during preparation

The browser harness at `tests/browser.html` reported PASS using the existing React components and styles, an isolated local API, a simulated camera and test storage transport:

- Plain and meme layouts, photo uploads, camera flip, timer selection, countdown/auto capture, per-shot meme references and captured GIF frames.
- Filters, sticker categories, Pikachu image handling, sticker drag/resize/rotate/delete, caption editing/hiding, independent date toggle and frame color.
- PNG export, GIF encoding, uploaded-photo GIF slideshow, print document generation and share payload construction.
- Gallery Cancel without upload; Submit through the Blob client SDK with test transport; preview and owner deletion.
- Pending feedback, administrator approval, persistent likes and duplicate-like prevention.

Print dialogs, operating-system sharing, physical camera access and Blob transport were simulated. These checks do not establish device compatibility or real cloud success. The actual PokéAPI Pikachu endpoint and sprite were separately fetched and decoded successfully during preparation.

The generated frontend bundle was checked for server-secret canaries; none were present. The existing font matched its built copy, and all 68 sticker/meme assets were retained. Core CSS, camera/editor components, compositor and GIF implementation were preserved by the deployment changes.

## Production font investigation and local fix

On November 8, 2026, read-only requests to `https://pixel-photobooth-nine.vercel.app` confirmed the HTML preload references `/fonts/arcadeclassic.ttf`, but that asset returns **404**. Its license text returns 200. The binary remains Git-ignored, explaining why it is missing from a Git build. The production font is not fixed yet because hosting permission is unconfirmed and no font was uploaded or deployed.

The font follow-up keeps all existing typography selectors, families, sizes, weights and spacing. The shared font face now loads the served TTF consistently instead of letting an installed desktop copy hide a missing asset. Vercel headers specify the TTF content type and revalidation caching. Prebuild supports a permitted Base64 or HTTPS build source; both prebuild and postbuild verify the exact original file by hash.

Verification completed:

- `npm run build` passed, including postbuild verification of the original font in `dist`.
- An isolated temporary checkout without the font successfully provisioned byte-identical data from `ARCADE_FONT_BASE64`. No network upload occurred.
- The tests reject a missing font, invalid Base64, a different font and an insecure source without installing an asset.
- Local Chrome screenshots confirmed the original pixel appearance on the landing heading, navigation, buttons, footer headings and How It Works heading.
- The font binary and original license remain unchanged and excluded from Git. No alternative font was installed.

After the author grants the necessary hosting/redistribution permission, follow [the font guide](./public/fonts/README.md), redeploy and run `npm run check:font -- https://pixel-photobooth-nine.vercel.app`. Then repeat browser font verification on the deployed pages. The current 404 must not be reported as resolved before that succeeds.

## Required production verification

These checks remain outstanding:

1. Provision separate Preview/Production Vercel Blob and Neon resources, configure the environment variables and apply `server/db/schema.sql`.
2. Run the read-only and authorized write smoke tests in DEPLOYMENT.md against Preview and then Production HTTPS URLs. Verify real uploads, metadata, feedback, likes, ownership and deletion.
3. Verify persistence after reload, a new browser session, a cold function instance and a redeployment. Confirm the authenticated maintenance cron is configured and operates successfully.
4. Use real devices to verify webcam permissions/flip/capture, GIF recording, image uploads, all decorations, exports, actual printing and supported file sharing.
5. Refresh frontend deep links directly and inspect the original font, responsive layouts, animations and gallery Cancel/Submit behavior on the deployed site.

Do not describe the deployment as complete until these checks succeed. The exact commands, environment-variable table, font provisioning options and manual feature checklist are in DEPLOYMENT.md.
