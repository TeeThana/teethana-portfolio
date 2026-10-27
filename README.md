# Teethana Portfolio

A blue 3D portfolio built around a real ThreeUI Bookshelf. Select a project volume, inspect the binding, open the book, turn its pages, or visit its full project page. An owner-only workspace manages the public profile, contact channels, project stories, ordering, covers, and visibility.

![Blue ThreeUI project bookshelf](docs/bookshelf-preview.png)

## Stack

- **Node.js 24 LTS**, TypeScript, **Next.js 16.4.3** App Router, React 19.
- **ThreeUI Community 1.2.0**: the free Bookshelf renderer, adapted for project data; Structure Flow in the hero. All required 3D assets are local to the bundle.
- **Hono** mounted at `/api` inside the Next.js Node runtime. One origin, one server, no separate CORS setup.
- **PostgreSQL** with `pg`, parameterized SQL, JSONB profile/stack data, versioned migrations, and transactional catalog updates. Compatible with Neon and Vercel Functions.
- **GitHub OAuth with PKCE**, an HttpOnly signed session, exact owner-ID authorization, and same-origin checks for mutations.

The existing `portfolio-fe/` app has been upgraded in place. The root uses npm workspaces. The original repository history and default branch are preserved.

## Run locally

```sh
nvm use 24
npm ci
cp portfolio-fe/.env.example portfolio-fe/.env.local
# Set a local POSTGRES_PASSWORD and use the same password in both database URLs.
docker compose --env-file portfolio-fe/.env.local up -d db --wait
npm run db:migrate
npm run db:seed
npm run dev
```

PowerShell: replace `cp` with `Copy-Item`. Open [localhost:3000](http://localhost:3000). Next.js and the API use the same origin. Keep `APP_URL` equal to the browser's origin, including its port. The local PostgreSQL service listens only on `127.0.0.1:5547` and has its own named volume. Use a URL-safe local password, or percent-encode it in connection URLs.

Migrations are explicit commands; web requests never create tables. `db:seed` initializes the profile once from the public snapshot in `src/server/seed.json` and preserves existing owner edits. Initial non-fork projects are visible; later sync imports always start Inactive. If you have an existing SQLite portfolio, **use the import steps below instead of `db:seed`**.

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
DATABASE_URL=postgresql://user:password@host/database?sslmode=verify-full
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

Tests run against **real PostgreSQL**, not an in-memory SQL substitute. First create a dedicated test database once:

```sh
docker compose --env-file portfolio-fe/.env.local exec -T db psql -U portfolio -d postgres -c "CREATE DATABASE portfolio_test"
```

Set `TEST_DATABASE_URL` in `portfolio-fe/.env.local` or the shell. Its database name must end in `_test`; tests create and clean up unique schemas inside that database and never fall back to the application database. Tests cover owner access, sessions, CSRF, validation, visibility, OAuth, transaction rollback, concurrent sync/edits, idempotent migration/seed, and backup/restore. CI supplies a PostgreSQL 17 service and runs type checking, tests, and a production build without GitHub credentials. A build itself does not need a database connection.

## Deploy free on Vercel + Neon

Use **Vercel Hobby** for this personal portfolio and **Neon Free** for PostgreSQL, within each provider's free allowances. The web app, Hono API, and owner workspace share one Vercel project. PostgreSQL is hosted by Neon and can be provisioned through Vercel Marketplace. You can use the supplied `vercel.app` address without buying a domain.

1. Create a Neon Free database through Vercel Marketplace, then import this repository into Vercel.
2. Set the Vercel **Root Directory** to `portfolio-fe` and enable inclusion of source files outside that root. `portfolio-fe/vercel.json` installs the root npm workspace and builds the app.
3. Set `DATABASE_URL` to Neon's **pooled** PostgreSQL connection URL. Keep TLS enabled; `sslmode=verify-full` validates the server certificate. Do not expose the URL through a `NEXT_PUBLIC_` variable. The app reuses a small `pg` pool, with Vercel's pool lifecycle integration.
4. Run `npm run db:migrate` against the Neon database from a trusted local checkout. For a fresh portfolio, run `npm run db:seed`; to preserve an existing local portfolio, run `npm run db:import-sqlite` instead. CLI commands load `portfolio-fe/.env.local` and prefer `DATABASE_URL_UNPOOLED` when supplied. Point these variables at the intended target before running them.
5. Set `APP_URL` to the final HTTPS URL, configure `AUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`, and update the GitHub OAuth callback. Keep the secret stable across deployments.
6. Deploy, then check `/api/health`, public project pages, and owner sign-in. Public access must be enabled so recruiters can open the link without a Vercel account.

Do not run migrations automatically in a preview build or give previews write access to the production database. Use a separate Neon branch/database and matching environment variables for previews. Leave OAuth unset on previews unless they have their own matching callback and origin. Neither local setup nor pushing this repository provisions a cloud database or deploys a public site.

## Move the existing SQLite data

The old `portfolio-fe/data/portfolio.sqlite` file is no longer used by the running app. Keep it and its backups until you have verified the migration. The importer opens the source **read-only** in a consistent transaction, validates the profile/projects, preserves IDs, slugs, stories, contact fields, cover colors, ordering, Active/Inactive flags, availability, and metadata, and writes all records into PostgreSQL in one transaction.

```sh
npm run db:migrate
npm run db:import-sqlite
# Optional custom source path (relative to portfolio-fe):
npm run db:import-sqlite -- ./data/portfolio.sqlite
```

The target application tables must be empty. An occupied target is rejected without overwriting it; an import failure rolls back every inserted record. Do not seed the target before importing. The legacy SQLite source is never deleted or modified.

## Deploy on a Node.js host

The same source also builds a standalone Node.js Docker image. PostgreSQL holds application state; the app container needs no persistent filesystem. For local Compose, migrate and seed/import first using the setup above, then start the app:

```sh
docker compose --env-file portfolio-fe/.env.local up --build -d
```

For a public Node host, set an HTTPS `APP_URL`, update the OAuth callback, and terminate TLS at a reverse proxy. The image runs as a non-root user. Compose stores PostgreSQL in `portfolio-postgres` and overrides the app connection URL to use the internal `db` service. CLI scripts run from the trusted checkout with Node 24 and installed dependencies; they are not bundled into the production web image.

`GET /api/health` checks PostgreSQL connectivity and migration version 1. Application reads use a consistent transaction. Catalog syncs serialize with a transaction-scoped advisory lock; project edits lock their own row so concurrent patches preserve each other's fields. No session-level locks are required by the Neon pooler.

## Back up and restore

`npm run db:backup` writes a consistent, validated JSON backup of the profile, **all** projects (including hidden work), and metadata to `portfolio-fe/backups/`. A custom output can be supplied with `-- path.json`; existing files are never overwritten. Backups can contain unpublished profile data, so keep them private and off-host. They are excluded from Git and Docker builds.

To restore, point the CLI at a new PostgreSQL database, run `npm run db:migrate`, and then `npm run db:restore -- path.json` (paths are relative to `portfolio-fe`). Restore requires empty application tables and rolls back on any error. This portable application backup does not include database roles or server settings; use Neon/provider backups or `pg_dump` when you need a full PostgreSQL backup.

## Structure

```text
portfolio-fe/
  src/app/                 Public pages, owner sign-in, admin, Hono route entry
  src/components/          Bookshelf, navigation, public showcase, owner workspace
  src/server/              API, auth, validation, GitHub sync, PostgreSQL store/migrations
  src/vendor/threeui/      MIT Bookshelf renderer and local Three.js helpers
  scripts/                 Migrate, seed, import, backup/restore, ThreeUI adapter
  tests/                   Security, PostgreSQL transactions and persistence tests
```

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for component attribution and the vendored MIT license. Do not overwrite the adapter when updating ThreeUI without reviewing its narrow source modifications.
