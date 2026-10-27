import Link from "next/link";
import { GitFork as Github, LockKeyhole, ArrowLeft } from "lucide-react";
import { authConfigured, config } from "@/server/config";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner sign-in",
  robots: { index: false, follow: false },
};
const messages: Record<string, string> = {
  "owner-only": "This workspace is reserved for the portfolio owner.",
  "invalid-state": "The sign-in request expired. Please try again.",
  github: "GitHub sign-in could not be completed. Please try again.",
  "not-configured": "GitHub sign-in has not been configured yet.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = authConfigured();
  return (
    <main id="main" className="login-page">
      <Link className="wordmark" href="/">
        teethana<span>/</span>
      </Link>
      <section className="login-card">
        <LockKeyhole size={28} />
        <p className="eyebrow">OWNER WORKSPACE</p>
        <h1>
          Your work.
          <br />
          <em>Your space.</em>
        </h1>
        <p>
          Sign in with the GitHub account <strong>@{config().owner}</strong> to
          curate projects and manage your profile.
        </p>
        {error && messages[error] && (
          <p className="notice error" role="alert">
            {messages[error]}
          </p>
        )}
        {configured ? (
          <a href="/api/auth/github" className="button button-blue">
            <Github size={17} />
            Continue with GitHub
          </a>
        ) : (
          <div className="setup-note">
            <strong>GitHub sign-in needs setup.</strong>
            <p>
              Configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and AUTH_SECRET
              on your server. The workspace stays locked until setup is
              complete.
            </p>
            <a
              href="https://github.com/TeeThana/teethana-portfolio#owner-sign-in"
              target="_blank"
              rel="noopener noreferrer"
            >
              Setup instructions ↗
            </a>
          </div>
        )}
        <Link href="/" className="text-button">
          <ArrowLeft size={14} />
          Back to the portfolio
        </Link>
      </section>
    </main>
  );
}
