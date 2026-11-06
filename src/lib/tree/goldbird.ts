import * as THREE from 'three';
import { STRIDE, cross, fitFibres, marabouLines, norm, seeded, sstep, type V3 } from './marabou';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The golden songbird: a clip-on glass bird, silvered and lacquered gold so it
 * works as a mirror and shows the room around it (dark green branches below, a
 * warm wall above), with a silver glitter beak, the wing outlined and feathered
 * in silver glitter, a gold spring clip and a big soft cloud of white marabou
 * for a tail.
 *
 * Built like the swan: the glass is raymarched inside a box and the marabou is
 * fine fibres drawn as GL lines that sway in the vertex shader.
 *
 * Bird units: y up, facing -x, +z towards the viewer, beak tip to tail about
 * 1.7. The figure is scaled by the ornament's `r`, so one bird unit is `r`
 * tree units. It clips onto a branch, so it hangs from no string and wears no cap.
 */

/** The figure's origin in bird units: the x it tilts about, at mid height. */
const PIV = 0.0;
const CY = -0.12;

/** The tilt it rests at, and how far either side of it it can be turned, in radians. */
export const GOLDBIRD_REST = 0.15;
export const GOLDBIRD_TILT: [number, number] = [-0.45 - GOLDBIRD_REST, 0.5 - GOLDBIRD_REST];

/** The box the glass and clip fit inside, in bird units. */
const MIN = new THREE.Vector3(-1.08, -0.62, -0.3);
const MAX = new THREE.Vector3(0.7, 0.37, 0.3);

/** The share of the artifact's barbs drawn: the bird is far smaller on the tree. */
const BARBS = 0.35;
/** CSS px per bird unit in the artifact the tail was tuned in. */
const TUNED_PX = 145;

const f4 = (v: number) => v.toFixed(4);
const f6 = (v: number) => v.toFixed(6);

// Outlines traced on a grid over the photo, in photo pixels: [x, top edge y, bottom edge y].
// 1 unit = 350 px; the beak tip (photo x 85) sits at x = -1.05 and the level belly line (photo y 252)
// at y = 0. Each outline becomes a smooth spline of its centre line and its half height squared
// (squared, so both ends close round instead of coming to a point).
type Row = [number, number, number];
const toUnits = ([px, top, bot]: Row): Row => [
  (px - 85) / 350 - 1.05,
  (252 - (top + bot) / 2) / 350,
  ((bot - top) / 2 / 350) ** 2,
];
// the glass: round head, a full chest, a near-level back, and the belly sweeping up into the tail
const BODY = (
  [
    [185, 203, 203],
    [195, 176, 226],
    [210, 156, 234],
    [230, 142, 246],
    [255, 134, 266],
    [280, 137, 292],
    [300, 146, 312],
    [325, 158, 328],
    [350, 164, 337],
    [400, 163, 344],
    [450, 161, 342],
    [500, 172, 322],
    [550, 190, 302],
    [600, 205, 290],
    [630, 214, 278],
    [660, 226, 256],
    [680, 238, 238],
  ] as Row[]
).map(toUnits);
// the wing: rounded at the shoulder, under the line of the back, drawn out to a point at the tail
const WING = (
  [
    [322, 225, 225],
    [335, 200, 248],
    [360, 188, 275],
    [400, 182, 292],
    [450, 181, 294],
    [500, 190, 285],
    [550, 204, 271],
    [600, 219, 257],
    [640, 234, 245],
    [655, 240, 240],
  ] as Row[]
).map(toUnits);

// Catmull-Rom style tangents for the centre line and the squared half height
const tangents = (P: Row[]) =>
  P.map((_, i) => {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    return [(b[1] - a[1]) / (b[0] - a[0]), (b[2] - a[2]) / (b[0] - a[0])];
  });
const BODY_M = tangents(BODY);
const WING_M = tangents(WING);

/** The spline as GLSL: returns (centre y, half height squared); negative past either end. */
const profGLSL = (name: string, P: Row[], M: number[][]) => {
  let s = `vec2 ${name}(float x){\n  if (x <= ${f4(P[0][0])}) return vec2(${f4(P[0][1])}, -1.0);\n`;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i];
    const b = P[i + 1];
    s += `  if (x < ${f4(b[0])}) return herm(x, ${f4(a[0])}, ${f4(b[0])}, vec2(${f4(a[1])}, ${f6(a[2])}), vec2(${f4(b[1])}, ${f6(b[2])}), vec2(${f4(M[i][0])}, ${f6(M[i][1])}), vec2(${f4(M[i + 1][0])}, ${f6(M[i + 1][1])}));\n`;
  }
  return s + `  return vec2(${f4(P[P.length - 1][1])}, -1.0);\n}`;
};
/** The same spline in JS, to sit the eye on the head. */
const profJS = (P: Row[], M: number[][], x: number) => {
  if (x <= P[0][0] || x >= P[P.length - 1][0]) return [0, -1];
  let i = 0;
  while (x >= P[i + 1][0]) i++;
  const a = P[i];
  const b = P[i + 1];
  const dx = b[0] - a[0];
  const t = (x - a[0]) / dx;
  const t2 = t * t;
  const t3 = t2 * t;
  return [1, 2].map(
    (k) =>
      (2 * t3 - 3 * t2 + 1) * a[k] +
      (t3 - 2 * t2 + t) * dx * M[i][k - 1] +
      (-2 * t3 + 3 * t2) * b[k] +
      (t3 - t2) * dx * M[i + 1][k - 1]
  );
};

/** Narrower side to side than it is tall. */
const ZS = 0.75;
const EYE_XY = [-0.65, 0.19];
/** The eye sits on the glass surface: an elliptical cross-section at its x. */
const EYE_Z = (() => {
  const [c, h2] = profJS(BODY, BODY_M, EYE_XY[0]);
  const h = Math.sqrt(Math.max(h2, 0));
  const dy = EYE_XY[1] - c;
  return ZS * Math.sqrt(Math.max(h * h - dy * dy, 0)) - 0.004;
})();

const glassFragment = /* glsl */ `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix;
uniform float uTime; uniform float uPx;
varying vec3 vPos;
varying vec3 vCam;
${raymarchConstants(CY, MIN, MAX)}
const float ZS = ${f4(ZS)};
const vec3 EYE = vec3(${f4(EYE_XY[0])}, ${f4(EYE_XY[1])}, ${f4(EYE_Z)});
const float BX0 = ${f4(BODY[0][0])}, BX1 = ${f4(BODY[BODY.length - 1][0])};
const float WX0 = ${f4(WING[0][0])}, WX1 = ${f4(WING[WING.length - 1][0])};
const vec3 GOLD = vec3(1.0, 0.70, 0.22);

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

// cubic Hermite piece of a traced outline
vec2 herm(float x, float x0, float x1, vec2 p0, vec2 p1, vec2 m0, vec2 m1){
  float dx = x1 - x0, t = (x - x0) / dx, t2 = t * t, t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * p0 + (t3 - 2.0 * t2 + t) * dx * m0 + (-2.0 * t3 + 3.0 * t2) * p1 + (t3 - t2) * dx * m1;
}
${profGLSL('bodyProf', BODY, BODY_M)}
${profGLSL('wingProf', WING, WING_M)}

// the wing on the side of the body: x = distance to its outline (< 0 inside), y = height across it
// from -1 at the bottom edge to 1 at the top
vec2 wingInfo(vec2 p){
  vec2 w = wingProf(p.x);
  float h = sqrt(max(w.y, 0.0));
  float h2 = sqrt(max(wingProf(p.x + 0.003).y, 0.0));
  float dh = clamp((h2 - h) / 0.003, -4.0, 4.0);
  float d = (abs(p.y - w.x) - h) / sqrt(1.0 + dh * dh);
  float xo = max(WX0 - p.x, p.x - WX1);
  if (xo > 0.0) d = length(vec2(xo, p.y - w.x));
  return vec2(d, (p.y - w.x) / max(h, 1e-4));
}
// the silver glitter painted on the wing, in clean smooth lines: its outline, a curved row across the
// shoulder, and three long flight-feather lines running back and meeting at the tip
float wingLines(vec2 p, vec2 wi){
  float m = 1.0 - smoothstep(0.007, 0.011, abs(wi.x));
  if (wi.x < 0.0) {
    float h = sqrt(max(wingProf(p.x).y, 0.0));
    float v = wi.y;
    float r = length(vec2((p.x - WX0) / 0.13, v));
    m = max(m, 1.0 - smoothstep(0.006, 0.010, abs(r - 1.0) * min(0.13, h)));
    float lines = min(abs(v - 0.45), min(abs(v + 0.05), abs(v + 0.55))) * h;
    float fade = smoothstep(WX1 - 0.02, WX1 - 0.10, p.x);
    m = max(m, step(1.0, r) * fade * (1.0 - smoothstep(0.005, 0.009, lines)));
  }
  return m;
}
// what the mirror-gold glass sees: dark green branches below, a warm pale wall above, broken up
// by the shadowy shapes of the branches and candles around it
vec3 envC(vec3 R){
  float n = vnoise(R * 1.5 + vec3(3.1, 0.7, 5.3)) * 0.8 + vnoise(R * 3.2) * 0.2;
  vec3 below = mix(vec3(0.03, 0.08, 0.03), vec3(0.14, 0.24, 0.08), n);
  vec3 above = mix(vec3(0.42, 0.35, 0.24), vec3(1.0, 0.90, 0.70), smoothstep(0.3, 0.65, n));
  vec3 c = mix(below, above, smoothstep(-0.6, -0.05, R.y + 0.2 * (n - 0.5)));
  c *= mix(0.25, 1.0, smoothstep(0.28, 0.5, vnoise(R * 2.0 + 11.0)));
  return c;
}

// the glass: an elliptical cross-section at every x, swept along the traced outline
float bodySD(vec3 p){
  vec2 b = bodyProf(p.x), b2 = bodyProf(p.x + 0.003);
  float h = sqrt(max(b.y, 0.0)), h2 = sqrt(max(b2.y, 0.0));
  float dh = clamp((h2 - h) / 0.003, -4.0, 4.0), dc = (b2.x - b.x) / 0.003;
  float rr = length(vec2(p.y - b.x, p.z / ZS));
  float d = (rr - h) / sqrt(1.0 + dh * dh + dc * dc);
  float xo = max(BX0 - p.x, p.x - BX1);
  if (xo > 0.0) d = length(vec2(xo, rr));
  return d * ZS;
}
float plate(vec3 p, vec2 a, vec2 b){
  vec2 pa = p.xy - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return max(length(pa - ba * h) - 0.006, abs(p.z) - 0.04);
}
// gold spring under the belly and the two jaws of the clip, as on the swan
float metalSD(vec3 p){
  p -= vec3(-0.01, 0.0, 0.0);
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

// mat: 1 glass, 2 beak, 3 eye, 5 metal
float map(vec3 p, out float mat){
  vec3 q = vec3(p.xy, abs(p.z));
  float wm = p.x > WX0 - 0.02 && p.x < WX1 + 0.02 ? smoothstep(0.01, -0.01, wingInfo(p.xy).x) * smoothstep(0.03, 0.10, q.z) : 0.0;
  float d = bodySD(p) - 0.005 * wm;   // the wing is a raised plate
  mat = 1.0;
  // long, straight, level beak
  float bk = sdTaper(p, vec3(-0.74, 0.14, 0.0), vec3(-0.95, 0.136, 0.0), 0.055, 0.006);
  if (bk < d) mat = 2.0;
  d = smin(d, bk, 0.02);
  // small black bead eye
  float eye = sdEll(q - EYE, vec3(0.026, 0.026, 0.016));
  if (eye < d) mat = 3.0;
  d = min(d, eye);
  // the clip only reaches up to the belly
  if (p.y < -0.15) {
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

void main(){
  // march from where the view ray enters the box (bird units) to where it leaves it
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
  vec3 nV = normalize(normalMatrix * nO);

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
  vec3 L2 = normalize(vec3(0.7, 0.15, 0.7));
  float ao = 0.0, sc2 = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.012 + 0.04 * float(i);
    ao += (h - sdf(p + nO * h)) * sc2; sc2 *= 0.65;
  }
  ao = clamp(1.0 - 1.8 * ao, 0.3, 1.0);
  float diff = max(dot(nV, L) * 0.8 + 0.2, 0.0);
  float hemi = 0.32 + 0.18 * nV.y;

  vec3 alb = vec3(0.0), gC = vec3(0.86, 0.88, 0.92), col = vec3(0.0);
  float glit = 0.0, gloss = 0.5, sharp = 60.0;
  bool lit = true;
  if (mat < 1.5) {
    // mirror-gold glass: the room tinted gold, with sharp bright glints where the lights catch it
    vec3 R = reflect(-V, nV);
    col = GOLD * envC(R) * mix(0.5, 1.0, ao);
    col += vec3(1.0, 0.94, 0.78) * (pow(max(dot(R, L), 0.0), 120.0) * 2.4 + pow(max(dot(R, L2), 0.0), 120.0) * 1.3
                                   + pow(max(dot(R, L), 0.0), 12.0) * 0.12) * ao;
    lit = false;
    float side = smoothstep(0.03, 0.10, q.z);
    glit = wingLines(p.xy, wingInfo(p.xy)) * side;
    alb = GOLD * 0.25;
  } else if (mat < 2.5) {
    alb = vec3(0.34, 0.35, 0.37); glit = 0.95; gloss = 0.6;   // beak rolled in silver glitter
  } else if (mat < 3.5) {
    alb = vec3(0.004, 0.003, 0.003); gloss = 2.4; sharp = 300.0;   // glossy black glass bead
  } else {
    // polished gold wire and clip
    vec3 R = reflect(-V, nV);
    col = mix(vec3(0.10, 0.06, 0.012), vec3(0.95, 0.74, 0.34), smoothstep(-0.25, 0.85, R.y)) * mix(0.55, 1.0, ao)
        + vec3(1.0, 0.9, 0.7) * (pow(max(dot(R, L), 0.0), 50.0) * 1.3 + pow(max(dot(R, L2), 0.0), 50.0) * 0.6);
    lit = false;
  }

  if (lit) {
    col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
    float nh = max(dot(nV, normalize(L + V)), 0.0), nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
    col += gloss * ao * vec3(1.0, 0.97, 0.95) * (pow(nh, sharp) * 0.6 + pow(nh, 10.0) * 0.06 + pow(nh2, sharp) * 0.25);
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
    vec3 tint = mix(vec3(1.0), 0.5 + 0.5 * cos(6.283 * (h2 * 2.0 + vec3(0.0, 0.33, 0.67))), step(0.75, h2) * 0.5);
    vec3 gcol = gC * (0.30 + 0.75 * diff + hemi * 0.4) * (0.55 + 0.6 * h) * mix(vec3(1.0), tint, 0.4)
              + vec3(1.3, 1.3, 1.2) * tint * sp * tw;
    col = mix(col, gcol, glit * step(0.15, hash(g + 2.1)) * (0.8 + 0.2 * h) * mix(0.6, 1.0, ao));
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

/**
 * The tail: a big soft cloud of white marabou billowing out behind the bird,
 * about as long again as the bird, with a few long fine wisps straying out
 * past it. Returns interleaved line vertices.
 */
function tail() {
  const rnd = seeded(41);
  const T0: V3 = [0.63, 0.04, 0];
  const WHITE: V3[] = [
    [0.64, 0.64, 0.62],
    [0.56, 0.56, 0.56],
    [0.7, 0.69, 0.66],
  ];
  const rndUnit = () => norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
  type Feather = {
    th: number;
    ph: number;
    L: number;
    nb: number;
    size: number;
    al: number;
    fluff: number;
    curl: number;
    droop: number;
    a: number;
  };
  const feathers: Feather[] = [];
  for (let i = 0; i < 64; i++) {
    const th = -0.42 + (0.8 * (i + rnd())) / 64;
    feathers.push({
      th,
      ph: (rnd() - 0.5) * 1.1,
      L: (0.9 + 0.4 * rnd()) * (0.8 + 0.3 * Math.exp(-((th / 0.3) ** 2))),
      nb: 280,
      size: 1.15,
      al: 0.65,
      fluff: 0.5,
      curl: 0.4,
      droop: 0.06,
      a: 0.42,
    });
  }
  // long wisps: few barbs lying close along the shaft
  for (let i = 0; i < 26; i++)
    feathers.push({
      th: -0.5 + 1.0 * rnd(),
      ph: (rnd() - 0.5) * 1.2,
      L: 1.2 + 0.4 * rnd(),
      nb: 50,
      size: 0.55,
      al: 0.22,
      fluff: 0.15,
      curl: 0.3,
      droop: 0.08,
      a: 0.5,
    });
  // short fluff round the base, hiding where the tail is tucked into the glass
  for (let i = 0; i < 14; i++)
    feathers.push({
      th: -1.3 + 2.8 * rnd(),
      ph: (rnd() - 0.5) * 1.6,
      L: 0.18 + 0.16 * rnd(),
      nb: 90,
      size: 0.85,
      al: 0.65,
      fluff: 0.5,
      curl: 0.5,
      droop: 0.04,
      a: 0.42,
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
    const base = WHITE[Math.floor(rnd() * 3)];
    const curl = (rnd() - 0.5) * f.curl;
    const curlZ = (rnd() - 0.5) * 0.3;
    const aoF = f.ph < 0 ? 0.74 : 1.0;
    const pts: V3[] = [
      [T0[0] + (rnd() - 0.5) * 0.06, T0[1] + (rnd() - 0.5) * 0.07, (rnd() - 0.5) * 0.08],
    ];
    const tans: V3[] = [];
    const step = f.L / RSEG;
    for (let k = 1; k <= RSEG; k++) {
      const s = k / RSEG;
      const th = f.th + curl * s;
      const ph = f.ph + curlZ * s;
      const d = norm([
        Math.cos(th) * Math.cos(ph),
        Math.sin(th) * Math.cos(ph) - f.droop * s,
        Math.sin(ph),
      ]);
      const q = pts[k - 1];
      tans.push(d);
      pts.push([q[0] + d[0] * step, q[1] + d[1] * step, q[2] + d[2] * step]);
    }
    // shaft
    const shaft = base.map((v) => v * 0.85) as V3;
    for (let k = 0; k < RSEG; k++) {
      put(pts[k], tans[k], shaft, 0.3 - (0.15 * k) / RSEG, k / RSEG, 0, phase, 0.7 * aoF);
      put(
        pts[k + 1],
        tans[k],
        shaft,
        0.3 - (0.15 * (k + 1)) / RSEG,
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
      const al = f.al * (0.75 + 1.2 * rnd());
      const spin = (rnd() - 0.5) * 1.2 * f.fluff * 2;
      let d = norm(
        [0, 1, 2].map(
          (k) =>
            t[k] * Math.cos(al) + (n1[k] * Math.cos(psi) + n2[k] * Math.sin(psi)) * Math.sin(al)
        ) as V3
      );
      const lb =
        (0.2 + 0.24 * rnd()) *
        sstep(0, 0.1, s) *
        (1 - 0.4 * s * s) *
        Math.min(1.3, Math.max(0.6, f.L / 1.1)) *
        f.size;
      const tint = 0.8 + 0.4 * rnd();
      const c = base.map((v) => v * tint) as V3;
      const aoS = (0.6 + 0.4 * sstep(0, 0.35, s)) * aoF;
      const sl = lb / BSEG;
      for (let k = 0; k < BSEG; k++) {
        const ru = rndUnit();
        const tw = cross(t, d);
        d = norm(
          [0, 1, 2].map(
            (i) => d[i] + t[i] * 0.08 + tw[i] * spin + ru[i] * f.fluff - (i === 1 ? 0.04 : 0)
          ) as V3
        );
        const q: V3 = [p[0] + d[0] * sl, p[1] + d[1] * sl, p[2] + d[2] * sl];
        const b0 = k / BSEG;
        const b1 = (k + 1) / BSEG;
        put(p, d, c, f.a - 0.25 * b0, s, b0, phase, aoS * (0.55 + 0.45 * b0));
        put(q, d, c, f.a - 0.25 * b1, s, b1, phase, aoS * (0.55 + 0.45 * b1));
        // a wisp of barbule fuzz off this bit of barb
        const m = rnd();
        const ru2 = rndUnit();
        const r0: V3 = [p[0] + d[0] * sl * m, p[1] + d[1] * sl * m, p[2] + d[2] * sl * m];
        const bd = norm([0, 1, 2].map((i) => d[i] * 0.6 + ru2[i]) as V3);
        const bl = 0.014 + 0.026 * rnd();
        const bm = (k + m) / BSEG;
        put(r0, bd, c, 0.26, s, bm, phase, aoS * (0.6 + 0.4 * bm));
        put(
          [r0[0] + bd[0] * bl, r0[1] + bd[1] * bl, r0[2] + bd[2] * bl],
          bd,
          c,
          0.1,
          s,
          bm,
          phase,
          aoS * (0.6 + 0.4 * bm)
        );
        p = q;
      }
    }
  }

  // Keep the tail the size it was in the artifact, where it was shrunk about its root to fit
  // a canvas spanning x up to 2.24 and y from -0.70 to 0.54 at any tilt.
  const out = data.subarray(0, n);
  fitFibres(out, T0, PIV, [-0.45, 0, 0.5], 2.184, -0.65, 0.49);
  return out;
}

/**
 * The golden songbird: a group whose origin sits at bird point (PIV, CY),
 * scaled by the ornament's `r`. `setGust` sets how hard the tail is being
 * blown, 0 to 1.
 */
export function goldbirdFigure(reduced: boolean) {
  const glass = raymarchedMesh(glassFragment, CY, MIN, MAX);
  glass.mesh.position.x = -PIV;

  const tailLines = marabouLines(tail(), {
    reduced,
    spec: [0.2, 0.196, 0.19],
    tunedPx: TUNED_PX,
    barbs: BARBS,
  });
  const fibres = tailLines.lines;
  fibres.position.set(-PIV, -CY, 0);

  const object = new THREE.Group();
  object.add(glass.mesh, fibres);
  return {
    object,
    rest: GOLDBIRD_REST,
    tilt: GOLDBIRD_TILT,
    setGust: tailLines.setGust,
    dispose: () => {
      glass.dispose();
      tailLines.dispose();
    },
  };
}
