import * as THREE from "three";
import { NOISE_GLSL } from "./noise.js";

/* Distorted noise orb material — the brand's signature object.
   Used by the home hero and the about hero.

   Normals are recomputed from the displaced surface (tangent-space
   neighbor sampling), so the lighting follows every bump instead of
   the smooth base sphere — that's what makes the surface read as a
   rendered object rather than a soft cloud. */
export function createOrbMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDistort: { value: 0.22 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAccent: { value: new THREE.Color("#E8A87C") },
      uDeep: { value: new THREE.Color("#1a0a04") },
      // Interaction (driven by the home hero only — zero everywhere else,
      // which renders identically to the pre-interaction material):
      uCharge: { value: 0 }, // 0→1 over a long hold — simmer + veins
      uChargeTime: { value: 0 }, // CPU-warped clock, accelerates with charge
      uVein: { value: new THREE.Color("#82CFFF") }, // sky-blue energy veins
      uSeed: { value: new THREE.Vector3(0, 0, 1) }, // vein origin, object space
      // Intro morph (home loader only — these defaults render identically
      // to the pre-morph material everywhere else):
      uAmp: { value: 1 }, // master displacement amplitude — 0 = perfect sphere
      uFlat: { value: 0 }, // 1 = unlit flat colour, matching the loader video's dot
      uFlatColor: { value: new THREE.Color(235 / 255, 159 / 255, 117 / 255) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uDistort;
      uniform vec2 uMouse;
      uniform float uCharge;
      uniform float uChargeTime;
      uniform float uAmp;
      varying vec3 vNormal;
      varying float vDisp;
      varying vec3 vView;
      varying vec3 vPos;
      ${NOISE_GLSL}

      // Fractal multi-octave noise — broad shape → fine surface texture
      float displacement(vec3 p) {
        float n1 = snoise(p * 1.1 + vec3(uTime * 0.22, uTime * 0.18, uTime * 0.26));
        float n2 = snoise(p * 2.6 + uTime * 0.35) * 0.34;
        float n3 = snoise(p * 5.8 + uTime * 0.52) * 0.17;
        float n4 = snoise(p * 12.5 + uTime * 0.72) * 0.07;
        float mouseInfluence = clamp(length(uMouse), 0.0, 1.5) * 0.32;
        // Charge amplifies the displacement field — a simmer, not a rage
        float base = (n1 + n2 + n3 + n4) * uDistort * (1.0 + uCharge * 0.45);
        // Held-down tremor — restrained high-frequency unrest while charged
        float tremor = snoise(p * 6.0 + uChargeTime * 1.7) * 0.07 * uCharge;
        // uAmp gates everything — at 0 the mesh is a perfect sphere, so the
        // intro morph can match the loader video's dot exactly.
        return (base + tremor + mouseInfluence) * uAmp;
      }

      void main() {
        vec3 n = normalize(position);
        float disp = displacement(position);
        vec3 displaced = position + n * disp;

        // Perturbed normal: displace two tangent-space neighbors and
        // take the cross product of the resulting surface edges.
        vec3 t = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 b = cross(n, t);
        float eps = 0.07;
        vec3 pt = position + t * eps;
        vec3 pb = position + b * eps;
        vec3 dt = pt + normalize(pt) * displacement(pt);
        vec3 db = pb + normalize(pb) * displacement(pb);
        vec3 newNormal = normalize(cross(dt - displaced, db - displaced));
        if (dot(newNormal, n) < 0.0) newNormal = -newNormal;

        vNormal = normalize(normalMatrix * newNormal);
        vDisp = disp;
        vPos = position; // stable coords — vein pattern sticks to the surface
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vView = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uAccent;
      uniform vec3 uDeep;
      uniform vec3 uVein;
      uniform float uCharge;
      uniform float uChargeTime;
      uniform vec3 uSeed;
      uniform float uFlat;
      uniform vec3 uFlatColor;
      varying vec3 vNormal;
      varying float vDisp;
      varying vec3 vView;
      varying vec3 vPos;
      ${NOISE_GLSL}

      // Cellular (Voronoi) edge distance — near-zero along cell borders.
      // The borders form the geometric vein network.
      vec3 hash3(vec3 p) {
        p = vec3(
          dot(p, vec3(127.1, 311.7, 74.7)),
          dot(p, vec3(269.5, 183.3, 246.1)),
          dot(p, vec3(113.5, 271.9, 124.6)));
        return fract(sin(p) * 43758.5453123);
      }
      float voronoiEdge(vec3 p) {
        vec3 ip = floor(p);
        vec3 fp = fract(p);
        float f1 = 8.0;
        float f2 = 8.0;
        for (int x = -1; x <= 1; x++)
        for (int y = -1; y <= 1; y++)
        for (int z = -1; z <= 1; z++) {
          vec3 g = vec3(float(x), float(y), float(z));
          vec3 r = g + hash3(ip + g) - fp;
          float d = dot(r, r);
          if (d < f1) { f2 = f1; f1 = d; }
          else if (d < f2) { f2 = d; }
        }
        return sqrt(f2) - sqrt(f1);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vView);

        // warm key upper-right, faint fill lower-left (view space)
        vec3 L1 = normalize(vec3(0.65, 0.75, 0.4));
        vec3 L2 = normalize(vec3(-0.7, -0.3, 0.35));
        float diff = max(dot(N, L1), 0.0);
        float fill = max(dot(N, L2), 0.0) * 0.22;

        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);

        // tight hot specular
        vec3 H = normalize(L1 + V);
        float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.85;

        // ramp: deep core -> ember mid-tones -> peach rim -> hot glints
        vec3 ember = vec3(0.55, 0.22, 0.08);
        vec3 col = uDeep;
        col = mix(col, ember, diff * 0.85);
        col = mix(col, uAccent, fres * 0.9);
        col += uAccent * fill;
        col += vec3(1.0, 0.85, 0.7) * spec;
        col += uAccent * smoothstep(0.1, 0.6, vDisp) * 0.25;

        // --- Charge veins — an estuary growing out of the press point -----
        // Channels radiate from the exact cursor hit (uSeed), meander like
        // rivers, and split into more, thinner branches the farther the
        // front travels — trunk near the source, delta at the tips.
        if (uCharge > 0.004) {
          vec3 dir = normalize(vPos);
          vec3 S = normalize(uSeed);
          float dSeed = acos(clamp(dot(dir, S), -1.0, 1.0));

          // Growth front — starts at radius ~0 at the press point and
          // creeps outward; the smoothstep tail tapers the advancing tips.
          float wob = 1.0 + snoise(dir * 3.4) * 0.22;
          float r = uCharge * 4.4;
          float cover = smoothstep(r, r - 0.35, dSeed * wob);

          // Azimuth around the seed in its tangent frame
          vec3 T = normalize(cross(S, abs(S.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 B = cross(S, T);
          float theta = atan(dot(dir, B), dot(dir, T));
          // Meander — bend grows with distance (smooth 3D field, no seam)
          float th = theta + snoise(dir * 2.6) * 0.9 * dSeed;

          // Branch generations: 6 trunks at the source; finer generations
          // only exist farther out — channels split as they travel. Angular
          // width shrinks with distance (estuary: thick mouth, thin tips) —
          // near the source the trunks merge into the nucleus.
          float t1 = clamp(0.10 / max(dSeed, 0.08), 0.15, 1.0);
          float t2 = clamp(0.14 / max(dSeed, 0.10), 0.12, 0.8);
          float t3 = clamp(0.18 / max(dSeed, 0.10), 0.10, 0.6);
          float g1 = 1.0 - smoothstep(0.0, t1, abs(sin(th * 3.0)));
          float g2 = (1.0 - smoothstep(0.0, t2, abs(sin(th * 7.0 + 1.7)))) * smoothstep(0.30, 0.85, dSeed);
          float g3 = (1.0 - smoothstep(0.0, t3, abs(sin(th * 13.0 + 4.2)))) * smoothstep(0.85, 1.55, dSeed);
          float branches = max(g1, max(g2 * 0.85, g3 * 0.7));

          // Cracked micro-texture inside the channels
          float edge = voronoiEdge(vPos * 2.3);
          branches *= 0.72 + 0.55 * (1.0 - smoothstep(0.0, 0.16, edge));

          // Current flowing outward from the source along the channels
          float flow = 0.72 + 0.28 * sin(dSeed * 7.0 - uChargeTime * 2.4);

          float veins = branches * cover * flow;
          // Origin nucleus — a glow right where the press landed
          veins = max(veins, (1.0 - smoothstep(0.0, 0.16, dSeed)) * uCharge * 1.2 * flow);
          veins = min(veins, 1.0);

          // Colour application removed — the estuary mask (veins) stays
          // computed here, ready for the next effect to consume.
        }

        // Intro morph — collapse the lit material to the flat peach of the
        // loader video's dot so the pixel handoff is invisible.
        col = mix(col, uFlatColor, uFlat);

        // dither — kills gradient banding in the dark regions
        float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col += (dith - 0.5) / 255.0;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
