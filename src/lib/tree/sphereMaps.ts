/**
 * Shared baking for hand-decorated baubles: a shader per surface point is run
 * over equirectangular maps that match three.js's SphereGeometry UVs, giving a
 * colour map, a normal map, and roughness/metalness.
 */

export type Vec = [number, number, number];

export type GlitterMaps = {
  map: HTMLCanvasElement;
  normalMap: HTMLCanvasElement;
  /** Roughness in green, metalness in blue, as three.js reads them. */
  roughnessMetalnessMap: HTMLCanvasElement;
};

/** What a surface point looks like; tilt is the normal-map offset along (+u, +v). */
export type Surface = { rgb: Vec; tilt: [number, number]; rough: number; metal: number };

/**
 * A point on the unit sphere, with its longitude (0 facing the viewer, +x to
 * the right), latitude, and the tangent directions along +u (east) and +v (north).
 */
export type SpherePoint = {
  n: Vec;
  lon: number;
  lat: number;
  east: Vec;
  north: Vec;
};

export type Decal = { c: Vec; u: Vec; v: Vec; s: number };

/** A motif centred at (lon, lat) on the sphere, lon 0 facing the viewer, turned by rot degrees. */
export function decal(lon: number, lat: number, s: number, rot = 0): Decal {
  const D = Math.PI / 180;
  const l = lon * D;
  const b = lat * D;
  const r = rot * D;
  const c: Vec = [Math.sin(l) * Math.cos(b), Math.sin(b), Math.cos(l) * Math.cos(b)];
  const e: Vec = [Math.cos(l), 0, -Math.sin(l)];
  const n: Vec = [-Math.sin(l) * Math.sin(b), Math.cos(b), -Math.cos(l) * Math.sin(b)];
  const u = e.map((x, i) => x * Math.cos(r) + n[i] * Math.sin(r)) as Vec;
  const v = e.map((x, i) => -x * Math.sin(r) + n[i] * Math.cos(r)) as Vec;
  return { c, u, v, s };
}

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const hash = (x: number, y: number, z: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Park–Miller, as the artifact sketches used, so motifs come out the same each load. */
export const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const srgb = (v: number) => toByte(Math.pow(Math.max(0, v), 1 / 2.2));

export function bake(width: number, shade: (p: SpherePoint) => Surface): GlitterMaps {
  const height = width / 2;
  const make = () => {
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const g = cv.getContext('2d')!;
    return { cv, g, img: g.createImageData(width, height) };
  };
  const color = make();
  const normal = make();
  const rm = make();

  for (let py = 0; py < height; py++) {
    // Matches SphereGeometry: theta from the top pole, phi around from -x.
    const theta = ((py + 0.5) / height) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      const n: Vec = [-cp * st, ct, sp * st];
      const { rgb, tilt, rough, metal } = shade({
        n,
        lon: Math.atan2(n[0], n[2]),
        lat: Math.PI / 2 - theta,
        east: [sp, 0, cp],
        north: [ct * cp, st, -ct * sp],
      });

      const i = (py * width + px) * 4;
      color.img.data[i] = srgb(rgb[0]);
      color.img.data[i + 1] = srgb(rgb[1]);
      color.img.data[i + 2] = srgb(rgb[2]);
      color.img.data[i + 3] = 255;

      const len = Math.hypot(tilt[0], tilt[1], 1);
      normal.img.data[i] = toByte(0.5 + (0.5 * tilt[0]) / len);
      normal.img.data[i + 1] = toByte(0.5 + (0.5 * tilt[1]) / len);
      normal.img.data[i + 2] = toByte(0.5 + 0.5 / len);
      normal.img.data[i + 3] = 255;

      rm.img.data[i] = 0;
      rm.img.data[i + 1] = toByte(rough);
      rm.img.data[i + 2] = toByte(metal);
      rm.img.data[i + 3] = 255;
    }
  }

  for (const { g, img } of [color, normal, rm]) g.putImageData(img, 0, 0);
  return { map: color.cv, normalMap: normal.cv, roughnessMetalnessMap: rm.cv };
}
