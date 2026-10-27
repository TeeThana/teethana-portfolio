import test from "node:test";
import assert from "node:assert/strict";
import { testStore } from "./database";
import { migrate } from "../src/server/migrations";
import { exportSnapshot, importSnapshot } from "../src/server/snapshots";
import { transaction } from "../src/server/database";
import type { GithubRepository } from "../src/lib/types";

const repo = (id: number): GithubRepository => ({
  id,
  name: `project-${id}`,
  full_name: `TeeThana/project-${id}`,
  description: "A project",
  html_url: `https://github.com/TeeThana/project-${id}`,
  homepage: "",
  language: "TypeScript",
  stargazers_count: 0,
  updated_at: "2026-10-27T00:00:00Z",
  private: false,
  fork: false,
  archived: false,
});

test("transaction settings expire at commit rather than leaking into pooled sessions", async () => {
  const store = await testStore();
  try {
    const before = await store.pool.query("SHOW statement_timeout");
    await transaction(store.pool, async (client) => {
      const result = await client.query("SHOW statement_timeout");
      assert.equal(result.rows[0].statement_timeout, "15s");
    });
    const after = await store.pool.query("SHOW statement_timeout");
    assert.equal(
      after.rows[0].statement_timeout,
      before.rows[0].statement_timeout,
    );
  } finally {
    await store.close();
  }
});

test("migrations and seed are repeatable without replacing owner edits", async () => {
  const store = await testStore();
  try {
    await migrate(store.pool);
    assert.equal(await store.initialize(), true);
    const profile = (await store.portfolio()).profile;
    await store.saveProfile({
      ...profile,
      bio: "Owner's edited biography ภาษาไทย",
    });
    const before = await exportSnapshot(store.pool);
    await migrate(store.pool);
    assert.equal(await store.initialize(), false);
    assert.deepEqual(await exportSnapshot(store.pool), before);
  } finally {
    await store.close();
  }
});

test("a failed SQL write rolls back the whole GitHub sync and its timestamp", async () => {
  const store = await testStore();
  try {
    await store.initialize();
    const before = await exportSnapshot(store.pool);
    await assert.rejects(
      store.sync([repo(5000000000), { ...repo(2), stargazers_count: -1 }]),
    );
    assert.deepEqual(await exportSnapshot(store.pool), before);
  } finally {
    await store.close();
  }
});

test("concurrent syncs publish one complete catalog and retain bigint GitHub IDs", async () => {
  const store = await testStore();
  try {
    await store.sync([repo(5000000000), repo(6000000000)], true);
    await Promise.all([
      store.sync([repo(5000000000)]),
      store.sync([repo(6000000000)]),
    ]);
    const projects = await store.projects(true);
    assert.equal(projects.length, 2);
    assert.equal(projects.filter((p) => p.available).length, 1);
    assert.deepEqual(
      projects.map((p) => p.githubId).sort(),
      [5000000000, 6000000000],
    );
  } finally {
    await store.close();
  }
});

test("concurrent project patches retain edits to independent fields", async () => {
  const store = await testStore();
  try {
    await store.sync([repo(1)], true);
    await Promise.all([
      store.updateProject("github-1", { title: "Updated title" }),
      store.updateProject("github-1", { summary: "Updated summary" }),
    ]);
    const [project] = await store.projects();
    assert.equal(project.title, "Updated title");
    assert.equal(project.summary, "Updated summary");
  } finally {
    await store.close();
  }
});

test("portable backups restore hidden projects and refuse to overwrite an occupied target", async () => {
  const source = await testStore(),
    target = await testStore();
  try {
    await source.initialize();
    const [project] = await source.projects();
    await source.updateProject(project.id, {
      active: false,
      content: "Owner's project story ภาษาไทย",
    });
    const snapshot = await exportSnapshot(source.pool);
    await importSnapshot(target.pool, snapshot);
    assert.deepEqual(await exportSnapshot(target.pool), snapshot);
    await assert.rejects(
      importSnapshot(target.pool, snapshot),
      /empty database/,
    );
    assert.deepEqual(await exportSnapshot(target.pool), snapshot);
  } finally {
    await source.close();
    await target.close();
  }
});

test("a conflicting import rolls back the profile and all earlier inserts", async () => {
  const source = await testStore(),
    target = await testStore();
  try {
    await source.initialize();
    const snapshot = await exportSnapshot(source.pool);
    await assert.rejects(
      importSnapshot(target.pool, {
        ...snapshot,
        projects: [...snapshot.projects, snapshot.projects[0]],
      }),
    );
    for (const table of ["profile", "projects", "metadata"]) {
      const { rows } = await target.pool.query(`SELECT COUNT(*) FROM ${table}`);
      assert.equal(Number(rows[0].count), 0);
    }
  } finally {
    await source.close();
    await target.close();
  }
});
