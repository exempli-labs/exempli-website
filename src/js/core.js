import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Elapsed seconds, starting from the first call — drop-in for the
   deprecated THREE.Clock's getElapsedTime(). */
export function createElapsed() {
  let start = null;
  return () => {
    if (start === null) start = performance.now();
    return (performance.now() - start) / 1000;
  };
}

/* Lenis smooth scroll + ScrollTrigger sync + nav translucency on scroll.
   Under prefers-reduced-motion the page keeps native scrolling. */
export function initSmoothScroll() {
  const navEl = document.getElementById("nav");
  const updateNavScrollState = (scroll) => {
    navEl.classList.toggle("is-scrolled", scroll > 16);
  };

  if (REDUCED_MOTION) {
    window.addEventListener("scroll", () => updateNavScrollState(window.scrollY), { passive: true });
    updateNavScrollState(window.scrollY);
    return null;
  }

  const lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  lenis.on("scroll", (e) => {
    ScrollTrigger.update();
    updateNavScrollState(e.scroll);
  });
  updateNavScrollState(window.scrollY);

  return lenis;
}

/* Custom cursor — trails the pointer, grows over .hover-target elements. */
export function initCursor() {
  if (REDUCED_MOTION) return;
  const cursor = document.getElementById("cursor");
  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const target = { x: pos.x, y: pos.y };
  window.addEventListener("mousemove", (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
  });
  function animateCursor() {
    pos.x += (target.x - pos.x) * 0.18;
    pos.y += (target.y - pos.y) * 0.18;
    cursor.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
  document.querySelectorAll(".hover-target").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hovering"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hovering"));
  });
}

/* Magnetic pull on .magnetic elements — the element leans toward the cursor. */
export function initMagnetic() {
  if (REDUCED_MOTION) return;
  document.querySelectorAll(".magnetic").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.45);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.45);
    });
    el.addEventListener("mouseleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

/* Full-screen mobile menu — the only navigation below md. */
export function initMobileNav(lenis) {
  const toggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("mobile-menu");
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (lenis) open ? lenis.stop() : lenis.start();
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) setOpen(false);
  });
}
