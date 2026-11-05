import * as THREE from 'three';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The frosted heart: a puffy heart of white satin glass with a pearly sheen and,
 * on each face, a grey painted snowflake of eight fir sprigs flecked with glitter.
 * Raymarched as a signed-distance figure inside a box so it turns and sways like
 * the baubles.
 *
 * Heart units: y up, faces towards ±z, the point at y -0.76 and the shoulders
 * around y 0.45. The mesh is scaled by the ornament's `r`, so one heart unit is
 * `r` tree units.
 */

/** The cap's size in heart units: a plain silver collar over the short neck. */
export const HEART_CAP = 0.38;

/** Where the bottom of the cap's collar sits on the heart, in heart units. */
const COLLAR = 0.47;

/**
 * Where the mesh's origin sits in heart units. The collar's bottom is
 * 0.4 * HEART_CAP * r below the spinner; choosing this keeps the mesh's origin
 * 1.38 * r below it, just where a bauble's centre would be.
 */
const CY = COLLAR + 0.4 * HEART_CAP - 1.38;

/** The box the heart fits inside, in heart units. */
const MIN = new THREE.Vector3(-0.7, -0.82, -0.34);
const MAX = new THREE.Vector3(0.7, 0.62, 0.34);

const fragmentShader = /* glsl */ `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix;
uniform float uTime; uniform float uPx;
varying vec3 vPos;
varying vec3 vCam;
${raymarchConstants(CY, MIN, MAX)}
const float ZS = 1.55;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 hash3(vec3 p){ return vec3(hash(p), hash(p + 17.13), hash(p + 31.71)); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// exact cone between two balls, so the lobe runs into the point without a crease
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// one half of the heart: a round lobe tapering down to the point
float heartHalf(vec3 q){
  return sdRoundCone(q, vec3(0.24, 0.08, 0.0), vec3(0.0, -0.67, 0.0), 0.40, 0.085);
}
float sdf(vec3 p){
  vec3 q = vec3(p.xy, p.z * ZS);   // flattened front to back
  float s = max(q.y - 0.08, 0.0);
  q.y += 0.7 * s * s;              // broad, nearly flat shoulders with only a shallow dip
  float d = smin(heartHalf(q), heartHalf(vec3(-q.x, q.yz)), 0.12) / (ZS * 1.4);
  // the neck, flaring in, ending inside the cap's collar
  return smin(d, sdCap(p, vec3(0.0, 0.2, 0.0), vec3(0.0, 0.56, 0.0), 0.065), 0.12);
}
vec3 calcN(vec3 p){
  const vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
}

// the snowflake, painted flat on a face in matte grey: eight arms 45 degrees apart, each a fir
// sprig whose side branches slant up towards its tip, longest low down, staggered side to side
float flake(vec2 u){
  float r = length(u);
  if (r > 0.56) return 0.0;
  const float SEC = 0.7853982;
  float a = atan(u.x, u.y);
  float k = floor(a / SEC + 0.5);
  float aa = a - k * SEC;
  vec2 q = r * vec2(sin(aa), cos(aa));   // the arm runs up +y
  float ak = abs(k);
  float len = (ak < 0.5 ? 0.38 : ak < 1.5 ? 0.45 : ak < 2.5 ? 0.43 : ak < 3.5 ? 0.37 : 0.40)
            + 0.025 * hash(vec3(mod(k, 8.0), 3.0, 1.0));
  q.x += 0.005 * sin(q.y * 28.0 + k * 1.7);   // a hand-painted waver
  float sx = abs(q.x);
  // the stem, thinning towards its tip
  float w = mix(0.014, 0.007, clamp(q.y / len, 0.0, 1.0));
  float dm = q.y < len ? sx : length(vec2(sx, q.y - len));
  float m = 1.0 - smoothstep(w * 0.55, w, dm);
  // side branches at 30 degrees to the stem; the left side sits half a step higher
  const float SB = 0.5, CB = 0.866, SP = 0.06;
  float y0 = q.y - sx * CB / SB + (q.x < 0.0 ? SP * 0.5 : 0.0);
  float yj = floor(y0 / SP + 0.5) * SP;
  float L = 0.19 * (1.0 - yj / len) + 0.035;
  float along = sx / SB;
  float on = step(0.08, yj) * step(yj, len - 0.04) * (1.0 - smoothstep(L - 0.015, L, along));
  float bw = mix(0.011, 0.005, clamp(along / L, 0.0, 1.0));
  m = max(m, on * (1.0 - smoothstep(bw * 0.55, bw, abs(y0 - yj) * SB)));
  return m;
}
// a few loose glitter dots, mostly beyond the upper arms' tips
float dots(vec2 u){
  float m = 0.0;
  m = max(m, 1.0 - smoothstep(0.009, 0.014, length(u - vec2(-0.48, 0.08))));
  m = max(m, 1.0 - smoothstep(0.009, 0.014, length(u - vec2(0.47, 0.10))));
  m = max(m, 1.0 - smoothstep(0.009, 0.014, length(u - vec2(-0.18, 0.28))));
  m = max(m, 1.0 - smoothstep(0.009, 0.014, length(u - vec2(0.20, 0.27))));
  return m;
}

void main(){
  // march from where the view ray enters the box (heart units) to where it leaves it
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

  vec3 nO = calcN(p);
  vec3 nV = normalize(normalMatrix * nO);

  // frosted satin glass, faintly brushed across
  float streak = vnoise(vec3(p.x * 2.5, p.y * 60.0, p.z * 2.5));
  vec3 alb = vec3(0.80, 0.81, 0.84) * (0.95 + 0.07 * streak);
  // the decoration, laid flat on whichever face this is
  float face = smoothstep(0.3, 0.65, abs(nO.z));
  vec2 u = vec2(p.z > 0.0 ? p.x : -p.x, p.y);
  const vec2 FC = vec2(0.0, -0.2);
  float paint = face * flake(u - FC) * (0.85 + 0.15 * vnoise(p * 70.0));
  alb = mix(alb, vec3(0.30, 0.285, 0.28), paint * 0.92);   // matte grey-taupe paint
  // glitter specks: little diamonds scattered along the painted lines, plus the loose dots
  vec2 gu = u * 42.0, gi = floor(gu), gf = fract(gu) - 0.5;
  float hs = hash(vec3(gi, 9.0));
  float onLine = step(0.5, hs) * step(0.4, flake((gi + 0.5) / 42.0 - FC));
  float glit = face * max(onLine * (1.0 - smoothstep(0.22, 0.32, abs(gf.x) + abs(gf.y))), dots(u));

  // ---------- lighting, matching the songbird ----------
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
  vec3 col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
  float nh = max(dot(nV, normalize(L + V)), 0.0);
  float nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
  // satin: a broad soft sheen streaked by the brushing, plus a crisp glint
  col += ao * vec3(1.0, 0.98, 0.95) * (pow(nh, 12.0) * 0.16 * (0.6 + 0.8 * streak) + pow(nh, 180.0) * 0.9 + pow(nh2, 120.0) * 0.3);
  float fres = pow(1.0 - max(nV.z, 0.0), 2.5);
  // pearly lustre: a soft rainbow sliding over the glass towards the edges
  vec3 pearl = 0.5 + 0.5 * cos(6.283 * (nV.z * 1.2 + p.y * 0.8 + vec3(0.0, 0.33, 0.67)));
  col += ao * mix(vec3(0.82, 0.85, 0.90), pearl, 0.6) * fres * 0.42;

  if (glit > 0.01) {
    // each speck is one flake of glitter: a tiny tilted mirror that flashes as it turns
    vec3 g = vec3(gi, p.z > 0.0 ? 1.0 : 2.0);
    float h = hash(g + 1.7);
    vec3 gV = normalize(normalMatrix * normalize(nO + (hash3(g) - 0.5) * 1.1));
    float tw = 0.6 + 0.4 * sin(uTime * 2.4 + h * 60.0);
    float sp = 1.6 * pow(max(dot(reflect(-L, gV), V), 0.0), 12.0)
             + 1.0 * pow(max(dot(reflect(-L2, gV), V), 0.0), 14.0);
    float h2 = hash(g + 5.3);
    vec3 tint = mix(vec3(1.0), 0.5 + 0.5 * cos(6.283 * (h2 * 2.0 + vec3(0.0, 0.33, 0.67))), step(0.6, h2) * 0.6);
    vec3 gcol = vec3(0.85, 0.87, 0.9) * (0.45 + 0.6 * diff) * mix(vec3(1.0), tint, 0.5)
              + vec3(1.3, 1.3, 1.2) * tint * sp * tw;
    col = mix(col, gcol, glit);
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

/**
 * The heart's mesh: a box around the figure whose material raymarches the
 * heart inside it. Its origin is where a bauble's centre would be.
 */
export const frostedHeartMesh = () => raymarchedMesh(fragmentShader, CY, MIN, MAX);
