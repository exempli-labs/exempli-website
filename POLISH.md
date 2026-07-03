# exempli — polish plan

Goal: keep the copy and the vibe; raise craft to "this proves we can build" level.
References: hashgraphvc.com, hubtown.co.in — restraint, perfect type, few flawless moments.

## Toolchain (installed 2026-07-01)

Vite 8 + Tailwind v4 (`@tailwindcss/vite`), npm GSAP 3.15 (all plugins now free, incl. SplitText),
Lenis, three 0.185 (ES modules), `@fontsource-variable/inter` + `jetbrains-mono`.
Run: `npm run dev` · build: `npm run build`. Tokens live in `src/styles/main.css` (`@theme`).
Pages still load CDN scripts until Phase 1 lands.

## Phase 1 — migrate onto the toolchain ✅ (2026-07-02)

- [x] Extract shared JS to `src/js/`: `core.js` (Lenis/nav/cursor + elapsed helper), `noise.js` (GLSL, one copy), `orb.js` (shared home/about orb material), `pages/{home,work,process,about}.js`
- [x] Replace CDN `<script>` tags with module imports per page; delete inline `tailwind.config`
- [x] Link `src/styles/main.css`; move shared inline `<style>` blocks into it
- [x] Verify parity page by page (0 console errors), `npm run build` works (~187 KB gzip JS total)
- Notes: dropped dead code (unused `makeNoiseOrbMaterial`, inert hero lights, 404'ing SplitText tag);
  replaced deprecated `THREE.Clock` with `createElapsed()`; subpages now get the `ss01`/`cv11`
  font features the homepage already had.

## Phase 2 — fix what's broken (highest visual ROI) ✅ (2026-07-02)

- [x] Headline splitting → GSAP SplitText (words+chars, aria auto, reverts after intro; no more mid-word breaks)
- [x] Mobile nav — hamburger + full-screen overlay (black/peach, mono indices, staggered reveal, Esc closes, scroll locks). Top CTA hidden below md (it wrapped); menu carries contact.
- [x] 3D composition pass:
  - orb (home): composition group — right-of-center on desktop, top on mobile; distortion 0.38→0.22; fresnel pow 2.4→3.0; subdiv 96→64 (48 mobile); DPR cap 1.5 mobile
  - about orb: canvas 70vw→56vw, pulled in; same material tuning
  - process knot: scale 0.72 anchored upper-right, opacity 0.55→0.4 — off the nav/copy
  - work constellation: grouped, shifted right/up clear of headline
- [x] Contrast: `.hero-shade` gradient layer between every hero canvas and its text
- [x] `prefers-reduced-motion`: native scroll (no Lenis), static poster frames for all 3D, no marquee/pulse/cursor, instant content
- [x] Cursor: ring grows but never solid-fills over text; `:focus-visible` accent outlines added
- Note: "↓ 02" mobile overflow was a screenshot-crop artifact — verified no real overflow (scrollWidth == innerWidth)
- ~~OPEN: orb interior mottled~~ RESOLVED 2026-07-02: orb shader rewritten — normals recomputed from the
  displaced surface + key/fill/specular lighting + ember color ramp + dither. Hero got a volume pass:
  drifting dust field (counter-parallax), ember glow backdrop in the orb group, CSS vignette. ~120fps desktop.
  Marquee upgraded to extruded 3D ticker (lit edge, drop shadow, drum-tilted type).

## Phase 3 — the impressive layer ✅ (2026-07-02)

- [x] Loader: 1.6s with count-up %, hands off into the orb scale-up
- [x] Page transitions — cross-document View Transitions (fade; off under reduced-motion; no-op where unsupported)
- [x] Case rows: cursor-following live wireframe preview per project (no fake screenshots; hidden on touch).
      Swap for real project imagery when Ethan supplies it.
- [x] Process steps: built the `.step-canvas` mini-wireframes (ico/box/torus/knot/octa, IO-gated, static under reduced-motion)
- [x] Magnetic CTAs (gsap quickTo); all bottom CTAs converted to the bordered component
- [x] Footer: big hello@exempli.ai on subpages, sitemap links on all pages. Socials pending Ethan's links.

## Phase 4 — business credibility

- [ ] Consultation CTA → Cal.com embed/modal (mailto loses people)
- [x] Copy consistency: DECIDED by Ethan 2026-07-02 — **audit / architect / design / build / tune**. Applied to
      process hero + meta + steps, home marquee + pillars. (Prose "maintain(ed)" on about page left as prose.)
- [ ] Favicon (peach tittle dot), OG image + social cards, 404
- [ ] Deploy: `npm run build` → Cloudflare Pages / Vercel / Netlify

## Do NOT

More 3D scenes, more section types, framework rewrite. The gap is discipline and finish, not ambition.
