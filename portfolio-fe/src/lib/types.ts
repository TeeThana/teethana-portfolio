export type Experience = {
  period: string;
  role: string;
  organization: string;
  description: string;
};
export type Profile = {
  name: string;
  headline: string;
  bio: string;
  location: string;
  avatarUrl: string;
  email: string;
  githubUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  resumeUrl: string;
  experience: Experience[];
};
export type Project = {
  id: string;
  githubId: number | null;
  slug: string;
  title: string;
  summary: string;
  content: string;
  role: string;
  year: string;
  stack: string[];
  coverColor: string;
  repoUrl: string;
  liveUrl: string;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  available: boolean;
  language: string;
  stars: number;
  updatedAt: string;
};
export type Portfolio = {
  profile: Profile;
  projects: Project[];
  lastSyncedAt: string | null;
};
export type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
};
