/**
 * The Copper winter bauble: glossy burnt-orange glass, deepening to red
 * underneath, with a winter scene in silver glitter — four lone fir trees on a
 * wavy glitter snow line, a shorter line below it, and white snow dots falling.
 *
 * Trees and snow are drawn flat into an atlas and projected on as decals; the
 * snow lines are computed per point. Baked with sphereMaps.
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

type Pt = [number, number];

const CELL = 512;
const CELLS = 4;
/** Glitter grains per sphere radius. */
const GRAINS = 90;

const COPPER: Vec = [0.44, 0.095, 0.012];
/** The glass deepens to red underneath. */
const COPPER_LOW: Vec = [0.3, 0.024, 0.018];
/** Bright cool silver; the metal takes its tint from this. */
const SILVER: Vec = [0.95, 0.96, 0.99];
const SNOW: Vec = [0.86, 0.86, 0.84];

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const TREE_S = 0.54;
const TREE_BASE = -7;
const TREE0 = -25;
const SNOW_S = 0.5;
/** Main snow line: lon of a crest, crest lat, valley lat, half width. Crests sit just left of each tree. */
const GROUND = { crest: (TREE0 - 18) * D2R, high: -14 * D2R, low: -32 * D2R, hw: 0.04 };
/** Lower snow line: drop below the main one, half width, and start/end in lon from the crest. */
const GROUND2 = { drop: 11 * D2R, hw: 0.032, from: -14 * D2R, to: 32 * D2R };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** GLSL-style mod, always positive. */
const mod = (x: number, y: number) => x - y * Math.floor(x / y);
const grid = (n: Vec, k: number): [number, number, number] => [
  Math.floor(n[0] * k),
  Math.floor(n[1] * k),
  Math.floor(n[2] * k),
];

function densify(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** R = glitter coverage, G = snow dot coverage, B = snow dot dome shading. */
function drawAtlas() {
  const rnd = seeded(97);

  const atlas = document.createElement('canvas');
  atlas.width = CELL * CELLS;
  atlas.height = CELL;
  const ctx = atlas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, atlas.width, atlas.height);
  ctx.fillStyle = '#f00';
  ctx.strokeStyle = '#f00';

  // A solid core plus sprayed grains, so the edges are rough like real glitter glue.
  function glitter(pts: Pt[], w: number) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w * 0.74;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    for (const [x, y] of densify(pts, Math.max(1.5, w * 0.12))) {
      for (let k = 0; k < 4; k++) {
        const a = rnd() * 6.283;
        const r = w * 0.5 * Math.sqrt(rnd()) * 1.08;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, w * (0.04 + 0.07 * rnd()), 0, 6.283);
        ctx.fill();
      }
      if (rnd() < 0.06) {
        const a = rnd() * 6.283;
        const r = w * (0.62 + 0.5 * rnd());
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, w * 0.05, 0, 6.283);
        ctx.fill();
      }
    }
  }

  // Cell coordinates are in sphere-tangent units, x right, y up, spanning ±s.
  const toCell =
    (cell: number, s: number) =>
    ([x, y]: Pt): Pt => [
      cell * CELL + CELL / 2 + ((x / s) * CELL) / 2,
      CELL / 2 - ((y / s) * CELL) / 2,
    ];

  // Cells 0–1: filled glitter firs. Stacked tiers, each a jagged triangle whose bottom edge
  // droops into branch tips; a faint gap under each tier shows the layers.
  function fir(cell: number, tiers: number, slim: number) {
    const T = toCell(cell, 1);
    const top = 0.93;
    const base = -0.9;
    const H = top - base;
    const side = 7;
    const tierPts: Pt[][] = [];
    for (let i = 0; i < tiers; i++) {
      const f1 = (i + 1) / tiers;
      // Each tier's apex starts well inside the tier above, so the layers overlap.
      const yTop = i === 0 ? top : top - H * (i / tiers) + (H * 0.6) / tiers;
      const yBot = top - H * f1;
      const hw = (0.1 + 0.5 * Math.pow(f1, 0.85)) * slim;
      const droop = 0.05 + 0.03 * f1;
      const pts: Pt[] = [];
      // Right edge, apex down to the outer tip, with a little branch zigzag.
      for (let k = 0; k <= side; k++) {
        const t = k / side;
        const j = k % 2 ? 0.035 : -0.01;
        pts.push([hw * t + j * (0.3 + t), yTop - (yTop - yBot + droop) * t]);
      }
      // Bottom edge back across, curving up in the middle, scalloped into branch tips.
      const tips = Math.max(3, Math.round(hw * 9));
      for (let k = 1; k < tips * 2; k++) {
        const x = hw - (2 * hw * k) / (tips * 2);
        const arc = 0.09 * (1 - (x / hw) ** 2);
        pts.push([x, yBot - droop + arc + (k % 2 ? 0.045 : 0) + (rnd() - 0.5) * 0.015]);
      }
      // Left edge back up to the apex.
      for (let k = side; k >= 0; k--) {
        const t = k / side;
        const j = k % 2 ? 0.035 : -0.01;
        pts.push([-(hw * t + j * (0.3 + t)), yTop - (yTop - yBot + droop) * t]);
      }
      tierPts.push(pts.map(([x, y]) => [x + (rnd() - 0.5) * 0.012, y]));
    }
    // Lowest tier first so each upper one sits over the one below.
    for (let i = tiers - 1; i >= 0; i--) {
      const pts = tierPts[i].map(T);
      ctx.fillStyle = '#f00';
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      glitter(pts.concat([pts[0]]), CELL * 0.022);
      if (i < tiers - 1) {
        // Shadow line just under this tier's branch tips, over the tier below.
        const n = tierPts[i].length;
        const under = tierPts[i]
          .slice(side + 1, n - side - 1)
          .map(([x, y]): Pt => [x, y - 0.035])
          .map(T);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = CELL * 0.014;
        ctx.beginPath();
        under.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.strokeStyle = '#f00';
      }
    }
    // Short trunk where it meets the snow line.
    const trunk: Pt[] = [
      [0, base + 0.02],
      [0, base - 0.06],
    ];
    glitter(densify(trunk.map(T), 3), CELL * 0.05);
  }
  fir(0, 4, 1);
  fir(1, 5, 0.95);

  // Cells 2–3: scattered raised white snow dots.
  function snow(cell: number, count: number) {
    const T = toCell(cell, SNOW_S);
    const px = CELL / (2 * SNOW_S);
    const dots: [number, number, number][] = [];
    for (let tries = 0; dots.length < count && tries < 2000; tries++) {
      const x = (rnd() - 0.5) * 0.9;
      const y = (rnd() - 0.5) * 0.9;
      const r = 0.014 + 0.013 * rnd();
      if (dots.every(([a, b, q]) => Math.hypot(a - x, b - y) > (q + r) * 3.2)) dots.push([x, y, r]);
    }
    for (const [x, y, r0] of dots) {
      const [cx, cy] = T([x, y]);
      const r = r0 * px * (0.92 + 0.16 * rnd());
      const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r * 1.05);
      g.addColorStop(0, 'rgb(0,255,255)');
      g.addColorStop(0.55, 'rgb(0,255,170)');
      g.addColorStop(1, 'rgb(0,255,40)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.283);
      ctx.fill();
    }
    ctx.fillStyle = '#f00';
  }
  snow(2, 9);
  snow(3, 7);

  return ctx.getImageData(0, 0, atlas.width, atlas.height).data;
}

const DECALS: (Decal & { cell: number })[] = [
  // Four lone trees spaced evenly round the ball, standing on the snow line.
  ...(
    [
      [TREE0, 0, -1],
      [TREE0 + 90, 1, 1.5],
      [TREE0 + 180, 0, 1],
      [TREE0 + 270, 1, -1.5],
    ] as const
  ).map(([lon, cell, rot]) => ({
    ...decal(lon, TREE_BASE + Math.asin(0.9 * TREE_S) / D2R, TREE_S, rot),
    cell,
  })),
  // Snow falling all around above the ground.
  ...(
    [
      [0, 40, 2, 0],
      [60, 18, 3, 40],
      [120, 42, 2, 80],
      [180, 20, 3, 15],
      [240, 40, 2, 55],
      [300, 20, 3, 25],
      [30, 66, 3, 10],
      [150, 66, 2, 70],
      [270, 66, 3, 35],
    ] as const
  ).map(([lon, lat, cell, rot]) => ({ ...decal(lon, lat, SNOW_S, rot), cell })),
];

/** The wavy snow line, one smooth wave per tree, falling gently right of each crest. */
function groundLat(lo: number) {
  let p = mod(4 * (lo - GROUND.crest) + Math.PI, TAU) - Math.PI;
  p -= 0.55 * (1 - Math.cos(p));
  return (
    GROUND.low +
    (GROUND.high - GROUND.low) * (0.5 + 0.5 * Math.cos(p)) +
    0.006 * Math.sin(lo * 11 + 0.7)
  );
}

/** Glitter coverage of the two snow lines, with rough, grainy edges. */
function ground(n: Vec, lo: number, la: number) {
  const cl = Math.max(Math.sqrt(Math.max(1 - n[1] * n[1], 0)), 0.05);
  const lat = groundLat(lo);
  const sl = (groundLat(lo + 0.01) - groundLat(lo - 0.01)) / 0.02 / cl;
  const norm = 1 / Math.sqrt(1 + sl * sl);
  const rough = (hash(...grid(n, 300)) - 0.5) * 0.01;
  const speck = 0.65 + 0.35 * hash(...grid(n, 400));
  const gr = hash(...grid(n, 210)) >= 0.72 ? 1 : 0;

  // Main line, all the way round.
  const d = Math.abs(la - lat) * norm;
  const hw = GROUND.hw * (1 + 0.18 * Math.sin(lo * 7 + 1.3));
  const core = (1 - smoothstep(hw * 0.7, hw * 1.1, d + rough)) * speck;
  const grain = gr * (1 - smoothstep(hw * 1.3, hw * 1.9, d));
  let m = Math.max(core, grain);

  // Lower line: parallel to the main one, only under each tree's left side, tapering at both ends.
  const u = mod(lo - GROUND.crest + Math.PI / 4, Math.PI / 2) - Math.PI / 4;
  if (u >= GROUND2.from && u <= GROUND2.to) {
    const t = (u - GROUND2.from) / (GROUND2.to - GROUND2.from);
    const seg = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.35);
    const hw2 = GROUND2.hw * seg * (1 + 0.15 * Math.sin(lo * 9 + 0.4));
    if (hw2 > 0.001) {
      const d2 = Math.abs(la - (lat - GROUND2.drop)) * norm;
      const core2 = (1 - smoothstep(hw2 * 0.7, hw2 * 1.1, d2 + rough)) * speck;
      const grain2 = seg >= 0.05 ? gr * (1 - smoothstep(hw2 * 1.3, hw2 * 1.9, d2)) : 0;
      m = Math.max(m, core2, grain2);
    }
  }
  return m;
}

export function paintCopperBauble(width = 1024): GlitterMaps {
  const atlas = drawAtlas();
  const AW = CELL * CELLS;
  const at = (x: number, y: number) => (Math.floor(y) * AW + Math.floor(x)) * 4;

  return bake(width, ({ n, lon, lat }) => {
    let m = 0;
    let bc = 0;
    let bs = 0;
    for (const d of DECALS) {
      if (dot(n, d.c) <= 0) continue;
      const u = dot(n, d.u) / (2 * d.s) + 0.5;
      const v = dot(n, d.v) / (2 * d.s) + 0.5;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      const i = at((d.cell + u) * CELL, (1 - v) * CELL);
      m = Math.max(m, atlas[i] / 255);
      if (atlas[i + 1] / 255 > bc) {
        bc = atlas[i + 1] / 255;
        bs = atlas[i + 2] / 255;
      }
    }
    m = Math.max(m, ground(n, lon, lat));

    // Glossy glass, top-to-bottom tint.
    const k = smoothstep(0.3, -0.8, n[1]);
    const glass = COPPER.map((c, i) => c + (COPPER_LOW[i] - c) * k) as Vec;
    let rgb = glass;
    let tilt: [number, number] = [0, 0];
    let rough = 0.12;
    let metal = 0;

    if (m > 0.01) {
      const [gx, gy, gz] = grid(n, GRAINS);
      const h = hash(gx, gy, gz);
      const h2 = hash(gx + 11, gy + 5, gz + 3);
      // Cool silver; a few grains flash colour.
      const iri = h2 > 0.7 ? 0.25 : 0;
      const tint = [0, 0.33, 0.67].map(
        (o) => 1 - iri + iri * (0.5 + 0.5 * Math.cos(6.283 * (h2 * 2 + o)))
      );
      const bright = 0.88 + 0.12 * h;
      const grain = SILVER.map((c, i) => Math.min(1, c * tint[i] * bright));
      const cov = m;
      rgb = glass.map((c, i) => c + (grain[i] - c) * cov) as Vec;
      // Grains tip only a little, so plenty of them catch the light at once.
      tilt = [(hash(gx + 3, gy, gz) - 0.5) * 0.7 * cov, (hash(gx, gy + 7, gz) - 0.5) * 0.7 * cov];
      rough = 0.12 + (0.22 + 0.12 * h - 0.12) * cov;
      metal = cov * 0.75;
    }

    // Raised white snow dots, shaded as little domes.
    if (bc > 0.05) {
      const cov = smoothstep(0.25, 0.75, bc);
      const dome = SNOW.map((c) => c * (0.6 + 0.6 * bs) + 0.45 * Math.pow(bs, 8));
      rgb = rgb.map((c, i) => c + (Math.min(1, dome[i]) - c) * cov) as Vec;
      tilt = [tilt[0] * (1 - cov), tilt[1] * (1 - cov)];
      rough = rough + (0.55 - rough) * cov;
      metal = metal * (1 - cov);
    }

    return { rgb, tilt, rough, metal };
  });
}
