# Local MySQL development

Use Node.js 24 and Docker Desktop. From this project directory:

```bash
npm install
npm run setup:local
npm run dev
```

Open http://localhost:5173. The API runs on port 3001. Setup creates an ignored `.env.local` with random credentials, starts MySQL 8.4 on **127.0.0.1:3307**, and applies the MySQL schema. Repeating setup preserves the environment file and database. Existing `.env.local` files are never overwritten.

Gallery metadata, feedback, likes, ownership and rate limits are stored in MySQL. PNG files are stored in the ignored `server/data/photos/` directory and served by the API. No Neon account or Vercel Blob token is needed. Local feedback uses `FEEDBACK_MODERATION=auto`; set it to `manual` if you want approval before public display. Server credentials stay outside the browser bundle.

The database persists in Docker's `pixel-booth_mysql_data` volume. Back up that volume and `server/data/photos/` together. Stop MySQL with `npm run db:down`; start it again with `npm run db:up`. Do not remove the volume to fix connection issues: doing so deletes database records.

## Use an existing MySQL installation

Create a dedicated database and user on MySQL 8.0.16 or newer (8.4 recommended), with privileges on that database. Copy `.env.example` to `.env.local`, then configure:

```dotenv
DATABASE_URL=mysql://YOUR_USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/pixel_booth
PHOTO_STORAGE=local
PHOTO_DIRECTORY=server/data/photos
APP_ORIGIN=http://localhost:5173
FEEDBACK_MODERATION=auto
PORT=3001
```

Set `SESSION_SECRET`, `ADMIN_API_TOKEN` and `CRON_SECRET` to three independent random values of at least 32 characters; `openssl rand -hex 32` generates one. URL-encode special characters in database usernames/passwords. Keep these values only in `.env.local`. `BLOB_READ_WRITE_TOKEN` is unnecessary with local photos.

```bash
npm run db:migrate
npm run dev
```

For Docker Compose with an existing environment file, also set `MYSQL_PORT`, `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` locally. Match `MYSQL_PASSWORD` to the password in `DATABASE_URL`, and match the port to `MYSQL_PORT`. Compose initializes credentials only when its database volume is first created.

## Import previous local data

Back up `server/data/` first. Preview the import, then apply it:

```bash
npm run data:migrate
npm run data:migrate -- --apply
```

The import reads the previous gallery/feedback JSON and PNG files without modifying them. It preserves IDs, timestamps and likes and skips imported records. Imported notes follow `FEEDBACK_MODERATION`: published with `auto`, queued for approval with `manual`. Review pending notes using the existing moderation CLI and local API origin.

## Verify

`GET http://localhost:3001/api/health` should report `database: "mysql"` and `photos: "local"`. Save a gallery photo and feedback, then refresh to confirm persistence. API regression tests for both SQL backends:

```bash
npm test
MYSQL_TEST_URL=mysql://.../DEDICATED_TEST_DATABASE npm run test:mysql
npm run build
```

Use a separate, empty MySQL database for `MYSQL_TEST_URL`: the MySQL tests reset its tables. Do not point it at your application database.

If you see a storage error, ensure Docker Desktop is running, run `npm run setup:local`, and restart `npm run dev` so the API reloads `.env.local`. If port 3307 is occupied, set a free `MYSQL_PORT` and the same port in `DATABASE_URL` before starting Compose.

The existing [Vercel deployment guide](DEPLOYMENT.md) remains applicable to Neon/Blob hosting. Local files need a persistent server disk and are refused on Vercel; Vercel environments must use `PHOTO_STORAGE=vercel-blob` and the existing cloud configuration.
