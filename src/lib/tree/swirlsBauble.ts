/**
 * The Burgundy swirls bauble: matte wine-red glass with thin white glitter lines
 * in loose pairs, falling straight down from the cap and twisting harder towards
 * the bottom. Neighbouring pairs twist opposite ways, so the lower half becomes a
 * crossed lattice while the top stays like meridians.
 *
 * Baked with sphereMaps: the glitter grains tip their own way in the normal map
 * so they sparkle as it turns.
 */

import { bake, hash, seeded, type GlitterMaps, type Vec } from './sphereMaps';

const BURGUNDY: Vec = [0.3, 0.016, 0.045];
/** Shiny white glitter; the metal takes its tint from this. */
const WHITE: Vec = [0.95, 0.95, 0.97];
/** Glitter grains per sphere radius. */
const GRAINS = 110;
/** The lines are thickened a little from the close-up so they still read at tree size. */
const WIDTH = 1.6;
/** The lines run from lat 78° at the cap down to lat -72°. */
const TOP = 1.36;
const SPAN = 2.62;
const PAIRS = 13;

/** A line: lon(lat) = base + twist * t^pow, t = 0 at the cap, 1 at the bottom. */
type Line = { base: number; twist: number; pow: number; wiggle: number };

const TAU = Math.PI * 2;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function design() {
  const rnd = seeded(97);
  const lines: Line[] = [];
  for (let g = 0; g < PAIRS; g++) {
    const base = (g * TAU) / PAIRS + (rnd() - 0.5) * 0.08;
    const dir = g % 2 ? -1 : 1;
    const twist = dir * (2.5 + rnd() * 0.4);
    const pow = 2.1 + rnd() * 0.3;
    const wiggle = rnd();
    const gap = 0.12 + rnd() * 0.03;
    for (let k = 0; k < 2; k++) lines.push({ base: base + (k - 0.5) * gap, twist, pow, wiggle });
  }
  return lines;
}

export function paintSwirlsBauble(width = 1024): GlitterMaps {
  const lines = design();

  return bake(width, ({ n, lon, lat }) => {
    const plain = { rgb: BURGUNDY, tilt: [0, 0] as [number, number], rough: 0.6, metal: 0 };
    const along = (TOP - lat) / SPAN;
    const t = Math.max(0, Math.min(1, along));
    const ends = smoothstep(0, 0.03, t) * (1 - smoothstep(0.92, 0.95, along));
    if (ends <= 0) return plain;

    const cl = Math.cos(lat);
    const rough = (hash(...grid(n, 380)) - 0.5) * 0.0018 * WIDTH;
    const tt = Math.max(t, 1e-4);
    let m = 0;
    lines.forEach((l, k) => {
      const tp = Math.pow(tt, l.pow);
      const line =
        l.base +
        l.twist * tp +
        0.03 * Math.sin(lat * 3.2 + l.wiggle * 6.28) +
        0.005 * Math.sin(lat * 9 + k * 2.3);
      const slope = (cl * l.twist * l.pow * tp) / tt / SPAN;
      const dl = ((((lon - line + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      const d = (Math.abs(dl) * cl) / Math.hypot(1, slope) + rough;
      const core = 1 - smoothstep(0.0048 * WIDTH, 0.0078 * WIDTH, d);
      m = Math.max(m, core * ends);
    });
    if (m <= 0.01) return plain;

    const [gx, gy, gz] = grid(n, GRAINS);
    const h = hash(gx, gy, gz);
    const h2 = hash(gx + 11, gy + 5, gz + 3);
    // Bright white; a few grains flash a little colour.
    const iri = h2 > 0.85 ? 0.3 : 0;
    const tint = [0, 0.33, 0.67].map(
      (o) => 1 - iri + iri * (0.5 + 0.5 * Math.cos(6.283 * (h2 * 2 + o)))
    );
    const bright = 0.85 + 0.15 * h;
    const grain = WHITE.map((c, k) => Math.min(1, c * tint[k] * bright)) as Vec;
    const cov = m;
    return {
      rgb: BURGUNDY.map((c, k) => c + (grain[k] - c) * cov) as Vec,
      // Grains tip only a little, so plenty of them catch the light at once.
      tilt: [(hash(gx + 3, gy, gz) - 0.5) * 0.7 * cov, (hash(gx, gy + 7, gz) - 0.5) * 0.7 * cov],
      rough: 0.6 + (0.1 + 0.12 * h - 0.6) * cov,
      metal: cov,
    };
  });
}

const grid = (n: Vec, k: number): [number, number, number] => [
  Math.floor(n[0] * k),
  Math.floor(n[1] * k),
  Math.floor(n[2] * k),
];
