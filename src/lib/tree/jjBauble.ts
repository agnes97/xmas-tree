/**
 * The J+J bauble: satin lime glass, hand-dabbed with silver glitter — "<2" on
 * one side, "J+J" on the other, and glitter snowflakes all around.
 *
 * The glitter is drawn flat into an atlas (one cell per motif), then each motif
 * is projected onto the sphere as a decal and baked (see sphereMaps) with a
 * grainy normal map, so the glitter catches the light as it turns.
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
const CELLS = 5;
/** Text decals span this many sphere radii from their centre. */
const TEXT_S = 0.85;
/** Glitter grains per sphere radius. */
const GRAINS = 70;

const LIME: Vec = [0.205, 0.56, 0.018];
const SILVER: Vec = [0.72, 0.78, 0.66];

function catmull(pts: Pt[], seg = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    for (let t = 0; t < seg; t++) {
      const s = t / seg;
      const s2 = s * s;
      const s3 = s2 * s;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * s +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

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

// Hand wobble, so the strokes don't look machine-drawn.
const wobble = (pts: Pt[], amt: number): Pt[] =>
  pts.map(([x, y], i) => [
    x + Math.sin(i * 0.9 + x * 7) * amt,
    y + Math.cos(i * 0.7 + y * 5) * amt,
  ]);

function drawAtlas() {
  const rnd = seeded(97);

  const atlas = document.createElement('canvas');
  atlas.width = CELL * CELLS;
  atlas.height = CELL;
  const ctx = atlas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, atlas.width, atlas.height);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

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

  // Text is laid out in sphere-tangent units (radius 1), x right, y up.
  const toCell =
    (cell: number) =>
    ([x, y]: Pt): Pt => [
      cell * CELL + CELL / 2 + ((x / TEXT_S) * CELL) / 2,
      CELL / 2 - ((y / TEXT_S) * CELL) / 2,
    ];
  const textW = (0.085 / (2 * TEXT_S)) * CELL;

  {
    // Cell 0: "<2"
    const T = toCell(0);
    const less: Pt[] = [
      [-0.37, 0.6],
      [-0.79, 0.04],
      [-0.21, -0.57],
    ];
    glitter(wobble(densify(less, 0.02), 0.006).map(T), textW);
    const two = catmull([
      [-0.13, 0.36],
      [-0.02, 0.59],
      [0.22, 0.7],
      [0.47, 0.6],
      [0.56, 0.36],
      [0.44, 0.07],
      [0.16, -0.24],
      [-0.07, -0.51],
    ]).concat(
      catmull(
        [
          [-0.07, -0.51],
          [0.3, -0.5],
          [0.66, -0.48],
          [0.79, -0.39],
        ],
        10
      )
    );
    glitter(wobble(two, 0.006).map(T), textW);
  }
  {
    // Cell 1: "J+J" — each J has a short tick, a flat top bar, a stem and a curl that hooks back in.
    const T = toCell(1);
    const J1 = densify(
      [
        [-0.78, 0.25],
        [-0.71, 0.5],
        [-0.54, 0.53],
      ],
      0.02
    ).concat(
      catmull([
        [-0.54, 0.53],
        [-0.51, 0.19],
        [-0.475, -0.28],
        [-0.47, -0.56],
        [-0.55, -0.62],
        [-0.69, -0.53],
        [-0.78, -0.375],
        [-0.8, -0.27],
        [-0.73, -0.23],
      ])
    );
    const J2 = densify(
      [
        [0.24, 0.41],
        [0.24, 0.58],
        [0.41, 0.55],
        [0.56, 0.5],
      ],
      0.02
    ).concat(
      catmull([
        [0.56, 0.5],
        [0.59, 0.19],
        [0.61, -0.28],
        [0.61, -0.58],
        [0.5, -0.625],
        [0.28, -0.59],
        [0.17, -0.45],
        [0.19, -0.33],
        [0.3, -0.31],
        [0.375, -0.375],
      ])
    );
    glitter(wobble(J1, 0.005).map(T), textW);
    glitter(wobble(J2, 0.005).map(T), textW);
    const bar: Pt[] = [
      [-0.3, -0.02],
      [0.23, -0.02],
    ];
    const post: Pt[] = [
      [-0.03, 0.2],
      [-0.03, -0.2],
    ];
    glitter(densify(bar, 0.02).map(T), textW * 1.05);
    glitter(densify(post, 0.02).map(T), textW * 1.05);
  }

  // Cells 2–4: hand-dabbed glitter snowflakes, short thick arms, slightly uneven.
  function flake(cell: number, arms: number, turn: number) {
    const cx = cell * CELL + CELL / 2;
    const cy = CELL / 2;
    const R = CELL * 0.45;
    const w = CELL * 0.11;
    for (let a = 0; a < arms; a++) {
      const ang = turn + (a * 2 * Math.PI) / arms + (rnd() - 0.5) * 0.22;
      const len = R * (0.78 + 0.22 * rnd());
      const arm: Pt[] = [
        [cx, cy],
        [cx + Math.cos(ang) * len, cy - Math.sin(ang) * len],
      ];
      glitter(densify(arm, 4), w * (0.85 + 0.25 * rnd()));
    }
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.75, 0, 6.283);
    ctx.fill();
  }
  flake(2, 6, 0.3);
  flake(3, 8, 0.1);
  flake(4, 6, 0);

  return ctx.getImageData(0, 0, atlas.width, atlas.height).data;
}

const FLAKES: [number, number, number][] = [
  // A ring around J+J.
  [128, 51, 0.15],
  [204, 57, 0.15],
  [104, 0, 0.15],
  [253, 20, 0.15],
  [126, -57, 0.14],
  [228, -51, 0.14],
  // A ring around <2.
  [-8, 50, 0.14],
  [60, 22, 0.14],
  [70, -40, 0.14],
  [-58, -46, 0.13],
  [-80, 26, 0.14],
  // The sides between.
  [100, 45, 0.14],
  [100, -45, 0.14],
  [280, -4, 0.14],
  [290, 50, 0.13],
  [262, -45, 0.14],
];

const DECALS: (Decal & { cell: number })[] = [
  { ...decal(0, -2, TEXT_S), cell: 0 },
  { ...decal(180, 0, TEXT_S), cell: 1 },
  ...FLAKES.map(([lon, lat, s], i) => ({
    ...decal(lon, lat, s, (i * 37) % 60),
    cell: 2 + (i % 3),
  })),
];

export function paintJJBauble(width = 1024): GlitterMaps {
  const atlas = drawAtlas();
  const AW = CELL * CELLS;
  const sample = (x: number, y: number) => atlas[(Math.floor(y) * AW + Math.floor(x)) * 4] / 255;

  return bake(width, ({ n }) => {
    let m = 0;
    for (const d of DECALS) {
      if (dot(n, d.c) <= 0) continue;
      const u = dot(n, d.u) / (2 * d.s) + 0.5;
      const v = dot(n, d.v) / (2 * d.s) + 0.5;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      m = Math.max(m, sample((d.cell + u) * CELL, (1 - v) * CELL));
    }
    if (m <= 0.01) return { rgb: LIME, tilt: [0, 0], rough: 0.42, metal: 0 };

    const gx = Math.floor(n[0] * GRAINS);
    const gy = Math.floor(n[1] * GRAINS);
    const gz = Math.floor(n[2] * GRAINS);
    const h = hash(gx, gy, gz);
    const h2 = hash(gx + 11, gy + 5, gz + 3);
    // Most grains are silver; a few flash green, gold or pink.
    const iri = h2 > 0.7 ? 0.35 : 0;
    const tint = [0, 0.33, 0.67].map(
      (o) => 1 - iri + iri * (0.5 + 0.5 * Math.cos(6.283 * (h2 * 2 + o)))
    );
    const bright = 0.75 + 0.5 * h;
    const grain = SILVER.map((c, k) => c * tint[k] * bright) as Vec;
    const cov = m * (0.72 + 0.28 * h);
    return {
      rgb: LIME.map((c, k) => c + (grain[k] - c) * cov) as Vec,
      // Each grain is a tiny flat mirror, tipped its own way.
      tilt: [(hash(gx + 3, gy, gz) - 0.5) * 1.3 * cov, (hash(gx, gy + 7, gz) - 0.5) * 1.3 * cov],
      rough: 0.42 + (0.18 - 0.42) * cov,
      metal: cov * 0.9,
    };
  });
}
