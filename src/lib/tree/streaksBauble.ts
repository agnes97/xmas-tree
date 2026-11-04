/**
 * The Silver streaks bauble: matte grey glass with hand-painted silver glitter
 * lines running around it in rows, each row broken into separate strokes with
 * wide, staggered gaps, and little triangles of tiny pearls sitting on some of them.
 *
 * Baked with sphereMaps: the glitter grains tip their own way in the normal map
 * so they sparkle as it turns, and each pearl is a raised dome.
 */

import {
  bake,
  decal,
  dot,
  hash,
  seeded,
  type Decal,
  type GlitterMaps,
  type Vec,
} from './sphereMaps';

const GREY: Vec = [0.1, 0.098, 0.097];
const SILVER: Vec = [0.8, 0.81, 0.84];
const PEARL: Vec = [0.86, 0.86, 0.84];
/** Glitter grains per sphere radius. */
const GRAINS = 110;
/** The lines are thickened a little from the close-up so they still read at tree size. */
const WIDTH = 1.6;
/** Spacing of the grains strung along a line, in radians of arc. */
const STEP = 0.032;

type Stroke = { lat: number; lon: number; half: number; seed: number };
type Pearl = { x: number; y: number; r: number };
type Bunch = Decal & { pearls: Pearl[]; reach: number };

const TAU = Math.PI * 2;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A point on the unit sphere, lon 0 facing the viewer. */
const at = (lon: number, lat: number): Vec => [
  Math.sin(lon) * Math.cos(lat),
  Math.sin(lat),
  Math.cos(lon) * Math.cos(lat),
];

function design() {
  const rnd = seeded(97);

  // Rows around the hanging axis, each a run of strokes ~40–92° long with gaps between.
  const strokes: Stroke[] = [];
  for (const y of [0.86, 0.68, 0.49, 0.29, 0.09, -0.11, -0.31, -0.51, -0.7, -0.87]) {
    let lon = rnd() * TAU;
    let used = 0;
    for (;;) {
      const span = 0.7 + rnd() * 0.9;
      const gap = 0.45 + rnd() * 0.8;
      if (used + span > TAU - 0.4) break;
      const half = span / 2;
      strokes.push({
        lat: Math.asin(y) + (rnd() - 0.5) * 0.06,
        lon: lon + half,
        half,
        seed: rnd(),
      });
      lon += span + gap;
      used += span + gap;
    }
  }

  // Pearls go on the middles of strokes, spread evenly: each next bunch on the
  // middle farthest from those already placed.
  const mids = strokes
    .filter((s) => Math.abs(s.lat) < 0.85)
    .map((s) => ({ s, p: at(s.lon, s.lat) }));
  const chosen = [mids[0]];
  while (chosen.length < 8) {
    let best = mids[0];
    let bestD = -1;
    for (const m of mids) {
      if (chosen.includes(m)) continue;
      const d = Math.min(...chosen.map((c) => Math.acos(Math.min(1, dot(c.p, m.p)))));
      if (d > bestD) {
        bestD = d;
        best = m;
      }
    }
    chosen.push(best);
  }

  // Each bunch: three tight clusters in a triangle, a pearl with four smaller ones around it.
  const SCALE = 2.2;
  const bunches: Bunch[] = chosen.map(({ s }, k) => {
    const turn = Math.PI / 2 + [0, 0.25, -0.2][k % 3];
    const pearls: Pearl[] = [];
    const add = (x: number, y: number, r: number) =>
      pearls.push({ x: x * SCALE, y: y * SCALE, r: r * SCALE * (0.92 + 0.16 * rnd()) });
    for (let b = 0; b < 3; b++) {
      const a = turn + (b * TAU) / 3;
      const bx = Math.cos(a) * 0.029;
      const by = Math.sin(a) * 0.029;
      add(bx, by, 0.014);
      for (let i = 0; i < 4; i++) {
        const ai = a + (i * Math.PI) / 2;
        add(bx + Math.cos(ai) * 0.0145, by + Math.sin(ai) * 0.0145, 0.0105);
      }
    }
    const reach = Math.max(...pearls.map((p) => Math.hypot(p.x, p.y) + p.r));
    return { ...decal((s.lon * 180) / Math.PI, (s.lat * 180) / Math.PI, 1), pearls, reach };
  });

  return { strokes, bunches };
}

export function paintStreaksBauble(width = 1024): GlitterMaps {
  const { strokes, bunches } = design();

  return bake(width, ({ n, lon, lat, east, north }) => {
    // Raised pearls sit on top of everything.
    for (const b of bunches) {
      if (dot(n, b.c) < Math.cos(b.reach * 1.2)) continue;
      const pu = dot(n, b.u);
      const pv = dot(n, b.v);
      for (const p of b.pearls) {
        const du = (pu - p.x) / p.r;
        const dv = (pv - p.y) / p.r;
        const rho = Math.hypot(du, dv);
        if (rho >= 1) continue;
        const cov = 1 - smoothstep(0.82, 1, rho);
        const o = b.u.map((x, i) => du * x + dv * b.v[i]) as Vec;
        return {
          rgb: GREY.map((c, k) => c + (PEARL[k] - c) * cov) as Vec,
          tilt: [dot(o, east) * 0.85 * cov, dot(o, north) * 0.85 * cov],
          rough: 0.6 + (0.38 - 0.6) * cov,
          metal: 0,
        };
      }
    }

    // Glitter lines: a thin silver core with sparkling grains strung along it.
    const cl = Math.cos(lat);
    const rough = (hash(...grid(n, 320)) - 0.5) * 0.003 * WIDTH;
    let m = 0;
    strokes.forEach((s, k) => {
      const dl = ((((lon - s.lon + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      const t = Math.abs(dl) / s.half;
      if (t >= 1) return;
      const line =
        s.lat + 0.003 * Math.sin(dl * 4 + s.seed * 6.28) + 0.0015 * Math.sin(dl * 11 + s.seed * 17);
      const d = Math.abs(lat - line) + rough;
      if (d > 0.02 * WIDTH) return;
      const w = (0.0015 + (1 - 0.0015) * (1 - smoothstep(0.82, 1, t))) * WIDTH;
      const core =
        (1 - smoothstep(0.0055 * w, 0.0085 * w, d)) * (0.55 + 0.45 * hash(...grid(n, 260)));
      const a = (dl * cl) / STEP;
      const f = (a - Math.floor(a) - 0.5) * STEP;
      const on = hash(Math.floor(a), k, 7) >= 0.35 ? 1 : 0;
      const grain = on * (1 - smoothstep(0.008 * w, 0.0115 * w, Math.hypot(f, d)));
      m = Math.max(m, core, grain);
    });
    if (m <= 0.01) return { rgb: GREY, tilt: [0, 0], rough: 0.6, metal: 0 };

    const [gx, gy, gz] = grid(n, GRAINS);
    const h = hash(gx, gy, gz);
    const h2 = hash(gx + 11, gy + 5, gz + 3);
    // Mostly plain silver; a few grains flash a colour.
    const iri = h2 > 0.7 ? 0.25 : 0;
    const tint = [0, 0.33, 0.67].map(
      (o) => 1 - iri + iri * (0.5 + 0.5 * Math.cos(6.283 * (h2 * 2 + o)))
    );
    const bright = 0.75 + 0.5 * h;
    const grain = SILVER.map((c, k) => c * tint[k] * bright) as Vec;
    const cov = m * (0.72 + 0.28 * h);
    return {
      rgb: GREY.map((c, k) => c + (grain[k] - c) * cov) as Vec,
      tilt: [(hash(gx + 3, gy, gz) - 0.5) * 1.3 * cov, (hash(gx, gy + 7, gz) - 0.5) * 1.3 * cov],
      rough: 0.6 + (0.18 - 0.6) * cov,
      metal: cov * 0.9,
    };
  });
}

const grid = (n: Vec, k: number): [number, number, number] => [
  Math.floor(n[0] * k),
  Math.floor(n[1] * k),
  Math.floor(n[2] * k),
];
