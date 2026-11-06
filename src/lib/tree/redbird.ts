import * as THREE from 'three';
import { STRIDE, cross, fitFibres, marabouLines, norm, seeded, sstep, type V3 } from './marabou';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The ruby songbird: a clip-on glass bird of matte raspberry satin glass
 * moulded with feather grooves, a gold glitter beak, a black bead eye, raised
 * fish scales on the wing outlined in gold glitter with a dark dot in each,
 * thin gold legs into a clip, and a tail of a wine-red marabou tuft over long
 * black vaned feathers.
 *
 * Built like the golden songbird: the glass is raymarched inside a box and the
 * tail is fine fibres drawn as GL lines that sway in the vertex shader.
 *
 * Bird units: y up, facing -x, +z towards the viewer, beak tip to the end of
 * the glass tail about 2.2. The figure is scaled by the ornament's `r`, so one
 * bird unit is `r` tree units. It clips onto a branch, so it hangs from no
 * string and wears no cap.
 */

/** The figure's origin in bird units: the x it tilts about, at mid height. */
const PIV = 0.12;
const CY = -0.415;

/** The tilt it rests at, and how far either side of it it can be turned, in radians. */
export const REDBIRD_REST = 0.15;
export const REDBIRD_TILT: [number, number] = [-0.45 - REDBIRD_REST, 0.5 - REDBIRD_REST];

/** The box the glass, legs and clip fit inside, in bird units. */
const MIN = new THREE.Vector3(-1.08, -1.08, -0.33);
const MAX = new THREE.Vector3(1.16, 0.25, 0.33);

/** The share of the artifact's barbs drawn: the bird is far smaller on the tree. */
const BARBS = 0.35;
/** CSS px per bird unit in the artifact the tail was tuned in. */
const TUNED_PX = 115;

const f4 = (v: number) => v.toFixed(4);
const f6 = (v: number) => v.toFixed(6);

// Outlines traced on a grid over the level side-on photo, in photo pixels: [x, top edge y, bottom
// edge y]. 1 unit = 276 px; the beak tip (photo x 152) sits at x = -1.03 and photo y 200 at y = 0.
// Each outline becomes a smooth spline of its centre line and its half height squared (squared, so
// both ends close round instead of coming to a point).
type Row = [number, number, number];
const toUnits = ([px, top, bot]: Row): Row => [
  (px - 152) / 276 - 1.03,
  (200 - (top + bot) / 2) / 276,
  ((bot - top) / 2 / 276) ** 2,
];
// A big round head runs straight into a full chest with no neck; the back falls gently from the
// crown and runs level to a thick, blunt tail tube; the belly is one deep curve, lowest by the legs.
const BODY = (
  [
    [196, 212, 212],
    [203, 191, 234],
    [212, 180, 248],
    [225, 170, 266],
    [245, 163, 288],
    [265, 160, 305],
    [290, 162, 325],
    [320, 170, 352],
    [360, 181, 375],
    [410, 190, 389],
    [455, 195, 393],
    [505, 199, 388],
    [555, 202, 371],
    [605, 204, 335],
    [645, 205, 298],
    [680, 205, 271],
    [715, 205, 249],
    [735, 206, 241],
    [748, 214, 233],
    [753, 223, 223],
  ] as Row[]
).map(toUnits);
// the wing: a round front low on the shoulder, a top edge just under the back, out to a point at the back
const WING = (
  [
    [385, 262, 262],
    [392, 230, 296],
    [410, 212, 316],
    [440, 205, 326],
    [480, 205, 328],
    [520, 206, 322],
    [555, 207, 306],
    [585, 209, 278],
    [605, 210, 245],
    [617, 214, 214],
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

/** A little narrower side to side than it is deep. */
const ZS = 0.8;
const EYE_XY = [-0.617, 0.0];
/** The eye sits on the glass surface: an elliptical cross-section at its x. */
const EYE_Z = (() => {
  const [c, h2] = profJS(BODY, BODY_M, EYE_XY[0]);
  const h = Math.sqrt(Math.max(h2, 0));
  const dy = EYE_XY[1] - c;
  return ZS * Math.sqrt(Math.max(h * h - dy * dy, 0)) - 0.01;
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
const vec2 WC = vec2(0.0, -0.18);   // origin of the wing's scale grid
const vec2 SA = vec2(0.35, -0.937); // the scales' round edges point down and a little back
const vec2 SB = vec2(0.937, 0.35);
const float SCA = 0.19, SCB = 0.155;   // the scale grid: open loops, about four along and three or four down
const vec3 GOLD = vec3(1.0, 0.70, 0.26);

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

// ---- the wing: a teardrop high on the side, round at the front, its top edge just under the line
// of the back, drawn out to a point towards the tail ----
vec2 wingUV(vec2 p){ return p - WC; }
// roughly the distance to the wing outline, < 0 inside
float wingDP(vec2 p){
  vec2 w = wingProf(p.x);
  float h = sqrt(max(w.y, 0.0));
  float h2 = sqrt(max(wingProf(p.x + 0.003).y, 0.0));
  float dh = clamp((h2 - h) / 0.003, -4.0, 4.0);
  float d = (abs(p.y - w.x) - h) / sqrt(1.0 + dh * dh);
  float xo = max(WX0 - p.x, p.x - WX1);
  if (xo > 0.0) d = length(vec2(xo, p.y - w.x));
  return d;
}
float wingD(vec2 w){ return wingDP(w + WC); }
// Overlapping fish scales: rows running along the body, each row half a scale along from the one
// above and tucked under it, so every scale shows a round lower edge. Only scales centred inside
// the leaf exist, which gives the wing its scalloped lower edge.
// x = how far inside the visible scale's rim, y = distance out to its dot (1 on the dot's edge), z = 1 on a scale.
vec3 scales(vec2 w){
  vec2 g = vec2(dot(w, SA) / SCA, dot(w, SB) / SCB);
  const float R = 0.56;
  float i0 = floor(g.x / 0.5);
  for (int k = -2; k <= 1; k++) {        // the row nearest the back lies on top
    float i = i0 + float(k);
    float off = 0.5 * mod(i, 2.0);
    float j0 = floor(g.y - off + 0.5) + off;
    float best = 9.0; vec2 bd = vec2(0.0);
    for (int m = -1; m <= 1; m++) {
      vec2 c = vec2(i * 0.5, j0 + float(m));
      vec2 d = g - c;
      float r = length(d);
      vec2 cw = SA * (c.x * SCA) + SB * (c.y * SCB);
      if (r < R && r < best && wingD(cw) < -0.022) { best = r; bd = d; }
    }
    if (best < R) {
      vec2 e = (bd - vec2(0.18, 0.0)) / vec2(0.11, 0.24);
      return vec3(R - best, length(e), 1.0);
    }
  }
  return vec3(0.0, 9.0, 0.0);
}
// the moulding, as a height field over the side of the bird: each wing scale domed and dropping at
// its rim, and feather grooves along the chest and belly
float relief(vec2 p, out float wing){
  vec2 w = wingUV(p);
  vec3 sc = scales(w);
  wing = 1.0 - smoothstep(-0.004, 0.004, wingD(w));
  float hs = smoothstep(0.0, 0.07, sc.x);
  // grooves parallel to the belly line, broken into long feather strokes
  vec2 bp = bodyProf(p.x);
  float yb = bp.x - sqrt(max(bp.y, 0.0)) + 0.02;
  float ph = (p.y - yb) / 0.07;
  float row = floor(ph);
  ph += 0.12 * sin(p.x * 6.0 + row * 1.7);
  float stroke = smoothstep(0.15, 0.55, 0.5 + 0.5 * sin(p.x * 7.0 + row * 2.1));
  float groove = (0.5 + 0.5 * cos(6.2832 * ph)) * stroke
               * smoothstep(-0.4, 0.4, ph) * (1.0 - smoothstep(3.5, 5.0, ph)) * smoothstep(-0.78, -0.55, p.x) * (1.0 - smoothstep(0.75, 0.95, p.x));
  return 0.0025 * hs * sc.z * wing + 0.0035 * groove * (1.0 - wing);
}

// the glass: an elliptical cross-section at every x, swept along the traced outline
float glassSD(vec3 p){
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
  return max(length(pa - ba * h) - 0.006, abs(p.z) - 0.045);
}
// two thin gold legs straight down from the belly into the clip, its jaws hinged at the front
float metalSD(vec3 p){
  float legs = min(sdCap(p, vec3(0.09, -0.6, 0.0), vec3(0.09, -0.98, 0.0), 0.012),
                   sdCap(p, vec3(0.19, -0.6, 0.0), vec3(0.19, -0.98, 0.0), 0.012));
  float j1 = plate(p, vec2(-0.22, -0.98), vec2(0.28, -0.99)) - 0.006;
  float j2 = plate(p, vec2(-0.22, -1.04), vec2(0.28, -1.015)) - 0.006;
  float back = plate(p, vec2(-0.22, -0.98), vec2(-0.22, -1.04));
  float hinge = sdCap(p, vec3(-0.22, -1.01, -0.05), vec3(-0.22, -1.01, 0.05), 0.014);
  return min(min(legs, hinge), min(min(j1, j2), back));
}

// mat: 1 glass, 2 beak, 3 eye, 5 metal
float map(vec3 p, out float mat){
  vec3 q = vec3(p.xy, abs(p.z));
  float d = glassSD(p);
  mat = 1.0;
  // short, thick cone of a beak, level with the eye
  float bk = sdTaper(p, vec3(-0.80, -0.03, 0.0), vec3(-1.03, -0.018, 0.0), 0.068, 0.008);
  if (bk < d) mat = 2.0;
  d = smin(d, bk, 0.02);
  // round black glass bead eye
  float eye = sdEll(q - EYE, vec3(0.042, 0.042, 0.03));
  if (eye < d) mat = 3.0;
  d = min(d, eye);
  // the legs and clip only reach up to the belly
  if (p.y < -0.5) {
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

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
  vec3 L2 = normalize(vec3(0.7, 0.15, 0.7));
  float ao = 0.0, sc2 = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.012 + 0.04 * float(i);
    ao += (h - sdf(p + nO * h)) * sc2; sc2 *= 0.65;
  }
  ao = clamp(1.0 - 1.8 * ao, 0.3, 1.0);

  vec3 alb = vec3(0.0), gC = GOLD, col = vec3(0.0);
  float glit = 0.0, gloss = 0.5, sharp = 60.0, satin = 0.0;
  bool lit = true;
  if (mat < 1.5) {
    // matte raspberry satin glass, a shade deeper underneath
    float side = smoothstep(0.02, 0.12, abs(p.z));
    alb = mix(vec3(0.21, 0.008, 0.028), vec3(0.12, 0.004, 0.016), smoothstep(0.1, -0.5, p.y));
    alb *= 0.93 + 0.14 * vnoise(p * vec3(5.0, 7.0, 5.0));
    gloss = 0.35; sharp = 30.0; satin = 1.0;
    // the moulding tilts the surface: scales on the wing, feather grooves round the belly
    float wing, wx, wy;
    const float E = 0.004;
    relief(p.xy, wing);
    vec2 g = vec2(relief(p.xy + vec2(E, 0.0), wx) - relief(p.xy - vec2(E, 0.0), wx),
                  relief(p.xy + vec2(0.0, E), wy) - relief(p.xy - vec2(0.0, E), wy)) / (2.0 * E);
    nO = normalize(nO - side * vec3(g, 0.0));
    wing *= side;
    // a pale pink painted ring round the eye
    float er = length(p.xy - EYE.xy);
    float side2 = smoothstep(0.03, 0.08, abs(p.z));
    alb = mix(alb, vec3(0.42, 0.06, 0.11), (1.0 - smoothstep(0.065, 0.095, er)) * side2 * 0.85);
    alb = mix(alb, vec3(0.70, 0.36, 0.40), (1.0 - smoothstep(0.05, 0.064, er)) * side2 * 0.9);
    if (wing > 0.0) {
      vec2 w = wingUV(p.xy);
      vec3 sc = scales(w);
      // gold glitter round every scale and all round the wing's outline, a dark painted dot in each scale
      float rim = 1.0 - smoothstep(0.065, 0.09, sc.x);
      float top = 1.0 - smoothstep(0.010, 0.016, -wingD(w));
      float spot = (1.0 - smoothstep(0.85, 1.1, sc.y)) * sc.z;
      alb *= mix(1.0, mix(0.75, 0.5, sc.z), wing);   // the loops are darker inside
      alb = mix(alb, vec3(0.012, 0.002, 0.005), spot * wing);
      glit = max(rim * sc.z, top) * wing;
    }
  } else if (mat < 2.5) {
    alb = vec3(0.30, 0.17, 0.03); glit = 1.0; gloss = 0.6;   // beak rolled in gold glitter, in fine ridges
    nO = normalize(nO + 0.25 * vec3(0.0, sin(p.x * 160.0), 0.0) * smoothstep(-1.0, -0.85, p.x));
  } else if (mat < 3.5) {
    alb = vec3(0.004, 0.003, 0.003); gloss = 2.4; sharp = 300.0;   // glossy black glass bead
  }
  vec3 nV = normalize(normalMatrix * nO);
  float diff = max(dot(nV, L) * 0.8 + 0.2, 0.0);
  float hemi = 0.32 + 0.18 * nV.y;

  if (mat > 4.5) {
    // polished gold wire and clip
    vec3 R = reflect(-V, nV);
    col = mix(vec3(0.10, 0.06, 0.012), vec3(0.95, 0.74, 0.34), smoothstep(-0.25, 0.85, R.y)) * mix(0.55, 1.0, ao)
        + vec3(1.0, 0.9, 0.7) * (pow(max(dot(R, L), 0.0), 50.0) * 1.3 + pow(max(dot(R, L2), 0.0), 50.0) * 0.6);
    lit = false;
  }

  if (lit) {
    col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
    float nh = max(dot(nV, normalize(L + V)), 0.0), nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
    col += gloss * ao * vec3(1.0, 0.97, 0.95) * (pow(nh, sharp) * 0.6 + pow(nh2, sharp) * 0.25);
    // satin: a broad pink sheen where the light catches the glass, and a glow at the rim
    float fres = pow(1.0 - max(nV.z, 0.0), 2.5);
    col += satin * ao * (alb * 3.2 + vec3(0.05, 0.01, 0.03)) * (pow(nh, 5.0) * 0.45 + pow(nh2, 6.0) * 0.15);
    col += satin * ao * (alb * 2.0 + vec3(0.06, 0.01, 0.03)) * fres * 0.4;
  }

  if (glit > 0.01) {
    vec3 g = floor(p * 260.0);
    float h = hash(g);
    vec3 gV = normalize(normalMatrix * normalize(nO + (hash3(g) - 0.5) * 1.3));
    float tw = 0.55 + 0.45 * sin(uTime * 2.4 + h * 60.0);
    // each grain is a tiny tilted mirror: it flashes when it faces a light, and a few always glint
    float sp = 2.0 * pow(max(dot(reflect(-L, gV), V), 0.0), 16.0) * step(0.4, h)
             + 1.2 * pow(max(dot(reflect(-L2, gV), V), 0.0), 20.0) * step(0.55, h)
             + 0.6 * step(0.92, h);
    vec3 gcol = gC * (0.35 + 0.75 * diff + hemi * 0.4) * (0.55 + 0.6 * h)
              + mix(vec3(1.3, 1.25, 1.1), gC * 1.6 + 0.3, 0.5) * sp * tw;
    col = mix(col, gcol, glit * (0.85 + 0.15 * h) * mix(0.6, 1.0, ao));
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

const lerp = (a: V3, b: V3, f: number): V3 => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
];
const along = (p: V3, d: V3, l: number): V3 => [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l];

type Feather = {
  th: number;
  ph: number;
  L: number;
  nb: number;
  curl: number;
  droop: number;
  /** Long black feathers with flat vanes, `W` wide; the rest are marabou. */
  vane?: { W: number };
  size?: number;
  al?: number;
  fluff?: number;
};

/**
 * The tail, as in the photos: a dense tuft of wine-red marabou carrying
 * straight on from the glass tail tube, tipped up a little, and under it long
 * black feathers with real vanes, fanned out backwards and down, about as long
 * as the bird. Returns interleaved line vertices.
 */
function tail() {
  const rnd = seeded(43);
  // the glass tail tube ends where the feathers come out
  const T0: V3 = [BODY[BODY.length - 1][0] - 0.09, BODY[BODY.length - 1][1], 0];
  const RED: V3[] = [
    [0.14, 0.006, 0.012],
    [0.1, 0.004, 0.009],
    [0.18, 0.01, 0.016],
  ];
  const BLACK: V3[] = [
    [0.01, 0.009, 0.011],
    [0.016, 0.013, 0.016],
    [0.006, 0.005, 0.007],
  ];
  const rndUnit = () => norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
  const feathers: Feather[] = [];
  for (let i = 0; i < 30; i++)
    feathers.push({
      th: -0.42 + (0.32 * (i + rnd())) / 30,
      ph: (rnd() - 0.65) * 0.7,
      L: 1.5 + 0.6 * rnd(),
      vane: { W: 0.11 + 0.06 * rnd() },
      nb: 700,
      curl: 0.2,
      droop: 0.06,
    });
  // a slim tuft running back and a little up along the line of the back, ragged at the end
  for (let i = 0; i < 46; i++) {
    const th = (0.3 * (i + rnd())) / 46;
    feathers.push({
      th,
      ph: (rnd() - 0.4) * 0.8,
      L: (0.6 + 0.35 * rnd()) * (0.8 + 0.3 * Math.exp(-(((th - 0.15) / 0.12) ** 2))),
      nb: 240,
      size: 0.75,
      al: 0.55,
      fluff: 0.5,
      curl: 0.4,
      droop: 0,
    });
  }
  // short fluff round the root, hiding where the feathers are tucked into the glass
  for (let i = 0; i < 14; i++)
    feathers.push({
      th: -1.2 + 2.8 * rnd(),
      ph: (rnd() - 0.5) * 1.6,
      L: 0.14 + 0.14 * rnd(),
      nb: 90,
      size: 0.8,
      al: 0.65,
      fluff: 0.5,
      curl: 0.5,
      droop: 0,
    });
  feathers.sort((a, b) => a.ph - b.ph); // back to front
  for (const f of feathers) f.nb = Math.round(f.nb * BARBS);

  const RSEG = 22;
  const BSEG = 6;
  const VSEG = 3;
  const data = new Float32Array(
    feathers.reduce((n, f) => n + RSEG + f.nb * (f.vane ? VSEG : BSEG * 2), 0) * 2 * STRIDE
  );
  let n = 0;
  const put = (p: V3, t: V3, c: V3, a: number, s: number, b: number, ph: number, ao: number) => {
    data.set([...p, ...t, ...c, a, s, b, ph, ao], n);
    n += STRIDE;
  };
  for (const f of feathers) {
    const phase = rnd();
    const base = (f.vane ? BLACK : RED)[Math.floor(rnd() * 3)];
    const curl = (rnd() - 0.5) * f.curl;
    const curlZ = (rnd() - 0.5) * 0.3;
    const aoF = f.ph < 0 ? 0.78 : 1.0;
    const pts: V3[] = [[T0[0] + rnd() * 0.06, T0[1] + (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.06]];
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
      tans.push(d);
      pts.push(along(pts[k - 1], d, step));
    }
    // shaft
    const shaft = base.map((v) => v * 0.85) as V3;
    for (let k = 0; k < RSEG; k++) {
      put(pts[k], tans[k], shaft, 0.45 - (0.25 * k) / RSEG, k / RSEG, 0, phase, 0.7 * aoF);
      put(
        pts[k + 1],
        tans[k],
        shaft,
        0.45 - (0.25 * (k + 1)) / RSEG,
        (k + 1) / RSEG,
        0,
        phase,
        0.7 * aoF
      );
    }
    const at = (s: number) => {
      const fi = s * RSEG;
      const i0 = Math.min(RSEG - 1, Math.floor(fi));
      return { p: lerp(pts[i0], pts[i0 + 1], fi - i0), t: tans[i0] };
    };
    if (f.vane) {
      // a flat vane: straight barbs either side of the shaft, angled towards the tip, widest past
      // the middle and closing to a round tip; the lowest barbs are loose fluff
      const pn = norm([(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7, 1]);
      for (let j = 0; j < f.nb; j++) {
        const s = 0.04 + 0.96 * rnd();
        let { p } = at(s);
        const { t } = at(s);
        const sideV = norm(cross(t, pn));
        const side = j % 2 ? 1 : -1;
        const fluffy = s < 0.16;
        const al = fluffy ? 0.9 + 0.5 * rnd() : 0.62 + 0.12 * rnd();
        const ru0: V3 = fluffy ? rndUnit() : [0, 0, 0];
        let d = norm(
          [0, 1, 2].map(
            (k) => t[k] * Math.cos(al) + side * sideV[k] * Math.sin(al) + ru0[k] * 0.6
          ) as V3
        );
        const prof =
          Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + s * 0.95)), 0.5) * (fluffy ? 1.3 : 1);
        const lb = f.vane.W * prof * (0.9 + 0.2 * rnd());
        const tint = 0.8 + 0.4 * rnd();
        const c = base.map((v) => v * tint) as V3;
        const aoS = (0.7 + 0.3 * sstep(0, 0.3, s)) * aoF;
        const sl = lb / VSEG;
        for (let k = 0; k < VSEG; k++) {
          d = norm(
            [0, 1, 2].map((i) => d[i] + t[i] * 0.06 + (fluffy ? (rnd() - 0.5) * 0.5 : 0)) as V3
          );
          const q = along(p, d, sl);
          const b0 = k / VSEG;
          const b1 = (k + 1) / VSEG;
          put(p, d, c, 0.85 - 0.3 * b0, s, b0 * 0.3, phase, aoS * (0.75 + 0.25 * b0));
          put(q, d, c, 0.85 - 0.3 * b1, s, b1 * 0.3, phase, aoS * (0.75 + 0.25 * b1));
          p = q;
        }
      }
    } else {
      // marabou: long curling barbs all round the shaft, each with a wisp of fuzz
      const size = f.size ?? 1;
      const fluff = f.fluff ?? 0.5;
      for (let j = 0; j < f.nb; j++) {
        const s = 0.03 + 0.97 * rnd();
        let { p } = at(s);
        const { t } = at(s);
        const n1 = norm(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        const n2 = cross(t, n1);
        const psi = rnd() * 6.283;
        const al = (f.al ?? 0.6) * (0.75 + 1.2 * rnd());
        const spin = (rnd() - 0.5) * 1.2 * fluff * 2;
        let d = norm(
          [0, 1, 2].map(
            (k) =>
              t[k] * Math.cos(al) + (n1[k] * Math.cos(psi) + n2[k] * Math.sin(psi)) * Math.sin(al)
          ) as V3
        );
        const lb =
          (0.2 + 0.24 * rnd()) *
          sstep(0, 0.1, s) *
          (1 - 0.55 * s * s) *
          Math.min(1.3, Math.max(0.6, f.L / 1.1)) *
          size;
        const tint = 0.75 + 0.5 * rnd();
        const c = base.map((v) => v * tint) as V3;
        const aoS = (0.62 + 0.38 * sstep(0, 0.35, s)) * aoF;
        const sl = lb / BSEG;
        for (let k = 0; k < BSEG; k++) {
          const ru = rndUnit();
          const tw = cross(t, d);
          d = norm(
            [0, 1, 2].map(
              (i) => d[i] + t[i] * 0.08 + tw[i] * spin + ru[i] * fluff - (i === 1 ? 0.04 : 0)
            ) as V3
          );
          const q = along(p, d, sl);
          const b0 = k / BSEG;
          const b1 = (k + 1) / BSEG;
          put(p, d, c, 0.5 - 0.3 * b0, s, b0, phase, aoS * (0.55 + 0.45 * b0));
          put(q, d, c, 0.5 - 0.3 * b1, s, b1, phase, aoS * (0.55 + 0.45 * b1));
          // a wisp of barbule fuzz off this bit of barb
          const m = rnd();
          const ru2 = rndUnit();
          const r0 = along(p, d, sl * m);
          const bd = norm([0, 1, 2].map((i) => d[i] * 0.6 + ru2[i]) as V3);
          const bl = 0.014 + 0.022 * rnd();
          const bm = (k + m) / BSEG;
          put(r0, bd, c, 0.3, s, bm, phase, aoS * (0.6 + 0.4 * bm));
          put(along(r0, bd, bl), bd, c, 0.12, s, bm, phase, aoS * (0.6 + 0.4 * bm));
          p = q;
        }
      }
    }
  }

  // Keep the tail the size it was in the artifact, where it was shrunk about its root to fit
  // a canvas spanning x up to 3.06 and y from -1.20 to 0.26 at any tilt.
  const out = data.subarray(0, n);
  fitFibres(out, T0, PIV, [-0.45, 0, 0.5], 3.062, -1.2, 0.26);
  return out;
}

/**
 * The ruby songbird: a group whose origin sits at bird point (PIV, CY),
 * scaled by the ornament's `r`. `setGust` sets how hard the tail is being
 * blown, 0 to 1.
 */
export function redbirdFigure(reduced: boolean) {
  const glass = raymarchedMesh(glassFragment, CY, MIN, MAX);
  glass.mesh.position.x = -PIV;

  // the red marabou has a pink sheen; the black feathers only a faint one
  const tailLines = marabouLines(tail(), {
    reduced,
    spec: [0.12, 0.1056, 0.108],
    darkSpec: 0.2,
    tunedPx: TUNED_PX,
    barbs: BARBS,
  });
  const fibres = tailLines.lines;
  fibres.position.set(-PIV, -CY, 0);

  const object = new THREE.Group();
  object.add(glass.mesh, fibres);
  return {
    object,
    rest: REDBIRD_REST,
    tilt: REDBIRD_TILT,
    setGust: tailLines.setGust,
    dispose: () => {
      glass.dispose();
      tailLines.dispose();
    },
  };
}
