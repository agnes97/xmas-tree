import * as THREE from 'three';
import { raymarchConstants, raymarchedMesh } from './raymarched';

/**
 * The plum snowflake: six faceted arms coated in plum glitter, hanging on a
 * mauve cord through a hole in its top arm. The front is moulded like a hip
 * roof: every point rises with its distance from the edge, which gives a sharp
 * ridge along each arm, creases between the arms and a little pyramid on every
 * barb. Under that roof is a thick, straight-sided slab, and the back is flat.
 * Like the clip-on birds it only turns a little either side of its resting
 * angle, rather than spinning round.
 *
 * Snowflake units: 1 = one arm's length, the flake in the xy plane with its
 * centre at the origin, front towards +z and back face at z = 0. The cord runs
 * up to y = CORD, which sits 1.38 above the centre so the cord meets the
 * string where a bauble's cap would be. The figure is scaled by the
 * ornament's `r`, so one snowflake unit is `r` tree units.
 */

/** Where it rests, and how far it turns either side of that, in radians. */
export const SNOWFLAKE_REST = 0.3;
export const SNOWFLAKE_TILT: [number, number] = [-1.1 - SNOWFLAKE_REST, 1.1 - SNOWFLAKE_REST];

/** The cord's radius in snowflake units, so the string above can match it. */
export const SNOWFLAKE_CORD = 0.009;

/** The slab's thickness, and how steeply the faceted front rises. */
const T = 0.13;
const K = 0.6;
/** The depth it turns about, halfway through the slab. */
const PZ = 0.08;
/** The top of the cord, where it meets the string: 1.38 above the centre. */
const CORD = 1.4;

const MIN = new THREE.Vector3(-0.95, -1.1, -0.04);
const MAX = new THREE.Vector3(0.95, CORD + 0.02, 0.3);

const f4 = (v: number) => v.toFixed(4);

// Half the outline of one arm, traced on a grid over the photo: [along the arm, half width]. It
// starts behind the centre (hidden in the hub), runs out past the notch to a narrow waist, flares
// into a pair of side barbs, then tapers to a long point.
const ARM = [
  [-0.15, 0],
  [-0.15, 0.15],
  [0.05, 0.15],
  [0.25, 0.13],
  [0.4, 0.095],
  [0.5, 0.088],
  [0.62, 0.185],
  [0.7, 0.09],
  [0.77, 0.05],
  [0.86, 0.027],
  [0.94, 0.012],
  [1, 0],
];
const edgesGLSL = ARM.map((a, i) => {
  const b = ARM[(i + ARM.length - 1) % ARM.length];
  return `edge(q, vec2(${f4(a[0])}, ${f4(a[1])}), vec2(${f4(b[0])}, ${f4(b[1])}), ${i === 0 ? '0.0' : '1.0'}, d, s);`;
}).join('\n  ');

const fragmentShader = /* glsl */ `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; uniform mat3 normalMatrix;
uniform float uTime; uniform float uPx;
varying vec3 vPos;
varying vec3 vCam;
${raymarchConstants(0, MIN, MAX)}
const float T = ${f4(T)}, K = ${f4(K)}, KI = ${f4(1 / Math.hypot(1, K))};
const vec2 NUB = vec2(0.0, 0.855);   // the rounded top of the upper arm, with the hole through it
const float RN = 0.048, RH = 0.017;
const vec3 RING = vec3(0.0, 0.95, 0.08);   // the cord's loop through the hole, in the yz plane
const float RR = 0.095, RC = ${f4(SNOWFLAKE_CORD)}, CORD = ${f4(CORD)};

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 hash3(vec3 p){ return vec3(hash(p), hash(p + 17.13), hash(p + 31.71)); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }

// one edge of a polygon: nearest distance squared, and an even-odd crossing test for the sign
void edge(vec2 p, vec2 a, vec2 b, float useD, inout float d, inout float s){
  vec2 e = b - a, w = p - a;
  vec2 h = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  if (useD > 0.5) d = min(d, dot(h, h));
  bool c1 = p.y >= a.y, c2 = p.y < b.y, c3 = e.x * w.y > e.y * w.x;
  if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
}
// signed distance to one arm, q = (along the arm, distance from its axis); the edge along the axis
// only closes the polygon, it isn't part of the outline
float armSD(vec2 q){
  float d = 1e9, s = 1.0;
  ${edgesGLSL}
  return s * sqrt(d);
}
// signed distance to the whole outline: fold into the nearest arm's half sector, and take that arm
// and its neighbour
float flatSD(vec2 p){
  const float SEC = 1.0471976;
  float r = length(p), ang = atan(p.x, p.y);
  float al = abs(ang - SEC * floor(ang / SEC + 0.5));
  float d = min(armSD(r * vec2(cos(al), sin(al))), armSD(r * vec2(cos(SEC - al), sin(SEC - al))));
  if (p.y > 0.7) {
    d = min(d, length(p - NUB) - RN);                    // the top arm ends in a rounded nub
    if (p.y > NUB.y) d = max(d, length(p - NUB) - RN);
    d = max(d, RH - length(p - NUB));                    // with the hole for the cord
  }
  return d;
}
float flakeSD(vec3 p){
  float d2 = flatSD(p.xy);
  float h = T + K * max(-d2, 0.0);   // flat back at z = 0, straight sides up to T, faceted roof above
  return max(max(d2, (p.z - h) * KI), -p.z);
}
float cordSD(vec3 p){
  vec2 tq = vec2(length(p.yz - RING.yz) - RR, p.x);
  vec3 top = RING + vec3(0.0, RR, 0.0);
  return min(length(tq) - RC, sdCap(p, top, vec3(0.0, CORD, top.z), RC));
}
// mat: 1 snowflake, 2 cord
float map(vec3 p, out float mat){
  float d = flakeSD(p);
  mat = 1.0;
  if (p.y > 0.8) {
    float c = cordSD(p);
    if (c < d) mat = 2.0;
    d = min(d, c);
  }
  return d;
}
float sdf(vec3 p){ float m; return map(p, m); }
vec3 calcN(vec3 p){
  const vec2 e = vec2(0.0008, -0.0008);
  return normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
}

void main(){
  // march from where the view ray enters the box (snowflake units) to where it leaves it
  vec3 rd = normalize(vPos - vCam);
  vec3 ro = vPos + CY;
  vec3 inv = 1.0 / mix(vec3(1e-5), rd, step(1e-5, abs(rd)));
  vec3 tf = max((BMIN - ro) * inv, (BMAX - ro) * inv);
  float tEnd = min(min(tf.x, tf.y), tf.z);
  float t = 0.0, dBest = 1e9, tBest = 0.0;
  bool hit = false;
  for (int i = 0; i < 160; i++) {
    float d = sdf(ro + rd * t);
    if (d < dBest) { dBest = d; tBest = t; }
    if (d < 0.0004) { hit = true; break; }
    t += d * 0.85;
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
    float h = 0.01 + 0.03 * float(i);
    ao += (h - sdf(p + nO * h)) * sc2; sc2 *= 0.65;
  }
  ao = clamp(1.0 - 1.6 * ao, 0.35, 1.0);
  float diff = max(dot(nV, L) * 0.8 + 0.2, 0.0);
  float hemi = 0.32 + 0.18 * nV.y;
  vec3 col;

  if (mat < 1.5) {
    // plum, coated all over in fine glitter: every grain a tiny tilted mirror, never finer than
    // about a pixel so it sparkles rather than shimmering
    vec3 g = floor(p / max(1.0 / 330.0, 1.2 * uPx));
    float h = hash(g), h2 = hash(g + 5.3);
    vec3 alb = vec3(0.115, 0.013, 0.068) * (0.7 + 0.6 * h2);
    col = alb * (hemi * ao + diff * 1.1 * mix(0.6, 1.0, ao) + 0.3 * max(dot(nV, L2), 0.0));
    float nh = max(dot(nV, normalize(L + V)), 0.0), nh2 = max(dot(nV, normalize(L2 + V)), 0.0);
    col += ao * vec3(0.95, 0.55, 0.85) * (pow(nh, 14.0) * 0.10 + pow(nh2, 14.0) * 0.05);   // soft metallic sheen
    vec3 gV = normalize(normalMatrix * normalize(nO + (hash3(g) - 0.5) * 0.9));
    float tw = 0.55 + 0.45 * sin(uTime * 2.2 + h * 60.0);
    float sp = 2.2 * pow(max(dot(reflect(-L, gV), V), 0.0), 26.0) * step(0.45, h)
             + 1.3 * pow(max(dot(reflect(-L2, gV), V), 0.0), 30.0) * step(0.6, h)
             + 0.35 * step(0.96, h);
    col += vec3(1.0, 0.62, 0.92) * sp * tw * ao;
    // the straight moulded sides of the slab sit a shade deeper, so its thickness reads when it turns
    col *= 1.0 - 0.38 * (1.0 - smoothstep(0.12, 0.4, abs(nO.z)));
  } else {
    // mauve twisted cord
    float tw = 0.5 + 0.5 * sin(atan(p.x, p.z - RING.z) * 3.0 + p.y * 260.0);
    vec3 alb = vec3(0.30, 0.10, 0.22) * (0.75 + 0.35 * tw);
    col = alb * (hemi * ao + diff * mix(0.6, 1.0, ao) + 0.25 * max(dot(nV, L2), 0.0));
    float nh = max(dot(nV, normalize(L + V)), 0.0);
    col += ao * vec3(0.9, 0.7, 0.85) * pow(nh, 30.0) * 0.25;
  }

  col = col / (1.0 + col * 0.12);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, alpha);
}`;

/**
 * The snowflake: a group whose origin is the flake's centre, which hangs where
 * a bauble's centre would, 1.38 * r below the string. It turns about an axis
 * halfway through the slab.
 */
export function snowflakeFigure() {
  const flake = raymarchedMesh(fragmentShader, 0, MIN, MAX);
  flake.mesh.position.z = -PZ;
  const object = new THREE.Group();
  object.add(flake.mesh);
  return { object, dispose: flake.dispose };
}
