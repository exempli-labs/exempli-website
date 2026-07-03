import * as THREE from "three";
import { NOISE_GLSL } from "./noise.js";

/* Textured-space backdrop shared by every hero: a slow ember nebula far
   behind the focal object, a sparse distant starfield, and two dust layers
   at different depths whose opposing parallax gives the scene volume.
   Everything is additive over black and cheap — one fbm quad + three
   point clouds. Call update(t, mouse) once per frame. */

function makeSoftDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function initSpaceBackdrop(scene, { mobile = false, intensity = 1 } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const dotTex = makeSoftDot();

  // --- Nebula: fbm haze quad far behind everything -------------------------
  const nebulaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color("#E8A87C") },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uAccent;
      uniform float uIntensity;
      varying vec2 vUv;
      ${NOISE_GLSL}
      float fbm(vec3 p) {
        return snoise(p) * 0.5 + snoise(p * 2.13) * 0.25 + snoise(p * 4.7) * 0.125;
      }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(4.6, 2.6);
        float m = smoothstep(-0.15, 0.75, fbm(vec3(p * 0.55, uTime * 0.02)));
        vec3 col = mix(vec3(0.10, 0.035, 0.015), uAccent * 0.55, m);
        // brighter filaments threaded through the haze
        float wisp = smoothstep(0.35, 0.9, fbm(vec3(p * 1.4 + 3.7, uTime * 0.03)));
        col += uAccent * wisp * 0.12;
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x)
                   * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        gl_FragColor = vec4(col, m * 0.16 * uIntensity * edge);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(46, 26), nebulaMat);
  nebula.position.set(0, 0, -9);
  group.add(nebula);

  // --- Point-cloud helper ---------------------------------------------------
  function makePoints(count, spread, zRange, size, opacity, color) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread[0];
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      pos[i * 3 + 2] = zRange[0] + Math.random() * (zRange[1] - zRange[0]);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        map: dotTex,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    group.add(pts);
    return pts;
  }

  // --- Distant stars + two dust layers at different depths ------------------
  const stars = makePoints(mobile ? 90 : 190, [40, 22], [-12, -7], 0.05, 0.7, "#f4e7db");
  const dustFar = makePoints(mobile ? 90 : 200, [24, 14], [-6, -2], 0.035, 0.35, "#E8A87C");
  const dustNear = makePoints(mobile ? 70 : 160, [13, 8], [-1, 1.5], 0.065, 0.5, "#E8A87C");

  return {
    group,
    update(t, mouse) {
      nebulaMat.uniforms.uTime.value = t;
      // Layered parallax: near dust moves against the pointer, far layers
      // barely respond — the differential is the depth cue.
      stars.rotation.y = -mouse.x * 0.012;
      stars.rotation.x = mouse.y * 0.008;
      dustFar.rotation.y = t * 0.008 + mouse.x * 0.02;
      dustFar.position.y = Math.sin(t * 0.04 + 1.7) * 0.1;
      dustNear.rotation.y = t * 0.014 - mouse.x * 0.07;
      dustNear.rotation.x = -mouse.y * 0.045;
      dustNear.position.y = Math.sin(t * 0.05) * 0.14;
    },
  };
}
