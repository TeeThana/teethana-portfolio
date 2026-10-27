"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  RotateCcw,
  X,
} from "lucide-react";
import type { Project } from "@/lib/types";
import {
  createBookshelfRenderer,
  type Book,
  type BookshelfRenderer,
} from "@/vendor/threeui/bookshelfRenderer.js";
function asBook(p: Project, i: number): Book {
  return {
    id: p.id,
    title: p.title.length > 26 ? `${p.title.slice(0, 25)}…` : p.title,
    roman: String(i + 1).padStart(2, "0"),
    discipline: p.language || "Software development",
    note: p.summary.slice(0, 150),
    deck: (p.content || p.summary).slice(0, 800),
    binding: "Blue cloth · silver foil",
    format: "A project from the Teethana collection",
    theme: p.stack.join(" · "),
    motif: "A study in code and craft",
    motifKey: ["brackets", "paths", "layers", "compass", "window", "spark"][
      i % 6
    ],
    paletteLabel: "Midnight · cobalt · silver",
    color: p.coverColor,
    foil: "#c0d8fc",
    palette: {
      paper: "#111c31",
      paperDeep: "#091121",
      paperPale: "#d5e3f5",
      ink: "#e4edfa",
      inkSoft: "#a6bbd7",
      wall: "#111c31",
      shelf: "#263b58",
      shelfDark: "#101d30",
      light: "#c6dcff",
      fill: "#83aee8",
    },
    width: 1.02 + (i % 3) * 0.04,
    height: 1.5 + (i % 2) * 0.12,
    depth: 0.25,
    chapters: ["Overview", "The work", "Source code"],
    seed: (i + 1) * 11,
  };
}
export default function Bookshelf({ projects }: { projects: Project[] }) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<BookshelfRenderer | null>(null);
  const [selected, setSelected] = useState(0),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState("");
  const project = projects[selected] || projects[0];
  useEffect(() => {
    if (!host.current || !canvas.current || !projects.length) return;
    let disposed = false;
    try {
      const scene = createBookshelfRenderer(host.current, canvas.current, {
        books: projects.map(asBook),
        onReady: () => {
          if (!disposed) setStatus("ready");
        },
        onError: (message) => {
          if (!disposed) {
            setError(message);
            setStatus("unavailable");
          }
        },
        onSelectionChange: (item) => {
          if (!disposed) setSelected(item.index);
        },
      });
      renderer.current = scene;
      const observer = new ResizeObserver(() => scene.resize());
      observer.observe(host.current);
      void scene.ready.catch(() => {
        if (!disposed) setStatus("unavailable");
      });
      return () => {
        disposed = true;
        observer.disconnect();
        scene.dispose();
        renderer.current = null;
      };
    } catch {
      setStatus("unavailable");
    }
    return () => {
      disposed = true;
    };
  }, [projects]);
  if (!projects.length)
    return (
      <div className="empty-state">
        The next chapter is still being written. Projects will appear here soon.
      </div>
    );
  return (
    <div className="project-library">
      <div className="book-world" ref={host} data-state={status}>
        <canvas
          ref={canvas}
          aria-label="Interactive 3D project bookshelf. Use the arrows or the project list below."
        />
        <div id="loading" className="shelf-loading" role="status">
          Preparing the bookshelf…
        </div>
        <p id="fallback-status" className="sr-only" />
        <div id="browse-ui" className="shelf-ui">
          <div className="shelf-selection">
            <span id="counter" className="eyebrow">
              01 / {String(projects.length).padStart(2, "0")}
            </span>
            <div>
              <h3 id="selection-title">{project.title}</h3>
              <p id="selection-note">{project.summary}</p>
            </div>
          </div>
          <div className="shelf-buttons">
            <button
              id="previous"
              className="icon-button"
              aria-label="Previous project"
            >
              <ArrowLeft size={17} />
            </button>
            <button id="inspect" className="button button-outline">
              <BookOpen size={15} />
              Inspect book
            </button>
            <button id="next" className="icon-button" aria-label="Next project">
              <ArrowRight size={17} />
            </button>
          </div>
          <div
            id="markers"
            className="shelf-markers"
            role="tablist"
            aria-label="Choose a project volume"
          />
          <span id="palette-label" className="sr-only" />
        </div>
        <aside
          id="detail-panel"
          className="book-details"
          aria-hidden="true"
          aria-label="Selected book details"
        >
          <div className="detail-top">
            <span id="detail-eyebrow" className="eyebrow" />
            <button
              id="close-detail"
              className="icon-button"
              aria-label="Close book inspection"
            >
              <X size={17} />
            </button>
          </div>
          <h3 id="detail-title">{project.title}</h3>
          <p id="detail-deck" />
          <dl>
            <div>
              <dt>Stack</dt>
              <dd id="detail-theme" />
            </div>
            <div>
              <dt>Edition</dt>
              <dd id="detail-format" />
            </div>
          </dl>
          <span id="detail-binding" className="sr-only" />
          <span id="detail-motif" className="sr-only" />
          <div className="detail-controls">
            <button id="toggle-book" className="button button-blue">
              Open book
            </button>
            <div className="page-controls">
              <button
                id="previous-page"
                className="icon-button"
                aria-label="Previous book page"
              >
                <ArrowLeft size={15} />
              </button>
              <span id="page-counter" className="eyebrow" />
              <button
                id="next-page"
                className="icon-button"
                aria-label="Next book page"
              >
                <ArrowRight size={15} />
              </button>
            </div>
            <span id="page-label" className="eyebrow" />
            <p className="microcopy" />
            <button id="reset-view" className="text-button">
              <RotateCcw size={12} />
              Reset view
            </button>
          </div>
          <Link className="case-study-link" href={`/projects/${project.slug}`}>
            Read full project
            <ArrowUpRight size={16} />
          </Link>
        </aside>
        <span id="live-region" className="sr-only" aria-live="polite" />
        <span id="pointer-label" className="pointer-label" aria-hidden="true">
          <span id="pointer-label-index" />
          <span id="pointer-label-title" />
        </span>
      </div>
      {status === "unavailable" && (
        <p className="shelf-fallback" role="status">
          The 3D view is unavailable on this device. Explore every project
          below.<span className="sr-only">{error}</span>
        </p>
      )}
      <div className="project-index" aria-label="All projects">
        {projects.map((p, i) => (
          <Link
            href={`/projects/${p.slug}`}
            key={p.id}
            className="project-index-row"
            onMouseEnter={() => {
              if (status === "ready") renderer.current?.selectVolume(i);
            }}
          >
            <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3>{p.title}</h3>
              <p>{p.summary}</p>
            </div>
            <span className="project-language">{p.language || "Project"}</span>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </div>
    </div>
  );
}
