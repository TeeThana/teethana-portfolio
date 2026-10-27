import type { Pool, PoolClient } from "pg";
import seed from "./seed.json";
import type {
  GithubRepository,
  Portfolio,
  Profile,
  Project,
} from "@/lib/types";
import { config } from "./config";
import { createPool, lockCatalog, transaction } from "./database";

const colors = [
  "#1e3d78",
  "#315fa8",
  "#182b51",
  "#527caf",
  "#214b86",
  "#728fb7",
];
const projectSelect = `SELECT id, github_id AS "githubId", slug, title, summary, content, role, year,
  stack_json AS stack, cover_color AS "coverColor", repo_url AS "repoUrl", live_url AS "liveUrl",
  active, featured, sort_order AS "sortOrder", available, language, stars, updated_at AS "updatedAt" FROM projects`;
type Row = Omit<Project, "githubId" | "updatedAt"> & {
  githubId: string | null;
  updatedAt: Date;
};
const decodeProject = (row: Row): Project => ({
  ...row,
  githubId: row.githubId === null ? null : Number(row.githubId),
  updatedAt: row.updatedAt.toISOString(),
});
async function listProjects(
  db: Pool | PoolClient,
  includeInactive = false,
): Promise<Project[]> {
  const result = await db.query<Row>(`${projectSelect}
    ${includeInactive ? "" : "WHERE active AND available"} ORDER BY sort_order, lower(title) COLLATE "C"`);
  return result.rows.map(decodeProject);
}

async function syncCatalog(
  client: PoolClient,
  repositories: GithubRepository[],
  bootstrap = false,
) {
  const repos = repositories.filter((repo) => !repo.private);
  let added = 0;
  await client.query(
    "UPDATE projects SET available=FALSE WHERE github_id IS NOT NULL",
  );
  for (const [index, repo] of repos.entries()) {
    const updated = await client.query(
      `UPDATE projects SET repo_url=$1,language=$2,stars=$3,
      updated_at=$4,available=TRUE WHERE github_id=$5`,
      [
        repo.html_url,
        repo.language || "",
        repo.stargazers_count,
        repo.updated_at,
        repo.id,
      ],
    );
    if (updated.rowCount) continue;
    const active = bootstrap && !repo.fork && index < 6;
    await client.query(
      `INSERT INTO projects
      (id,github_id,slug,title,summary,stack_json,cover_color,repo_url,live_url,active,featured,sort_order,language,stars,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        `github-${repo.id}`,
        repo.id,
        `${repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${repo.id}`,
        repo.name.replace(/[-_]/g, " "),
        repo.description ||
          "Explore the source and the ideas behind this project on GitHub.",
        JSON.stringify(repo.language ? [repo.language] : []),
        colors[index % colors.length],
        repo.html_url,
        repo.homepage?.startsWith("https://") ? repo.homepage : "",
        active,
        active && index === 0,
        index,
        repo.language || "",
        repo.stargazers_count,
        repo.updated_at,
      ],
    );
    added++;
  }
  const syncedAt = new Date().toISOString();
  await client.query(
    `INSERT INTO metadata(key,value) VALUES('last_synced_at',$1)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [syncedAt],
  );
  return { added, total: repos.length, syncedAt };
}

export class ProjectUnavailableError extends Error {}

export function createStore(pool: Pool) {
  return {
    pool,
    async health() {
      const { rowCount } = await pool.query(
        "SELECT 1 FROM schema_migrations WHERE version=1",
      );
      if (!rowCount)
        throw new Error("Run database migrations before serving requests");
    },
    async initialize() {
      return transaction(pool, async (client) => {
        await lockCatalog(client);
        const { rowCount } = await client.query(
          "SELECT id FROM profile WHERE id=1",
        );
        if (rowCount) return false;
        await client.query(
          "INSERT INTO profile(id,document) VALUES(1,$1::jsonb)",
          [JSON.stringify(seed.profile)],
        );
        await syncCatalog(
          client,
          seed.repositories as GithubRepository[],
          true,
        );
        return true;
      });
    },
    async sync(repositories: GithubRepository[], bootstrap = false) {
      return transaction(pool, async (client) => {
        await lockCatalog(client);
        return syncCatalog(client, repositories, bootstrap);
      });
    },
    projects(includeInactive = false) {
      return listProjects(pool, includeInactive);
    },
    async portfolio(includeInactive = false): Promise<Portfolio> {
      return transaction(
        pool,
        async (client) => {
          const profile = await client.query<{ document: Profile }>(
            "SELECT document FROM profile WHERE id=1",
          );
          const meta = await client.query<{ value: string }>(
            "SELECT value FROM metadata WHERE key='last_synced_at'",
          );
          return {
            profile: profile.rows[0]?.document || seed.profile,
            projects: await listProjects(client, includeInactive),
            lastSyncedAt: meta.rows[0]?.value || null,
          };
        },
        true,
      );
    },
    async saveProfile(profile: Profile) {
      await pool.query(
        `INSERT INTO profile(id,document) VALUES(1,$1::jsonb)
        ON CONFLICT(id) DO UPDATE SET document=excluded.document`,
        [JSON.stringify(profile)],
      );
      return profile;
    },
    async project(slug: string) {
      const { rows } = await pool.query<Row>(
        `${projectSelect} WHERE slug=$1 AND active AND available`,
        [slug],
      );
      return rows[0] ? decodeProject(rows[0]) : null;
    },
    async updateProject(id: string, patch: Partial<Project>) {
      return transaction(pool, async (client) => {
        const { rows } = await client.query<Row>(
          `${projectSelect} WHERE id=$1 FOR UPDATE`,
          [id],
        );
        if (!rows[0]) return null;
        const current = decodeProject(rows[0]),
          next = { ...current, ...patch };
        if (patch.active === true && !current.available)
          throw new ProjectUnavailableError(
            "This repository is no longer publicly available. Sync GitHub first.",
          );
        const result = await client.query<Row>(
          `UPDATE projects SET title=$1,summary=$2,content=$3,role=$4,
          year=$5,stack_json=$6::jsonb,cover_color=$7,live_url=$8,active=$9,featured=$10,sort_order=$11
          WHERE id=$12 RETURNING id, github_id AS "githubId", slug, title, summary, content, role, year,
          stack_json AS stack, cover_color AS "coverColor", repo_url AS "repoUrl", live_url AS "liveUrl",
          active, featured, sort_order AS "sortOrder", available, language, stars, updated_at AS "updatedAt"`,
          [
            next.title,
            next.summary,
            next.content,
            next.role,
            next.year,
            JSON.stringify(next.stack),
            next.coverColor,
            next.liveUrl,
            next.active,
            next.featured,
            next.sortOrder,
            id,
          ],
        );
        return decodeProject(result.rows[0]);
      });
    },
    async close() {
      await pool.end();
    },
  };
}
export type PortfolioStore = ReturnType<typeof createStore>;
const singleton = globalThis as typeof globalThis & {
  portfolioStore?: PortfolioStore;
};
export function getStore() {
  return (singleton.portfolioStore ??= createStore(
    createPool(config().databaseUrl),
  ));
}
