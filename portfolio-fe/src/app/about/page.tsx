import Link from "next/link";
import {
  ArrowUpRight,
  GitFork as Github,
  BriefcaseBusiness as Linkedin,
  Mail,
  Globe,
  FileDown,
} from "lucide-react";
import { Navigation, Footer } from "@/components/navigation";
import { getStore } from "@/server/store";
export const dynamic = "force-dynamic";
export const metadata = { title: "About & contact" };
export default async function About() {
  const { profile } = await getStore().portfolio();
  const contacts = [
    { url: profile.githubUrl, label: "GitHub", icon: Github },
    { url: profile.linkedinUrl, label: "LinkedIn", icon: Linkedin },
    { url: profile.websiteUrl, label: "Website", icon: Globe },
    {
      url: profile.email ? `mailto:${profile.email}` : "",
      label: profile.email,
      icon: Mail,
    },
  ].filter((x) => x.url);
  return (
    <div className="site-shell">
      <Navigation />
      <main id="main" className="about-page">
        <p className="eyebrow">FROM APPLICATIONS TO INFRASTRUCTURE</p>
        <div className="about-intro">
          <div>
            <h1>
              A little about
              <br />
              <em>{profile.name}.</em>
            </h1>
            <h2>{profile.headline}</h2>
            {profile.bio ? (
              <p className="prose">{profile.bio}</p>
            ) : (
              <p className="prose subtle">
                I’m putting together the next chapter of this page. In the
                meantime, explore what I’ve been building on GitHub.
              </p>
            )}
            <p className="eyebrow location">{profile.location}</p>
            {profile.resumeUrl && (
              <a
                className="button button-outline"
                href={profile.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown size={15} />
                View résumé
              </a>
            )}
          </div>
          <div className="portrait-frame">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                width={340}
                height={340}
                alt={profile.name}
              />
            ) : (
              <span className="portrait-monogram">t.</span>
            )}
            <span className="portrait-caption eyebrow">
              BUILD / SHIP / OPERATE
            </span>
          </div>
        </div>
        {profile.experience.length > 0 && (
          <section className="experience-section">
            <p className="eyebrow">SELECTED EXPERIENCE & TECHNICAL FOCUS</p>
            {profile.experience.map((item, index) => (
              <article key={index} className="experience-row">
                <span className="eyebrow">{item.period}</span>
                <div>
                  <h3>{item.role}</h3>
                  <p>{item.organization}</p>
                  <p className="subtle prose">{item.description}</p>
                </div>
              </article>
            ))}
          </section>
        )}
        <section id="contact" className="contact-section">
          <p className="eyebrow">GOOD THINGS START WITH A CONVERSATION</p>
          <h2>
            Let’s build
            <br />
            <em>what comes next.</em>
          </h2>
          <div className="contact-links">
            {contacts.map(({ url, label, icon: Icon }) => (
              <a
                href={url}
                key={label}
                target={url.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
              >
                <Icon size={20} />
                <span>{label}</span>
                <ArrowUpRight size={20} />
              </a>
            ))}
          </div>
          <Link href="/#work" className="text-button">
            Explore selected work
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
