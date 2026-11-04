# ✦ Pixel Booth

A soft pastel, pixel-styled photobooth web application made with **React 19 + TypeScript + Vite** and a **Node.js / Express** backend. The meme and sticker collections are extracted and optimized from the four uploaded ZIP archives.

## Quick start

**Requirements:** Node.js 20 or newer; a modern Chrome, Edge, Firefox or Safari browser.

```bash
cd pixel-booth
npm install
npm run dev
```

Open **http://localhost:5173**. The web UI runs on port **5173** and the persistent Node.js API runs on port **3001**. Both are started by `npm run dev`. Vite proxies `/api` calls to the API. Allow the browser to access your camera when asked. Browsers typically only enable camera access on **localhost or HTTPS**.

### Production build

```bash
npm run build
npm run start
```

This serves the built React frontend and API together on **http://localhost:3001** (or the port set by `PORT`). To deploy publicly, use HTTPS and secure server storage; read the production precautions below first.

## User experience

1. **Landing page** with Home, How it works, Layouts, Gallery, Feedback, Instagram, and dedicated Privacy / Terms / Cookie pages.
2. **Layout chooser:** Plain (2, 3, 4-strip, 2×2, 3×2), Meme (2×2, 3×2, 4×2 side-by-side photo + meme), and Coming Soon.
3. **Photo session:** camera permission and mirrored live preview, auto capture or click to capture, 3/5/10-second timer, retake any slot, flip cameras when supported, or upload multiple PNG/JPEG/WEBP/GIF photos.
4. **Decorate:** 7 filters (Original, B&W, Retro, Soft, Golden, Cool, Pixel), 35 draggable / rotatable / resizable uploaded pixel stickers, custom draggable text, selectable text color and size, capture date, 10 frame swatches or custom color, and 33 changeable memes organized into Animal / Animation / People.
5. **Save:** PNG download, actual animated GIF built from sampled camera moments (or photo slideshow if only uploads), print-ready browser print dialog, native device file sharing where supported, and social links/manual upload instructions. The **Add to gallery** button opens a confirmation with **Cancel** and **Submit**.
6. **Gallery:** saved PNGs and captions persist on the Node.js server, can be previewed, downloaded, shared as links (public deployments only), and deleted.
7. **Feedback:** an empty prompt before the first review; afterwards, notes loop right-to-left. Visitors can submit a name, 1–5 stars, and comments, and like the notes.

## Project structure

```text
pixel-booth/
├── index.html                # React application HTML entry
├── src/
│   ├── main.tsx              # Browser routes
│   ├── styles.css            # Theme and responsive styles
│   ├── pages/                # Landing, chooser, capture, editor, gallery, feedback, policies
│   ├── components/           # Shared header, footer, modal, previews
│   ├── context/              # Photobooth session state
│   ├── lib/                  # Canvas export, image processing, API, GIF, types
│   ├── generated/assets.ts   # Asset manifest generated from ZIPs
│   └── types/gifenc.d.ts      # TypeScript declarations for GIF encoder
├── public/
│   ├── assets/stickers/      # 35 optimized PNGs
│   ├── assets/memes/         # 33 JPGs, animal / animation / people
│   └── fonts/README.md      # How to enable Arcade Classic
├── server/
│   ├── index.ts              # Express REST API and static website
│   └── data/                # Locally persisted gallery PNGs and feedback
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## About the requested Arcade Classic font

The requested font is from https://www.1001fonts.com/arcadeclassic-font.html. That page describes it as **free for personal use, not commercial use**, and its author specifically **disallows distribution**. A copy is installed locally at `public/fonts/arcadeclassic.ttf` and excluded from Git. The original license is retained in `public/fonts/pizzadudedotdk.txt`. Arcade Classic is reserved for major website headings and the photo composition title, with a monospace fallback if the local file is missing or a glyph is unsupported. Body copy, navigation, controls, smaller titles and export captions use the original DM Sans font loaded from Google Fonts, with a sans-serif fallback. For a new checkout, download your own permitted copy from the source and save it at the same path. Obtain suitable permission before commercial use or distributing the font, including in a public deployment.

## GIF, photo exports, printing and social shares

- **PNG:** final decorated composition at native resolution (not a screenshot of the editor UI).
- **GIF:** records up to 36 real, mirrored camera sample frames (~240ms per GIF frame) as you capture. If the whole session consisted of uploaded photos, creates an animated slideshow. GIFs are 320×260 pixels to keep downloads manageable. Animated GIFs are a live-moment souvenir, not an animation of the full static decorated print layout.
- **Print:** opens a separate print-ready browser page with the final composition. You can print physically or use the browser's Save as PDF option. Popups must be allowed.
- **Share:** native file sharing works on browsers/devices that implement the Web Share API. For Instagram, Facebook and Messenger, browser integrations generally **cannot automatically post/attach the image**. Download the PNG and upload it through the desired app. On a public deployment, Facebook can share a saved gallery link; localhost URLs are not accessible to other people.

## API and data storage

| Endpoint | Function |
| --- | --- |
| `GET /api/health` | API health check |
| `GET /api/gallery` | List saved gallery photos |
| `POST /api/gallery` | Confirmed PNG upload with caption/category/layout |
| `GET /api/gallery/:id/image` | Retrieve a saved PNG |
| `DELETE /api/gallery/:id` | Delete a saved photo |
| `GET /api/feedback` | List posted feedback |
| `POST /api/feedback` | Submit name, rating and message |
| `POST /api/feedback/:id/like` | Increment a feedback note's like count |

The API saves PNGs to `server/data/gallery/`, and JSON records to `server/data/gallery.json` and `server/data/feedback.json`. The application starts with an **empty gallery and feedback wall**. Temporary session photos and GIF frames are kept in browser memory and are not automatically uploaded.

## Important before public launch

This is a **fully featured local prototype**, not a security-hardened multi-user photo-hosting service. The public gallery demo has **no login or ownership authentication**, its delete endpoint is open to users, and feedback has **no moderation, rate limits or vote-abuse prevention**. Before production, add authentication and per-photo ownership, admin moderation/reporting, CSRF/rate limits, upload quota/storage limits, verified content deletion, safe backups, privacy contact and a retention policy. Use HTTPS, secure access to stored images, and obtain any necessary rights to redistribute the supplied stickers and meme pictures.

The Privacy, Terms and Cookie pages are detailed **starter policy copy**, not legal advice. Add the real website operator's name, contact information and verified production data practices before public deployment.

## Troubleshooting

- **Camera unavailable?** Use `http://localhost:5173` locally or HTTPS when deployed, grant camera permission, check other apps using the webcam, or use Upload Photos instead.
- **Gallery or feedback unavailable?** Confirm the API process is running on port 3001 (`npm run dev` starts it automatically).
- **Print did not open?** Allow pop-ups for the website and click Print again.
- **Font looks different?** Install your permitted Arcade Classic copy in `public/fonts/` following the font section above.
- **Share won't attach to Instagram?** Use Download PNG and manually attach through Instagram or Messenger; this is a platform/browser restriction.
