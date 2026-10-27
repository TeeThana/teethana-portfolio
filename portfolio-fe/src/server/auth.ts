import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sign, verify } from "hono/jwt";
import { config } from "./config";

export const SESSION_COOKIE = "teethana_session";
export const STATE_COOKIE = "teethana_oauth_state";
export const PKCE_COOKIE = "teethana_oauth_pkce";
export type OwnerSession = {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
};
export function nonce() {
  return randomBytes(32).toString("base64url");
}
export function challenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function equalSecret(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function createSession(user: OwnerSession) {
  const c = config();
  if (c.authSecret.length < 32 || user.id !== c.ownerId)
    throw new Error("Owner authentication is not configured");
  return sign(
    {
      sub: user.id,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
    c.authSecret,
    "HS256",
  );
}
export async function readSession(
  token?: string,
): Promise<OwnerSession | null> {
  const c = config();
  if (!token || c.authSecret.length < 32) return null;
  try {
    const payload = await verify(token, c.authSecret, "HS256");
    if (
      payload.sub !== c.ownerId ||
      typeof payload.exp !== "number" ||
      typeof payload.login !== "string"
    )
      return null;
    return {
      id: payload.sub,
      login: payload.login,
      name: String(payload.name || payload.login),
      avatarUrl: String(payload.avatarUrl || ""),
    };
  } catch {
    return null;
  }
}
