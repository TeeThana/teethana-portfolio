import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The public Bookshelf has a fixed catalog. Keep its MIT renderer and adapt data.
const packageRoot = path.dirname(
  fileURLToPath(import.meta.resolve("@designcodeio/threeui/package.json")),
);
const upstream = path.join(packageRoot, "lib-dist/shaders/bookshelf"),
  target = path.resolve("src/vendor/threeui");
fs.mkdirSync(target, { recursive: true });
let source = fs.readFileSync(
  path.join(upstream, "bookshelfRenderer.js"),
  "utf8",
);
const begin = source.indexOf("  const S = ["),
  end = source.indexOf("], Vr = ", begin);
if (begin < 0 || end < 0 || !source.includes("function ar("))
  throw new Error("ThreeUI source changed; review adapter before upgrading.");
source =
  source.slice(0, begin) + "  const S = He.books" + source.slice(end + 1);
source = source.replace(
  'en = document.querySelector(".detail-controls .microcopy")',
  'en = y.querySelector(".detail-controls .microcopy")',
);
source = source.replace(
  "    openSelected: () => {",
  '    selectVolume: (index) => { if (b === "hero" && D) ar(index, m); },\n    openSelected: () => {',
);
// Browse volumes with either a mouse wheel or a horizontal trackpad gesture.
// Keep browser zoom gestures and single-volume shelves on the normal page path.
const wheelStart = source.indexOf("  function vr(e) {"),
  wheelEnd = source.indexOf("  function xe(", wheelStart);
if (wheelStart < 0 || wheelEnd < 0)
  throw new Error("ThreeUI wheel handler changed; review adapter.");
source = source.slice(0, wheelStart) + `  function vr(e) {
    if (b !== "hero" || S.length < 2 || e.ctrlKey || e.metaKey || !e.cancelable) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? y.clientHeight : 1;
    V += A(delta * unit * 0.012, -0.72, 0.72), Ne = 0.14, U();
  }
` + source.slice(wheelEnd);
// Project covers use procedural cloth and motifs instead of the fixed tool atlas.
const coverStart = source.indexOf("  function wn(e) {"),
  coverEnd = source.indexOf("  function Cn(e) {", coverStart);
if (coverStart < 0 || coverEnd < 0)
  throw new Error("ThreeUI cover function changed; review adapter.");
source =
  source.slice(0, coverStart) +
  `  function wn(e) {
    const canvas=document.createElement("canvas");canvas.width=768;canvas.height=1152;
    const context=canvas.getContext("2d");context.fillStyle=e.color;context.fillRect(0,0,768,1152);
    const random=ye(pe(e.id)+e.seed);
    for(let index=0;index<1600;index++) {
      context.strokeStyle=random()>.5?"rgba(255,255,255,.035)":"rgba(0,0,0,.04)";
      const x=random()*768,y=random()*1152;
      context.beginPath();context.moveTo(x,y);context.lineTo(x+4+random()*22,y);context.stroke();
    }
    const gradient=context.createLinearGradient(0,0,768,0);
    gradient.addColorStop(0,"rgba(0,0,0,.25)");gradient.addColorStop(.08,"rgba(255,255,255,.04)");gradient.addColorStop(1,"rgba(0,0,0,.12)");
    context.fillStyle=gradient;context.fillRect(0,0,768,1152);
    context.strokeStyle=e.foil;context.globalAlpha=.25;context.lineWidth=2;context.strokeRect(35,35,698,1082);context.globalAlpha=1;
    $t(context,e,768,1152);
    return Q(new l.CanvasTexture(canvas));
  }
` +
  source.slice(coverEnd);
source = source
  .replaceAll("WORKING VOLUMES", "TEETHANA / PROJECTS")
  .replaceAll("AN IMAGINED EDITION", "A PROJECT IN THE COLLECTION");
source = source.replace(
  "t.fillText(e.title, 58, 1020)",
  "t.fillText(e.title, 58, 1020, 650)",
);
source = source.replace("e ? 8.7 : 8.1", "e ? 7.1 : 6.7");
const license = fs.readFileSync(path.join(packageRoot, "LICENSE"), "utf8");
fs.writeFileSync(
  path.join(target, "bookshelfRenderer.js"),
  `/* ThreeUI Bookshelf v1.2.0 — project catalog adapter.\n${license}\n*/\n${source}`,
);
fs.cpSync(path.join(upstream, "three165"), path.join(target, "three165"), {
  recursive: true,
});
fs.writeFileSync(path.join(target, "LICENSE"), license);
console.log(
  "Vendored ThreeUI Bookshelf 1.2.0 with project data and preserved MIT notices.",
);
