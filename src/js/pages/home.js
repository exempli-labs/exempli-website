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
  uniforms: {
    uAccent: { value: new THREE.Color("#E8A87C") },
    uFade: { value: 1 }, // dropped to 0 during the intro morph, eased back in
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uAccent;
    uniform float uFade;
    varying vec2 vUv;
    void main() {
      float d = distance(vUv, vec2(0.5));
      float a = pow(smoothstep(0.5, 0.0, d), 2.2) * 0.3;
      gl_FragColor = vec4(mix(uAccent, vec3(1.0, 0.55, 0.28), 0.25), a * uFade);
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

let lastT = 0;
let chargeTime = 0;
let seedEase = null; // bound by the interaction block below
function renderOrb() {
  requestAnimationFrame(renderOrb);
  if (!heroVisible) return;
  const t = elapsed();
  // Charge clock — runs faster the harder the orb is charged, so the tremor
  // and vein flicker accelerate while the mouse is held down.
  const dt = Math.min(Math.max(t - lastT, 0), 0.05);
  lastT = t;
  const charge = orbMaterial.uniforms.uCharge.value;
  chargeTime += dt * (0.6 + charge * 1.6);
  orbMaterial.uniforms.uChargeTime.value = chargeTime;
  // Vein origin glides after the cursor while dragging
  if (seedEase) seedEase();
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

  // --- Charge — holding the mouse slowly wakes the orb ---------------------
  // No click punch: pointerdown just starts a long build. Veins snake outward
  // from the point under the cursor (raycast onto the orb; nearest silhouette
  // point when the hold is beside it) as uCharge climbs; full coverage only
  // lands after a committed hold. Release bleeds the energy back out.
  const uCharge = orbMaterial.uniforms.uCharge;
  const uSeed = orbMaterial.uniforms.uSeed;
  let holding = false;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const orbSphere = new THREE.Sphere();
  const seedTarget = new THREE.Vector3(0, 0, 1);
  const hitV = new THREE.Vector3();
  const scaleV = new THREE.Vector3();
  const invQ = new THREE.Quaternion();

  // Cursor → orb-local direction. Hits the orb's bounding sphere when the
  // cursor is over it; otherwise uses the point on the ray nearest the orb,
  // so holding beside it still wakes the closest edge.
  let lastPX = 0;
  let lastPY = 0;
  function seedFromCursor() {
    const rect = heroCanvas.getBoundingClientRect();
    ndc.set(
      ((lastPX - rect.left) / rect.width) * 2 - 1,
      -((lastPY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    orb.getWorldPosition(orbSphere.center);
    orbSphere.radius = 1.35 * Math.max(orb.getWorldScale(scaleV).x, 0.0001);
    const hit = raycaster.ray.intersectSphere(orbSphere, hitV);
    if (!hit) raycaster.ray.closestPointToPoint(orbSphere.center, hitV);
    hitV.sub(orbSphere.center);
    orb.getWorldQuaternion(invQ).invert();
    seedTarget.copy(hitV.applyQuaternion(invQ).normalize());
  }

  heroSection.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; // left button / touch only
    if (e.target.closest("a, button, p, h1, h2, h3, li")) return; // never hijack real controls or selectable text
    holding = true;
    document.body.style.userSelect = "none"; // no text-selection while holding

    // Veins originate exactly where the press landed
    lastPX = e.clientX;
    lastPY = e.clientY;
    seedFromCursor();
    uSeed.value.copy(seedTarget);

    // Long build — ignites fast (first tendrils inside ~0.5s so the hold
    // visibly responds), then crawls, reaching maximum only after ~5s.
    gsap.to(uCharge, { value: 1, duration: 5, ease: "power2.out", overwrite: true });
  });

  // Track the cursor while held so the origin can follow it.
  heroSection.addEventListener("pointermove", (e) => {
    lastPX = e.clientX;
    lastPY = e.clientY;
  });

  // Every frame while holding: re-anchor the origin under the cursor — the
  // orb rotates beneath the beam, and dragging trails smoothly via the lerp.
  seedEase = () => {
    if (holding) seedFromCursor();
    uSeed.value.lerp(seedTarget, 0.25).normalize();
  };

  const releaseCharge = () => {
    if (!holding) return;
    holding = false;
    document.body.style.userSelect = "";
    gsap.to(uCharge, { value: 0, duration: 1.1, ease: "power2.out", overwrite: true });
  };
  window.addEventListener("pointerup", releaseCharge);
  window.addEventListener("pointercancel", releaseCharge);
  window.addEventListener("blur", releaseCharge);

  // Dev-only tuning handle (stripped from production builds)
  if (import.meta.env.DEV) window.__orbDebug = { orbMaterial, gsap, orb, camera, heroCanvas, THREE, renderer, scene, glowMat, lenis };

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

// Loader — logo-reveal video → dot-to-orb morph → site.
// Only plays on the first visit per browser session; subsequent navigations
// back home skip it so the user doesn't re-watch the intro every time. The
// video ends with the peach dot resting as the tittle of the "i"; the orb
// takes over that exact footprint and inflates into its hero station.
const loaderBar = document.getElementById("loader-bar");
const loaderVideo = document.getElementById("loader-video");
const loaderPct = document.getElementById("loader-pct");
const loaderEl = document.getElementById("loader");
// Add `?intro` to the URL to force the reveal to replay (handy for previewing —
// it otherwise plays only once per browser session).
const forceIntro = new URLSearchParams(location.search).has("intro");
const isFirstVisit = forceIntro || !sessionStorage.getItem("exempli-seen");
sessionStorage.setItem("exempli-seen", "1");

// Scroll stays locked while the intro holds the stage: the hero ScrollTrigger
// scrub writes the same orb transforms the morph animates, so a mid-intro
// scroll would set the two fighting over position and scale. Same overflow pin
// + Lenis stop the mobile menu uses, so wheel, touch, keyboard, and scrollbar
// are all covered.
function setIntroScrollLock(locked) {
  document.documentElement.style.overflow = locked ? "hidden" : "";
  if (lenis) locked ? lenis.stop() : lenis.start();
}

// The intro video buys ~3.8s. Spend it warming EVERYTHING behind the loader —
// compile shaders, load fonts, split the headline, render the orb at full state
// — so the reveal is just a fast curtain-lift over a finished, warm page rather
// than the start of more loading. Nothing heavy runs at the handoff.

// Compile WebGL programs up front so the first visible frame has no hitch.
try {
  renderer.compile(scene, camera);
} catch (e) {}

// Build the hero at full state (behind the loader). The render loop is already
// running, so by the time the video ends the orb is drawn, warm, and ready.
function composeHero() {
  orb.scale.setScalar(1);
  heroCanvas.style.opacity = "1";
}

// Pre-build the headline reveal WHILE the intro plays — SplitText splitting and
// the font wait happen off the critical moment. Paused; played at the reveal.
// Only used on the intro path; return visits keep the plain (already-visible)
// headline so there's never a flash of hidden text.
let headlineReveal = null;
let headlineReady = Promise.resolve();
function prepareHeadline() {
  headlineReady = document.fonts.ready.then(() => {
    const split = SplitText.create("#hero-headline .word", {
      type: "words,chars",
      charsClass: "char",
      aria: "auto",
    });
    headlineReveal = gsap.timeline({ paused: true });
    headlineReveal
      .from(split.chars, {
        yPercent: 120,
        opacity: 0,
        duration: 0.6,
        ease: "expo.out",
        stagger: 0.008,
      })
      .from(
        "[data-fade]",
        { y: 20, opacity: 0, duration: 0.5, ease: "expo.out", stagger: 0.06 },
        "-=0.35"
      )
      // Clean DOM once done — restores selectable, unwrapped text
      .eventCallback("onComplete", () => split.revert());
  });
}

// Reveal — the page is already built, so this just lifts the curtain fast.
let revealStarted = false;
function revealSite() {
  if (revealStarted) return;
  revealStarted = true;

  setIntroScrollLock(false); // fallback exits must never leave the page pinned
  composeHero(); // ensure full state even if we arrived via a fallback

  const tl = gsap.timeline();
  tl.to("#loader", { yPercent: -100, duration: 0.7, ease: "expo.inOut" });
  // Quick distortion settle — a spark of life on the already-visible orb.
  tl.from(orbMaterial.uniforms.uDistort, { value: 0.5, duration: 0.8, ease: "expo.out" }, 0);
  tl.set("#loader", { display: "none" });

  // Headline snaps in with the lift. Thanks to the warm-up, fonts are long
  // ready, so this fires immediately (no wait) rather than after the intro.
  headlineReady.then(() => headlineReveal && headlineReveal.play());
}

// Handle to the morph timeline + a one-way "intro is done" latch. The deadline
// guarantee below uses these to force completion if the animated path stalls.
let morphTl = null;
let introFinalized = false;

// Deterministic teardown — drops the loader and shows the finished hero WITHOUT
// the GSAP ticker, so it still works when the tab is hidden (rAF frozen) and the
// morph can't advance. Idempotent; safe to call from any fallback.
function finalizeIntro() {
  if (introFinalized) return;
  introFinalized = true;
  revealStarted = true; // stop any animated path from re-entering
  if (morphTl) morphTl.kill(); // a frozen morph must not resume and replay later
  setIntroScrollLock(false);
  composeHero();
  // Park the orb at its lit hero station and paint one frame directly (no rAF).
  orb.position.set(0, 0.35, 0);
  orb.scale.setScalar(1);
  orbMaterial.uniforms.uFlat.value = 0;
  orbMaterial.uniforms.uAmp.value = 1;
  glowMat.uniforms.uFade.value = 1;
  try { renderer.render(scene, camera); } catch (e) {}
  // Chrome + headline shown by direct state-set, not a (possibly frozen) tween.
  gsap.set(["#nav", "#scroll-cue"], { clearProps: "opacity" });
  headlineReady.then(() => { if (headlineReveal) headlineReveal.progress(1); });
  if (loaderEl) loaderEl.style.display = "none";
}

if (isFirstVisit && !REDUCED_MOTION) {
  const video = loaderVideo;

  // Pin to the top and lock scroll for the intro — browsers restore scroll on
  // reload, and playing the reveal against a scrolled-away hero would morph
  // the dot into an orb nobody can see. Restoration is programmatic, so the
  // overflow pin alone can't stop it — it has to be switched off outright,
  // and via ScrollTrigger's API: a bare history.scrollRestoration write gets
  // stomped when ScrollTrigger re-applies its captured value on load-refresh.
  ScrollTrigger.clearScrollMemory("manual");
  if (lenis) lenis.scrollTo(0, { immediate: true });
  window.scrollTo(0, 0);
  setIntroScrollLock(true);

  // Warm + compose the whole hero behind the loader while the video plays.
  composeHero();
  prepareHeadline();

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

  // Where the dot comes to rest in the video's own pixels — measured from the
  // final frame of loader-reveal.mp4 (1920×1080): centre (1634.5, 384.5),
  // radius ≈28.5px, core colour rgb(235,159,117). If the video is re-rendered,
  // re-measure and update these (and uFlatColor in orb.js).
  const DOT = { x: 1634.5 / 1920, y: 384.5 / 1080, r: 28.5 / 1080 };

  // The on-screen box the video's CONTENT occupies (object-fit: contain math),
  // regardless of any letterboxing inside the element.
  function videoContentRect() {
    const r = video.getBoundingClientRect();
    const iw = video.videoWidth || 1920;
    const ih = video.videoHeight || 1080;
    const s = Math.min(r.width / iw, r.height / ih);
    const w = iw * s;
    const h = ih * s;
    return {
      left: r.left + (r.width - w) / 2,
      top: r.top + (r.height - h) / 2,
      width: w,
      height: h,
    };
  }

  // The morph: the video's last frame leaves the dot resting as the tittle of
  // the "i". The orb — flattened to the dot's colour, zeroed to a perfect
  // sphere — snaps into that exact screen footprint while the opaque loader
  // still hides the switch. Then the wordmark dissolves (the video's dot
  // crossfading into the identical orb underneath), and the dot inflates and
  // glides to its hero station as the lit material wakes up.
  function morphFromDot() {
    if (revealStarted) return;
    revealStarted = true;
    window.removeEventListener("keydown", skipIntro);

    // Dot centre + radius in screen px
    const c = videoContentRect();
    const dotX = c.left + DOT.x * c.width;
    const dotY = c.top + DOT.y * c.height;
    const dotR = DOT.r * c.height;

    // Screen → world on the orb's plane (z = 0; camera looks straight down -z)
    const rect = heroCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector3(
      ((dotX - rect.left) / rect.width) * 2 - 1,
      -(((dotY - rect.top) / rect.height) * 2 - 1),
      0.5
    );
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const world = camera.position.clone().addScaledVector(dir, -camera.position.z / dir.z);

    // Match apparent size: world units per pixel at the orb's depth
    const wpp = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / rect.height;
    const startScale = Math.max((dotR * wpp) / (1.35 * orbGroup.scale.x), 0.001);

    // Snap the orb into the dot's footprint behind the opaque loader
    orb.position.copy(world.sub(orbGroup.position).divideScalar(orbGroup.scale.x));
    orb.scale.setScalar(startScale);
    orbMaterial.uniforms.uAmp.value = 0;
    orbMaterial.uniforms.uFlat.value = 1;
    glowMat.uniforms.uFade.value = 0;

    // Let the render loop paint one frame with the orb in dot state, then run
    // the reveal — no chance of the full-size warm-up orb flashing through.
    // rAF is suspended in hidden tabs, so race it against a short timeout:
    // the timeline still gets built and simply plays when the tab is shown.
    let kicked = false;
    const kickoff = () => {
      if (kicked) return;
      kicked = true;
      const tl = gsap.timeline();
      tl.set("#loader", { pointerEvents: "none" }, 0);
      tl.set(["#nav", "#scroll-cue"], { opacity: 0 }, 0);
      // Wordmark dissolves — the video's dot fades out over the identical
      // orb-dot beneath it, so the object never appears to change.
      tl.to(video, { opacity: 0, duration: 0.55, ease: "power1.out" }, 0);
      tl.to([".loader-bar", ".loader-meta"], { opacity: 0, duration: 0.4, ease: "power1.out" }, 0);
      tl.to("#loader", { backgroundColor: "rgba(0, 0, 0, 0)", duration: 0.7, ease: "power1.inOut" }, 0);
      // The dot inflates into the orb and glides to its hero station. The
      // flight starts under the dissolve's tail — expo.inOut's slow open
      // means perceptible growth lands just as the last letters clear, so
      // the handoff reads as one continuous transformation, not
      // dissolve → wait → grow.
      tl.to(orb.position, { x: 0, y: 0.35, z: 0, duration: 1.4, ease: "expo.inOut" }, 0.1);
      tl.to(orb.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: "expo.inOut" }, 0.1);
      // Mid-flight the material wakes: light replaces flat peach, the
      // surface starts to breathe
      tl.to(orbMaterial.uniforms.uFlat, { value: 0, duration: 0.9, ease: "power2.inOut" }, 0.45);
      tl.to(orbMaterial.uniforms.uAmp, { value: 1, duration: 1.1, ease: "power2.inOut" }, 0.5);
      // The ember glow blooms through touchdown and settles a beat after —
      // the orb lands, then the light arrives. Cosmetic tail only; teardown
      // below doesn't wait for it.
      tl.to(glowMat.uniforms.uFade, { value: 1, duration: 0.9, ease: "power1.inOut" }, 1.15);
      // Page chrome drifts in under the flight; headline lands with the orb
      tl.to(["#nav", "#scroll-cue"], { opacity: 1, duration: 0.6, ease: "power1.out" }, 0.8);
      tl.call(() => headlineReady.then(() => headlineReveal && headlineReveal.play()), [], 0.75);
      // Touchdown is at 1.5 — hand scroll back and drop the loader right
      // there rather than holding the page hostage for the glow's afterglow.
      tl.call(() => setIntroScrollLock(false), [], 1.55);
      tl.set("#loader", { display: "none" }, 1.55);
      tl.set(["#nav", "#scroll-cue"], { clearProps: "opacity" }, 1.55);
      morphTl = tl; // expose to the deadline guarantee so it can stop a stall
      // Dev-only scrub handle (stripped from production builds)
      if (import.meta.env.DEV) window.__morphTl = tl;
    };
    requestAnimationFrame(() => requestAnimationFrame(kickoff));
    setTimeout(kickoff, 150);
  }

  // Skip — a click anywhere (the loader owns the pointer while it's up) or
  // Enter/Space/Escape jumps the video to its final frame. The morph then runs
  // exactly as if the video had played out, so skipping still exits through
  // the dot-to-orb handoff instead of a jarring cut.
  function skipIntro(e) {
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
    if (revealStarted) return;
    e.preventDefault();
    if (video.duration) {
      // Morph only once the final frame is actually decoded — the crossfade
      // needs the dot at rest on screen, not whatever frame the seek left.
      video.addEventListener("seeked", morphFromDot, { once: true });
      video.currentTime = video.duration;
    } else {
      // Metadata never arrived — the old lift is the safe exit.
      revealSite();
    }
  }
  loaderEl.addEventListener("pointerdown", skipIntro);
  window.addEventListener("keydown", skipIntro);

  // Roll the video immediately — it opens on black with the dot in shot.
  requestAnimationFrame(tickMeter);
  video.addEventListener("ended", morphFromDot, { once: true });
  // Decode / source failure shouldn't strand the visitor on black.
  video.addEventListener("error", revealSite, { once: true });
  const played = video.play();
  if (played && played.catch) {
    // Autoplay blocked (rare for muted inline) — reveal rather than hang.
    played.catch(() => revealSite());
  }
  // Insurance: a stall watchdog rather than a wall-clock deadline — a fixed
  // timeout would guillotine a healthy video that rebuffered once mid-play.
  // Only frozen playback counts, and only while the tab is visible (hidden
  // tabs may legally pause media; the reveal then waits for visibility).
  let lastPlayhead = -1;
  let stalledMs = 0;
  const watchdog = setInterval(() => {
    if (revealStarted) {
      clearInterval(watchdog);
      return;
    }
    if (video.ended) {
      // The 'ended' handler owns this exit; if its event got lost, run the
      // morph directly (idempotent) rather than strand the visitor on black.
      clearInterval(watchdog);
      morphFromDot();
      return;
    }
    if (document.hidden || video.currentTime !== lastPlayhead) {
      stalledMs = 0;
      lastPlayhead = video.currentTime;
      return;
    }
    stalledMs += 700;
    if (stalledMs >= 2800) {
      clearInterval(watchdog);
      revealSite();
    }
  }, 700);
} else {
  // Return visit / reduced motion — jump straight to the finished hero, and
  // give scroll restoration back to the browser (an earlier intro run in this
  // history entry switched it off, and the value survives reloads). Through
  // ScrollTrigger's API so its load-refresh doesn't re-apply the old value.
  ScrollTrigger.clearScrollMemory("auto");
  loaderEl.style.display = "none";
  composeHero();
  if (REDUCED_MOTION) {
    // Static poster frame instead of an animation loop
    requestAnimationFrame(() => {
      orbMaterial.uniforms.uTime.value = 7.0;
      renderer.render(scene, camera);
    });
  }
}

// Hard guarantee: whatever the animated path did — or failed to do — the intro
// is torn down and the finished hero shown by this deadline. Unlike a net that
// bails once a reveal has "started", this fires whenever the loader is still on
// screen. That case is real: a tab hidden during load freezes GSAP's rAF ticker,
// so the morph can set revealStarted yet never advance, hanging the loader
// forever. finalizeIntro() tears down without the ticker, so it works even while
// hidden; a healthy visible intro has already hidden the loader by now, so this
// no-ops. A one-off visibility handler also finalizes the moment a stalled
// background tab is brought forward, rather than waiting out the deadline.
function guaranteeIntroEnds() {
  if (introFinalized) return;
  if (loaderEl && getComputedStyle(loaderEl).display !== "none") {
    try { finalizeIntro(); } catch (e) {}
  }
}
if (isFirstVisit && !REDUCED_MOTION) {
  document.addEventListener("visibilitychange", function onVis() {
    if (document.visibilityState !== "visible") return;
    // Give the resumed ticker a moment to let a healthy morph finish on its own;
    // only force it if the loader is genuinely still stuck.
    setTimeout(() => {
      if (!introFinalized && loaderEl && getComputedStyle(loaderEl).display !== "none" && (!morphTl || morphTl.progress() === 0)) {
        guaranteeIntroEnds();
      }
    }, 900);
  });
}
setTimeout(guaranteeIntroEnds, 7000);

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

// Pillars — static cards. Hover accents (tint, marker, underline, brighten)
// are pure CSS; JS only drives the cursor spotlight.
if (!REDUCED_MOTION) {
  document.querySelectorAll(".pillar").forEach((p) => {
    // Feed the pointer's position within the tile to the .pillar-glow radial
    // gradient. Only the light moves; the tile stays put.
    p.addEventListener("mousemove", (e) => {
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", `${e.clientX - r.left}px`);
      p.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

// Shared page base — terrain contact section
initContactSection();
