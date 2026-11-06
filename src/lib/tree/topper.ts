import * as THREE from 'three';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The snowflake tree topper: a surface of revolution traced from the photo, a
 * long satin white spire rising out of an onion bulb, a frosted sage ball
 * painted with silver glitter snowflakes, and a dark frosted tube with a
 * glitter rim that slides over the tree's tip. A black grosgrain bow is tied
 * round the neck: a band, a knot in front, two flat loops curving back and two
 * notched tails draped down over the ball, the left one printed in white with
 * JACK DANIEL'S. It spins on the tip like the baubles.
 *
 * Topper units: 1 = the ball's radius, the ball's centre at the origin, y up,
 * the bow facing +z. The figure is scaled by the ornament's `r`, so one
 * topper unit is `r` tree units.
 */

const D2R = Math.PI / 180;
const f4 = (v: number) => v.toFixed(4);

// [photo y, radius] in px, measured off the photo row by row: 1 unit = 212 px, the ball's centre
// at photo y 1290. The neck under the bow is hidden in the photo, so it is a guess.
const PROF_PX = [
  [1727, 80],
  [1722, 85.5],
  [1650, 85.5],
  [1641, 82],
  [1522, 82],
  [1502, 87.5],
  [1480, 117.5],
  [1450, 154.5],
  [1400, 184],
  [1350, 205],
  [1290, 212],
  [1240, 207],
  [1180, 182],
  [1130, 135],
  [1095, 80],
  [1070, 68],
  [1045, 86],
  [1015, 101],
  [990, 105],
  [970, 103.5],
  [940, 90],
  [905, 75],
  [850, 58],
  [800, 46],
  [750, 38.5],
  [700, 33.5],
  [600, 27.5],
  [500, 24],
  [400, 22],
  [200, 21],
  [60, 20.5],
  [42, 18.5],
];
const PR = PROF_PX.map(([y, r]) => [(1290 - y) / 212, r / 212]);
const PM = PR.map((_, i) => {
  const a = PR[Math.max(0, i - 1)];
  const b = PR[Math.min(PR.length - 1, i + 1)];
  return (b[1] - a[1]) / (b[0] - a[0]);
});
let profGLSL = `float prof(float y){\n  if (y <= ${f4(PR[0][0])}) return ${f4(PR[0][1])};\n`;
for (let i = 0; i < PR.length - 1; i++) {
  const a = PR[i];
  const b = PR[i + 1];
  profGLSL += `  if (y < ${f4(b[0])}) return herm(y, ${f4(a[0])}, ${f4(b[0])}, ${f4(a[1])}, ${f4(b[1])}, ${f4(PM[i])}, ${f4(PM[i + 1])});\n`;
}
profGLSL += `  return ${f4(PR[PR.length - 1][1])};\n}`;
const YB = PR[0][0];
const RB = PR[0][1];
const YT = PR[PR.length - 1][0];
const RT = PR[PR.length - 1][1];

/** How far the bottom of the tube sits below the ball's centre, in topper units. */
export const TOPPER_BASE = -YB;

// The snowflakes: [longitude, latitude, radius] on the ball, more of them up top as in the photo.
const FLAKES = [
  [0, 7, 0.36],
  [10, 33, 0.25],
  [-50, 2, 0.33],
  [50, -10, 0.32],
  [100, 26, 0.3],
  [150, -6, 0.34],
  [200, 30, 0.28],
  [250, 0, 0.34],
  [300, 32, 0.27],
  [-25, -42, 0.24],
  [125, -45, 0.24],
];
const v3 = (a: number[]) => `vec3(${a.map(f4).join(', ')})`;
const flakeGLSL = FLAKES.map(([lo, la, s]) => {
  const l = lo * D2R;
  const b = la * D2R;
  const c = [Math.sin(l) * Math.cos(b), Math.sin(b), Math.cos(l) * Math.cos(b)];
  const e = [Math.cos(l), 0, -Math.sin(l)];
  const n = [-Math.sin(l) * Math.sin(b), Math.cos(b), -Math.cos(l) * Math.sin(b)];
  return `if (dot(n, ${v3(c)}) > 0.8) m = max(m, flake6(vec2(dot(n, ${v3(e)}), dot(n, ${v3(n)})) / ${f4(s)}));`;
}).join('\n  ');

// The left tail is a quadratic curve from the knot down to its notched end. The ribbon's white
// "JACK DANIEL'S" print runs up it, from just above the notch towards the knot, as in the photo.
const TL = [
  [-0.3, 0.95],
  [-0.88, 0.4],
  [-1.3, -0.62],
];
const v2 = (a: number[]) => `vec2(${f4(a[0])}, ${f4(a[1])})`;
const bez = (t: number) =>
  [0, 1].map((k) => (1 - t) * (1 - t) * TL[0][k] + 2 * (1 - t) * t * TL[1][k] + t * t * TL[2][k]);
let TLEN = 0;
for (let i = 1; i <= 64; i++) {
  const a = bez((i - 1) / 64);
  const b = bez(i / 64);
  TLEN += Math.hypot(b[0] - a[0], b[1] - a[1]);
}
/** Capital height in topper units; the ribbon is 0.36 wide. */
const LOGO_CAP = 0.15;
/** Capital height on the lettering's canvas, close to its size on screen so it stays crisp. */
const CAP_PX = 40;

/**
 * The print, white on black: small capitals with a taller J and D, condensed
 * like the label's lettering, and a little ®. Returns the canvas and the
 * lettering box's length and height in topper units.
 */
function paintLogo() {
  const parts: [string, number][] = [
    ['J', 1],
    ['ACK ', 0.8],
    ['D', 1],
    ['ANIEL’S', 0.8],
  ];
  const fontFor = (k: number) =>
    `bold ${Math.round((CAP_PX * k) / 0.66)}px "Times New Roman", Times, Georgia, serif`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let wText = 0;
  for (const [s, k] of parts) {
    ctx.font = fontFor(k);
    wText += ctx.measureText(s).width;
  }
  ctx.font = fontFor(0.4);
  const wReg = ctx.measureText('®').width + 2;
  const sx = Math.min(1, (8.4 * CAP_PX) / (wText + wReg));
  canvas.width = Math.ceil((wText + wReg) * sx) + 8;
  canvas.height = Math.round(CAP_PX * 1.85);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.translate(4, Math.round(CAP_PX * 1.4));
  ctx.scale(sx, 1);
  let x = 0;
  for (const [s, k] of parts) {
    ctx.font = fontFor(k);
    ctx.fillText(s, x, 0);
    x += ctx.measureText(s).width;
  }
  ctx.font = fontFor(0.4);
  ctx.fillText('®', x + 2, -CAP_PX * 0.6);
  return {
    canvas,
    length: (canvas.width / CAP_PX) * LOGO_CAP,
    height: (canvas.height / CAP_PX) * LOGO_CAP,
  };
}

const MIN = new THREE.Vector3(-1.85, YB - 0.02, -1.05);
const MAX = new THREE.Vector3(1.85, YT + 0.03, 1.05);

const fragmentShader = (txl: number, txh: number) => /* glsl */ `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix;
uniform float uTime; uniform float uPx; uniform sampler2D uLogo;
varying vec3 vPos;
varying vec3 vCam;
${raymarchConstants(0, MIN, MAX)}
// the print on the left tail: its length along the tail, where it starts (measured from the knot),
// and its box's length and height
const float TLEN = ${f4(TLEN)}, TXE = ${f4(TLEN - 0.2)}, TXL = ${f4(txl)}, TXH = ${f4(txh)};
const float YB = ${f4(YB)}, RB = ${f4(RB)}, YT = ${f4(YT)}, RT = ${f4(RT)};
const vec3 KNOT = vec3(0.0, 1.0, 0.38);
// the loops: an outer ellipse with a narrow slit of a hole low down in it (centre, radii)
const vec2 LC = vec2(-0.98, 1.30), LR = vec2(0.74, 0.37), LHC = vec2(-0.99, 1.18), LHR = vec2(0.45, 0.07);
const vec2 RC = vec2(0.96, 1.32), RR2 = vec2(0.72, 0.38), RHC = vec2(0.92, 1.20), RHR = vec2(0.37, 0.07);
const vec2 TLA = ${v2(TL[0])}, TLB = ${v2(TL[1])}, TLC = ${v2(TL[2])};   // left tail
const vec2 TRA = vec2(0.22, 0.92), TRB = vec2(0.80, 0.45), TRC = vec2(1.20, -0.45);      // right tail
const float TW = 0.18, ZP = 0.2;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 hash3(vec3 p){ return vec3(hash(p), hash(p + 17.13), hash(p + 31.71)); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sdEll(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float herm(float x, float x0, float x1, float p0, float p1, float m0, float m1){
  float dx = x1 - x0, t = (x - x0) / dx, t2 = t * t, t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * p0 + (t3 - 2.0 * t2 + t) * dx * m0 + (-2.0 * t3 + 3.0 * t2) * p1 + (t3 - t2) * dx * m1;
}
${profGLSL}
float dot2(vec2 v){ return dot(v, v); }
// distance to a quadratic bezier (x) and where along it the nearest point is (y)
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

// a flat ribbon loop: a ring round an ellipse, broad along the top and thin underneath, curving back
// towards its outer end
float sdEll2(vec2 q, vec2 R){ float k0 = length(q / R), k1 = length(q / (R * R)) + 1e-5; return k0 * (k0 - 1.0) / k1; }
// shaped like a teardrop: pinched where it comes out of the knot, its outer end drooping a little
float loopSD(vec3 p, vec2 c, vec2 R, vec2 hc, vec2 hr){
  vec2 q = p.xy - c;
  float s = clamp(q.x * sign(c.x) / R.x, -1.0, 1.0);   // -1 at the knot, 1 at the outer end
  vec2 qs = vec2(q.x, (q.y - 0.24 * min(s, 0.0) + 0.10 * max(s, 0.0) * max(s, 0.0)) / mix(0.4, 1.0, smoothstep(-1.0, 0.3, s)));
  float dr = max(sdEll2(qs, R) * 0.8, -sdEll2(p.xy - hc, hr));
  float zc = 0.52 - 0.26 * max(abs(p.x) - 0.3, 0.0) - 0.08 * max(q.y / R.y, 0.0);   // out in front of the bulb, curving back
  return max(dr, (abs(p.z - zc) - 0.016) * 0.95);
}
// a tail: a strip along a curve, with a notched end, draped over the front of the ball and hanging
// on down in front of it past its outline. dg = distance to the glass
float tailSD(vec3 p, vec2 A, vec2 B, vec2 C, float dg){
  float d2 = sdBez(p.xy, A, B, C).x - TW;
  vec2 T = normalize(C - B), N = vec2(-T.y, T.x), e = p.xy - C;
  d2 = max(d2, dot(e, T) + 0.13 - 0.13 * clamp(abs(dot(e, N)) / TW, 0.0, 1.0));
  float shell = max(abs(dg - 0.03) - 0.013, ZP - p.z);
  float hang = max(abs(p.z - ZP) - 0.013, 0.03 - dg);
  return max(min(shell, hang), d2);
}
// the white print on the left tail (0..1): the text box is laid along the tail's curve, reading up it
// towards the knot with the tops of the letters on the outer edge
float logo(vec2 q){
  float t = sdBez(q, TLA, TLB, TLC).y;
  vec2 P = mix(mix(TLA, TLB, t), mix(TLB, TLC, t), t);
  vec2 T = normalize(mix(TLB - TLA, TLC - TLB, t));
  float a = length(TLB - TLA), c = length(TLC - TLB);
  float s = (a * t + 0.5 * (c - a) * t * t) / (0.5 * (a + c)) * TLEN;   // about how far along from the knot
  vec2 uv = vec2((TXE - s) / TXL, dot(q - P, vec2(T.y, -T.x)) / TXH + 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uLogo, vec2(uv.x, 1.0 - uv.y)).r;
}

// mat: 1 glass, 3 loop, 4 tail, 5 knot and band
float map(vec3 p, out float mat){
  float rr = length(p.xz);
  float r = prof(p.y), r2 = prof(p.y + 0.004);
  float dr = clamp((r2 - r) / 0.004, -6.0, 6.0);
  float d = (rr - r) / sqrt(1.0 + dr * dr);
  float yo = max(YB - p.y, p.y - YT);
  if (yo > 0.0) d = length(vec2(max(rr - (p.y < YB ? RB : RT), 0.0), yo));
  d = min(d, length(p - vec3(0.0, YT, 0.0)) - RT);   // the rounded tip of the spire
  mat = 1.0;
  if (p.y > -0.7 && p.y < 1.8) {
    float dg = d;
    float lp = min(loopSD(p, LC, LR, LHC, LHR), loopSD(p, RC, RR2, RHC, RHR));
    if (lp < d) mat = 3.0;
    d = min(d, lp);
    float tl = min(tailSD(p, TLA, TLB, TLC, dg), tailSD(p, TRA, TRB, TRC, dg));
    if (tl < d) mat = 4.0;
    d = min(d, tl);
    float kn = min(sdEll(p - KNOT, vec3(0.30, 0.19, 0.12)), max(abs(rr - 0.32) - 0.015, abs(p.y - 1.0) - 0.08));
    if (kn < d) mat = 5.0;
    d = min(d, kn);
  }
  return d;
}
float sdf(vec3 p){ float m; return map(p, m); }
vec3 calcN(vec3 p){
  const vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
}

// a six-armed snowflake painted in glitter: each arm a stem with side branches slanting out at 60
// degrees, longest near the centre, and a little ring round the middle. u in units of the flake radius.
float flake6(vec2 u){
  float r = length(u);
  if (r > 1.0) return 0.0;
  const float SEC = 1.0471976;
  float a = atan(u.x, u.y);
  float aa = a - SEC * floor(a / SEC + 0.5);
  vec2 q = r * vec2(sin(aa), cos(aa));
  const float LEN = 0.93;
  float sx = abs(q.x);
  float w = mix(0.07, 0.045, clamp(q.y / LEN, 0.0, 1.0));
  float m = 1.0 - smoothstep(w * 0.5, w, q.y < LEN ? sx : length(vec2(sx, q.y - LEN)));
  const float SB = 0.866, CB = 0.5, SP = 0.2;
  float y0 = q.y - sx * CB / SB;
  float yj = floor(y0 / SP + 0.5) * SP;
  float L = 0.36 * (1.0 - yj / LEN) + 0.06;
  float along = sx / SB;
  float on = step(0.3, yj) * step(yj, LEN - 0.12) * (1.0 - smoothstep(L - 0.04, L, along));
  float bw = mix(0.055, 0.035, clamp(along / L, 0.0, 1.0));
  m = max(m, on * (1.0 - smoothstep(bw * 0.5, bw, abs(y0 - yj) * SB)));
  m = max(m, 1.0 - smoothstep(0.03, 0.055, abs(r - 0.17)));
  return m;
}
float flakes(vec3 p){
  vec3 n = normalize(p);
  float m = 0.0;
  ${flakeGLSL}
  return m;
}

void main(){
  // march from where the view ray enters the box (topper units) to where it leaves it
  vec3 rd = normalize(vPos - vCam);
  vec3 ro = vPos + CY;
  vec3 inv = 1.0 / mix(vec3(1e-5), rd, step(1e-5, abs(rd)));
  vec3 tf = max((BMIN - ro) * inv, (BMAX - ro) * inv);
  float tEnd = min(min(tf.x, tf.y), tf.z);
  float t = 0.0, dBest = 1e9, tBest = 0.0;
  bool hit = false;
  for (int i = 0; i < 170; i++) {
    float d = sdf(ro + rd * t);
    if (d < dBest) { dBest = d; tBest = t; }
    if (d < 0.0006) { hit = true; break; }
    t += d * 0.75;
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
  vec3 nV = normalize(normalMatrix * nO);

  // ---------- lighting, matching the baubles ----------
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
  vec3 L2 = normalize(vec3(0.7, 0.15, 0.7));
  float ao = 0.0, sc2 = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.015 + 0.05 * float(i);
    ao += (h - sdf(p + nO * h)) * sc2; sc2 *= 0.65;
  }
  ao = clamp(1.0 - 1.4 * ao, 0.35, 1.0);
  float diff = max(dot(nV, L) * 0.8 + 0.2, 0.0);
  float hemi = 0.32 + 0.18 * nV.y;
  float nh = max(dot(nV, normalize(L + V)), 0.0), nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
  float fres = pow(1.0 - max(nV.z, 0.0), 1.4);
  vec3 col;
  float glit = 0.0;

  if (mat < 1.5) {
    // frosted glass: lighter towards the rim, where the frosting scatters more light
    vec3 inner, rim;
    if (p.y < -1.03) { inner = vec3(0.045, 0.075, 0.062); rim = vec3(0.30, 0.31, 0.30); }   // dark green tube
    else {
      inner = mix(vec3(0.13, 0.17, 0.15), vec3(0.24, 0.27, 0.255), smoothstep(-0.7, 0.4, p.y));   // sage ball
      rim = vec3(0.62, 0.63, 0.62);
    }
    vec3 alb = mix(inner, rim, fres * 0.85);
    // the spire, bulb and neck: satin pearl white
    float white = smoothstep(0.88, 0.98, p.y);
    float streak = vnoise(vec3(p.x * 3.0, p.y * 40.0, p.z * 3.0));
    alb = mix(alb, vec3(0.74, 0.73, 0.71) * (0.98 + 0.03 * streak), white);
    col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
    col += ao * vec3(1.0, 0.98, 0.95) * (pow(nh, 10.0) * mix(0.05, 0.16, white) + pow(nh, 160.0) * mix(0.25, 0.5, white) + pow(nh2, 100.0) * 0.18);
    // a faint pearly lustre on the white glass towards its edges
    vec3 pearl = 0.5 + 0.5 * cos(6.283 * (nV.z * 1.2 + p.y * 0.3 + vec3(0.0, 0.33, 0.67)));
    col += white * ao * mix(vec3(0.85, 0.86, 0.88), pearl, 0.35) * pow(1.0 - max(nV.z, 0.0), 2.5) * 0.3;
    // glitter: snowflakes on the ball, and a band right round the rim at the bottom
    if (p.y > -1.0 && p.y < 0.95) glit = flakes(p);
    float rough = (vnoise(p * 60.0) - 0.5) * 0.03;
    glit = max(glit, 1.0 - smoothstep(-1.665, -1.645, p.y + rough));
  } else {
    // black grosgrain: fine ribs running across the ribbon and a soft sheen
    float rib, ink = 0.0;
    if (mat < 3.5) {
      rib = p.x * 240.0;
    } else if (mat < 4.5) {
      rib = (p.x < 0.0 ? sdBez(p.xy, TLA, TLB, TLC).y * 1.6 : sdBez(p.xy, TRA, TRB, TRC).y * 1.5) * 190.0;
      // the print, only on the tail's outer face; four taps a pixel apart keep the letters smooth
      if (p.x < 0.0 && nO.z > 0.0) {
        float o = uPx * 0.25;
        ink = 0.25 * (logo(p.xy + vec2(o, o)) + logo(p.xy + vec2(-o, o)) + logo(p.xy + vec2(o, -o)) + logo(p.xy - vec2(o, o)));
        ink *= smoothstep(0.0, 0.2, nO.z);
      }
    } else {
      rib = p.x * 260.0;
    }
    float rb2 = 0.5 + 0.5 * sin(rib) * clamp((0.03 / uPx - 2.0) / 3.0, 0.0, 1.0);
    vec3 alb = vec3(0.011, 0.011, 0.012) * (0.75 + 0.5 * rb2);
    alb = mix(alb, vec3(0.62, 0.61, 0.58) * (0.9 + 0.1 * rb2), ink);   // white ink, the ribs showing through
    col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
    col += ao * vec3(0.9, 0.92, 0.95) * (pow(nh, 14.0) * 0.07 + pow(nh2, 14.0) * 0.03) * (0.5 + rb2);
    col += ao * vec3(0.5) * pow(1.0 - max(nV.z, 0.0), 3.0) * 0.14;   // a soft rim, so the bow reads on a dark page
  }

  if (glit > 0.01) {
    // each grain a tiny tilted mirror that flashes as it turns, never finer than about a pixel
    vec3 g = floor(p / max(1.0 / 210.0, 1.2 * uPx));
    float h = hash(g);
    vec3 gV = normalize(normalMatrix * normalize(nO + (hash3(g) - 0.5) * 1.2));
    float tw = 0.55 + 0.45 * sin(uTime * 2.4 + h * 60.0);
    float sp = 2.0 * pow(max(dot(reflect(-L, gV), V), 0.0), 16.0) * step(0.4, h)
             + 1.2 * pow(max(dot(reflect(-L2, gV), V), 0.0), 20.0) * step(0.55, h)
             + 0.6 * step(0.92, h);
    float h2 = hash(g + 5.3);
    vec3 tint = mix(vec3(1.0), 0.5 + 0.5 * cos(6.283 * (h2 * 2.0 + vec3(0.0, 0.33, 0.67))), step(0.75, h2) * 0.5);
    vec3 gcol = vec3(0.84, 0.86, 0.9) * (0.35 + 0.75 * diff + hemi * 0.4) * (0.55 + 0.6 * h) * mix(vec3(1.0), tint, 0.4)
              + vec3(1.3, 1.3, 1.2) * tint * sp * tw;
    col = mix(col, gcol, glit * step(0.15, hash(g + 2.1)) * (0.8 + 0.2 * h) * mix(0.6, 1.0, ao));
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

/** The topper: a group whose origin is the ball's centre; it turns about its axis. */
export function topperFigure() {
  const logo = paintLogo();
  const texture = new THREE.CanvasTexture(logo.canvas);
  // Read top row first, as the lettering's box is laid out.
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const figure = raymarchedMesh(fragmentShader(logo.length, logo.height), 0, MIN, MAX, {
    uLogo: { value: texture },
  });
  const object = new THREE.Group();
  object.add(figure.mesh);
  return { object, dispose: () => (figure.dispose(), texture.dispose()) };
}
