import * as THREE from 'three';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The frosted songbird: a glass bird ornament gripping a brown branch, raymarched
 * as a signed-distance figure inside a box so it turns and sways like the baubles.
 *
 * Bird units: y up, facing +z, the head a ball of radius ~0.32 centred at y 0.64.
 * The mesh is scaled by the ornament's `r`, so one bird unit is `r` tree units.
 */

/** The head's radius in bird units; the silver cap is scaled to fit it. */
export const HEAD = 0.32;

/**
 * Where the mesh's origin sits in bird units. The cap puts the head's centre
 * 1.38 * HEAD * r below the spinner; choosing this keeps the mesh's origin
 * 1.38 * r below it, just where a bauble's centre would be.
 */
const CY = 0.64 - 1.38 * (1 - HEAD);

/** The box the bird, its branch and toes fit inside, in bird units. */
const MIN = new THREE.Vector3(-0.6, -1.72, -0.55);
const MAX = new THREE.Vector3(0.6, 1.03, 0.62);

const fragmentShader = /* glsl */ `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix;
uniform float uTime; uniform float uPx;
varying vec3 vPos;
varying vec3 vCam;
${raymarchConstants(CY, MIN, MAX)}

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

// wing space: hugs the body's side, the lower end tucked in and swept back beside the tail
vec3 wingSpace(vec3 p){
  float yy = p.y + 0.15;
  return vec3(abs(p.x) - (0.31 + 0.10 * min(yy, 0.0)), yy, p.z - (-0.06 + 0.12 * min(yy, 0.0)));
}
// feathers in wing space: x = relief, y = dark painted edge, z = 1 on the scalloped shoulder
vec3 feathers(vec3 w){
  float u = w.z, vv = w.y;
  vec2 sc = vec2(u / 0.085, vv / 0.07);
  sc.x += 0.5 * mod(floor(sc.y), 2.0);
  vec2 f = fract(sc) - vec2(0.5, 0.0);
  float r = length(vec2(f.x, (f.y - 1.0) * 1.1));
  float scal = 1.0 - smoothstep(0.07, 0.16, abs(r - 0.62));
  float hs = smoothstep(0.0, 0.6, r) * (1.0 - smoothstep(0.58, 0.8, r));
  float fx = fract(u / 0.075 + 0.35 * vv + 0.04 * sin(vv * 38.0));
  float streak = smoothstep(0.70, 0.80, fx) * (1.0 - smoothstep(0.86, 0.96, fx));
  float hl = smoothstep(0.0, 0.72, fx) * (1.0 - smoothstep(0.74, 0.95, fx));
  float zone = smoothstep(-0.12, 0.08, vv);
  return vec3(mix(hl, hs, zone), mix(streak * smoothstep(-0.62, -0.1, vv) * 0.9, scal, zone), zone);
}

// toe space: two feet of three toes each along the branch, curling over its top and front
vec3 toeSpace(vec3 p){
  float id = floor((p.x - 0.02) / 0.085 + 0.5);
  id = p.x < 0.02 ? clamp(id, -3.0, -1.0) : clamp(id, 1.0, 3.0);
  return vec3(p.x - 0.02 - id * 0.085, p.y + 0.335 - id * 0.085 * 0.085, p.z - 0.37);
}

// mat: 1 glass body, 2 wing, 4 branch, 5 toe, 6 eye, 7 beak
float map(vec3 p, out float mat){
  float body = sdEll(p - vec3(0.0, 0.02, 0.0), vec3(0.40, 0.60, 0.40));
  body = smin(body, sdEll(p - vec3(0.0, 0.12, 0.09), vec3(0.37, 0.45, 0.36)), 0.1);
  body = smin(body, sdEll(p - vec3(0.0, 0.64, 0.02), vec3(0.31, 0.33, 0.33)), 0.2);
  vec3 tq = p; tq.z *= 2.3;   // tail is wide and flattened front to back
  float tail = sdTaper(tq, vec3(0.0, -0.40, -0.32), vec3(0.0, -1.45, -0.12), 0.25, 0.19) / 2.3;
  body = smin(body, tail, 0.14);
  // closed, chunky beak; a painted black line marks where it parts
  float beak = sdTaper(p, vec3(0.0, 0.62, 0.27), vec3(0.0, 0.665, 0.47), 0.10, 0.018);
  float d = smin(body, beak, 0.03);
  mat = beak < body ? 7.0 : 1.0;

  // fuller wing, with each feather moulded in relief on its outer face
  vec3 ws = wingSpace(p);
  float wing = sdEll(ws, vec3(0.135, 0.74, 0.30));
  if (wing < 0.05) wing -= 0.008 * feathers(ws).x * smoothstep(-0.03, 0.05, ws.x);
  if (wing < d) mat = 2.0;
  d = smin(d, wing, 0.03);

  // painted almond eye, barely raised
  float eye = sdEll(vec3(abs(p.x), p.yz) - vec3(0.18, 0.705, 0.255), vec3(0.035, 0.042, 0.078));
  if (eye < d) mat = 6.0;
  d = min(d, eye);

  // short, chunky branch with rough bark
  vec3 bq = p - vec3(0.02, -0.34, 0.37);
  float br = sdTaper(bq, vec3(-0.36, -0.04, 0.01), vec3(0.38, 0.045, -0.03), 0.14, 0.10);
  br = smin(br, length(bq - vec3(-0.20, -0.11, 0.07)) - 0.08, 0.07);   // a knot
  br = smin(br, sdTaper(bq, vec3(0.22, 0.0, 0.0), vec3(0.34, -0.15, 0.06), 0.07, 0.04), 0.05);   // broken-off twig
  br += 0.06 * (vnoise(p * vec3(4.0, 7.0, 7.0)) - 0.5) + 0.012 * (vnoise(p * vec3(8.0, 40.0, 40.0)) - 0.5);
  if (br < d) mat = 4.0;
  d = min(d, br);

  vec3 tp = toeSpace(p);
  float toe = min(sdCap(tp, vec3(0.0, 0.12, -0.07), vec3(0.0, 0.13, 0.05), 0.026),
                  sdCap(tp, vec3(0.0, 0.13, 0.05), vec3(0.0, 0.05, 0.135), 0.023));
  if (toe < d) mat = 5.0;
  return min(d, toe);
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
  for (int i = 0; i < 120; i++) {
    float d = sdf(ro + rd * t);
    if (d < dBest) { dBest = d; tBest = t; }
    if (d < 0.0006) { hit = true; break; }
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
  vec3 nV = normalize(normalMatrix * nO);

  // ---------- materials ----------
  vec3 alb; float gloss = 1.0, glit = 0.0, headM = 0.0;
  if (mat < 1.5) {
    vec3 white = vec3(0.80, 0.84, 0.87), blue = vec3(0.24, 0.50, 0.78);
    float nz = vnoise(p * 11.0);
    headM = smoothstep(0.14, 0.38, p.y + 0.06 * p.z + 0.06 * (nz - 0.5));
    float chestM = (1.0 - smoothstep(0.12, 0.42, length((p - vec3(0.0, 0.2, 0.3)) * vec3(0.9, 1.0, 1.4)))) * step(0.0, p.z);
    alb = mix(white, blue, headM);
    float mot = chestM * smoothstep(0.35, 0.75, nz + 0.25 * vnoise(p * 30.0));
    alb = mix(alb, mix(vec3(0.33, 0.39, 0.39), blue * 0.85, nz), mot * 0.75);
    alb = mix(alb, blue * 1.05, chestM * 0.6 * (1.0 - headM));
    glit = max(headM * 0.6, chestM * 0.55 * smoothstep(0.3, 0.6, nz));
  } else if (mat < 2.5) {
    vec3 w = wingSpace(p);
    vec3 fe = feathers(w);
    float dark = fe.y * (0.75 + 0.25 * vnoise(p * 40.0));
    vec3 base = mix(vec3(0.52, 0.52, 0.50), vec3(0.20, 0.185, 0.165), smoothstep(-0.6, 0.15, w.y));
    alb = mix(base, vec3(0.025, 0.02, 0.016), dark);
    glit = (1.0 - dark) * (0.2 + 0.4 * smoothstep(0.1, 0.7, fe.x)) * mix(0.6, 1.0, fe.z);
    gloss = 0.85;
  } else if (mat < 4.5) {
    float g = vnoise(p * vec3(3.0, 30.0, 30.0)) * 0.7 + 0.3 * vnoise(p * 60.0);
    alb = mix(vec3(0.025, 0.008, 0.004), vec3(0.17, 0.045, 0.014), smoothstep(0.25, 0.75, g));
    gloss = 0.9;
  } else if (mat < 5.5) {
    vec3 tp = toeSpace(p);
    // white toes, black claws curling down the front of the branch
    alb = mix(vec3(0.80, 0.80, 0.78), vec3(0.012), smoothstep(0.075, 0.095, tp.z));
    gloss = 0.7;
  } else if (mat < 6.5) {
    // black paint with a white painted highlight towards the front
    vec3 e = vec3(abs(p.x), p.yz) - vec3(0.18, 0.705, 0.255);
    alb = mix(vec3(0.008), vec3(0.85), 1.0 - smoothstep(0.011, 0.016, length(vec2(e.y - 0.013, e.z - 0.024))));
    gloss = 1.6;
  } else {
    // pale blue-grey with a little glitter, and a black painted line along the middle
    float mid = abs(p.y - (0.62 + (p.z - 0.27) * 0.225));
    float line = 1.0 - smoothstep(0.005, 0.009, mid);
    alb = mix(vec3(0.42, 0.58, 0.74), vec3(0.01), line);
    gloss = 0.8; glit = 0.35 * (1.0 - line);
  }

  // ---------- lighting ----------
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
  vec3 L2 = normalize(vec3(0.7, 0.15, 0.7));
  float ao = 0.0, sc2 = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.015 + 0.05 * float(i);
    ao += (h - sdf(p + nO * h)) * sc2; sc2 *= 0.65;
  }
  ao = clamp(1.0 - 1.6 * ao, 0.25, 1.0);
  float diff = max(dot(nV, L) * 0.8 + 0.2, 0.0);
  float hemi = 0.32 + 0.18 * nV.y;
  vec3 col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
  float nh = max(dot(nV, normalize(L + V)), 0.0);
  float nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
  col += gloss * ao * vec3(1.0, 0.97, 0.92) * (pow(nh, 220.0) * 1.4 + pow(nh, 36.0) * 0.07 + pow(nh2, 160.0) * 0.4);
  float fres = pow(1.0 - max(nV.z, 0.0), 3.0);
  // pearly lustre: a faint rainbow at grazing angles on the glass
  vec3 pearl = 0.5 + 0.5 * cos(6.283 * (nV.z * 1.3 + p.y * 0.6 + vec3(0.0, 0.33, 0.67)));
  col += (mat < 1.5 ? 1.0 : 0.4) * ao * mix(vec3(0.8, 0.85, 0.88), pearl, 0.35) * fres * 0.22;

  if (glit > 0.01) {
    // grains no finer than about a pixel, so they sparkle rather than shimmer
    vec3 g = floor(p * min(190.0, 0.8 / uPx));
    float h = hash(g);
    vec3 gV = normalize(normalMatrix * normalize(nO + (hash3(g) - 0.5) * 1.3));
    float tw = 0.55 + 0.45 * sin(uTime * 2.4 + h * 60.0);
    float sp = 2.0 * pow(max(dot(reflect(-L, gV), V), 0.0), 16.0) * step(0.4, h)
             + 1.2 * pow(max(dot(reflect(-L2, gV), V), 0.0), 20.0) * step(0.55, h)
             + 0.7 * step(0.9, h);
    float h2 = hash(g + 5.3);
    vec3 tint = mix(vec3(1.0), 0.5 + 0.5 * cos(6.283 * (h2 * 2.0 + vec3(0.0, 0.33, 0.67))), step(0.7, h2) * 0.7);
    vec3 gcol = mix(vec3(0.78, 0.84, 0.88), vec3(0.45, 0.68, 0.95), headM) * (0.30 + 0.75 * diff + hemi * 0.4) * (0.55 + 0.6 * h) * mix(vec3(1.0), tint, 0.5)
              + vec3(1.3, 1.3, 1.2) * tint * sp * tw;
    col = mix(col, gcol, glit * step(0.35, hash(g + 2.1)) * (0.75 + 0.25 * h) * mix(0.6, 1.0, ao));
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

/**
 * The songbird's mesh: a box around the figure whose material raymarches the
 * bird inside it. Its origin is where a bauble's centre would be.
 */
export const songbirdMesh = () => raymarchedMesh(fragmentShader, CY, MIN, MAX);
