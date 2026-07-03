import * as THREE from "three";
import { initSmoothScroll, initCursor, initMobileNav, initMagnetic, createElapsed, REDUCED_MOTION } from "../core.js";
import { initContactSection } from "../contact.js";
import { initSpaceBackdrop } from "../space.js";
import { createOrbMaterial } from "../orb.js";

const lenis = initSmoothScroll();
initMobileNav(lenis);
initCursor();
initMagnetic();

// ----- 3D: smaller noise orb (same shader as home hero) -----
const aboutCanvas = document.getElementById("about-canvas");
const renderer = new THREE.WebGLRenderer({ canvas: aboutCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 4.2);

function sizeOrb() {
  const w = aboutCanvas.clientWidth, h = aboutCanvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
sizeOrb();
addEventListener("resize", sizeOrb);

const geo = new THREE.IcosahedronGeometry(1.35, 96);
const orbMaterial = createOrbMaterial();
const orb = new THREE.Mesh(geo, orbMaterial);
scene.add(orb);

// Textured space behind the orb — shared hero vibe
const backdrop = initSpaceBackdrop(scene, { mobile: window.innerWidth < 768, intensity: 0.8 });

const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener("mousemove", (e) => {
  mouseTarget.x = (e.clientX / innerWidth) * 2 - 1;
  mouseTarget.y = -(e.clientY / innerHeight) * 2 + 1;
});

let orbVisible = true;
new IntersectionObserver(([e]) => { orbVisible = e.isIntersecting; }, { threshold: 0.01 }).observe(aboutCanvas);

const elapsed = createElapsed();
function render() {
  requestAnimationFrame(render);
  if (!orbVisible) return;
  const t = elapsed();
  mouse.lerp(mouseTarget, 0.12);
  backdrop.update(t, mouse);
  orbMaterial.uniforms.uTime.value = t;
  orbMaterial.uniforms.uMouse.value.copy(mouse);
  orb.rotation.x = mouse.y * 0.42 + Math.sin(t * 0.15) * 0.08;
  orb.rotation.y = t * 0.08 + mouse.x * 0.58;
  renderer.render(scene, camera);
}
if (REDUCED_MOTION) {
  requestAnimationFrame(() => {
    orbMaterial.uniforms.uTime.value = 7.0;
    renderer.render(scene, camera);
  });
} else {
  render();
}
setTimeout(() => aboutCanvas.classList.add("is-visible"), 200);

// Shared page base — terrain contact section
initContactSection();
