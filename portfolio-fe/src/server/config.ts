export function config() {
  const appUrl = new URL(process.env.APP_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(appUrl.protocol))
    throw new Error("Invalid APP_URL");
  if (
    process.env.NODE_ENV === "production" &&
    appUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname)
  )
    throw new Error("Public production deployments require an https APP_URL");
  return {
    origin: appUrl.origin,
    secure: appUrl.protocol === "https:",
    owner: process.env.GITHUB_OWNER || "TeeThana",
    ownerId: process.env.OWNER_GITHUB_ID || "155901166",
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    authSecret: process.env.AUTH_SECRET || "",
    databasePath: process.env.DATABASE_PATH || "./data/portfolio.sqlite",
    githubToken: process.env.GITHUB_TOKEN || "",
  };
}
export function authConfigured() {
  const c = config();
  return Boolean(c.clientId && c.clientSecret && c.authSecret.length >= 32);
}
