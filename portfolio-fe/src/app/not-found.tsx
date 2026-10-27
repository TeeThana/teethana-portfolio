import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="not-found">
      <p className="eyebrow">404 / A CHAPTER NOT FOUND</p>
      <h1>
        This page isn’t
        <br />
        <em>on the shelf.</em>
      </h1>
      <Link href="/" className="button button-blue">
        Back to the collection ↗
      </Link>
    </main>
  );
}
