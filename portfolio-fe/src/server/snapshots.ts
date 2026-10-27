import type { Pool } from "pg";
import { z } from "zod";
import { lockCatalog, transaction } from "./database";
import { profileSchema, projectPatchSchema } from "./validation";

const snapshotSchema = z
  .object({
    format: z.literal("teethana-portfolio"),
    version: z.literal(1),
    profile: profileSchema,
    projects: z.array(
      z
        .object({
          id: z.string().min(1).max(120),
          githubId: z
            .number()
            .int()
            .positive()
            .max(Number.MAX_SAFE_INTEGER)
            .nullable(),
          slug: z.string().min(1).max(200),
          title: z.string().min(1).max(100),
          summary: z.string().max(500),
          content: z.string().max(15000),
          role: z.string().max(120),
          year: z.string().max(30),
          stack: z.array(z.string().max(40)).max(20),
          coverColor: z.string().regex(/^#[0-9a-f]{6}$/i),
          repoUrl: z.url().refine((url) => new URL(url).protocol === "https:"),
          liveUrl: projectPatchSchema.shape.liveUrl.unwrap(),
          active: z.boolean(),
          featured: z.boolean(),
          sortOrder: z.number().int().min(0).max(10000),
          available: z.boolean(),
          language: z.string().max(120),
          stars: z.number().int().min(0),
          updatedAt: z.iso.datetime(),
        })
        .strict(),
    ),
    metadata: z.array(
      z.object({ key: z.string().min(1), value: z.string() }).strict(),
    ),
  })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;

export async function exportSnapshot(pool: Pool): Promise<Snapshot> {
  return transaction(
    pool,
    async (client) => {
      // Keep profile, catalog and metadata from the same consistent database view.
      const { rows } = await client.query(
        "SELECT document FROM profile WHERE id=1",
      );
      if (!rows[0])
        throw new Error("Initialize the profile before creating a backup");
      const projects =
        await client.query(`SELECT id, github_id AS "githubId", slug, title, summary, content, role, year,
      stack_json AS stack, cover_color AS "coverColor", repo_url AS "repoUrl", live_url AS "liveUrl",
      active, featured, sort_order AS "sortOrder", available, language, stars, updated_at AS "updatedAt"
      FROM projects ORDER BY sort_order, lower(title) COLLATE "C"`);
      const metadata = await client.query(
        "SELECT key,value FROM metadata ORDER BY key",
      );
      return snapshotSchema.parse({
        format: "teethana-portfolio",
        version: 1,
        profile: rows[0].document,
        projects: projects.rows.map((row) => ({
          ...row,
          githubId: row.githubId === null ? null : Number(row.githubId),
          updatedAt: row.updatedAt.toISOString(),
        })),
        metadata: metadata.rows,
      });
    },
    true,
  );
}

export async function importSnapshot(pool: Pool, input: unknown) {
  const snapshot = snapshotSchema.parse(input);
  return transaction(pool, async (client) => {
    await lockCatalog(client);
    const { rows } = await client.query(`SELECT
      (SELECT COUNT(*) FROM profile)+(SELECT COUNT(*) FROM projects)+(SELECT COUNT(*) FROM metadata) AS count`);
    if (Number(rows[0].count) !== 0)
      throw new Error(
        "Import requires an empty database; existing content will not be overwritten",
      );
    await client.query("INSERT INTO profile(id,document) VALUES(1,$1::jsonb)", [
      JSON.stringify(snapshot.profile),
    ]);
    for (const p of snapshot.projects) {
      await client.query(
        `INSERT INTO projects
        (id,github_id,slug,title,summary,content,role,year,stack_json,cover_color,repo_url,live_url,active,featured,sort_order,available,language,stars,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          p.id,
          p.githubId,
          p.slug,
          p.title,
          p.summary,
          p.content,
          p.role,
          p.year,
          JSON.stringify(p.stack),
          p.coverColor,
          p.repoUrl,
          p.liveUrl,
          p.active,
          p.featured,
          p.sortOrder,
          p.available,
          p.language,
          p.stars,
          p.updatedAt,
        ],
      );
    }
    for (const meta of snapshot.metadata)
      await client.query("INSERT INTO metadata(key,value) VALUES($1,$2)", [
        meta.key,
        meta.value,
      ]);
    return { projects: snapshot.projects.length };
  });
}
