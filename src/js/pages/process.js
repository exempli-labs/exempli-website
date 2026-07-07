import { SplitText } from "gsap/SplitText";
import { gsap, initSmoothScroll, initCursor, initMobileNav, initMagnetic, REDUCED_MOTION } from "../core.js";
import { initContactSection } from "../contact.js";

gsap.registerPlugin(SplitText);

const lenis = initSmoothScroll();
initMobileNav(lenis);
initCursor();
initMagnetic();

// The hero "spiral" (torus knot) is preserved but not displayed — see
// ./process-spiral.js. Re-add the #hero-canvas element and import it to restore.

// ----- Hero headline: masked char rise on load (same recipe as home) -----
if (!REDUCED_MOTION) {
  document.fonts.ready.then(() => {
    const split = SplitText.create("#process-headline .hline", { type: "chars", aria: "auto" });
    gsap.from(split.chars, {
      yPercent: 120,
      opacity: 0,
      duration: 0.6,
      ease: "expo.out",
      stagger: 0.018,
      onComplete: () => split.revert(),
    });
  });
}

// ----- Manifesto: words fill with colour as you scroll -----
// Opacity 0.15 → 1 on black reads as charcoal→white (and dim-peach→peach for
// the <em> words) but stays on the compositor — no per-word paint. CSS holds
// the final state, so no-JS and reduced-motion users see finished text.
const manifesto = document.querySelector("[data-split]");
if (manifesto && !REDUCED_MOTION) {
  document.fonts.ready.then(() => {
    SplitText.create(manifesto, {
      type: "words",
      aria: "auto",
      autoSplit: true, // re-splits on font swap / resize, re-applies the tween
      onSplit: (self) =>
        gsap.from(self.words, {
          opacity: 0.15,
          ease: "none", // scrubbed: the scrollbar is the easing
          stagger: 0.1,
          scrollTrigger: {
            trigger: manifesto,
            // ends at "center center" so the last word completes exactly as
            // the paragraph parks at the snap point (viewport centre)
            start: "top 85%",
            end: "center center",
            scrub: true,
          },
        }),
    });
  });
}

// ----- Process: sticky rail + one-step-at-a-time scroll lock -----
const railNum = document.querySelector(".process-active-num");
const indexItems = [...document.querySelectorAll(".process-index li")];
const indexEl = document.querySelector(".process-index");
const panels = [...document.querySelectorAll(".ppanel")];

if (panels.length) {
  const digitEl = railNum ? railNum.querySelector(".pan-digit") : null;
  let activeStep = -1;

  // -- Panel text: manifesto-style word cascade, not a general fade.
  // Title, copy words, and meta sit dim (0.15) until their step arrives,
  // then light in sequence — same dim→lit language as the manifesto.
  const PANEL_DIM = 0.15;
  const panelSeqs = new Map();
  if (!REDUCED_MOTION) {
    document.fonts.ready.then(() => {
      panels.forEach((p, k) => {
        const split = SplitText.create(p.querySelector(".ppanel-copy"), { type: "words", aria: "auto" });
        const seq = [p.querySelector(".ppanel-title"), ...split.words, p.querySelector(".ppanel-meta")];
        panelSeqs.set(p, seq);
        gsap.set(seq, { opacity: k === Math.max(activeStep, 0) ? 1 : PANEL_DIM });
      });
    });
  }
  const applyPanelStates = (i) => {
    if (REDUCED_MOTION) return;
    panels.forEach((p, k) => {
      const seq = panelSeqs.get(p);
      if (!seq) return;
      if (k === i) {
        // the arrival moment: words light one after another
        gsap.to(seq, { opacity: 1, duration: 0.35, ease: "power1.out", stagger: 0.02, overwrite: "auto" });
      } else {
        // lit behind you, dim ahead of you
        gsap.to(seq, { opacity: k < i ? 1 : PANEL_DIM, duration: 0.3, ease: "none", overwrite: "auto" });
      }
    });
  };

  const setActive = (i) => {
    if (i === activeStep || i < 0) return;
    const first = activeStep === -1;
    const dir = i > activeStep ? 1 : -1;
    activeStep = i;
    applyPanelStates(i);
    if (digitEl) {
      const next = panels[i].dataset.num.slice(-1);
      if (first || REDUCED_MOTION) {
        digitEl.textContent = next;
      } else {
        // Odometer roll: only the changing digit moves — the "0" holds still.
        gsap.killTweensOf(digitEl);
        gsap
          .timeline()
          .to(digitEl, { yPercent: -100 * dir, duration: 0.2, ease: "power2.in" })
          .add(() => { digitEl.textContent = next; })
          .fromTo(digitEl, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.45, ease: "expo.out" });
      }
    }
    indexItems.forEach((li, k) => li.classList.toggle("is-active", k === i));
    if (indexEl && panels.length > 1) {
      indexEl.style.setProperty("--progress", `${(i / (panels.length - 1)) * 100}%`);
    }
  };

  // Active = the panel whose centre is nearest the viewport centre.
  const pickActive = () => {
    const mid = window.innerHeight / 2;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < panels.length; i++) {
      const r = panels[i].getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - mid);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    setActive(best);
  };

  // Lenis owns scrolling here and doesn't emit native 'scroll' events or drive
  // IntersectionObserver reliably, so poll positions on its rAF loop. setActive
  // only writes to the DOM when the active step actually changes.
  (function trackProcess() {
    requestAnimationFrame(trackProcess);
    pickActive();
  })();
  addEventListener("resize", pickActive);

  // ----- Step lock: inside the zone, one gesture = one stop. -----
  // The page parks on the manifesto or a step (lenis.stop() = hard lock), a
  // wheel gesture advances exactly one stop, and past either end the page is
  // released to free scrolling (hero above, contact below).
  if (lenis && !REDUCED_MOTION) {
    const stops = manifesto ? [manifesto, ...panels] : [...panels];
    const quartOut = (t) => 1 - Math.pow(1 - t, 4);
    let mode = "free"; // free | moving | locked
    let lockedIndex = -1;
    let acc = 0;
    let lockTime = 0;

    const centerTarget = (el) => {
      const r = el.getBoundingClientRect();
      return window.scrollY + r.top + r.height / 2 - window.innerHeight / 2;
    };
    const distOf = (el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 - window.innerHeight / 2;
    };
    const nearest = () => {
      let index = 0, dist = Infinity;
      stops.forEach((el, k) => {
        const d = distOf(el);
        if (Math.abs(d) < Math.abs(dist)) { dist = d; index = k; }
      });
      return { index, dist };
    };
    const lockAt = (i) => {
      lockedIndex = i;
      mode = "locked";
      acc = 0;
      lockTime = performance.now();
      lenis.stop();
    };
    const release = () => {
      mode = "free";
      acc = 0;
      lenis.start();
    };
    const goTo = (i) => {
      mode = "moving";
      lockedIndex = i;
      lenis.start();
      lenis.scrollTo(centerTarget(stops[i]), {
        duration: 0.6,
        easing: quartOut,
        lock: true, // user input can't hijack the glide
        onComplete: () => lockAt(i),
      });
    };

    window.addEventListener(
      "wheel",
      (e) => {
        if (window.innerWidth < 900) return;
        if (mode === "moving") { e.preventDefault(); return; }
        if (mode !== "locked") return;
        e.preventDefault();
        // swallow trackpad inertia tails right after arriving
        if (performance.now() - lockTime < 350) { acc = 0; return; }
        acc += e.deltaY;
        if (Math.abs(acc) < 50) return;
        const next = lockedIndex + (acc > 0 ? 1 : -1);
        acc = 0;
        if (next < 0 || next >= stops.length) { release(); return; } // hero / contact
        goTo(next);
      },
      { passive: false }
    );

    // Idle watcher: in free mode, settle → glide to the nearest stop and lock.
    // In locked mode, release if something we can't intercept (keyboard,
    // scrollbar drag) moved the page — never trap the user.
    const IDLE_FRAMES = 5;
    let lastY = window.scrollY;
    let idle = 0;
    let movingStill = 0;
    (function stepLoop() {
      requestAnimationFrame(stepLoop);
      if (window.innerWidth < 900) {
        if (mode !== "free") release();
        return;
      }
      const y = window.scrollY;
      const moved = Math.abs(y - lastY);
      lastY = y;

      if (mode === "locked") {
        if (Math.abs(distOf(stops[lockedIndex])) > 80) release();
        return;
      }
      if (mode === "moving") {
        // stall guard — if the glide somehow dies, never leave the wheel
        // swallowed: lock at wherever we are so gestures work again
        if (moved < 0.5 && ++movingStill > 60) { movingStill = 0; lockAt(nearest().index); }
        else if (moved >= 0.5) movingStill = 0;
        return;
      }

      // free: wait for the gesture to settle
      if (moved > 0.5) { idle = 0; return; }
      if (++idle < IDLE_FRAMES) return;
      idle = 0;
      if (y < window.innerHeight * 0.35) return; // hero is never captured
      const { index, dist } = nearest();
      if (Math.abs(dist) > window.innerHeight * 0.45) return; // out of zone
      if (Math.abs(dist) < 4) { lockAt(index); return; } // already centred
      goTo(index);
    })();
  }
}

// Shared page base — terrain contact section
initContactSection();
