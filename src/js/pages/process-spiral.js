// PRESERVED / NOT CURRENTLY USED.
// The hero "spiral" (slow-rotating wireframe torus knot + textured space
// backdrop) that used to sit at the top of the process page. Removed from
// display on 2026-07-07 but kept here for possible reuse.
//
// To bring it back: add `<canvas id="hero-canvas" class="hero-canvas"></canvas>`
// as the first child of the hero <section> (the .hero-canvas / .hero-content CSS
// still needs to exist), then `import "./process-spiral.js";` from process.js.
// It reads `lenis`/scroll on its own via requestAnimationFrame.

import * as THREE from "three";
import { createElapsed, REDUCED_MOTION } from "../core.js";
import { initSpaceBackdrop } from "../space.js";

// ----- 3D: hero — a single slow-rotating wireframe pipe/torus knot -----
const heroCanvas = document.getElementById("hero-canvas");
const heroSection = heroCanvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 4);

function sizeHero() {
  const w = heroSection.clientWidth, h = heroSection.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
sizeHero();
addEventListener("resize", sizeHero);

// Textured space behind the knot — shared hero vibe
const backdrop = initSpaceBackdrop(scene, { mobile: window.innerWidth < 768, intensity: 0.8 });

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1.2, 0.18, 360, 24, 3, 5),
  new THREE.MeshBasicMaterial({ color: "#E8A87C", wireframe: true, transparent: true, opacity: 0.4 })
);
scene.add(knot);

// Anchor the knot upper-right so it never sits under the headline or copy
function layoutKnot() {
  const portrait = camera.aspect < 0.9;
  knot.scale.setScalar(portrait ? 0.5 : 0.72);
  knot.position.set(portrait ? 0.35 : 1.4, portrait ? 1.0 : 0.45, 0);
}
layoutKnot();
window.addEventListener("resize", layoutKnot);

const heroMouse = new THREE.Vector2();
const heroMouseTarget = new THREE.Vector2();
addEventListener("mousemove", (e) => {
  heroMouseTarget.x = (e.clientX / innerWidth) * 2 - 1;
  heroMouseTarget.y = -(e.clientY / innerHeight) * 2 + 1;
});

let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0.01 }).observe(heroSection);

const elapsed = createElapsed();
function renderHero() {
  requestAnimationFrame(renderHero);
  if (!heroVisible) return;
  const t = elapsed();
  heroMouse.lerp(heroMouseTarget, 0.08);
  backdrop.update(t, heroMouse);
  knot.rotation.x = t * 0.08 + heroMouse.y * 0.25;
  knot.rotation.y = t * 0.12 + heroMouse.x * 0.4;
  renderer.render(scene, camera);
}
if (REDUCED_MOTION) {
  requestAnimationFrame(() => renderer.render(scene, camera));
} else {
  renderHero();
}
setTimeout(() => heroCanvas.classList.add("is-visible"), 150);
