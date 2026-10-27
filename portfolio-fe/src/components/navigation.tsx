import Link from "next/link";
import { ArrowUpRight, GitFork as Github } from "lucide-react";
export function Navigation() {
  return (
    <header className="site-nav">
      <Link href="/" className="wordmark" aria-label="Teethana home">
        teethana<span>/</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#work">Work</Link>
        <Link href="/about">About</Link>
        <Link href="/about#contact">
          Contact
          <ArrowUpRight size={12} />
        </Link>
      </nav>
      <Link
        className="github-nav"
        href="https://github.com/TeeThana"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="TeeThana on GitHub"
      >
        <Github size={18} />
      </Link>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/" className="wordmark">
        teethana<span>/</span>
      </Link>
      <span>Code, craft, and the chapters in between.</span>
      <Link href="/admin">
        Owner workspace
        <ArrowUpRight size={12} />
      </Link>
    </footer>
  );
}
