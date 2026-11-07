# Arcade Classic: production hosting

## Diagnosis

On November 8, 2026, `https://pixel-photobooth-nine.vercel.app/fonts/arcadeclassic.ttf` returned **404**, while the bundled license returned 200. The CSS and HTML correctly request `/fonts/arcadeclassic.ttf`, but the binary is Git-ignored and therefore absent from a Git-based Vercel build unless explicitly provisioned.

Vite copies `public/fonts/arcadeclassic.ttf` to `dist/fonts/arcadeclassic.ttf` unchanged. The correct browser URL is `/fonts/arcadeclassic.ttf`, not `/public/fonts/arcadeclassic.ttf`. No new font family, font weight, size, spacing or selector is needed.

## Permission is required before publishing

The existing font is Arcade Classic by Jakob Fischer. The unchanged bundled license, [pizzadudedotdk.txt](./pizzadudedotdk.txt), restricts use to non-commercial purposes and prohibits distribution without the author's permission. It does not grant explicit permission to publish a downloadable webfont.

**Public webfont hosting sends the font bytes to visitors.** A private Git repository, Base64 environment variable, private build source, CDN or Vercel Blob does not remove this permission requirement. Before uploading/deploying the font, obtain permission covering web embedding/self-hosting on your domain and commercial use if applicable. Contact the author through [pizzadude.dk](https://www.pizzadude.dk/faq) or the contact information in the original license. Keep the permission record and required notices. Do not assume a personal-use download grants web redistribution rights.

No font has been uploaded, committed, converted, replaced or publicly redistributed by this fix. The binary remains Git-ignored. Local builds use the existing local copy; publishing the generated build still requires the appropriate permission.

## Vercel setup after permission is obtained

Use the existing Vercel settings: **Vite**, build command **`npm run build`**, output directory **`dist`**. Do not override the command with `vite build`; that bypasses the font provisioning and verification hooks.

Choose one source for the exact existing TTF:

1. **Git deployment with a build-time environment variable:** encode your permitted local file on macOS and copy it directly to the clipboard:

   ```bash
   base64 < public/fonts/arcadeclassic.ttf | tr -d '\n' | pbcopy
   ```

   In Vercel Project Settings → Environment Variables, add `ARCADE_FONT_BASE64` with that clipboard value for Production and whichever Preview environments are authorized. Never add a `VITE_` prefix, put the value in Git or paste it into chat. This encoding is not encryption and grants no license rights. The existing 17,296-byte file encodes to about 23 KB; it can be configured without creating a public source URL.

2. **Git deployment with a permitted HTTPS build source:** instead set `ARCADE_FONT_URL` to a direct HTTPS URL for the same TTF. It must return the font bytes, not a download page, login page, ZIP or HTML redirect. A signed URL must remain valid at build time. Browser CORS on that source is unnecessary because the build server downloads it and the website serves it from its own origin.

3. **Local Vercel CLI deployment:** once hosting is authorized, the existing `.vercelignore` retains the local font. Keep the build command `npm run build` and deploy this checkout normally. Do not use `git add -f` as a workaround.

Configure only one of `ARCADE_FONT_BASE64` and `ARCADE_FONT_URL`. These variables are used only if the local font file is missing. Neither source changes the browser URL.

Prebuild validates the exact existing font by SHA-256 before writing a provisioned asset. Postbuild verifies that the same bytes reached `dist/fonts/arcadeclassic.ttf`. Missing/corrupt/different assets fail the build instead of silently changing the typography. These checks do not establish permission. Keep `.gitignore` and the original license unchanged.

Redeploy after setting the environment variable; changing an environment variable cannot add a file to an already-built deployment.

## Verification

```bash
npm run build
npm run check:font
npm run check:font -- https://pixel-photobooth-nine.vercel.app
```

The production check is read-only, does not require the database, and verifies status, response type and the original font hash. It rejects an HTML SPA fallback even if it returns 200. If Preview protection is enabled, use the authorized `VERCEL_AUTOMATION_BYPASS_SECRET` in your local environment; this checker does not follow redirects with that header.

In browser DevTools, disable cache and reload. Confirm `/fonts/arcadeclassic.ttf` returns 200, then inspect Rendered Fonts on the landing heading, navigation links, footer headings and page headings. The shared `@font-face` now consistently uses the served file instead of allowing an installed desktop font to hide a missing production asset. The HTML preload uses the same path and anonymous CORS mode. Vercel serves the TTF with `font/ttf` and revalidation caching; `/fonts/*` remains outside the SPA rewrite.

All existing typography assignments are retained: Arcade Classic for pixel headings, navigation, buttons and footer headings; DM Sans for body text, brand text, small labels and captions. Unsupported glyph fallbacks remain as before. No new loading screen, layout, font weight, size or spacing is introduced.

## Optional alternative, only with approval

[Silkscreen](https://github.com/googlefonts/silkscreen) is a pixel font distributed under the [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/silkscreen/OFL.txt), which permits embedding/redistribution subject to its conditions, including preserving the license/copyright notices. Its shapes and metrics differ from Arcade Classic and would need visual review. It is only a recommendation: no alternative font is installed or activated without approval.

References: [Vite public directory behavior](https://vite.dev/guide/assets.html#the-public-directory), [author's FAQ](https://www.pizzadude.dk/faq).
