import * as THREE from "three";
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
import { initContactSection } from "../contact.js";
import { initSpaceBackdrop } from "../space.js";

const lenis = initSmoothScroll();
initMobileNav(lenis);
initCursor();
initMagnetic();

// ----- 3D: hero — the sealing vault ------------------------------------------
// Two nested shells — a dodecahedron over an icosahedron — where EVERY panel
// is a petal hinged at its base edge. The page loads with both layers bloomed
// open around a blazing core; an intro tween closes the bloom to ~55% on its
// own, and scrolling seals the rest. Fully closed, the core is gone —
// completely enclosed, nothing visible. Scrolling back up reopens to the
// intro's resting state. Defense in depth, acted out.
const heroCanvas = document.getElementById("hero-canvas");
const heroSection = heroCanvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 4);

let worldPerPx = 0.006; // world units per canvas pixel at the vault's plane
function sizeHero() {
  const w = heroSection.clientWidth, h = heroSection.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  worldPerPx = (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)) / h;
}
sizeHero();
addEventListener("resize", sizeHero);

// Textured space behind the vault — shared hero vibe
const backdrop = initSpaceBackdrop(scene, { mobile: window.innerWidth < 768, intensity: 0.8 });

const vault = new THREE.Group();
scene.add(vault);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);

// Bloom pole: the direction from the vault's desktop anchor toward the camera.
// Petals facing the pole swing widest — the bloom aims at the visitor.
const POLE = new THREE.Vector3(0, 0, 4).sub(new THREE.Vector3(1.3, -0.45, 0)).normalize();

// --- Extract flat faces from a polyhedron (groups triangles by normal) ------
function extractFaces(geometry) {
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const groups = [];
  for (let tri = 0; tri < posAttr.count / 3; tri++) {
    const n = new THREE.Vector3().fromBufferAttribute(normAttr, tri * 3);
    let g = groups.find((f) => f.normal.dot(n) > 0.999);
    if (!g) groups.push((g = { normal: n.clone(), verts: [] }));
    for (let v = 0; v < 3; v++) {
      const p = new THREE.Vector3().fromBufferAttribute(posAttr, tri * 3 + v);
      if (!g.verts.some((q) => q.distanceToSquared(p) < 1e-6)) g.verts.push(p);
    }
  }
  geometry.dispose();
  return groups.map(({ normal, verts }) => {
    const centroid = verts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(verts.length);
    const u = verts[0].clone().sub(centroid).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u);
    const ang = (p) => {
      const d = p.clone().sub(centroid);
      return Math.atan2(d.dot(v), d.dot(u));
    };
    verts.sort((a, b) => ang(a) - ang(b));
    return { normal, verts, centroid };
  });
}

function panelLoop(verts, material) {
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(verts), material);
}

// --- Build a layer of hinged petals from a polyhedron ------------------------
// Every face becomes a petal pivoting on its base edge (the edge farthest
// from the pole). Open angle scales with how directly the face looks at the
// pole; closing order runs back-to-front so the last thing to seat is the
// petal the visitor is looking through.
function buildPetalLayer(geometry, { minOpen, maxOpen, pickMaterial, inset }) {
  const faces = extractFaces(geometry);
  const petals = faces.map((face) => {
    const n = face.verts.length;
    let hingeIdx = 0, worst = Infinity;
    for (let i = 0; i < n; i++) {
      const mid = face.verts[i].clone().add(face.verts[(i + 1) % n]).multiplyScalar(0.5);
      const align = mid.clone().normalize().dot(POLE);
      if (align < worst) { worst = align; hingeIdx = i; }
    }
    const e1 = face.verts[hingeIdx];
    const e2 = face.verts[(hingeIdx + 1) % n];
    const pivot = e1.clone().add(e2).multiplyScalar(0.5);
    const axis = e2.clone().sub(e1).normalize();

    const group = new THREE.Group();
    group.position.copy(pivot);
    vault.add(group);

    const rel = face.verts.map((p) => p.clone().sub(pivot));
    const relCentroid = rel.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(n);
    const facing = (face.normal.dot(POLE) + 1) / 2;
    const material = pickMaterial(facing);
    group.add(panelLoop(rel, material));
    if (inset) {
      group.add(panelLoop(
        rel.map((p) => p.clone().lerp(relCentroid, 0.2)),
        new THREE.LineBasicMaterial({ color: material.color, transparent: true, opacity: material.opacity * 0.45 })
      ));
    }

    const openAngle = minOpen + (maxOpen - minOpen) * facing;
    // opening must carry the petal outward, away from the shell
    let sign = 1;
    {
      const swung = relCentroid.clone().applyAxisAngle(axis, openAngle * 0.5).add(pivot);
      if (swung.length() < face.centroid.length()) sign = -1;
    }
    return { group, axis, sign, openAngle, facing, rank: 0 };
  });
  // back petals close first, pole-facing petals seat last
  [...petals].sort((a, b) => a.facing - b.facing).forEach((p, i) => {
    p.rank = petals.length > 1 ? i / (petals.length - 1) : 0;
  });
  return petals;
}

function setLayer(petals, layerClose) {
  for (const p of petals) {
    const k = smooth(clamp01((layerClose - p.rank * 0.3) / 0.7));
    p.group.quaternion.setFromAxisAngle(p.axis, p.openAngle * (1 - k) * p.sign);
  }
}

// Four concentric petal shells, alternating icosa/dodeca so the seams never
// align. Brightness falls off with radius — the main dodecahedron carries the
// bloom, the wide outer shells extend it as fainter echoes. Each layer closes
// within its own window of the master closedness: innermost leads, the wide
// outermost shell is the last to seat.
const mat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
const in1Mid = mat("#E8A87C", 0.5), in1Dim = mat("#C98C66", 0.25);
const mainBright = mat("#F4B891", 0.9), mainMid = mat("#E8A87C", 0.55), mainDim = mat("#C98C66", 0.28);
const in3Mid = mat("#E8A87C", 0.4), in3Dim = mat("#C98C66", 0.2);
const in4Mid = mat("#C98C66", 0.32), in4Dim = mat("#C98C66", 0.16);

const LAYERS = [
  {
    window: [0, 0.6],
    petals: buildPetalLayer(new THREE.IcosahedronGeometry(0.82, 0), {
      minOpen: 0.4, maxOpen: 1.25, inset: false,
      pickMaterial: (f) => (f > 0.45 ? in1Mid : in1Dim),
    }),
  },
  {
    window: [0.1, 0.8],
    petals: buildPetalLayer(new THREE.DodecahedronGeometry(1.3), {
      minOpen: 0.5, maxOpen: 1.55, inset: true,
      pickMaterial: (f) => (f > 0.6 ? mainBright : f > 0.35 ? mainMid : mainDim),
    }),
  },
  {
    window: [0.25, 0.92],
    petals: buildPetalLayer(new THREE.IcosahedronGeometry(1.8, 0), {
      minOpen: 0.35, maxOpen: 1.2, inset: false,
      pickMaterial: (f) => (f > 0.45 ? in3Mid : in3Dim),
    }),
  },
  {
    window: [0.4, 1.0],
    petals: buildPetalLayer(new THREE.DodecahedronGeometry(2.35), {
      minOpen: 0.3, maxOpen: 1.0, inset: false,
      pickMaterial: (f) => (f > 0.45 ? in4Mid : in4Dim),
    }),
  },
];

// --- Core + glows ------------------------------------------------------------
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const coreMat = new THREE.MeshBasicMaterial({ color: "#F4B891", wireframe: true, transparent: true, opacity: 0.85 });
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), coreMat);
vault.add(core);

const glowMat = new THREE.SpriteMaterial({
  map: glowTexture(),
  color: "#E8A87C",
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const glow = new THREE.Sprite(glowMat);
glow.scale.setScalar(2.4);
vault.add(glow);

// Bright glint where the last petal seats — fires the instant the vault locks
const glintMat = new THREE.SpriteMaterial({
  map: glowTexture(),
  color: "#ffffff",
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const glint = new THREE.Sprite(glintMat);
glint.scale.setScalar(0.7);
glint.position.copy(POLE).multiplyScalar(2.35);
vault.add(glint);

// --- Closedness: 0 = full bloom, 1 = sealed solid, core gone -----------------
// Each shell closes within its own window — a cascade running inside-out.
function applyClosedness(c) {
  for (const { window: [a, b], petals } of LAYERS) {
    setLayer(petals, clamp01((c - a) / (b - a)));
  }
  const coreVis = Math.pow(1 - c, 1.6);
  coreMat.opacity = 0.85 * coreVis;
  glowMat.opacity = 0.7 * coreVis;
  core.visible = coreVis > 0.004;
  glow.visible = core.visible;
}

// Intro: begins closing on its own the moment the page loads, settling at
// ~55%. Scroll takes it the rest of the way; scrolling back up returns to
// the intro's resting state, never the full bloom.
const intro = { v: REDUCED_MOTION ? 1 : 0 };
let scrollSeal = 0;
let scrollPx = 0;
applyClosedness(intro.v);

if (!REDUCED_MOTION) {
  gsap.to(intro, { v: 0.55, duration: 3.0, ease: "power2.inOut", delay: 0.5 });
  ScrollTrigger.create({
    trigger: heroSection,
    start: "top top",
    end: "bottom 18%",
    scrub: 0.4,
    onUpdate(self) {
      scrollPx = self.progress * (self.end - self.start);
      const f = clamp01((self.progress - 0.05) / 0.7);
      scrollSeal = f > 0 ? 0.55 + 0.45 * f : 0;
    },
  });
}

// Anchor the vault upper-right so it never sits under the headline or copy
// Centered below the words "your code." — right of center, under the
// first headline line
const vaultBase = new THREE.Vector2(1.3, -0.45);
function layoutVault() {
  const portrait = camera.aspect < 0.9;
  vault.scale.setScalar(portrait ? 0.42 : 0.62);
  vaultBase.set(portrait ? 0.35 : 1.3, portrait ? 0.8 : -0.45);
  vault.position.set(vaultBase.x, vaultBase.y, 0);
}
layoutVault();
window.addEventListener("resize", layoutVault);

const heroMouse = new THREE.Vector2();
const heroMouseTarget = new THREE.Vector2();
addEventListener("mousemove", (e) => {
  heroMouseTarget.x = (e.clientX / innerWidth) * 2 - 1;
  heroMouseTarget.y = -(e.clientY / innerHeight) * 2 + 1;
});

let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0.01 }).observe(heroSection);

const elapsed = createElapsed();
let glintArmed = false; // arms once the vault has been open, fires at full seal
function renderHero() {
  requestAnimationFrame(renderHero);
  if (!heroVisible) return;
  const t = elapsed();
  heroMouse.lerp(heroMouseTarget, 0.08);
  backdrop.update(t, heroMouse);

  const closedness = Math.max(intro.v, scrollSeal);
  applyClosedness(closedness);
  if (closedness > 0.985 && glintArmed) {
    glintArmed = false;
    gsap.fromTo(glintMat, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "power2.out" });
  } else if (closedness < 0.9) {
    glintArmed = true;
  }

  // calm engineered sway, not a spin — the bloom stays aimed at the camera
  vault.rotation.y = Math.sin(t * 0.25) * 0.2 + heroMouse.x * 0.35;
  vault.rotation.x = Math.sin(t * 0.18 + 1.3) * 0.1 + heroMouse.y * 0.2;
  // counter-parallax: give back ~70% of the scroll so the seal stays in view
  vault.position.y = vaultBase.y - scrollPx * worldPerPx * 0.7;
  if (core.visible) {
    core.rotation.y = -t * 0.3;
    core.rotation.x = t * 0.2;
    core.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05);
  }
  renderer.render(scene, camera);
}
if (REDUCED_MOTION) {
  requestAnimationFrame(() => renderer.render(scene, camera));
} else {
  renderHero();
}
setTimeout(() => heroCanvas.classList.add("is-visible"), 150);

// Shared page base — terrain contact section
initContactSection();
