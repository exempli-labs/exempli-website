import * as THREE from "three";
import { SplitText } from "gsap/SplitText";
import {
  gsap,
  ScrollTrigger,
  initSmoothScroll,
  initCursor,
  initMobileNav,
  initMagnetic,
  createElapsed,
  REDUCED_MOTION,
} from "../core.js";
import { createOrbMaterial } from "../orb.js";
import { initContactSection } from "../contact.js";
import { initSpaceBackdrop } from "../space.js";

gsap.registerPlugin(SplitText);

const lenis = initSmoothScroll();
initMobileNav(lenis);

const MOBILE = window.innerWidth < 768;

// -----------------------------------------------------------------
// Three.js — distorted noise orb (hero background)
// -----------------------------------------------------------------
const heroCanvas = document.getElementById("hero-canvas");
const heroSection = heroCanvas.parentElement;

const renderer = new THREE.WebGLRenderer({
  canvas: heroCanvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 4.2);

// Composition group — places the orb beside the type instead of under it.
// The orb keeps its own animation-driven transforms inside the group.
const orbGroup = new THREE.Group();
scene.add(orbGroup);

function layoutOrb() {
  const portrait = camera.aspect < 0.9;
  if (portrait) {
    orbGroup.scale.setScalar(0.62);
    orbGroup.position.set(0.15, 0.8, 0);
  } else {
    orbGroup.scale.setScalar(0.85);
    orbGroup.position.set(1.25, 0.1, 0);
  }
}

function sizeRenderer() {
  const w = heroSection.clientWidth;
  const h = heroSection.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  layoutOrb();
}
sizeRenderer();
window.addEventListener("resize", sizeRenderer);

// High-subdiv icosahedron for smooth vertex displacement
const geo = new THREE.IcosahedronGeometry(1.35, MOBILE ? 48 : 64);
const orbMaterial = createOrbMaterial();

const orb = new THREE.Mesh(geo, orbMaterial);
orb.position.set(0, 0.35, 0);
orb.scale.setScalar(0.001);
orbGroup.add(orb);

// --- Volume: ember glow well behind the orb ---------------------------------
const glowMat = new THREE.ShaderMaterial({
  uniforms: { uAccent: { value: new THREE.Color("#E8A87C") } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uAccent;
    varying vec2 vUv;
    void main() {
      float d = distance(vUv, vec2(0.5));
      float a = pow(smoothstep(0.5, 0.0, d), 2.2) * 0.3;
      gl_FragColor = vec4(mix(uAccent, vec3(1.0, 0.55, 0.28), 0.25), a);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glowMat);
glow.position.set(0, 0.35, -2.4);
orbGroup.add(glow);

// --- Volume: textured space — nebula, stars, layered dust -------------------
const backdrop = initSpaceBackdrop(scene, { mobile: MOBILE, intensity: 1.2 });

// Mouse parallax target
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
window.addEventListener("mousemove", (e) => {
  mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

const elapsed = createElapsed();
let heroVisible = true;
const ioOrb = new IntersectionObserver(
  ([entry]) => { heroVisible = entry.isIntersecting; },
  { threshold: 0.01 }
);
ioOrb.observe(heroSection);

function renderOrb() {
  requestAnimationFrame(renderOrb);
  if (!heroVisible) return;
  const t = elapsed();
  // Faster lerp = more responsive mouse tracking
  mouse.lerp(mouseTarget, 0.12);
  orbMaterial.uniforms.uTime.value = t;
  orbMaterial.uniforms.uMouse.value.copy(mouse);

  // Parallax tilt + slow drift — increased mouse response
  orb.rotation.x = mouse.y * 0.42 + Math.sin(t * 0.15) * 0.08;
  orb.rotation.y = t * 0.08 + mouse.x * 0.58;

  // Backdrop drifts slowly and parallaxes *against* the orb — depth cue
  backdrop.update(t, mouse);

  renderer.render(scene, camera);
}

if (!REDUCED_MOTION) {
  renderOrb();

  // Scroll-linked chaos — orb gets more distorted as you leave the hero
  ScrollTrigger.create({
    trigger: heroSection,
    start: "top top",
    end: "bottom top",
    scrub: 0.6,
    onUpdate: (self) => {
      const p = self.progress;
      orbMaterial.uniforms.uDistort.value = 0.22 + p * 0.5;
      orb.position.z = -p * 1.5; // push orb back as you scroll
      orb.scale.setScalar(1 - p * 0.25);
    },
  });
}

// Loader — "Introducing" → logo-reveal video → site.
// Only plays on the first visit per browser session; subsequent navigations
// back home skip it so the user doesn't re-watch the intro every time. The
// loader lifts the instant the reveal video ends, handing off to the orb.
const loaderBar = document.getElementById("loader-bar");
const loaderWord1 = document.querySelector(".loader-word-1");
const loaderVideo = document.getElementById("loader-video");
const loaderPct = document.getElementById("loader-pct");
const loaderEl = document.getElementById("loader");
// Add `?intro` to the URL to force the reveal to replay (handy for previewing —
// it otherwise plays only once per browser session).
const forceIntro = new URLSearchParams(location.search).has("intro");
const isFirstVisit = forceIntro || !sessionStorage.getItem("exempli-seen");
sessionStorage.setItem("exempli-seen", "1");

// Hero reveal — loader lifts, orb punches in, headline splits into place.
// Runs once, the moment the intro finishes (video end, or a skip / fallback).
let revealStarted = false;
function revealSite() {
  if (revealStarted) return;
  revealStarted = true;

  const tl = gsap.timeline();
  tl.to("#loader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" });

  // Orb dramatic entrance — scale up + canvas fade in
  tl.to(orb.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: "expo.out" }, "-=0.9");
  tl.to(heroCanvas, { opacity: 1, duration: 1.2, ease: "power2.out" }, "-=1.6");
  // Distortion settles after the punch-in
  tl.from(orbMaterial.uniforms.uDistort, { value: 0.8, duration: 2.0, ease: "expo.out" }, "-=1.4");

  // Headline reveal — SplitText wraps words as inline-blocks so lines can never
  // break mid-word. Chained onto the reveal timeline once fonts are ready.
  document.fonts.ready.then(() => {
    const split = SplitText.create("#hero-headline .word", {
      type: "words,chars",
      charsClass: "char",
      aria: "auto",
    });
    tl.from(
      split.chars,
      { yPercent: 120, opacity: 0, duration: 1.0, ease: "expo.out", stagger: 0.012 },
      "-=0.5"
    );
    tl.from(
      "[data-fade]",
      { y: 24, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.08 },
      "-=0.6"
    );
    // Clean DOM once the intro is done — restores selectable, unwrapped text
    tl.eventCallback("onComplete", () => split.revert());
  });
}

if (isFirstVisit && !REDUCED_MOTION) {
  const video = loaderVideo;

  // Progress meter tracks real playback, so "100%" lands exactly as the reveal
  // completes. rAF for a smooth bar (timeupdate only fires ~4x/sec).
  function tickMeter() {
    if (video.duration) {
      const p = Math.min(video.currentTime / video.duration, 1);
      loaderBar.style.transform = `scaleX(${p})`;
      loaderPct.textContent = String(Math.round(p * 100)).padStart(2, "0");
    }
    if (!revealStarted && !video.ended) requestAnimationFrame(tickMeter);
  }

  // Hand the stage from the word to the video, then play it through.
  function startReveal() {
    loaderWord1.classList.add("is-gone");
    video.classList.add("is-playing");
    requestAnimationFrame(tickMeter);

    video.addEventListener("ended", revealSite, { once: true });
    // Decode / source failure shouldn't strand the visitor on black.
    video.addEventListener("error", revealSite, { once: true });

    const played = video.play();
    if (played && played.catch) {
      // Autoplay blocked (rare for muted inline) — reveal rather than hang.
      played.catch(() => revealSite());
    }
    // Insurance: if 'ended' never fires, lift shortly after the run should end.
    setTimeout(revealSite, 3800);
  }

  // Let "Introducing" land for a beat, then roll the reveal.
  setTimeout(startReveal, 800);
} else {
  // Return visit / reduced motion — jump to the hero at full state instantly
  loaderEl.style.display = "none";
  orb.scale.setScalar(1);
  heroCanvas.style.opacity = "1";
  if (REDUCED_MOTION) {
    // Static poster frame instead of an animation loop
    requestAnimationFrame(() => {
      orbMaterial.uniforms.uTime.value = 7.0;
      renderer.render(scene, camera);
    });
  }
}

// Safety net: if the intro throws / hangs and the loader is still showing after
// the run should have finished, force-hide it so the user is never stuck.
setTimeout(() => {
  if (loaderEl && loaderEl.style.display !== "none" && loaderEl.getBoundingClientRect().top > -100) {
    loaderEl.style.display = "none";
    try { orb.scale.setScalar(1); } catch (e) {}
    try { heroCanvas.style.opacity = "1"; } catch (e) {}
  }
}, 6500);

// Section scroll reveals — DOM walk wraps words in text nodes only
function wrapWords(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    if (!text.trim()) return;
    const frag = document.createDocumentFragment();
    const parts = text.split(/(\s+)/);
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        const span = document.createElement("span");
        span.className = "reveal-word inline-block";
        span.textContent = part;
        frag.appendChild(span);
      }
    });
    node.parentNode.replaceChild(frag, node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    Array.from(node.childNodes).forEach(wrapWords);
  }
}

if (!REDUCED_MOTION) {
  gsap.utils.toArray("[data-split]").forEach((el) => {
    wrapWords(el);
    gsap.from(el.querySelectorAll(".reveal-word"), {
      opacity: 0.15,
      duration: 0.6,
      ease: "none",
      stagger: 0.025,
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        end: "bottom 50%",
        scrub: true,
      },
    });
  });
}

initCursor();
initMagnetic();

// Scroll cue — if the visitor sits on the page 5s without scrolling, start a
// slow breathe as a nudge; stop once they scroll (the cue did its job).
const scrollCue = document.getElementById("scroll-cue");
if (scrollCue && !REDUCED_MOTION) {
  setTimeout(() => {
    if (window.scrollY < 80) scrollCue.classList.add("is-pulsing");
  }, 5000);
  window.addEventListener(
    "scroll",
    () => {
      if (window.scrollY > 80) scrollCue.classList.remove("is-pulsing");
    },
    { passive: true }
  );
}

// Pillars — hover expands, click locks
const pillarsGrid = document.getElementById("pillars");
const pillars = Array.from(pillarsGrid.querySelectorAll(".pillar"));
let pillarLocked = null;
let pillarHovered = null;
function syncPillars() {
  const active = pillarLocked !== null ? pillarLocked : pillarHovered;
  if (active === null) {
    pillarsGrid.removeAttribute("data-active");
  } else {
    pillarsGrid.setAttribute("data-active", String(active));
  }
  pillars.forEach((p, i) => p.classList.toggle("is-locked", i === pillarLocked));
}
pillars.forEach((p, i) => {
  p.addEventListener("mouseenter", () => { pillarHovered = i; syncPillars(); });
  p.addEventListener("mouseleave", () => { pillarHovered = null; syncPillars(); });
  p.addEventListener("click", () => {
    pillarLocked = pillarLocked === i ? null : i;
    syncPillars();
  });
});

// Shared page base — terrain contact section
initContactSection();
