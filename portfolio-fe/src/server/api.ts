import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { authConfigured, config } from "./config";
import {
  challenge,
  createSession,
  equalSecret,
  nonce,
  PKCE_COOKIE,
  readSession,
  SESSION_COOKIE,
  STATE_COOKIE,
  type OwnerSession,
} from "./auth";
import { fetchRepositories, githubUser } from "./github";
import {
  getStore,
  ProjectUnavailableError,
  type PortfolioStore,
} from "./store";
import { profileSchema, projectPatchSchema } from "./validation";
import type { GithubRepository } from "@/lib/types";

type ApiEnv = { Variables: { owner: OwnerSession | null } };
export function createApi(
  deps: {
    store?: PortfolioStore;
    repositories?: () => Promise<GithubRepository[]>;
  } = {},
) {
  const app = new Hono<ApiEnv>().basePath("/api");
  const store = () => deps.store || getStore();
  app.use(
    "*",
    bodyLimit({
      maxSize: 65536,
      onError: (c) => c.json({ error: "Request too large" }, 413),
    }),
  );
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      if (c.req.header("Origin") !== config().origin)
        return c.json({ error: "Request origin is not allowed" }, 403);
      if (
        c.req.method !== "DELETE" &&
        !c.req.header("Content-Type")?.startsWith("application/json")
      )
        return c.json({ error: "Send application/json" }, 415);
    }
    c.set("owner", await readSession(getCookie(c, SESSION_COOKIE)));
    await next();
  });
  app.get("/health", async (c) => {
    await store().health();
    return c.json({ status: "ok" });
  });
  app.get("/portfolio", async (c) => c.json(await store().portfolio()));
  app.get("/projects/:slug", async (c) => {
    const project = await store().project(c.req.param("slug"));
    return project
      ? c.json(project)
      : c.json({ error: "Project not found" }, 404);
  });
  app.get("/auth/session", (c) =>
    c.json({ user: c.get("owner"), configured: authConfigured() }),
  );
  app.get("/auth/github", (c) => {
    if (!authConfigured()) return c.redirect("/login?error=not-configured");
    const state = nonce(),
      verifier = nonce(),
      conf = config();
    const options = {
      httpOnly: true,
      secure: conf.secure,
      sameSite: "Lax" as const,
      path: "/api/auth",
      maxAge: 600,
    };
    setCookie(c, STATE_COOKIE, state, options);
    setCookie(c, PKCE_COOKIE, verifier, options);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: conf.clientId,
      redirect_uri: `${conf.origin}/api/auth/github/callback`,
      scope: "read:user",
      state,
      code_challenge: challenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return c.redirect(url.toString());
  });
  app.get("/auth/github/callback", async (c) => {
    const state = c.req.query("state") || "",
      code = c.req.query("code"),
      expected = getCookie(c, STATE_COOKIE) || "",
      verifier = getCookie(c, PKCE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/api/auth" });
    deleteCookie(c, PKCE_COOKIE, { path: "/api/auth" });
    if (
      !authConfigured() ||
      !code ||
      !state ||
      !expected ||
      !verifier ||
      !equalSecret(state, expected)
    )
      return c.redirect("/login?error=invalid-state");
    try {
      const conf = config();
      const response = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: conf.clientId,
            client_secret: conf.clientSecret,
            code,
            redirect_uri: `${conf.origin}/api/auth/github/callback`,
            code_verifier: verifier,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const result = (await response.json()) as { access_token?: string };
      if (!response.ok || !result.access_token)
        return c.redirect("/login?error=github");
      const user = await githubUser(result.access_token);
      if (String(user.id) !== conf.ownerId)
        return c.redirect("/login?error=owner-only");
      const token = await createSession({
        id: String(user.id),
        login: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
      });
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        secure: conf.secure,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return c.redirect("/admin");
    } catch {
      return c.redirect("/login?error=github");
    }
  });
  app.post("/auth/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ success: true });
  });
  app.use("/admin/*", async (c, next) => {
    if (!c.get("owner"))
      return c.json({ error: "Owner sign-in required" }, 401);
    await next();
  });
  app.get("/admin/portfolio", async (c) =>
    c.json(await store().portfolio(true)),
  );
  app.patch("/admin/profile", async (c) => {
    const result = profileSchema.safeParse(await c.req.json());
    if (!result.success)
      return c.json(
        {
          error: "Please check the profile fields",
          details: result.error.flatten(),
        },
        400,
      );
    return c.json(await store().saveProfile(result.data));
  });
  app.patch("/admin/projects/:id", async (c) => {
    const result = projectPatchSchema.safeParse(await c.req.json());
    if (!result.success)
      return c.json(
        {
          error: "Please check the project fields",
          details: result.error.flatten(),
        },
        400,
      );
    try {
      const project = await store().updateProject(
        c.req.param("id"),
        result.data,
      );
      return project
        ? c.json(project)
        : c.json({ error: "Project not found" }, 404);
    } catch (error) {
      if (!(error instanceof ProjectUnavailableError)) throw error;
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Cannot update project",
        },
        400,
      );
    }
  });
  app.post("/admin/github/sync", async (c) => {
    let repositories: GithubRepository[];
    try {
      repositories = await (deps.repositories || fetchRepositories)();
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "GitHub sync failed",
        },
        502,
      );
    }
    return c.json(await store().sync(repositories));
  });
  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    if (error instanceof SyntaxError)
      return c.json({ error: "Invalid JSON" }, 400);
    console.error("Portfolio API failure");
    return c.json({ error: "An unexpected error occurred" }, 500);
  });
  return app;
}
