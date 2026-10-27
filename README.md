# Teethana Portfolio

A blue 3D portfolio built around a real ThreeUI Bookshelf. Select a project volume, inspect the binding, open the book, turn its pages, or visit its full project page. An owner-only workspace manages the public profile, contact channels, project stories, ordering, covers, and visibility.

![Blue ThreeUI project bookshelf](docs/bookshelf-preview.png)

## Stack

- **Node.js 24 LTS**, TypeScript, **Next.js 16.4.3** App Router, React 19.
- **ThreeUI Community 1.2.0**: the free Bookshelf renderer, adapted for project data; Structure Flow in the hero. All required 3D assets are local to the bundle.
- **Hono** mounted at `/api` inside the Next.js Node runtime. One origin, one server, no separate CORS setup.
- **SQLite** through Node's built-in `node:sqlite`, WAL mode, prepared statements, versioned schema migration, and persistent disk storage.
- **GitHub OAuth with PKCE**, an HttpOnly signed session, exact owner-ID authorization, and same-origin checks for mutations.

The existing `portfolio-fe/` app has been upgraded in place. The root uses npm workspaces. The original repository history and default branch are preserved.

## Run locally

```sh
nvm use 24
npm ci
cp portfolio-fe/.env.example portfolio-fe/.env.local
npm run dev
```

PowerShell: replace `cp` with `Copy-Item`. Open [localhost:3000](http://localhost:3000). Next.js and the API use the same origin. Keep `APP_URL` equal to the browser's origin, including its port. A new database is created at `portfolio-fe/data/portfolio.sqlite` and initialized once from the public GitHub snapshot in `src/server/seed.json`. No private email, credential, or private repository is included in that snapshot. Initial non-fork projects are visible; later sync imports always start Inactive.

## Owner sign-in

Create a [GitHub OAuth App](https://github.com/settings/developers) with:

- Homepage: your `APP_URL`.
- Authorization callback: `APP_URL/api/auth/github/callback`.
- For local development: `http://localhost:3000/api/auth/github/callback`.

Set these server environment variables (locally in `portfolio-fe/.env.local`):

```dotenv
APP_URL=http://localhost:3000
GITHUB_OWNER=TeeThana
OWNER_GITHUB_ID=155901166
GITHUB_CLIENT_ID=your-oauth-client-id
GITHUB_CLIENT_SECRET=your-oauth-client-secret
AUTH_SECRET=at-least-32-random-bytes
DATABASE_PATH=./data/portfolio.sqlite
```

Generate a strong session secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` and store the result only in the server environment. Never commit `.env.local`. The app remains publicly readable and **admin access stays locked** when OAuth is not configured. There is no development sign-in bypass. Only GitHub user ID `155901166` can access the workspace; matching a display name is insufficient. OAuth requests only `read:user`, and its access token is discarded after the identity check.

Visit `/admin`, sign in, and use **Sync GitHub** to import public repositories. Sync updates GitHub metadata while preserving your edited title, story, ordering, cover color, and visibility. Newly discovered projects stay hidden until activated. Repositories that disappear from the complete public listing are excluded from the public portfolio. A failed or truncated GitHub request does not change the catalog. An optional server-only `GITHUB_TOKEN` raises public API rate limits; it is not required for owner sign-in.

## Workspace

- **Projects:** Active/Inactive, featured state, display order, cover color, title, summary, full story, role, dates, technologies, and live link.
- **Profile & contact:** name, headline, biography, image, location, email, GitHub, LinkedIn, website, résumé, and experience/education entries. Empty contact channels stay hidden.
- Public endpoints and project pages return only active, publicly available work. Anonymous requests to every `/api/admin/*` endpoint are rejected server-side.
- The complete project index remains available when WebGL is unavailable. Book navigation has labeled controls and keyboard support; reduced motion is respected.

## Validate

```sh
npm run check
npm run build
npm start
```

Tests cover access control, expired/tampered/wrong-algorithm sessions, CSRF protection, link validation, hidden projects, curation-preserving sync, failed sync, and OAuth callback rejection. CI runs type checking, tests and a production build. No GitHub credentials are needed for CI.

## Deploy on a Node.js host

This build keeps the requested Next.js and Hono **Node.js runtime**. Sites' Workers runtime is not used. Deploy the Docker image to a Node/Docker host with a persistent volume, for example a VPS or a service supporting persistent disks.

```sh
docker compose up --build -d
```

Configure `portfolio-fe/.env.local` first. For a public deployment, use an **HTTPS** `APP_URL`, update the GitHub OAuth callback to that origin, and put a TLS reverse proxy in front of port 3000. The container runs as a non-root user and stores SQLite at `/app/portfolio-fe/data/portfolio.sqlite`; the `portfolio-data` volume persists it between deployments. Deploy **one application replica** against this local database. Avoid ephemeral serverless storage for SQLite. For multiple replicas, migrate the store to managed Postgres or a compatible hosted SQLite service.

`GET /api/health` checks database connectivity. `npm run db:backup` produces a consistent SQLite snapshot in a `backups/` directory beside the database (by default `portfolio-fe/data/backups/`). In Docker, run `docker compose exec portfolio node portfolio-fe/scripts/backup.mjs`; its backup is inside the persistent volume. Keep an off-host copy. To restore, stop the app, preserve the existing data directory, replace the SQLite file from a backup, remove the old `-wal` and `-shm` sidecars, then restart. Never replace a live SQLite database file.

## Structure

```text
portfolio-fe/
  src/app/                 Public pages, owner sign-in, admin, Hono route entry
  src/components/          Bookshelf, navigation, public showcase, owner workspace
  src/server/              API, owner auth, validation, GitHub sync, SQLite store
  src/vendor/threeui/      MIT Bookshelf renderer and local Three.js helpers
  scripts/                 Database backup and reproducible ThreeUI adapter
  tests/                   Security and persistence behavior tests
```

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for component attribution and the vendored MIT license. Do not overwrite the adapter when updating ThreeUI without reviewing its narrow source modifications.
