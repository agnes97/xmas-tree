import * as THREE from 'three';
import { STRIDE, cross, fitFibres, marabouLines, norm, seeded, sstep, type V3 } from './marabou';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The emerald swan: a clip-on glass swan of satin green glass with a long S
 * neck, a faceted rhinestone eye, a silver glitter wing edge lined with green
 * glass beads, a silver spring clip underneath and a big tail of bright green
 * and dark teal marabou feathers.
 *
 * The glass is raymarched as a signed-distance figure inside a box, like the
 * songbird. The marabou is ~100k fine fibre segments drawn as GL lines that
 * sway in the vertex shader.
 *
 * Swan units: y up, facing -x, +z towards the viewer, the body about 1.6 long.
 * The figure is scaled by the ornament's `r`, so one swan unit is `r` tree
 * units. It clips onto a branch, so it hangs from no string and wears no cap.
 */

/** The figure's origin in swan units: the x it tilts about, at mid height. */
const PIV = 0.3;
const CY = 0.3;

/** The tilt it rests at, and how far either side of it it can be turned, in radians. */
export const SWAN_REST = 0.18;
export const SWAN_TILT: [number, number] = [-0.4 - SWAN_REST, 0.5 - SWAN_REST];

/** The box the glass, beads and clip fit inside, in swan units. */
const MIN = new THREE.Vector3(-0.95, -0.7, -0.36);
const MAX = new THREE.Vector3(0.82, 1.46, 0.36);

/** The share of the artifact's barbs drawn: the swan is far smaller on the tree. */
const BARBS = 0.35;
/** CSS px per swan unit in the artifact the plume was tuned in. */
const TUNED_PX = 170;

const f4 = (v: number) => v.toFixed(4);

// Body: tapered segments along the spine, [x, centre y, half height]: a full round chest,
// drawn out into a long teardrop that ends in a raised point where the plume comes out.
const BODY = [
  [-0.5, 0.04, 0.24],
  [-0.29, 0.03, 0.315],
  [-0.08, 0.035, 0.33],
  [0.14, 0.015, 0.29],
  [0.36, -0.035, 0.18],
  [0.56, -0.05, 0.095],
  [0.72, -0.035, 0.028],
];
/** The body is a little flatter side to side than it is tall. */
const ZS = 0.8;
// Neck: an S of four quadratic curves [start, control, end, r start, r end], from inside the
// head, bowing back over the body, then sweeping forward and down into the chest.
const NECK: [[number, number], [number, number], [number, number], number, number][] = [
  [[-0.2, 1.31], [-0.025, 1.29], [-0.025, 1.02], 0.064, 0.058],
  [[-0.025, 1.02], [-0.025, 0.8], [-0.31, 0.755], 0.058, 0.07],
  [[-0.31, 0.755], [-0.62, 0.71], [-0.68, 0.38], 0.07, 0.105],
  [[-0.68, 0.38], [-0.706, 0.232], [-0.52, 0.1], 0.105, 0.17],
];
/** Upper edge of the silver glitter band on the wing, a polynomial in x. */
const EDGE = [0.3264, -0.2866, -1.5671, -0.4555, 4.5832, 4.4374, -9.3391];
/** Where the wing starts and ends along x. */
const W0 = -0.54;
const W1 = 0.68;

const bodyGLSL = BODY.slice(1).map((b, i) => {
  const a = BODY[i];
  return `sdRCone(s, vec3(${f4(a[0])}, ${f4(a[1])}, 0.0), vec3(${f4(b[0])}, ${f4(b[1])}, 0.0), ${f4(a[2])}, ${f4(b[2])})`;
});
const neckGLSL = NECK.map(
  ([A, B, C, r0, r1]) =>
    `b = sdBez(p.xy, vec2(${f4(A[0])}, ${f4(A[1])}), vec2(${f4(B[0])}, ${f4(B[1])}), vec2(${f4(C[0])}, ${f4(C[1])}));
  d = min(d, length(vec2(b.x, p.z)) - mix(${f4(r0)}, ${f4(r1)}, b.y));`
).join('\n  ');
const edgeGLSL = EDGE.map(f4).reduceRight((acc, c) => (acc ? `${c} + x * (${acc})` : c), '');

// ---------- JS copies of the glass shapes, used to sit the wing beads on the surface ----------
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const jsRCone = (p: V3, a: V3, b: V3, r1: number, r2: number) => {
  const ba = sub(b, a);
  const l2 = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pa = sub(p, a);
  const y = pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2];
  const z = y - l2;
  const xv = [0, 1, 2].map((i) => pa[i] * l2 - ba[i] * y);
  const x2 = xv[0] ** 2 + xv[1] ** 2 + xv[2] ** 2;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
};
const jsSmin = (a: number, b: number, k: number) => {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
};
const glassSD = (p: V3) => {
  const s: V3 = [p[0], p[1], p[2] / ZS];
  let d = 1e9;
  for (let i = 1; i < BODY.length; i++) {
    const a = BODY[i - 1];
    const b = BODY[i];
    const e = jsRCone(s, [a[0], a[1], 0], [b[0], b[1], 0], a[2], b[2]);
    d = i === 1 ? e : jsSmin(d, e, 0.05);
  }
  return d * ZS;
};
const edgeY = (x: number) => EDGE.reduceRight((acc, c) => c + x * acc, 0);
// the band's ends curl down: at the chest and towards the tail
const hookY = (x: number) => 0.07 * (1 - sstep(-0.53, -0.42, x)) + 0.08 * sstep(0.46, 0.66, x);
const bandY = (x: number) => edgeY(Math.min(W1, Math.max(W0, x))) - hookY(x);

/** Green glass beads along the top of the glitter band: [x, y, z, radius] each. */
function wingBeads() {
  const beads: number[] = [];
  const addBead = (x: number, y: number, r: number) => {
    const f = (z: number) => glassSD([x, y, z]);
    if (f(0) > 0) return;
    let lo = 0;
    let hi = 0.5;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (f(m) < 0) lo = m;
      else hi = m;
    }
    beads.push(x, y, lo + r * 0.55, r);
  };
  // evenly spaced along the curve (it turns steep in the hooks), then a little cluster at each end
  const X0 = -0.535;
  const X1 = 0.655;
  const R0 = 0.021;
  const GAP = 0.046;
  let px = X0;
  let py = bandY(X0);
  let acc = GAP;
  for (let x = X0; x <= X1; x += 0.002) {
    const y = bandY(x);
    acc += Math.hypot(x - px, y - py);
    px = x;
    py = y;
    if (acc >= GAP) {
      addBead(x, y + 0.02, R0);
      acc = 0;
    }
  }
  for (const [x, dy] of [
    [X0 - 0.02, 0.0],
    [X0 + 0.005, -0.03],
    [X0 - 0.025, -0.032],
  ])
    addBead(x, bandY(X0) + dy, 0.015);
  for (const [x, dy] of [
    [X1 + 0.02, 0.0],
    [X1 - 0.002, -0.03],
    [X1 + 0.025, -0.03],
  ])
    addBead(x, bandY(X1) + dy, 0.015);
  return beads;
}

const glassFragment = (nb: number) => /* glsl */ `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix;
uniform float uTime; uniform float uPx;
uniform vec4 uBead[${nb}];
varying vec3 vPos;
varying vec3 vCam;
${raymarchConstants(CY, MIN, MAX)}
const float ZS = ${ZS}, W0 = ${W0}, W1 = ${W1};
const vec3 HEAD = vec3(-0.30, 1.335, 0.0);
const vec3 EYE = vec3(-0.362, 1.368, 0.074);

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 hash3(vec3 p){ return vec3(hash(p), hash(p + 17.13), hash(p + 31.71)); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sdEll(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdTaper(vec3 p, vec3 a, vec3 b, float r1, float r2){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(r1, r2, h); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// exact distance to a cone with round ends of radius r1 at a and r2 at b
float sdRCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba), z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float dot2(vec2 v){ return dot(v, v); }
// distance to a quadratic bezier in the xy plane (x) and where along it the nearest point is (y)
vec2 sdBez(vec2 pos, vec2 A, vec2 B, vec2 C){
  vec2 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float kk = 1.0 / dot(b, b), kx = kk * dot(a, b), ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0, kz = kk * dot(d, a);
  float p = ky - kx * kx, q = kx * (2.0 * kx * kx - 3.0 * ky) + kz, h = q * q + 4.0 * p * p * p;
  float res, t;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    res = dot2(d + (c + b * t) * t);
  } else {
    float z = sqrt(-p), v = acos(q / (p * z * 2.0)) / 3.0, m = cos(v), n = sin(v) * 1.732050808;
    vec3 tt = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    float r1 = dot2(d + (c + b * tt.x) * tt.x), r2 = dot2(d + (c + b * tt.y) * tt.y);
    if (r1 < r2) { res = r1; t = tt.x; } else { res = r2; t = tt.y; }
  }
  return vec2(sqrt(res), t);
}

// upper edge of the glitter band: rises from the chest, crests over the back, dips and runs out to the tail
float edgeY(float x){ x = clamp(x, W0, W1); return ${edgeGLSL}; }
float bandY(float x){
  return edgeY(x) - 0.07 * (1.0 - smoothstep(-0.53, -0.42, x)) - 0.08 * smoothstep(0.46, 0.66, x);
}
// the wing panel: everything under the band, behind a front edge that slants back towards the belly
float wingMask(vec3 p){
  float front = W0 + 0.03 + 0.45 * max(0.0, bandY(W0) - p.y);
  return (1.0 - smoothstep(-0.004, 0.004, p.y - bandY(p.x))) * smoothstep(front - 0.035, front + 0.035, p.x)
       * smoothstep(W1, W1 - 0.06, p.x) * smoothstep(0.03, 0.10, abs(p.z));
}
float bodySD(vec3 p){
  vec3 s = vec3(p.xy, p.z / ZS);
  float d = ${bodyGLSL[0]};
  ${bodyGLSL
    .slice(1)
    .map((g) => `d = smin(d, ${g}, 0.05);`)
    .join('\n  ')}
  return d * ZS;
}
float neckSD(vec3 p){
  float d = 1e9; vec2 b;
  ${neckGLSL}
  // head: a long smooth egg tipped a little beak-down
  vec3 h = p - HEAD;
  h.xy = mat2(0.985, -0.174, 0.174, 0.985) * h.xy;
  d = smin(d, sdEll(h, vec3(0.17, 0.092, 0.088)), 0.05);
  return smin(d, length(p - vec3(-0.335, 1.385, 0.0)) - 0.062, 0.04);   // rounded forehead
}
float plate(vec3 p, vec2 a, vec2 b){
  vec2 pa = p.xy - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return max(length(pa - ba * h) - 0.006, abs(p.z) - 0.04);
}
// silver spring under the belly and the two jaws of the clip, hinged at the front, closed at the tip
float metalSD(vec3 p){
  vec3 s = p - vec3(-0.09, 0.0, 0.0);
  const float R = 0.03, PITCH = 0.021;
  float yy = s.y - PITCH * atan(s.z, s.x) / 6.2831853;
  yy = mod(yy + 0.5 * PITCH, PITCH) - 0.5 * PITCH;
  float coil = max(length(vec2(length(s.xz) - R, yy)) - 0.0065, abs(p.y + 0.385) - 0.105);
  float j1 = plate(p, vec2(-0.20, -0.49), vec2(0.32, -0.565));
  float j2 = plate(p, vec2(-0.20, -0.555), vec2(0.32, -0.58));
  float back = plate(p, vec2(-0.20, -0.49), vec2(-0.20, -0.555));
  float hinge = sdCap(p, vec3(-0.20, -0.522, -0.044), vec3(-0.20, -0.522, 0.044), 0.013);
  return min(min(coil, hinge), min(min(j1, j2), back));
}

// mat: 1 glass, 2 beak, 3 rhinestone eye, 4 bead, 5 metal.
// The y tests skip parts a point is too far from to reach; rays run close to along z.
float map(vec3 p, out float mat){
  vec3 q = vec3(p.xy, abs(p.z));
  float d = bodySD(p) - 0.004 * wingMask(p);   // the wing is a raised plate
  // a soft blend where the neck swells into the chest, a tight one higher up so the S stays open
  if (p.y > -0.3) d = smin(d, neckSD(p), mix(0.14, 0.04, smoothstep(0.12, 0.42, p.y)));
  mat = 1.0;
  if (p.y > 1.15) {
    float bk = sdTaper(p, vec3(-0.42, 1.305, 0.0), vec3(-0.672, 1.252, 0.0), 0.046, 0.018);
    if (bk < d) mat = 2.0;
    d = smin(d, bk, 0.02);
    float eye = sdEll(q - EYE, vec3(0.034, 0.034, 0.022));
    if (eye < d) mat = 3.0;
    d = min(d, eye);
  }
  if (q.z > 0.02 && p.x > -0.62 && p.x < 0.73 && p.y < 0.43 && p.y > -0.16) {
    float bd = 1e9;
    for (int i = 0; i < ${nb}; i++) bd = min(bd, length(q - uBead[i].xyz) - uBead[i].w);
    if (bd < d) mat = 4.0;
    d = min(d, bd);
  }
  if (p.y < -0.25) {
    float m = metalSD(p);
    if (m < d) mat = 5.0;
    d = min(d, m);
  }
  return d;
}
float sdf(vec3 p){ float m; return map(p, m); }
vec3 calcN(vec3 p){
  const vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
}
// hammered glass: shallow round dents, faint, over the lower body
float dimple(vec2 x){
  vec2 g = x / 0.05, i = floor(g), f = fract(g);
  float md = 1.0;
  for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) {
    vec2 o = vec2(float(xx), float(yy));
    vec2 r = o + 0.2 + 0.6 * vec2(hash(vec3(i + o, 1.0)), hash(vec3(i + o, 2.0))) - f;
    md = min(md, dot(r, r));
  }
  return -(1.0 - smoothstep(0.0, 0.16, md));
}

void main(){
  // march from where the view ray enters the box (swan units) to where it leaves it
  vec3 rd = normalize(vPos - vCam);
  vec3 ro = vPos + CY;
  vec3 inv = 1.0 / mix(vec3(1e-5), rd, step(1e-5, abs(rd)));
  vec3 tf = max((BMIN - ro) * inv, (BMAX - ro) * inv);
  float tEnd = min(min(tf.x, tf.y), tf.z);
  float t = 0.0, dBest = 1e9, tBest = 0.0;
  bool hit = false;
  for (int i = 0; i < 140; i++) {
    float d = sdf(ro + rd * t);
    if (d < dBest) { dBest = d; tBest = t; }
    if (d < 0.0005) { hit = true; break; }
    t += d * 0.8;
    if (t > tEnd) break;
  }
  float alpha = 1.0;
  if (!hit) {
    alpha = 1.0 - smoothstep(0.0, 1.2 * uPx, dBest);
    if (alpha <= 0.0) discard;
    t = tBest;
  }
  vec3 p = ro + rd * t;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p - CY, 1.0);
  gl_FragDepth = 0.5 * clip.z / clip.w + 0.5;

  float mat; map(p, mat);
  vec3 nO = calcN(p);
  vec3 q = vec3(p.xy, abs(p.z));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
  vec3 L2 = normalize(vec3(0.7, 0.15, 0.7));
  float ao = 0.0, sc2 = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.012 + 0.04 * float(i);
    ao += (h - sdf(p + nO * h)) * sc2; sc2 *= 0.65;
  }
  ao = clamp(1.0 - 1.8 * ao, 0.3, 1.0);

  vec3 alb = vec3(0.0), gC = vec3(0.8), col = vec3(0.0);
  float glit = 0.0, gloss = 0.5, sharp = 60.0;
  bool lit = true;
  if (mat < 1.5) {
    // satin emerald glass, yellower and lighter up the neck; the wing a frosted sage under its band
    float e = bandY(p.x);
    float wing = wingMask(p);
    float side = smoothstep(0.02, 0.09, q.z);
    alb = mix(vec3(0.022, 0.108, 0.030), vec3(0.040, 0.145, 0.032), smoothstep(0.1, 1.0, p.y));
    alb = mix(alb, vec3(0.040, 0.095, 0.050), wing * smoothstep(-0.25, 0.1, p.y));   // frosted wing panel
    alb = mix(alb, vec3(0.014, 0.062, 0.028), wing * smoothstep(0.0, -0.25, p.y));   // deeper green belly
    alb *= 1.0 - 0.4 * smoothstep(0.3, 0.72, p.x);                                    // darkening to the tail tip
    alb *= 0.85 + 0.3 * vnoise(p * vec3(7.0, 9.0, 7.0));
    gloss = mix(0.75, 0.4, wing); sharp = mix(55.0, 30.0, wing);
    // hammered dents over the whole lower body and tail
    float hammer = side * smoothstep(-0.48, -0.3, p.x) * (1.0 - smoothstep(e - 0.12, e - 0.04, p.y));
    if (hammer > 0.01) {
      const float E = 0.004;
      vec2 g = vec2(dimple(p.xy + vec2(E, 0.0)) - dimple(p.xy - vec2(E, 0.0)),
                    dimple(p.xy + vec2(0.0, E)) - dimple(p.xy - vec2(0.0, E))) / (2.0 * E);
      nO = normalize(nO - hammer * 0.0012 * vec3(g, 0.0));
      alb *= 1.0 + 0.28 * hammer * dimple(p.xy);
    }
    // wide band of silver glitter along the wing's upper edge, hooking down at both ends, its lower
    // edge ragged, narrowing to the tail; a strip of green glitter runs along its top under the beads
    float sl = (bandY(p.x + 0.01) - bandY(p.x - 0.01)) / 0.02;
    float dn = (p.y - e) / sqrt(1.0 + sl * sl);
    float bw = 0.085 * (1.0 - 0.5 * smoothstep(0.1, 0.6, p.x));
    float rough = (vnoise(p * 90.0) - 0.5) * 0.014;
    float inBand = (1.0 - smoothstep(-0.002, 0.004, dn)) * smoothstep(-bw - 0.004, -bw + 0.004, dn + rough);
    float ends = smoothstep(W0 - 0.005, W0 + 0.02, p.x) * (1.0 - smoothstep(W1 - 0.04, W1, p.x));
    glit = inBand * ends * side;
    gC = vec3(0.80, 0.88, 0.82);
    if (dn > -0.03 + rough * 0.4) gC = vec3(0.10, 0.60, 0.20);
    // a fine line of green glitter just under the band
    float under = abs(dn + bw + 0.008 - rough * 0.5);
    float gl2 = (1.0 - smoothstep(0.004, 0.008, under)) * ends * side;
    if (gl2 > glit) { glit = gl2; gC = vec3(0.22, 0.70, 0.30); }
    // green glitter round the eye and a brow sweeping back over the head
    float ring = abs(length(p.xy - EYE.xy) - 0.046);
    float brow = min(segD(p.xy, vec2(-0.40, 1.418), vec2(-0.28, 1.438)), segD(p.xy, vec2(-0.28, 1.438), vec2(-0.15, 1.39)));
    float hg = (1.0 - smoothstep(0.009, 0.015, min(ring, brow) + (vnoise(p * 150.0) - 0.5) * 0.005))
             * smoothstep(0.02, 0.05, q.z) * step(1.25, p.y);
    if (hg > glit) { glit = hg; gC = vec3(0.22, 0.80, 0.25); }
  } else if (mat < 2.5) {
    // beak rolled in green glitter
    alb = vec3(0.03, 0.16, 0.03); glit = 0.95; gC = vec3(0.25, 0.85, 0.28); gloss = 0.6;
  } else if (mat < 4.5 && mat > 3.5) {
    alb = vec3(0.006, 0.06, 0.022); gloss = 2.4; sharp = 220.0;   // glossy dark green glass bead
  }
  vec3 nV = normalize(normalMatrix * nO);
  float diff = max(dot(nV, L) * 0.8 + 0.2, 0.0);
  float hemi = 0.32 + 0.18 * nV.y;

  if (mat > 2.5 && mat < 3.5) {
    // faceted green rhinestone: a flat table, a ring of star facets and a ring of crown facets
    vec3 e = q - EYE;
    float rr = length(e.xy) / 0.034;
    float an = atan(e.y, e.x) / 0.7853982;
    float ring = rr < 0.42 ? 0.0 : (rr < 0.78 ? 1.0 : 2.0);
    float sh = ring == 1.0 ? 0.5 : 0.0;
    float id = floor(an + 0.5 - sh);
    float pc = (id + sh) * 0.7853982;
    float tilt = ring == 0.0 ? 0.0 : (ring == 1.0 ? 0.42 : 0.9);
    vec3 fn = vec3(cos(pc) * sin(tilt), sin(pc) * sin(tilt), cos(tilt));
    fn.z *= p.z < 0.0 ? -1.0 : 1.0;
    vec3 nF = normalize(normalMatrix * normalize(mix(nO, fn, 0.8)));
    vec3 R = reflect(-V, nF);
    float h = hash(vec3(id, ring, 3.7));
    float env = pow(max(dot(R, L), 0.0), 22.0) * 2.6 + pow(max(dot(R, L2), 0.0), 22.0) * 1.5 + smoothstep(0.35, 1.0, R.y) * 0.3;
    float fire = h * (0.55 + 0.45 * sin(uTime * 1.3 + h * 40.0));
    float edgeA = abs(fract(an + 0.5 - sh) - 0.5) * rr * 0.785;
    float edge = ring == 0.0 ? abs(rr - 0.42) : min(edgeA, min(abs(rr - 0.42), abs(rr - 0.78)));
    col = vec3(0.45, 0.85, 0.12) * (0.45 + 1.3 * fire) + vec3(0.9, 1.0, 0.8) * env * 1.4;
    col *= (0.45 + 0.55 * smoothstep(0.0, 0.07, edge)) * mix(0.7, 1.0, ao);
    // a crisp white glint and a little four-point star where the light catches the stone
    vec2 st = (e.xy - vec2(-0.010, 0.012)) / 0.034;
    float star = max(0.0, 1.0 - length(st) / 0.16) + 0.6 * max(0.0, 1.0 - abs(st.x) / 0.035) * max(0.0, 1.0 - abs(st.y) / 0.5)
               + 0.6 * max(0.0, 1.0 - abs(st.y) / 0.035) * max(0.0, 1.0 - abs(st.x) / 0.5);
    col += vec3(1.0, 1.0, 0.95) * star * (0.75 + 0.25 * sin(uTime * 2.1)) * step(0.0, p.z);
    lit = false;
  } else if (mat > 4.5) {
    // polished silver wire and clip
    vec3 R = reflect(-V, nV);
    col = mix(vec3(0.07, 0.08, 0.08), vec3(0.80, 0.83, 0.86), smoothstep(-0.25, 0.85, R.y)) * mix(0.55, 1.0, ao)
        + vec3(1.0) * (pow(max(dot(R, L), 0.0), 50.0) * 1.3 + pow(max(dot(R, L2), 0.0), 50.0) * 0.6);
    lit = false;
  }

  if (lit) {
    col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
    float nh = max(dot(nV, normalize(L + V)), 0.0), nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
    col += gloss * ao * vec3(1.0, 0.98, 0.94) * (pow(nh, sharp) * 0.6 + pow(nh, 10.0) * 0.06 + pow(nh2, sharp) * 0.25);
    float fres = pow(1.0 - max(nV.z, 0.0), 2.5);
    // satin sheen and light glowing through the thin glass at the rim
    if (mat < 1.5) col += ao * (alb * 2.2 + vec3(0.03, 0.07, 0.03)) * fres * 0.42;
    else col += ao * vec3(0.45, 0.70, 0.45) * fres * 0.06;
    if (mat > 3.5) col += vec3(0.02, 0.10, 0.03) * (1.0 - fres);          // light glowing through the bead
  }

  if (glit > 0.01) {
    vec3 g = floor(p * 230.0);
    float h = hash(g);
    vec3 gV = normalize(normalMatrix * normalize(nO + (hash3(g) - 0.5) * 1.3));
    float tw = 0.55 + 0.45 * sin(uTime * 2.4 + h * 60.0);
    // each grain is a tiny tilted mirror: it flashes when it faces a light, and a few always glint
    float sp = 2.0 * pow(max(dot(reflect(-L, gV), V), 0.0), 16.0) * step(0.4, h)
             + 1.2 * pow(max(dot(reflect(-L2, gV), V), 0.0), 20.0) * step(0.55, h)
             + 0.6 * step(0.92, h);
    float h2 = hash(g + 5.3);
    vec3 tint = mix(vec3(1.0), 0.5 + 0.5 * cos(6.283 * (h2 * 2.0 + vec3(0.0, 0.33, 0.67))), step(0.75, h2) * 0.6);
    vec3 gcol = gC * (0.30 + 0.75 * diff + hemi * 0.4) * (0.55 + 0.6 * h) * mix(vec3(1.0), tint, 0.4)
              + mix(vec3(1.3, 1.3, 1.2), gC * 1.6 + 0.3, 0.4) * tint * sp * tw;
    col = mix(col, gcol, glit * step(0.2, hash(g + 2.1)) * (0.8 + 0.2 * h) * mix(0.6, 1.0, ao));
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

/**
 * The plume: a big soft cloud billowing out behind the tail, wider than the swan
 * itself. Bright green fluff on top and spilling back up over the tail, dark
 * teal underneath and out at the far end. Each feather is a thin drooping shaft
 * with long curling barbs all round it. Returns interleaved line vertices.
 */
function plume() {
  const rnd = seeded(97);
  const T0: V3 = [0.7, -0.03, 0];
  const BRIGHT: V3[] = [
    [0.05, 0.5, 0.075],
    [0.09, 0.56, 0.05],
    [0.035, 0.44, 0.12],
  ];
  const TEAL: V3[] = [
    [0.01, 0.13, 0.1],
    [0.006, 0.1, 0.085],
    [0.02, 0.17, 0.115],
  ];
  const rndUnit = () => norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
  type Feather = {
    th: number;
    ph: number;
    L: number;
    curl?: number;
    dark: boolean;
    nb: number;
    size: number;
  };
  const feathers: Feather[] = [];
  const MAIN = 84;
  for (let i = 0; i < MAIN; i++) {
    const th = -0.26 + (0.78 * (i + rnd())) / MAIN; // mostly sideways, the upper ones climbing
    const L = (1.3 + 0.55 * rnd()) * (0.8 + 0.3 * Math.exp(-(((th - 0.08) / 0.35) ** 2)));
    feathers.push({
      th,
      ph: (rnd() - 0.5) * 1.0,
      L,
      curl: (rnd() - 0.25) * 0.25 + 0.8 * sstep(0.05, 0.45, th), // the high ones bend up further out
      dark: rnd() < 0.15,
      nb: 260,
      size: 1.25,
    });
  }
  // bright fluff spilling up and back over the tail
  for (let i = 0; i < 14; i++)
    feathers.push({
      th: 1.2 + 0.9 * rnd(),
      ph: (rnd() - 0.5) * 1.2,
      L: 0.4 + 0.3 * rnd(),
      dark: false,
      nb: 160,
      size: 1.15,
    });
  // short fluff round the base, hiding where the plume is tucked into the glass
  for (let i = 0; i < 16; i++)
    feathers.push({
      th: -2.4 + 4.6 * rnd(),
      ph: (rnd() - 0.5) * 1.6,
      L: 0.25 + 0.2 * rnd(),
      dark: rnd() < 0.4,
      nb: 100,
      size: 0.9,
    });
  feathers.sort((a, b) => a.ph - b.ph); // back to front
  for (const f of feathers) f.nb = Math.round(f.nb * BARBS);

  const RSEG = 22;
  const BSEG = 6;
  const data = new Float32Array(
    feathers.reduce((n, f) => n + RSEG + f.nb * BSEG * 2, 0) * 2 * STRIDE
  );
  let n = 0;
  const put = (p: V3, t: V3, c: V3, a: number, s: number, b: number, ph: number, ao: number) => {
    data.set([...p, ...t, ...c, a, s, b, ph, ao], n);
    n += STRIDE;
  };
  for (const f of feathers) {
    const phase = rnd();
    const ci = Math.floor(rnd() * 3);
    const base = (f.dark ? TEAL : BRIGHT)[ci];
    const curl = f.curl !== undefined ? f.curl : (rnd() - 0.5) * 0.5;
    const curlZ = (rnd() - 0.5) * 0.3;
    const aoF = f.ph < 0 ? 0.78 : 1.0;
    // the feathers leave the tail as a thick bundle, not from a single point
    const pts: V3[] = [
      [T0[0] - 0.03 + rnd() * 0.08, T0[1] + (rnd() - 0.5) * 0.18, (rnd() - 0.5) * 0.16],
    ];
    const tans: V3[] = [];
    const step = f.L / RSEG;
    for (let k = 1; k <= RSEG; k++) {
      const s = k / RSEG;
      const th = f.th + curl * s;
      const ph = f.ph + curlZ * s;
      const d = norm([
        Math.cos(th) * Math.cos(ph),
        Math.sin(th) * Math.cos(ph) - 0.06 * s,
        Math.sin(ph),
      ]);
      const q = pts[k - 1];
      tans.push(d);
      pts.push([q[0] + d[0] * step, q[1] + d[1] * step, q[2] + d[2] * step]);
    }
    // shaft
    for (let k = 0; k < RSEG; k++) {
      const c = base.map((v) => v * 0.85) as V3;
      put(pts[k], tans[k], c, 0.25 - (0.12 * k) / RSEG, k / RSEG, 0, phase, 0.7 * aoF);
      put(
        pts[k + 1],
        tans[k],
        c,
        0.25 - (0.12 * (k + 1)) / RSEG,
        (k + 1) / RSEG,
        0,
        phase,
        0.7 * aoF
      );
    }
    // barbs
    for (let j = 0; j < f.nb; j++) {
      const s = 0.03 + 0.97 * rnd();
      const fi = s * RSEG;
      const i0 = Math.min(RSEG - 1, Math.floor(fi));
      const fr = fi - i0;
      const a = pts[i0];
      const b = pts[i0 + 1];
      const t = tans[i0];
      let p: V3 = [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr, a[2] + (b[2] - a[2]) * fr];
      const n1 = norm(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const n2 = cross(t, n1);
      const psi = rnd() * 6.283;
      const al = 0.5 + 0.8 * rnd();
      const spin = (rnd() - 0.5) * 1.2;
      let d = norm(
        [0, 1, 2].map(
          (k) =>
            t[k] * Math.cos(al) + (n1[k] * Math.cos(psi) + n2[k] * Math.sin(psi)) * Math.sin(al)
        ) as V3
      );
      const lb =
        (0.2 + 0.24 * rnd()) *
        sstep(0, 0.1, s) *
        (1 - 0.3 * s * s) *
        Math.min(1.3, Math.max(0.6, f.L / 1.1)) *
        f.size;
      const tint = 0.75 + 0.5 * rnd();
      const dk =
        (f.dark ? 0.5 : 0.03) +
        0.95 * sstep(1.3, 1.75, p[0] + 0.25 * (rnd() - 0.5)) +
        0.85 * sstep(-0.05, -0.3, p[1]);
      const c = (rnd() < dk ? TEAL : BRIGHT)[ci].map((v) => v * tint) as V3;
      const aoS = (0.62 + 0.38 * sstep(0, 0.35, s)) * aoF;
      const sl = lb / BSEG;
      for (let k = 0; k < BSEG; k++) {
        const ru = rndUnit();
        const tw = cross(t, d);
        d = norm(
          [0, 1, 2].map(
            (i) => d[i] + t[i] * 0.08 + tw[i] * spin + ru[i] * 0.5 - (i === 1 ? 0.04 : 0)
          ) as V3
        );
        const q: V3 = [p[0] + d[0] * sl, p[1] + d[1] * sl, p[2] + d[2] * sl];
        const b0 = k / BSEG;
        const b1 = (k + 1) / BSEG;
        put(p, d, c, 0.72 - 0.36 * b0, s, b0, phase, aoS * (0.55 + 0.45 * b0));
        put(q, d, c, 0.72 - 0.36 * b1, s, b1, phase, aoS * (0.55 + 0.45 * b1));
        // a wisp of barbule fuzz off this bit of barb
        const m = rnd();
        const ru2 = rndUnit();
        const r0: V3 = [p[0] + d[0] * sl * m, p[1] + d[1] * sl * m, p[2] + d[2] * sl * m];
        const bd = norm([0, 1, 2].map((i) => d[i] * 0.6 + ru2[i]) as V3);
        const bl = 0.014 + 0.022 * rnd();
        const bm = (k + m) / BSEG;
        put(r0, bd, c, 0.4, s, bm, phase, aoS * (0.6 + 0.4 * bm));
        put(
          [r0[0] + bd[0] * bl, r0[1] + bd[1] * bl, r0[2] + bd[2] * bl],
          bd,
          c,
          0.16,
          s,
          bm,
          phase,
          aoS * (0.6 + 0.4 * bm)
        );
        p = q;
      }
    }
  }

  // Keep the plume the size it was in the artifact, where it was shrunk about its root to fit
  // a canvas spanning x up to 2.92 and y from -0.84 to 1.50 at any tilt.
  const out = data.subarray(0, n);
  fitFibres(out, T0, PIV, [-0.4, 0, 0.5], 2.86, -0.79, 1.45);
  return out;
}

/**
 * The swan: a group whose origin sits at swan point (PIV, CY), scaled by the
 * ornament's `r`. `setGust` sets how hard the plume is being blown, 0 to 1.
 */
export function swanFigure(reduced: boolean) {
  const beads = wingBeads();
  const glass = raymarchedMesh(glassFragment(beads.length / 4), CY, MIN, MAX);
  const glassMat = glass.mesh.material as THREE.ShaderMaterial;
  glassMat.uniforms.uBead = { value: new Float32Array(beads) };
  glass.mesh.position.x = -PIV;

  const plumeLines = marabouLines(plume(), {
    reduced,
    spec: [0.165, 0.22, 0.176],
    tunedPx: TUNED_PX,
    barbs: BARBS,
  });
  const fibres = plumeLines.lines;
  fibres.position.set(-PIV, -CY, 0);

  const object = new THREE.Group();
  object.add(glass.mesh, fibres);
  return {
    object,
    rest: SWAN_REST,
    tilt: SWAN_TILT,
    setGust: plumeLines.setGust,
    dispose: () => {
      glass.dispose();
      plumeLines.dispose();
    },
  };
}
