import * as THREE from "three";
import { initSmoothScroll, initCursor, initMobileNav, initMagnetic, createElapsed, REDUCED_MOTION } from "../core.js";
import { initContactSection } from "../contact.js";
import { initSpaceBackdrop } from "../space.js";

const lenis = initSmoothScroll();
initMobileNav(lenis);
initCursor();
initMagnetic();

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

// -----------------------------------------------------------------
// Step mini-scenes — each animation acts out its step:
//   audit     facets convert one by one from dark grey to lit peach
//   architect scattered fragments assemble into a structured frame
//   design    a raw noisy mass morphs into a refined twisted sculpture
//   build     a modular structure grows piece by piece to completion
//   tune      turbulent streamlines converge into clean laminar flow
// All loop on an ease-hold-reset rhythm; reduced motion gets a poster
// frame from each animation's "held" state.
// -----------------------------------------------------------------
const PEACH = new THREE.Color("#E8A87C");
const GREY = new THREE.Color("#2b2b2b");
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const backOut = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const stepAnims = {
  // 001 — audit lights up every corner of the stack, bit by bit
  audit(sc) {
    const geo = new THREE.IcosahedronGeometry(0.95, 1); // already non-indexed: 3 verts per face
    const vertCount = geo.attributes.position.count;
    const faceCount = vertCount / 3;
    const colors = new Float32Array(vertCount * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    // facet separation lines, only visible where faces are lit
    mesh.add(new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: "#000000", transparent: true, opacity: 0.55 })
    ));
    sc.add(mesh);

    // shuffled lighting order so the conversion sweeps unpredictably
    const order = Array.from({ length: faceCount }, (_, f) => f);
    for (let f = order.length - 1; f > 0; f--) {
      const j = Math.floor(Math.random() * (f + 1));
      [order[f], order[j]] = [order[j], order[f]];
    }

    const c = new THREE.Color();
    const P = 7;
    return {
      poster: 5.0,
      update(t) {
        const p = (t % P) / P;
        const reset = p > 0.9 ? easeInOut((p - 0.9) / 0.1) : 0; // fade back to grey
        for (let f = 0; f < faceCount; f++) {
          const litAt = (order[f] / faceCount) * 0.7;
          const prog = clamp01((p - litAt) / 0.05) * (1 - reset);
          // fresh conversions flash warm-white, then settle to peach
          const flash = prog > 0 ? Math.exp(-(p - litAt) * 26) * 0.4 : 0;
          c.copy(GREY).lerp(PEACH, prog);
          c.r = Math.min(1, c.r + flash);
          c.g = Math.min(1, c.g + flash * 0.85);
          c.b = Math.min(1, c.b + flash * 0.7);
          for (let v = 0; v < 3; v++) c.toArray(colors, (f * 3 + v) * 3);
        }
        geo.attributes.color.needsUpdate = true;
        mesh.rotation.y = t * 0.22;
        mesh.rotation.x = 0.35 + Math.sin(t * 0.3) * 0.08;
      },
    };
  },

  // 002 — architecture: structure assembled out of scattered parts
  architect(sc) {
    const group = new THREE.Group();
    sc.add(group);
    const a = 0.72; // cube half-size
    const beamMat = new THREE.MeshBasicMaterial({ color: "#E8A87C", wireframe: true, transparent: true, opacity: 0.6 });
    // 12 edges of a frame + 4 inner columns = the "simplest system"
    const edges = [];
    for (const s of [-a, a]) for (const u of [-a, a]) {
      edges.push({ size: [2 * a, 0.07, 0.07], pos: [0, s, u] });
      edges.push({ size: [0.07, 2 * a, 0.07], pos: [s, 0, u] });
      edges.push({ size: [0.07, 0.07, 2 * a], pos: [s, u, 0] });
    }
    edges.push({ size: [0.07, 2 * a, 0.07], pos: [0, 0, 0] });

    const beams = edges.map((e, k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...e.size, 1, 1, 1), beamMat);
      m.userData.target = new THREE.Vector3(...e.pos);
      // scattered start: flung outward with a random tumble
      const dir = new THREE.Vector3().randomDirection();
      m.userData.start = new THREE.Vector3(...e.pos).addScaledVector(dir, 1.6 + Math.random() * 1.2);
      m.userData.startQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      );
      m.userData.stagger = k / edges.length;
      group.add(m);
      return m;
    });

    const idQuat = new THREE.Quaternion();
    const P = 8;
    return {
      poster: 5.2,
      update(t) {
        const p = (t % P) / P;
        for (const m of beams) {
          const s0 = m.userData.stagger * 0.3;
          let k;
          if (p < 0.55) k = easeOut(clamp01((p - s0) / 0.25)); // assemble, staggered
          else if (p < 0.8) k = 1; // hold the structure
          else k = 1 - easeInOut((p - 0.8) / 0.2); // gently disperse
          m.position.lerpVectors(m.userData.start, m.userData.target, k);
          m.quaternion.slerpQuaternions(m.userData.startQuat, idQuat, k);
        }
        group.rotation.y = t * 0.2;
        group.rotation.x = 0.42;
      },
    };
  },

  // 003 — design: raw material becomes a deliberate sculpture
  design(sc) {
    const geo = new THREE.IcosahedronGeometry(0.92, 2);
    const pos = geo.attributes.position;
    const rock = new Float32Array(pos.count * 3);
    const sculpt = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      // rock: jagged pseudo-noise displacement along the normal
      const n =
        Math.sin(v.x * 5.3 + v.y * 2.1) * 0.45 +
        Math.sin(v.y * 7.7 + v.z * 3.9) * 0.3 +
        Math.sin(v.z * 9.1 + v.x * 6.3) * 0.25;
      v.clone().multiplyScalar(0.92 * (1 + n * 0.22)).toArray(rock, i * 3);
      // sculpture: tapered, elongated, twisted around y
      const y = v.y * 1.25;
      const taper = 1 - 0.42 * v.y * v.y;
      const ang = v.y * 1.9;
      const x = (v.x * Math.cos(ang) - v.z * Math.sin(ang)) * taper * 0.78;
      const z = (v.x * Math.sin(ang) + v.z * Math.cos(ang)) * taper * 0.78;
      new THREE.Vector3(x, y, z).multiplyScalar(0.92).toArray(sculpt, i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(rock, 3));
    geo.setAttribute("aTo", new THREE.BufferAttribute(sculpt, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMix: { value: 0 }, uColor: { value: PEACH } },
      vertexShader: `
        attribute vec3 aTo;
        uniform float uMix;
        void main() {
          vec3 p = mix(position, aTo, uMix);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 0.5); }
      `,
      wireframe: true,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    sc.add(mesh);

    const P = 8;
    return {
      poster: 3.6,
      update(t) {
        const p = (t % P) / P;
        let k;
        if (p < 0.35) k = easeInOut(p / 0.35); // rough mass -> sculpture
        else if (p < 0.6) k = 1; // admire the sculpture
        else k = 1 - easeInOut((p - 0.6) / 0.4); // back to raw material
        mat.uniforms.uMix.value = k;
        mesh.rotation.y = t * 0.3;
        mesh.rotation.x = 0.15;
      },
    };
  },

  // 004 — build: production software grows module by module
  build(sc) {
    // deterministic mini-skyline on a 4x4 grid
    const heights = [2, 4, 1, 3, 3, 6, 4, 2, 1, 5, 7, 3, 2, 3, 4, 1];
    const cells = [];
    heights.forEach((h, idx) => {
      const gx = idx % 4, gz = Math.floor(idx / 4);
      for (let level = 0; level < h; level++) cells.push({ gx, gz, level });
    });
    cells.sort((c1, c2) => c1.level - c2.level || c1.gx + c1.gz - (c2.gx + c2.gz));

    const S = 0.24, GAP = 0.31;
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(S, S, S, 1, 1, 1),
      new THREE.MeshBasicMaterial({ color: "#E8A87C", wireframe: true, transparent: true, opacity: 0.55 }),
      cells.length
    );
    const group = new THREE.Group();
    group.add(inst);
    group.rotation.x = 0.5;
    sc.add(group);

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const P = 8;
    return {
      poster: 6.0,
      update(t) {
        const p = (t % P) / P;
        cells.forEach((cell, k) => {
          const s0 = (k / cells.length) * 0.6;
          let s;
          if (p < 0.65) s = backOut(clamp01((p - s0) / 0.08)); // pop in, bottom-up
          else if (p < 0.85) s = 1; // hold the finished build
          else s = 1 - easeInOut(clamp01((p - 0.85 - (1 - k / cells.length) * 0.06) / 0.08)); // dismantle top-down
          pos.set((cell.gx - 1.5) * GAP, (cell.level + 0.5) * GAP - 0.85, (cell.gz - 1.5) * GAP);
          scl.setScalar(Math.max(0.0001, s));
          inst.setMatrixAt(k, m4.compose(pos, q, scl));
        });
        inst.instanceMatrix.needsUpdate = true;
        group.rotation.y = t * 0.25;
      },
    };
  },

  // 005 — tune: turbulence streamlined into clean laminar flow
  tune(sc) {
    const LINES = 16, PTS = 48;
    const lines = [];
    for (let l = 0; l < LINES; l++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PTS * 3), 3));
      const mat = new THREE.LineBasicMaterial({ color: "#E8A87C", transparent: true, opacity: 0.4 });
      const line = new THREE.Line(geo, mat);
      line.userData.row = l / (LINES - 1) - 0.5; // -0.5 .. 0.5
      lines.push(line);
      sc.add(line);
    }

    const P = 9;
    return {
      poster: 6.3,
      update(t) {
        const p = (t % P) / P;
        let k;
        if (p < 0.55) k = easeInOut(p / 0.55); // streamline
        else if (p < 0.85) k = 1; // clean laminar flow
        else k = 1 - easeInOut((p - 0.85) / 0.15); // drift back to turbulence
        const flowSpeed = 1.2 + k * 1.6; // improvement = faster flow
        for (const line of lines) {
          const row = line.userData.row;
          const posAttr = line.geometry.attributes.position;
          for (let i = 0; i < PTS; i++) {
            const x = (i / (PTS - 1) - 0.5) * 2.3;
            const turb =
              Math.sin(x * 3.1 + t * flowSpeed + row * 14) * 0.5 +
              Math.sin(x * 6.7 - t * flowSpeed * 1.6 + row * 31) * 0.3 +
              Math.sin(x * 11.3 + t * flowSpeed * 2.3 + row * 53) * 0.2;
            // tighten row spacing as the flow cleans up
            const y = row * 1.5 * (1 - 0.35 * k) + turb * 0.3 * (1 - k) + Math.sin(x * 2.0 - t * flowSpeed * 2.0) * 0.03 * k;
            posAttr.setXYZ(i, x, y, 0);
          }
          posAttr.needsUpdate = true;
          line.material.opacity = 0.28 + k * 0.3 + Math.sin(t * 4 + row * 20) * 0.06;
        }
      },
    };
  },
};

document.querySelectorAll(".step-canvas").forEach((canvas) => {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  cam.position.z = 3.1;
  function size() {
    const w = canvas.clientWidth || 140, h = canvas.clientHeight || 140;
    r.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  size();
  addEventListener("resize", size);

  const anim = (stepAnims[canvas.dataset.anim] || stepAnims.audit)(sc);
  // Prime one frame immediately so the canvas is never blank before the
  // IntersectionObserver-gated loop takes over.
  anim.update(anim.poster);
  r.render(sc, cam);

  let vis = false;
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; }, { threshold: 0.2 }).observe(canvas);
  const stepElapsed = createElapsed();
  if (REDUCED_MOTION) {
    requestAnimationFrame(() => {
      anim.update(anim.poster);
      r.render(sc, cam);
    });
  } else {
    (function loop() {
      requestAnimationFrame(loop);
      if (!vis) return;
      anim.update(stepElapsed());
      r.render(sc, cam);
    })();
  }
});

// Shared page base — terrain contact section
initContactSection();
