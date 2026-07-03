import * as THREE from "three";
import { initSmoothScroll, initCursor, initMobileNav, initMagnetic, createElapsed, REDUCED_MOTION } from "../core.js";
import { initContactSection } from "../contact.js";
import { initSpaceBackdrop } from "../space.js";

const lenis = initSmoothScroll();
initMobileNav(lenis);
initCursor();
initMagnetic();

// Hero 3D — wireframe constellation of small shapes (the "portfolio of blueprints")
const heroCanvas = document.getElementById("hero-canvas");
const heroSection = heroCanvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 6);

function sizeRenderer() {
  const w = heroSection.clientWidth;
  const h = heroSection.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
sizeRenderer();
window.addEventListener("resize", sizeRenderer);

const wireMat = new THREE.MeshBasicMaterial({ color: "#E8A87C", wireframe: true, transparent: true, opacity: 0.6 });
const dimWireMat = new THREE.MeshBasicMaterial({ color: "#E8A87C", wireframe: true, transparent: true, opacity: 0.35 });

// Five floating wireframe shapes, scattered in 3D
const shapes = [
  { geo: new THREE.IcosahedronGeometry(0.7, 1),            pos: [-2.6,  1.0, -1.0], mat: wireMat,    rotSpeed: [0.12, 0.18, 0] },
  { geo: new THREE.TorusKnotGeometry(0.42, 0.13, 100, 16), pos: [ 2.4,  0.7, -0.8], mat: wireMat,    rotSpeed: [0.18, 0.10, 0] },
  { geo: new THREE.OctahedronGeometry(0.55, 0),            pos: [ 0.0, -1.2, -1.4], mat: wireMat,    rotSpeed: [0.16, 0.22, 0] },
  { geo: new THREE.TorusGeometry(0.48, 0.10, 16, 80),      pos: [-1.6, -0.8, -2.2], mat: dimWireMat, rotSpeed: [0.10, 0.14, 0] },
  { geo: new THREE.BoxGeometry(0.7, 0.7, 0.7, 4, 4, 4),    pos: [ 1.8, -1.4, -2.8], mat: dimWireMat, rotSpeed: [0.08, 0.12, 0] },
  { geo: new THREE.IcosahedronGeometry(0.34, 0),           pos: [ 3.4, -0.2, -3.4], mat: dimWireMat, rotSpeed: [0.20, 0.16, 0] },
];

// Textured space behind the constellation — shared hero vibe
const backdrop = initSpaceBackdrop(scene, { mobile: window.innerWidth < 768, intensity: 0.8 });

// Composition group — keeps the cluster clear of the headline (left/bottom)
const cluster = new THREE.Group();
scene.add(cluster);

const meshes = shapes.map((s) => {
  const m = new THREE.Mesh(s.geo, s.mat);
  m.position.set(...s.pos);
  m.userData.rotSpeed = s.rotSpeed;
  m.userData.basePos = [...s.pos];
  cluster.add(m);
  return m;
});

function layoutCluster() {
  const portrait = camera.aspect < 0.9;
  cluster.scale.setScalar(portrait ? 0.6 : 0.9);
  cluster.position.set(portrait ? 0.3 : 1.0, portrait ? 0.9 : 0.35, 0);
}
layoutCluster();
window.addEventListener("resize", layoutCluster);

// Mouse parallax
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
window.addEventListener("mousemove", (e) => {
  mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0.01 }).observe(heroSection);

const elapsed = createElapsed();
function render() {
  requestAnimationFrame(render);
  if (!heroVisible) return;
  const t = elapsed();
  mouse.lerp(mouseTarget, 0.08);
  backdrop.update(t, mouse);

  meshes.forEach((m, i) => {
    const [sx, sy, sz] = m.userData.rotSpeed;
    m.rotation.x = t * sx + Math.sin(t * 0.2 + i) * 0.06;
    m.rotation.y = t * sy + mouse.x * 0.3;
    m.rotation.z = mouse.y * 0.18 + t * sz;
    // gentle bob
    const [bx, by] = m.userData.basePos;
    m.position.y = by + Math.sin(t * 0.35 + i * 1.7) * 0.18;
    m.position.x = bx + mouse.x * 0.25 * (1 + i * 0.1);
  });

  renderer.render(scene, camera);
}
if (REDUCED_MOTION) {
  requestAnimationFrame(() => renderer.render(scene, camera));
} else {
  render();
}

// Reveal canvas on load
setTimeout(() => heroCanvas.classList.add("is-visible"), 150);

// Shared page base — terrain contact section
initContactSection();
