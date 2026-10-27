import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import seed from "./seed.json";
import type {
  GithubRepository,
  Portfolio,
  Profile,
  Project,
} from "@/lib/types";
import { config } from "./config";

const colors = [
  "#1e3d78",
  "#315fa8",
  "#182b51",
  "#527caf",
  "#214b86",
  "#728fb7",
];
const projectSelect = `SELECT id, github_id AS githubId, slug, title, summary, content, role, year,
 stack_json AS stack, cover_color AS coverColor, repo_url AS repoUrl, live_url AS liveUrl,
 active, featured, sort_order AS sortOrder, available, language, stars, updated_at AS updatedAt FROM projects`;
type Row = Omit<Project, "stack" | "active" | "featured" | "available"> & {
  stack: string;
  active: number;
  featured: number;
  available: number;
};
const decodeProject = (row: Row): Project => ({
  ...row,
  stack: JSON.parse(row.stack),
  active: !!row.active,
  featured: !!row.featured,
  available: !!row.available,
});

export function createStore(filename: string, initialize = true) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  const version = Number(
    (db.prepare("PRAGMA user_version").get() as { user_version: number })
      .user_version,
  );
  if (version > 1)
    throw new Error("Database schema is newer than this application");
  if (version < 1)
    db.exec(`BEGIN;
    CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL);
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, github_id INTEGER UNIQUE, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '', year TEXT NOT NULL DEFAULT '',
      stack_json TEXT NOT NULL DEFAULT '[]', cover_color TEXT NOT NULL DEFAULT '#1e3d78',
      repo_url TEXT NOT NULL, live_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
      featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)), language TEXT NOT NULL DEFAULT '',
      stars INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
    );
    PRAGMA user_version=1; COMMIT;`);

  function projects(includeInactive = false): Project[] {
    return (
      db
        .prepare(
          `${projectSelect} ${includeInactive ? "" : "WHERE active=1 AND available=1"} ORDER BY sort_order, title COLLATE NOCASE`,
        )
        .all() as Row[]
    ).map(decodeProject);
  }
  function sync(repositories: GithubRepository[], bootstrap = false) {
    const repos = repositories.filter((repo) => !repo.private);
    let added = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "UPDATE projects SET available=0 WHERE github_id IS NOT NULL",
      ).run();
      const existing = db.prepare("SELECT id FROM projects WHERE github_id=?");
      const insert = db.prepare(
        `INSERT INTO projects (id,github_id,slug,title,summary,content,role,year,stack_json,cover_color,repo_url,live_url,active,featured,sort_order,language,stars,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      const update = db.prepare(
        "UPDATE projects SET repo_url=?,language=?,stars=?,updated_at=?,available=1 WHERE github_id=?",
      );
      for (const [index, repo] of repos.entries()) {
        if (existing.get(repo.id)) {
          update.run(
            repo.html_url,
            repo.language || "",
            repo.stargazers_count,
            repo.updated_at,
            repo.id,
          );
        } else {
          const active = bootstrap && !repo.fork && index < 6;
          const summary =
            repo.description ||
            "Explore the source and the ideas behind this project on GitHub.";
          const liveUrl = repo.homepage?.startsWith("https://")
            ? repo.homepage
            : "";
          insert.run(
            `github-${repo.id}`,
            repo.id,
            `${repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${repo.id}`,
            repo.name.replace(/[-_]/g, " "),
            summary,
            "",
            "",
            "",
            JSON.stringify(repo.language ? [repo.language] : []),
            colors[index % colors.length],
            repo.html_url,
            liveUrl,
            Number(active),
            Number(active && index === 0),
            index,
            repo.language || "",
            repo.stargazers_count,
            repo.updated_at,
          );
          added++;
        }
      }
      const syncedAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO metadata(key,value) VALUES('last_synced_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(syncedAt);
      db.exec("COMMIT");
      return { added, total: repos.length, syncedAt };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const profileExists = db.prepare("SELECT id FROM profile WHERE id=1").get();
  if (!profileExists && initialize) {
    db.prepare("INSERT INTO profile(id,document) VALUES(1,?)").run(
      JSON.stringify(seed.profile),
    );
    sync(seed.repositories as GithubRepository[], true);
  }
  return {
    db,
    sync,
    projects,
    portfolio(includeInactive = false): Portfolio {
      const row = db
        .prepare("SELECT document FROM profile WHERE id=1")
        .get() as { document: string } | undefined;
      const meta = db
        .prepare("SELECT value FROM metadata WHERE key='last_synced_at'")
        .get() as { value: string } | undefined;
      return {
        profile: row ? JSON.parse(row.document) : seed.profile,
        projects: projects(includeInactive),
        lastSyncedAt: meta?.value || null,
      };
    },
    saveProfile(profile: Profile) {
      db.prepare(
        "INSERT INTO profile(id,document) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document",
      ).run(JSON.stringify(profile));
      return profile;
    },
    project(slug: string) {
      const row = db
        .prepare(`${projectSelect} WHERE slug=? AND active=1 AND available=1`)
        .get(slug) as Row | undefined;
      return row ? decodeProject(row) : null;
    },
    updateProject(id: string, patch: Partial<Project>) {
      const current = projects(true).find((project) => project.id === id);
      if (!current) return null;
      const next = { ...current, ...patch };
      if (patch.active === true && !current.available)
        throw new Error(
          "This repository is no longer publicly available. Sync GitHub first.",
        );
      db.prepare(
        `UPDATE projects SET title=?,summary=?,content=?,role=?,year=?,stack_json=?,cover_color=?,live_url=?,active=?,featured=?,sort_order=? WHERE id=?`,
      ).run(
        next.title,
        next.summary,
        next.content,
        next.role,
        next.year,
        JSON.stringify(next.stack),
        next.coverColor,
        next.liveUrl,
        Number(next.active),
        Number(next.featured),
        next.sortOrder,
        id,
      );
      return next;
    },
    close() {
      db.close();
    },
  };
}
export type PortfolioStore = ReturnType<typeof createStore>;
const singleton = globalThis as typeof globalThis & {
  portfolioStore?: PortfolioStore;
};
export function getStore() {
  return (singleton.portfolioStore ??= createStore(config().databasePath));
}
