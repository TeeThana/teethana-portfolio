import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { sign } from "hono/jwt";
import { createStore } from "../src/server/store";
import { createApi } from "../src/server/api";
import {
  createSession,
  readSession,
  SESSION_COOKIE,
  STATE_COOKIE,
  PKCE_COOKIE,
} from "../src/server/auth";
import type { GithubRepository } from "../src/lib/types";

process.env.APP_URL = "http://portfolio.test";
process.env.AUTH_SECRET = randomBytes(48).toString("base64url");
const repo = (id: number, name = `project-${id}`): GithubRepository => ({
  id,
  name,
  full_name: `TeeThana/${name}`,
  description: `Description for ${name}`,
  html_url: `https://github.com/TeeThana/${name}`,
  homepage: "",
  language: "TypeScript",
  stargazers_count: 0,
  updated_at: "2026-10-27T00:00:00Z",
  private: false,
  fork: false,
  archived: false,
});
const owner = () =>
  createSession({
    id: "155901166",
    login: "TeeThana",
    name: "TeeThana",
    avatarUrl: "",
  });
const headers = (token: string, origin = "http://portfolio.test") => ({
  Cookie: `${SESSION_COOKIE}=${token}`,
  Origin: origin,
  "Content-Type": "application/json",
});

test("hidden and no-longer-public repositories cannot be retrieved through either public API", async () => {
  const store = createStore(":memory:", false);
  try {
    store.sync([repo(1), repo(2)], true);
    store.updateProject("github-2", { active: false });
    const api = createApi({ store });
    const response = await api.request("/api/portfolio");
    const body = await response.json();
    assert.deepEqual(
      body.projects.map((p: { id: string }) => p.id),
      ["github-1"],
    );
    assert.equal(
      (await api.request(`/api/projects/${store.projects(true)[1].slug}`))
        .status,
      404,
    );
    store.sync([repo(2)]);
    assert.equal(store.portfolio().projects.length, 0);
  } finally {
    store.close();
  }
});
test("GitHub sync preserves curation, imports new work as inactive, and ignores private repositories", () => {
  const store = createStore(":memory:", false);
  try {
    store.sync([repo(1)], true);
    store.updateProject("github-1", {
      title: "My curated title",
      summary: "My story",
      sortOrder: 12,
      coverColor: "#123456",
    });
    store.sync([
      { ...repo(1), description: "Changed on GitHub", stargazers_count: 5 },
      repo(2),
      { ...repo(3), private: true },
    ]);
    const projects = store.projects(true);
    assert.equal(projects.length, 2);
    const first = projects.find((p) => p.id === "github-1")!;
    assert.equal(first.title, "My curated title");
    assert.equal(first.summary, "My story");
    assert.equal(first.stars, 5);
    assert.equal(first.sortOrder, 12);
    assert.equal(first.coverColor, "#123456");
    assert.equal(projects.find((p) => p.id === "github-2")?.active, false);
  } finally {
    store.close();
  }
});
test("all owner API reads and writes reject anonymous or signed non-owner sessions", async () => {
  const store = createStore(":memory:", false);
  try {
    const api = createApi({ store });
    assert.equal((await api.request("/api/admin/portfolio")).status, 401);
    assert.equal(
      (
        await api.request("/api/admin/github/sync", {
          method: "POST",
          headers: {
            Origin: "http://portfolio.test",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      401,
    );
    const token = await sign(
      {
        sub: "not-the-owner",
        login: "another-user",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      process.env.AUTH_SECRET!,
      "HS256",
    );
    assert.equal(
      (await api.request("/api/admin/portfolio", { headers: headers(token) }))
        .status,
      401,
    );
  } finally {
    store.close();
  }
});
test("expired, tampered, and wrong-algorithm session tokens are rejected", async () => {
  const token = await owner();
  assert.equal((await readSession(token))?.login, "TeeThana");
  const pieces = token.split(".");
  pieces[2] = (pieces[2][0] === "a" ? "b" : "a") + pieces[2].slice(1);
  assert.equal(await readSession(pieces.join(".")), null);
  const expired = await sign(
    {
      sub: "155901166",
      login: "TeeThana",
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    process.env.AUTH_SECRET!,
    "HS256",
  );
  assert.equal(await readSession(expired), null);
  const wrongAlgorithm = await sign(
    {
      sub: "155901166",
      login: "TeeThana",
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    process.env.AUTH_SECRET!,
    "HS384",
  );
  assert.equal(await readSession(wrongAlgorithm), null);
});
test("cross-origin writes fail even with a valid owner session; valid edits persist", async () => {
  const store = createStore(":memory:", false);
  try {
    store.sync([repo(1)], true);
    const api = createApi({ store });
    const token = await owner();
    const bad = await api.request("/api/admin/projects/github-1", {
      method: "PATCH",
      headers: headers(token, "https://untrusted.example"),
      body: JSON.stringify({ active: false }),
    });
    assert.equal(bad.status, 403);
    assert.equal(store.projects()[0].active, true);
    const good = await api.request("/api/admin/projects/github-1", {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ active: false, title: "Updated by owner" }),
    });
    assert.equal(good.status, 200);
    assert.equal(store.projects().length, 0);
    assert.equal(store.projects(true)[0].title, "Updated by owner");
  } finally {
    store.close();
  }
});
test("unsafe links, unknown editable fields, and malformed JSON are rejected", async () => {
  const store = createStore(":memory:", false);
  try {
    store.sync([repo(1)], true);
    const api = createApi({ store }),
      token = await owner();
    for (const body of [
      JSON.stringify({ liveUrl: "javascript:alert(1)" }),
      JSON.stringify({ repoUrl: "https://untrusted.example" }),
      "{",
    ]) {
      const result = await api.request("/api/admin/projects/github-1", {
        method: "PATCH",
        headers: headers(token),
        body,
      });
      assert.equal(result.status, 400);
    }
    assert.equal(
      store.projects()[0].repoUrl,
      "https://github.com/TeeThana/project-1",
    );
  } finally {
    store.close();
  }
});
test("failed GitHub sync does not hide previously published work", async () => {
  const store = createStore(":memory:", false);
  try {
    store.sync([repo(1)], true);
    const api = createApi({
      store,
      repositories: async () => {
        throw new Error("GitHub is unavailable");
      },
    });
    const response = await api.request("/api/admin/github/sync", {
      method: "POST",
      headers: headers(await owner()),
      body: "{}",
    });
    assert.equal(response.status, 502);
    assert.equal(store.projects().length, 1);
  } finally {
    store.close();
  }
});
test("invalid OAuth callbacks fail closed before contacting GitHub", async () => {
  const store = createStore(":memory:", false);
  try {
    const api = createApi({ store });
    const response = await api.request(
      "/api/auth/github/callback?code=untrusted&state=untrusted",
    );
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("Location"),
      "/login?error=invalid-state",
    );
  } finally {
    store.close();
  }
});
test("OAuth accepts the exact owner ID and never creates a session for another account", async () => {
  const originalFetch = globalThis.fetch,
    client = process.env.GITHUB_CLIENT_ID,
    secret = process.env.GITHUB_CLIENT_SECRET;
  const store = createStore(":memory:", false);
  let identity = 999;
  process.env.GITHUB_CLIENT_ID = "fixture-client";
  process.env.GITHUB_CLIENT_SECRET = "fixture-client-secret";
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token")
      return Response.json({ access_token: "fixture-token" });
    if (url === "https://api.github.com/user")
      return Response.json({
        id: identity,
        login: "TeeThana",
        name: "Owner",
        avatar_url: "",
      });
    throw new Error("Unexpected provider call");
  };
  try {
    const api = createApi({ store });
    const callback = () =>
      api.request(
        "/api/auth/github/callback?code=fixture&state=fixture-state",
        {
          headers: {
            Cookie: `${STATE_COOKIE}=fixture-state; ${PKCE_COOKIE}=fixture-verifier`,
          },
        },
      );
    const rejected = await callback();
    assert.equal(rejected.headers.get("Location"), "/login?error=owner-only");
    assert.equal(
      rejected.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`)),
      false,
    );
    identity = 155901166;
    const accepted = await callback();
    assert.equal(accepted.headers.get("Location"), "/admin");
    const cookie = accepted.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${SESSION_COOKIE}=`));
    assert.ok(cookie);
    assert.match(cookie, /HttpOnly/i);
    const token = cookie.split(";")[0].slice(SESSION_COOKIE.length + 1);
    assert.equal((await readSession(token))?.id, "155901166");
  } finally {
    globalThis.fetch = originalFetch;
    if (client === undefined) delete process.env.GITHUB_CLIENT_ID;
    else process.env.GITHUB_CLIENT_ID = client;
    if (secret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
    else process.env.GITHUB_CLIENT_SECRET = secret;
    store.close();
  }
});
