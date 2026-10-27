"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ExternalLink,
  GitFork as Github,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  UserRound,
  X,
} from "lucide-react";
import type { Portfolio, Profile, Project } from "@/lib/types";

async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    const fields = data.details?.fieldErrors
      ? Object.entries(data.details.fieldErrors)
          .map(([key, value]) => `${key}: ${(value as string[]).join(", ")}`)
          .join("; ")
      : "";
    throw new Error(
      fields || data.error || "The request could not be completed",
    );
  }
  return data as T;
}
export function AdminWorkspace({
  initial,
  owner,
}: {
  initial: Portfolio;
  owner: string;
}) {
  const [data, setData] = useState(initial),
    [profile, setProfile] = useState<Profile>(initial.profile),
    [tab, setTab] = useState("projects"),
    [editing, setEditing] = useState<Project | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [isError, setIsError] = useState(false);
  async function job(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setIsError(false);
    try {
      await action();
    } catch (error) {
      setIsError(true);
      setNotice(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  }
  const updateProject = (p: Project) =>
    setData((old) => ({
      ...old,
      projects: old.projects.map((item) => (item.id === p.id ? p : item)),
    }));
  async function sync() {
    await job(async () => {
      const result = await request<{ added: number; total: number }>(
        "/api/admin/github/sync",
        "POST",
        {},
      );
      setData(await request<Portfolio>("/api/admin/portfolio"));
      setNotice(
        `Synced ${result.total} repositories. ${result.added} new repositories were added as Inactive.`,
      );
    });
  }
  async function saveProject(patch: Partial<Project>) {
    if (!editing) return;
    await job(async () => {
      const project = await request<Project>(
        `/api/admin/projects/${editing.id}`,
        "PATCH",
        patch,
      );
      updateProject(project);
      setEditing(null);
      setNotice("Project saved. Your portfolio is up to date.");
    });
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await job(async () => {
      const updated = await request<Profile>(
        "/api/admin/profile",
        "PATCH",
        profile,
      );
      setProfile(updated);
      setData((old) => ({ ...old, profile: updated }));
      setNotice("Profile saved. Your public page is up to date.");
    });
  }
  function field(key: keyof Profile, value: string) {
    setProfile((old) => ({ ...old, [key]: value }));
  }
  return (
    <main id="main" className="admin-shell">
      <header className="admin-nav">
        <Link href="/" className="wordmark">
          teethana<span>/</span>
        </Link>
        <div>
          <span className="owner-pill">
            <LockKeyhole size={12} />@{owner}
          </span>
          <button
            disabled={busy}
            className="text-button"
            onClick={() =>
              void job(async () => {
                await request("/api/auth/logout", "POST", {});
                window.location.assign("/");
              })
            }
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>
      <div className="admin-title">
        <div>
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h1>
            A collection,
            <br />
            <em>curated by you.</em>
          </h1>
        </div>
        <Link href="/" target="_blank" className="button button-outline">
          View portfolio
          <ExternalLink size={14} />
        </Link>
      </div>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <button
            className={tab === "projects" ? "selected" : ""}
            onClick={() => {
              setTab("projects");
              setNotice("");
            }}
          >
            <BookOpen size={16} />
            Projects<span>{data.projects.length}</span>
          </button>
          <button
            className={tab === "profile" ? "selected" : ""}
            onClick={() => {
              setTab("profile");
              setNotice("");
            }}
          >
            <UserRound size={16} />
            Profile & contact
          </button>
          <p>
            Changes are saved to your portfolio database. New GitHub imports
            start hidden.
          </p>
        </aside>
        <section className="admin-content">
          {notice && (
            <div
              className={`notice ${isError ? "error" : "success"}`}
              role={isError ? "alert" : "status"}
            >
              {!isError && <Check size={16} />}
              <span>{notice}</span>
            </div>
          )}
          {tab === "projects" ? (
            <>
              <div className="github-connection">
                <div>
                  <Github size={23} />
                  <div>
                    <strong>@{owner} / repositories</strong>
                    <p>
                      {data.lastSyncedAt
                        ? `Last sync: ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(data.lastSyncedAt))} (Bangkok)`
                        : "Ready to connect"}
                    </p>
                  </div>
                </div>
                <button
                  className="button button-blue"
                  disabled={busy}
                  onClick={() => void sync()}
                >
                  <RefreshCw size={14} className={busy ? "spinning" : ""} />
                  {busy ? "Working…" : "Sync GitHub"}
                </button>
              </div>
              <div className="admin-section-heading">
                <h2>Your projects</h2>
                <span>
                  {data.projects.filter((p) => p.active && p.available).length}{" "}
                  on the public shelf
                </span>
              </div>
              <div className="repository-list">
                {data.projects.map((p) => (
                  <article className="repository-row" key={p.id}>
                    <span
                      className="mini-book"
                      style={{ background: p.coverColor }}
                      aria-hidden="true"
                    />
                    <div className="repository-info">
                      <h3>
                        {p.title}
                        {p.featured && (
                          <span className="featured-label">Featured</span>
                        )}
                      </h3>
                      <p>
                        {p.language || "Project"} ·{" "}
                        {p.repoUrl.replace("https://github.com/", "")}
                      </p>
                      {!p.available && (
                        <p className="field-error">
                          No longer public on GitHub. Sync again after restoring
                          visibility.
                        </p>
                      )}
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={p.active && p.available}
                        disabled={busy || !p.available}
                        onChange={(e) => {
                          const active = e.target.checked;
                          void job(async () => {
                            updateProject(
                              await request<Project>(
                                `/api/admin/projects/${p.id}`,
                                "PATCH",
                                { active },
                              ),
                            );
                            setNotice(
                              `${p.title} is now ${active ? "visible on" : "hidden from"} your portfolio.`,
                            );
                          });
                        }}
                      />
                      <span className="switch-track" aria-hidden="true" />
                      <span>
                        {p.active && p.available ? "Active" : "Inactive"}
                      </span>
                    </label>
                    <button
                      className="icon-button"
                      disabled={busy}
                      onClick={() => setEditing(p)}
                      aria-label={`Edit ${p.title}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <form className="profile-editor" onSubmit={saveProfile}>
              <fieldset disabled={busy}>
                <div className="admin-section-heading">
                  <h2>Your story</h2>
                  <span>Public profile & contact</span>
                </div>
                <div className="form-grid">
                  <label>
                    Display name
                    <input
                      required
                      maxLength={100}
                      value={profile.name}
                      onChange={(e) => field("name", e.target.value)}
                    />
                  </label>
                  <label>
                    Location
                    <input
                      maxLength={120}
                      value={profile.location}
                      onChange={(e) => field("location", e.target.value)}
                    />
                  </label>
                  <label className="full-field">
                    Headline
                    <input
                      required
                      maxLength={160}
                      value={profile.headline}
                      onChange={(e) => field("headline", e.target.value)}
                    />
                  </label>
                  <label className="full-field">
                    About you
                    <textarea
                      rows={6}
                      maxLength={5000}
                      value={profile.bio}
                      onChange={(e) => field("bio", e.target.value)}
                    />
                  </label>
                  <label className="full-field">
                    Profile image URL
                    <input
                      type="url"
                      placeholder="https://…"
                      value={profile.avatarUrl}
                      onChange={(e) => field("avatarUrl", e.target.value)}
                    />
                  </label>
                </div>
                <h3 className="form-section-title">
                  Where people can find you
                </h3>
                <div className="form-grid">
                  {(
                    [
                      ["email", "Email"],
                      ["githubUrl", "GitHub"],
                      ["linkedinUrl", "LinkedIn"],
                      ["websiteUrl", "Website"],
                      ["resumeUrl", "Résumé URL"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type={key === "email" ? "email" : "url"}
                        placeholder={
                          key === "email" ? "you@example.com" : "https://…"
                        }
                        value={profile[key]}
                        onChange={(e) => field(key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <div className="admin-section-heading">
                  <h3 className="form-section-title">Experience & education</h3>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setProfile((old) => ({
                        ...old,
                        experience: [
                          ...old.experience,
                          {
                            period: "",
                            role: "",
                            organization: "",
                            description: "",
                          },
                        ],
                      }))
                    }
                  >
                    <Plus size={15} />
                    Add entry
                  </button>
                </div>
                {profile.experience.map((item, index) => (
                  <div className="experience-editor" key={index}>
                    <div className="form-grid">
                      {(
                        [
                          ["period", "Period"],
                          ["role", "Role or qualification"],
                          ["organization", "Company or school"],
                          ["description", "Description"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            value={item[key]}
                            onChange={(e) =>
                              setProfile((old) => ({
                                ...old,
                                experience: old.experience.map((row, i) =>
                                  i === index
                                    ? { ...row, [key]: e.target.value }
                                    : row,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setProfile((old) => ({
                          ...old,
                          experience: old.experience.filter(
                            (_, i) => i !== index,
                          ),
                        }))
                      }
                    >
                      <X size={13} />
                      Remove entry
                    </button>
                  </div>
                ))}
                <div className="save-bar">
                  <span>Only filled contact channels appear publicly.</span>
                  <button className="button button-blue" type="submit">
                    <Save size={15} />
                    {busy ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </section>
      </div>
      {editing && (
        <ProjectEditor
          key={editing.id}
          project={editing}
          busy={busy}
          error={isError ? notice : ""}
          save={saveProject}
          close={() => setEditing(null)}
        />
      )}
    </main>
  );
}
function ProjectEditor({
  project,
  busy,
  error,
  save,
  close,
}: {
  project: Project;
  busy: boolean;
  error: string;
  save: (patch: Partial<Project>) => Promise<void>;
  close: () => void;
}) {
  const [draft, setDraft] = useState(project),
    [stack, setStack] = useState(project.stack.join(", "));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="project-editor-title"
      className="project-editor"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="editor-heading">
        <div>
          <p className="eyebrow">PROJECT DETAILS</p>
          <h2 id="project-editor-title">Edit this chapter.</h2>
        </div>
        <button
          className="icon-button"
          disabled={busy}
          onClick={close}
          aria-label="Close editor"
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            title: draft.title,
            summary: draft.summary,
            content: draft.content,
            role: draft.role,
            year: draft.year,
            stack: stack
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            coverColor: draft.coverColor,
            liveUrl: draft.liveUrl,
            featured: draft.featured,
            sortOrder: draft.sortOrder,
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Project title
            <input
              autoFocus
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Short description
            <textarea
              required
              rows={2}
              maxLength={500}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          <label>
            Full project story
            <textarea
              rows={7}
              maxLength={15000}
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Your role
              <input
                maxLength={120}
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              />
            </label>
            <label>
              Year or period
              <input
                maxLength={30}
                value={draft.year}
                onChange={(e) => setDraft({ ...draft, year: e.target.value })}
              />
            </label>
            <label className="full-field">
              Technology (separated by commas)
              <input value={stack} onChange={(e) => setStack(e.target.value)} />
            </label>
            <label>
              Live project URL
              <input
                type="url"
                placeholder="https://…"
                value={draft.liveUrl}
                onChange={(e) =>
                  setDraft({ ...draft, liveUrl: e.target.value })
                }
              />
            </label>
            <label>
              Display order
              <input
                type="number"
                min={0}
                max={10000}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Book cover color
              <input
                className="color-input"
                type="color"
                value={draft.coverColor}
                onChange={(e) =>
                  setDraft({ ...draft, coverColor: e.target.value })
                }
              />
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) =>
                  setDraft({ ...draft, featured: e.target.checked })
                }
              />
              Featured project
            </label>
          </div>
          <div className="save-bar">
            <a
              href={project.repoUrl}
              className="text-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub
              <ArrowUpRight size={13} />
            </a>
            <button className="button button-blue" type="submit">
              <Save size={14} />
              {busy ? "Saving…" : "Save project"}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
