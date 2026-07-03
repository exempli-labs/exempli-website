# exempli — V2 plan (scoped 2026-07-02)

Seven changes scoped into five phases. Each phase is independently runnable and
verifiable; run them in order (later phases depend on Phase 1's shared modules).

## Execution prompt

Copy everything below the line into a session (or run phases one at a time).

---

Project: `~/exempli website/` — Vite 8 + Tailwind v4 + three 0.185 + GSAP/Lenis.
Pages: index/work/process/about.html, per-page JS in `src/js/pages/`, shared
`core.js`/`noise.js`/`orb.js`, tokens+shared CSS in `src/styles/main.css`.
Dev: `npm run dev` (port 5173). Aesthetic: black, peach accent #E8A87C,
ember/wireframe 3D, mono section markers, ~120fps desktop target,
`prefers-reduced-motion` honored everywhere via static poster frames.
Verify each phase in the browser preview before moving on: 0 console errors,
desktop + mobile screenshots, fps spot-check ≥100 on 3D pages, reduced-motion
pass. Finish with a clean `npm run build`.

### Phase 0 — quick fixes

1. **Remove "est 2026"**: in index.html change the hero marker
   "Custom software · est. 2026" to "Custom software". In about.html change
   "About · founded 2026" to "About". Leave the loader's "exempli // 2026"
   and work's "Selected work · 2025–2026" untouched (year stamps, not claims).
2. **Home nav tab**: on work.html, process.html, about.html add "Home" as the
   FIRST desktop nav link using the same `link-hover`/`link-inner`/`link-ghost`
   pattern (href="index.html"), and add it to the mobile overlay menu
   (renumber menu indices). Do NOT add a Home link on index.html. Preserve the
   convention that the current page's link gets `text-accent`.
3. **Remove work hover preview**: delete the `#case-preview` canvas element in
   work.html, its `.case-preview` CSS block (including the `@media (hover:none)`
   rule), and the entire "Case preview" block in `src/js/pages/work.js`
   (renderer, its mousemove listener, per-row mouseenter/mouseleave wiring).
   Keep case-row hover styling (background tint, meta color, arrow nudge) and
   the site-wide cursor ring.

### Phase 1 — shared base section on every page

4. Extract index.html's `#contact` section into shared modules so all four
   pages end identically:
   - Move the contact terrain scene (rhombitrihexagonal-tiling shader plane,
     ScrollTrigger rise-in, cursor hotspot with idle lissajous drift,
     reduced-motion static frame) from `src/js/pages/home.js` into
     `src/js/contact.js` exporting `initContactSection()`. It must reuse
     `createMiniScene`-equivalent sizing/visibility logic — move that helper
     into `core.js` if needed.
   - Move the `#contact` / `.contact-canvas` / `#contact::before` CSS from
     index.html's inline styles into `main.css`.
   - Replace the final CTA/footer section of work/process/about with the exact
     `#contact` markup from index (terrain canvas + "need software that fits?"
     + consultation CTA + footer). Adjust each page's `//0N` marker number to
     continue that page's sequence. Delete the old per-page footers.
   - Call `initContactSection()` from each page module; home keeps identical
     behavior/visuals to today.

### Phase 2 — textured-space heroes

5. **Home hero**: keep the ember orb composition (offset beside the type) and
   deepen the space behind it: (a) a large nebula layer far behind — noise
   shader quad, very low alpha, slow drift; (b) split the dust field into 2–3
   depth layers with distinct parallax response; (c) sparse faint white/peach
   starfield points at the far plane; (d) slightly stronger vignette. The
   `hero-shade` text-contrast layer must stay; headline legibility must not
   regress. DPR caps and mobile particle counts as today; ≥100fps desktop.
6. **Site-wide vibe**: extract the backdrop (nebula + layered dust + stars, no
   orb) into `src/js/space.js` with an `initSpaceBackdrop(scene, opts)` helper
   and add it behind the existing hero focal objects on work (constellation),
   process (knot), about (orb).

### Phase 3 — process step scenes with meaning

7. Replace the five generic spinning shapes in `src/js/pages/process.js` with
   purpose-built mini-scenes. Keep: 140px canvases, ember-wireframe material
   language, soft peach point light, IntersectionObserver-gated render loops,
   scroll reveal per step, reduced-motion poster frames. Each animation loops
   with an ease-hold-reset rhythm (no abrupt snaps):
   - **001 Audit** — an icosahedron's facets convert one by one from dark grey
     (#3a3a3a) to lit peach until the whole solid is illuminated, holds, then
     resets. (Audit lights up every corner.)
   - **002 Architect** — scattered floating fragments assemble into a clean
     structured frame/lattice, hold, gently disperse. (Structure out of parts.)
   - **003 Design** — a raw noisy block morphs smoothly into a refined twisted
     sculptural form and back (vertex morph, not a geometry swap). (Raw
     material becomes sculpture.)
   - **004 Build** — a modular structure grows piece by piece to completion —
     stacking/branching, each piece easing in. (Software assembling.)
   - **005 Tune** — turbulent particle streamlines converge into clean laminar
     flow that tightens and quickens. (Streamlining, improvement.)

### Phase 4 — security & trust page

8. Create `security.html` ("Security" tab) using the standard subpage shell:
   nav (+ mobile menu), hero with space backdrop and a small wireframe focal
   object (e.g. octahedral shield), `page-enter` reveals, and the shared base
   section from Phase 1. Copy sections (plain, confident, no legalese — match
   site voice): data handling & privacy (what we access and don't, GDPR
   posture) · IP & ownership (client owns all code; escrow available) ·
   confidentiality (NDA by default) · secure development (least-privilege,
   secrets management, dependency audits, review before merge) · hosting &
   compliance (SOC2-ready infra, EU/US residency options) · a short honest
   "what we don't do" note. Add the Security link to every page's nav and
   footer, and to the mobile menus. Give it a `<meta name="description">`.
9. Register security.html as a fifth rollup input in `vite.config.js`.

---

## Decisions taken (change if wrong)

- "founded 2026" on about treated as same intent as "est. 2026" → removed.
- Loader "exempli // 2026" and work "2025–2026" kept.
- Architect step (user didn't specify): fragments-assemble-into-structure.
- Security = full page/tab (user said "maybe"), added to nav on all pages.
- Nav order: Home · Work · Process · About · Security (Home only off-index).
