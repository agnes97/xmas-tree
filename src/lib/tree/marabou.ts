import * as THREE from 'three';

/**
 * Shared pieces for the clip-on birds' marabou tails: small vector helpers and
 * the fibre lines, drawn as GL lines lit as hair that sway in the vertex shader.
 *
 * Fibre data is interleaved, 14 floats a vertex: position (3), tangent (3),
 * colour and alpha (4), and `s` along the feather (0 at the root), `b` along
 * the barb, the feather's phase, and ambient occlusion (4).
 */

export type V3 = [number, number, number];

export const STRIDE = 14;

export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const fibreVertex = /* glsl */ `
attribute vec3 aTan; attribute vec4 aCol; attribute vec4 aPar;
uniform float uTime; uniform float uBreeze; uniform float uGust; uniform float uFade;
varying vec4 vCol; varying vec3 vT; varying float vAo;
void main(){
  // aPar: s = along the feather (0 at the root), b = along the barb, ph = this feather's phase, ao
  float s = aPar.x, b = aPar.y, ph = aPar.z, t = uTime;
  vec3 p = position;
  // the whole feather sways, more towards its tip
  float A = (0.035 * uBreeze + 0.06 * uGust) * pow(s, 1.5);
  p += A * vec3(0.25 * sin(t * 1.7 + ph * 5.0),
                0.7 * sin(t * 1.3 + ph * 6.283) + 0.3 * sin(t * 2.9 + ph * 11.0 + p.x * 3.0),
                0.8 * sin(t * 1.05 + ph * 9.0));
  // and the fluffy barbs flutter on their own
  p += b * (0.010 * uBreeze + 0.025 * uGust) * vec3(sin(t * 4.1 + ph * 40.0 + p.y * 20.0), sin(t * 3.3 + ph * 31.0 + p.x * 17.0), sin(t * 3.7 + ph * 23.0 + p.z * 13.0));
  p += uGust * pow(s, 1.2) * vec3(0.07, 0.045, 0.03 * sin(ph * 9.0)) * (0.7 + 0.3 * sin(t * 6.0 + ph * 13.0));
  vCol = vec4(aCol.rgb, aCol.a * uFade); vT = normalMatrix * aTan; vAo = aPar.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

/**
 * `spec` is the colour and strength of the sheen running along each fibre;
 * `darkSpec` scales it down on near-black fibres, which shine less.
 */
const fibreFragment = (spec: V3, darkSpec = 1) => /* glsl */ `
varying vec4 vCol; varying vec3 vT; varying float vAo;
void main(){
  vec3 T = normalize(vT + vec3(1e-5));
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55)), L2 = normalize(vec3(0.7, 0.15, 0.7)), V = vec3(0.0, 0.0, 1.0);
  float tl = dot(T, L), tl2 = dot(T, L2), th = dot(T, normalize(L + V));
  float diff = sqrt(max(0.0, 1.0 - tl * tl)), diff2 = sqrt(max(0.0, 1.0 - tl2 * tl2));
  float sp = pow(sqrt(max(0.0, 1.0 - th * th)), 80.0);
  vec3 col = vCol.rgb * (0.30 + 0.85 * diff + 0.25 * diff2) * vAo + vec3(${spec.map((v) => v.toFixed(4)).join(', ')}) * sp * vAo * mix(${darkSpec.toFixed(4)}, 1.0, step(0.05, vCol.r));
  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col * vCol.a, vCol.a);
}`;

/**
 * Shrinks fibre data about its root `t0`, only if needed, so it stays inside
 * the box it was tuned in at any tilt: x up to `xmax` turned about `piv` by
 * each of `yaws`, and y between `ymin` and `ymax`.
 */
export function fitFibres(
  data: Float32Array,
  t0: V3,
  piv: number,
  yaws: number[],
  xmax: number,
  ymin: number,
  ymax: number
) {
  let k = 1;
  for (let i = 0; i < data.length; i += STRIDE) {
    const dx = data[i] - t0[0];
    const dy = data[i + 1] - t0[1];
    const z = data[i + 2];
    for (const yw of yaws) {
      const c = Math.cos(yw);
      const den = c * dx + Math.sin(yw) * z;
      if (den > 0) k = Math.min(k, (xmax - piv - c * (t0[0] - piv)) / den);
    }
    if (dy > 0) k = Math.min(k, (ymax - t0[1]) / dy);
    if (dy < 0) k = Math.min(k, (t0[1] - ymin) / -dy);
  }
  for (let i = 0; i < data.length; i += STRIDE) {
    data[i] = t0[0] + (data[i] - t0[0]) * k;
    data[i + 1] = t0[1] + (data[i + 1] - t0[1]) * k;
    data[i + 2] *= k;
  }
}

/**
 * The fibres as line segments. Lines stay a pixel wide however small the bird
 * is drawn, so they fade with its size to stay as airy as they were at
 * `tunedPx` CSS px per unit with every barb drawn; `barbs` is the share drawn.
 */
export function marabouLines(
  data: Float32Array,
  opts: { reduced: boolean; spec: V3; darkSpec?: number; tunedPx: number; barbs: number }
) {
  const buffer = new THREE.InterleavedBuffer(data, STRIDE);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute('aTan', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute('aCol', new THREE.InterleavedBufferAttribute(buffer, 4, 6));
  geometry.setAttribute('aPar', new THREE.InterleavedBufferAttribute(buffer, 4, 10));
  const material = new THREE.ShaderMaterial({
    vertexShader: fibreVertex,
    fragmentShader: fibreFragment(opts.spec, opts.darkSpec),
    uniforms: {
      uTime: { value: 0 },
      uBreeze: { value: opts.reduced ? 0 : 1 },
      uGust: { value: 0 },
      uFade: { value: 1 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  // drawn after the glass, so the fibres behind it are hidden by its depth
  lines.renderOrder = 1;
  lines.frustumCulled = false;
  const scale = new THREE.Vector3();
  lines.onBeforeRender = () => {
    material.uniforms.uTime.value = performance.now() / 1000;
    const px = lines.getWorldScale(scale).x;
    material.uniforms.uFade.value = Math.min(1, Math.max(0.25, px / opts.tunedPx / opts.barbs));
  };
  return {
    lines,
    setGust: (gust: number) => (material.uniforms.uGust.value = gust),
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
