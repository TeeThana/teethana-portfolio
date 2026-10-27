import type { GithubRepository } from "@/lib/types";
import { config } from "./config";

export async function githubUser(
  token: string,
): Promise<{
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}> {
  return githubRequest("https://api.github.com/user", token);
}
async function githubRequest<T>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "teethana-portfolio",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? "GitHub API rate limit reached. Please try again later."
        : `GitHub request failed (${response.status}).`,
    );
  return response.json() as Promise<T>;
}
export async function fetchRepositories(): Promise<GithubRepository[]> {
  const c = config();
  const repos: GithubRepository[] = [];
  for (let page = 1; page <= 20; page++) {
    const items = await githubRequest<GithubRepository[]>(
      `https://api.github.com/users/${encodeURIComponent(c.owner)}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
      c.githubToken,
    );
    repos.push(...items.filter((repo) => !repo.private));
    if (items.length < 100) return repos;
  }
  // Never interpret a truncated sync as deleted/private repositories.
  throw new Error(
    "Repository list exceeds the supported sync size; no data was changed.",
  );
}
