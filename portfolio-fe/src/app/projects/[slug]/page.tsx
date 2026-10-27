import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitFork as Github } from "lucide-react";
import { Navigation, Footer } from "@/components/navigation";
import { getStore } from "@/server/store";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = await getStore().project((await params).slug);
  return { title: p?.title || "Project not found", description: p?.summary };
}
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = await getStore().project((await params).slug);
  if (!p) notFound();
  return (
    <div className="site-shell">
      <Navigation />
      <main id="main" className="project-page">
        <Link href="/#work" className="text-button">
          <ArrowLeft size={14} />
          Back to the collection
        </Link>
        <p className="eyebrow">PROJECT STUDY / {p.language || "SOFTWARE"}</p>
        <h1>{p.title}</h1>
        <p className="project-deck">{p.summary}</p>
        <div
          className="project-artwork"
          style={{ "--cover": p.coverColor } as React.CSSProperties}
        >
          <div className="flat-book">
            <span className="eyebrow">TEETHANA / SELECTED WORK</span>
            <div className="book-motif" aria-hidden="true" />
            <strong>{p.title}</strong>
            <span className="eyebrow">A CHAPTER IN CODE & CRAFT</span>
          </div>
          <span className="eyebrow artwork-caption">
            PROJECT VOLUME / {p.language || "DEVELOPMENT"}
          </span>
        </div>
        <div className="project-body">
          <section>
            <h2>About the project</h2>
            {p.content ? (
              <div className="prose">{p.content}</div>
            ) : (
              <p className="prose">
                {p.summary} Explore the repository for the source code,
                documentation, and development history.
              </p>
            )}
            <div className="hero-actions">
              <a
                className="button button-blue"
                href={p.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={16} />
                View source
                <ArrowUpRight size={15} />
              </a>
              {p.liveUrl && (
                <a
                  className="button button-outline"
                  href={p.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit project
                  <ArrowUpRight size={15} />
                </a>
              )}
            </div>
          </section>
          <aside>
            <div className="project-meta">
              <span className="eyebrow">TECHNOLOGY</span>
              <div className="tags">
                {p.stack.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            {p.role && (
              <div className="project-meta">
                <span className="eyebrow">MY ROLE</span>
                <p>{p.role}</p>
              </div>
            )}
            <div className="project-meta">
              <span className="eyebrow">
                {p.year ? "YEAR" : "LAST UPDATED ON GITHUB"}
              </span>
              <p>
                {p.year ||
                  new Intl.DateTimeFormat("en", {
                    year: "numeric",
                    month: "long",
                    timeZone: "Asia/Bangkok",
                  }).format(new Date(p.updatedAt))}
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
