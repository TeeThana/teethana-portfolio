import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, MapPin } from "lucide-react";
import { Navigation, Footer } from "@/components/navigation";
import { HeroField, ProjectBookshelf } from "@/components/portfolio-showcase";
import { getStore } from "@/server/store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Home() {
  const { profile, projects } = await getStore().portfolio();
  return (
    <div className="site-shell">
      <Navigation />
      <main id="main">
        <section className="hero">
          <HeroField />
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" />
              THE PERSONAL PORTFOLIO OF {profile.name.toUpperCase()}
            </p>
            <h1>
              Built with code.
              <br />
              Made to <em>explore.</em>
            </h1>
            <p className="hero-description">
              {profile.headline}
              <br />Web applications, delivery pipelines, and the systems
              that keep them running.
            </p>
            <div className="hero-actions">
              <a href="#work" className="button button-blue">
                Explore my work
                <ArrowDownRight size={16} />
              </a>
              <Link className="text-button" href="/about">
                A little about me
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
          <div className="hero-foot">
            <span className="eyebrow">
              THOUGHTFUL SOFTWARE / A LITTLE DIMENSION
            </span>
            {profile.location && (
              <span className="location">
                <MapPin size={12} />
                {profile.location}
              </span>
            )}
          </div>
        </section>
        <section id="work" className="work-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / THE COLLECTION</p>
              <h2>
                Projects, bound <em>in blue.</em>
              </h2>
            </div>
            <p>
              Every project has a story.
              <br /> Pick a volume. Open a new perspective.
            </p>
          </div>
          <ProjectBookshelf projects={projects} />
        </section>
        <section className="maker-section">
          <div className="maker-mark" aria-hidden="true">
            t.
          </div>
          <div>
            <p className="eyebrow">02 / BEHIND THE WORK</p>
            <h2>Hello, I’m {profile.name.split(" ")[0]}.</h2>
            <p>
              {profile.bio.split(/\n\s*\n/)[0] ||
                "Get to know the person behind the projects, the tools I work with, and what I’m building next."}
            </p>
          </div>
          <Link href="/about" className="text-button">
            Meet the maker
            <ArrowUpRight size={17} />
          </Link>
        </section>
        <section className="contact-callout">
          <p className="eyebrow">03 / THE NEXT CHAPTER</p>
          <div>
            <h2>
              Something in mind?
              <br />
              <em>Let’s make it happen.</em>
            </h2>
            <Link href="/about#contact" className="button button-light">
              Start a conversation
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
