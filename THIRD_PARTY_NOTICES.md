# Third-party components

The project uses ThreeUI Community 1.2.0 by Meng To (MIT), including its Bookshelf renderer and Structure Flow. The Bookshelf renderer and its Three.js helpers are vendored in `portfolio-fe/src/vendor/threeui/` with their original MIT license. The adapter replaces the fixed tool catalog with project data and blue procedural covers, exposes selection, scopes one DOM query, supports vertical and horizontal wheel browsing over the shelf, and adjusts the shelf camera distance. Regenerate it with `node scripts/vendor-threeui.mjs` from `portfolio-fe/` after reviewing any upstream upgrade.

Upstream: https://github.com/MengTo/threeui

The upstream embedded artwork and book rendering are retained under the upstream Community license. The personal project data and blue palette are supplied by this application. Three.js helper files retain their own copyright notices. Next.js, React, Hono, Lucide and the other dependencies retain their respective licenses. Manrope, Newsreader, IBM Plex Mono and Noto Sans Thai are open fonts loaded with Next.js font optimization.
