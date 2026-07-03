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
    },
    vertexShader: `
      uniform float uTime;
      uniform float uDistort;
      uniform vec2 uMouse;
      varying vec3 vNormal;
      varying float vDisp;
      varying vec3 vView;
      ${NOISE_GLSL}

      // Fractal multi-octave noise — broad shape → fine surface texture
      float displacement(vec3 p) {
        float n1 = snoise(p * 1.1 + vec3(uTime * 0.22, uTime * 0.18, uTime * 0.26));
        float n2 = snoise(p * 2.6 + uTime * 0.35) * 0.34;
        float n3 = snoise(p * 5.8 + uTime * 0.52) * 0.17;
        float n4 = snoise(p * 12.5 + uTime * 0.72) * 0.07;
        float mouseInfluence = clamp(length(uMouse), 0.0, 1.5) * 0.32;
        return (n1 + n2 + n3 + n4) * uDistort + mouseInfluence;
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
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vView = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uAccent;
      uniform vec3 uDeep;
      varying vec3 vNormal;
      varying float vDisp;
      varying vec3 vView;

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

        // dither — kills gradient banding in the dark regions
        float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col += (dith - 0.5) / 255.0;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
