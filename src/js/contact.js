import * as THREE from "three";
import { gsap, ScrollTrigger, createElapsed, REDUCED_MOTION } from "./core.js";
import { NOISE_GLSL } from "./noise.js";

/* Shared page base — peach horizon terrain under "need software that fits?".
   Solid plane, rhombitrihexagonal tiling drawn in the fragment shader:
   anti-aliased lines that dissolve before aliasing at the horizon. Terrain
   flows slowly toward the viewer; the cursor raises a lit hot spot that
   radiates ripples (roams on its own when idle / on touch). The landscape
   rises out of a flat plane when the section scrolls in. */
export function initContactSection() {
  const canvas = document.getElementById("contact-canvas");
  if (!canvas) return;
  const MOBILE = window.innerWidth < 768;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 1.8) }, // plane-local units
      uAccent: { value: new THREE.Color("#E8A87C") },
      uReveal: { value: REDUCED_MOTION ? 1 : 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform vec2 uMouse;
      uniform float uReveal;
      varying vec2 vUv;
      varying vec2 vPos;
      varying float vH;
      varying float vDist;
      varying float vSpot;
      ${NOISE_GLSL}
      void main() {
        vUv = uv;
        vPos = position.xy;
        vec3 pos = position;

        // Terrain drifts toward the camera (-y is the near edge)
        float flow = uTime * 0.5;
        float h = snoise(vec3(pos.x * 0.20, (pos.y + flow) * 0.20, uTime * 0.06))
                + snoise(vec3(pos.x * 0.55, (pos.y + flow) * 0.55, uTime * 0.09)) * 0.42
                + snoise(vec3(pos.x * 1.60, (pos.y + flow) * 1.60, uTime * 0.12)) * 0.12;

        // Cursor: raised bump + ripples radiating outward
        float d = distance(pos.xy, uMouse);
        h += smoothstep(3.2, 0.0, d) * 1.15;
        h += sin(d * 2.4 - uTime * 2.6) * smoothstep(5.0, 0.3, d) * 0.28;
        vSpot = smoothstep(4.2, 0.0, d);

        h *= uReveal;
        pos.z += h * 0.5;
        vH = h;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uAccent;
      uniform float uReveal;
      varying vec2 vUv;
      varying vec2 vPos;
      varying float vH;
      varying float vDist;
      varying float vSpot;

      float sdSeg(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a, ba = b - a;
        return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
      }

      void main() {
        // Rhombitrihexagonal tiling (hexagons ringed by squares + triangles).
        // Snap to the nearest hexagon center on the triangular lattice, fold
        // into one 30-degree mirror wedge, and the whole pattern reduces to
        // two segments: half a hexagon edge (A-B) and one square side (B-C).
        float s = 0.22;              // polygon edge length, plane units
        float D = s * 2.7320508;     // hexagon center spacing
        vec2 cell = vec2(D, D * 1.7320508);
        vec2 c1 = round(vPos / cell) * cell;
        vec2 c2 = round((vPos - 0.5 * cell) / cell) * cell + 0.5 * cell;
        vec2 q = vPos - (dot(vPos - c1, vPos - c1) < dot(vPos - c2, vPos - c2) ? c1 : c2);

        float ang = 0.5235988 - abs(mod(atan(q.y, q.x), 1.0471976) - 0.5235988);
        vec2 w = length(q) * vec2(cos(ang), sin(ang));

        vec2 A = vec2(0.8660254 * s, 0.0);
        vec2 B = vec2(0.8660254 * s, 0.5 * s);
        vec2 C = vec2(0.8660254 * s + s, 0.5 * s);

        float aa = max(max(fwidth(vPos.x), fwidth(vPos.y)), 1e-5);
        float lw = max(aa * 0.75, s * 0.02);
        // Dissolve the pattern before it aliases into mush at the horizon
        float fade = clamp(1.6 - (aa / s) * 6.0, 0.0, 1.0);
        float hexEdge = 1.0 - smoothstep(lw - aa, lw + aa, sdSeg(w, A, B));
        float link = 1.0 - smoothstep(lw - aa, lw + aa, sdSeg(w, B, C));
        float line = max(hexEdge, link * 0.75) * fade;

        // Elevation ramp: dim ember valleys -> peach -> warm white ridges
        float e = clamp(vH * 0.34 + 0.5, 0.0, 1.0);
        vec3 col = mix(uAccent * 0.45, uAccent, smoothstep(0.12, 0.62, e));
        col = mix(col, vec3(1.0, 0.88, 0.74), smoothstep(0.72, 1.0, e));

        float bright = 0.5 + e * 0.95 + vSpot * 0.6;

        // Atmosphere: fade to the horizon, feather the side edges
        float fog = smoothstep(13.5, 1.8, vDist);
        fog *= smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x);

        // Faint surface glow on ridges gives volume between the lines
        float fill = smoothstep(0.6, 1.0, e) * 0.07;

        float a = (line * bright + fill) * fog * smoothstep(0.0, 0.35, uReveal);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.35, 2.6);
  camera.lookAt(0, -0.2, 0);

  function size() {
    const w = canvas.clientWidth || 160;
    const h = canvas.clientHeight || 160;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener("resize", size);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 22, MOBILE ? 110 : 170, MOBILE ? 85 : 130),
    material
  );
  // Lay the plane flat to form a horizon, sit higher in the canvas
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.1;
  scene.add(mesh);

  // Cursor hot spot: lerped toward the pointer while it's over the section,
  // otherwise drifts on its own — the landscape stays alive on touch devices
  // and when the mouse is parked elsewhere.
  const mouseTarget = new THREE.Vector2(0, 1.8);
  let pointerAt = -Infinity;

  let visible = false;
  let renderedStatic = false;
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (visible) canvas.classList.add("is-visible");
    },
    { threshold: 0.15 }
  );
  io.observe(canvas);

  const elapsed = createElapsed();
  function loop() {
    if (!REDUCED_MOTION) requestAnimationFrame(loop);
    if (!visible) {
      if (REDUCED_MOTION && !renderedStatic) requestAnimationFrame(loop);
      return;
    }
    if (REDUCED_MOTION && renderedStatic) return;
    renderedStatic = true;
    const t = REDUCED_MOTION ? 5.0 : elapsed();
    material.uniforms.uTime.value = t;
    if (performance.now() - pointerAt > 3500) {
      // Idle: hot spot roams the terrain on a slow lissajous
      mouseTarget.set(Math.sin(t * 0.31) * 4.5, Math.cos(t * 0.23) * 2.2 + 1.8);
    }
    material.uniforms.uMouse.value.lerp(mouseTarget, 0.06);
    renderer.render(scene, camera);
  }
  loop();

  // Landscape rises out of a flat plane as the section scrolls in
  if (!REDUCED_MOTION) {
    ScrollTrigger.create({
      trigger: "#contact",
      start: "top 75%",
      once: true,
      onEnter: () => {
        gsap.to(material.uniforms.uReveal, { value: 1, duration: 2.6, ease: "power2.inOut" });
      },
    });
  }

  // Track the pointer only while it's over the section
  let rect = null;
  const updateRect = () => { rect = canvas.getBoundingClientRect(); };
  updateRect();
  window.addEventListener("resize", updateRect);
  window.addEventListener("scroll", updateRect, { passive: true });
  window.addEventListener("mousemove", (e) => {
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (x < -1.1 || x > 1.1 || y < -1.1 || y > 1.1) return;
    mouseTarget.set(x * 7.0, y * 4.0);
    pointerAt = performance.now();
  });
}
