"use client";
import dynamic from "next/dynamic";
import type { Project } from "@/lib/types";
const Shelf = dynamic(() => import("./bookshelf"), {
  ssr: false,
  loading: () => (
    <div className="shelf-placeholder" role="status">
      Preparing your collection…
    </div>
  ),
});
const Field = dynamic(
  () =>
    import("@designcodeio/threeui/components/StructureFlowCollection").then(
      (m) => m.StructureFlowCollection,
    ),
  { ssr: false },
);
export function ProjectBookshelf({ projects }: { projects: Project[] }) {
  return <Shelf projects={projects} />;
}
export function HeroField() {
  return (
    <div className="hero-field" aria-hidden="true">
      <Field variant="structure-flow" />
    </div>
  );
}
