import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintCopperBauble } from './copperBauble';
import { HEART_CAP, frostedHeartMesh } from './frostedHeart';
import { goldbirdFigure } from './goldbird';
import { paintJJBauble } from './jjBauble';
import { redbirdFigure } from './redbird';
import { SNOWFLAKE_CORD, SNOWFLAKE_REST, SNOWFLAKE_TILT, snowflakeFigure } from './snowflake';
import { HEAD, songbirdMesh } from './songbird';
import { paintStreaksBauble } from './streaksBauble';
import { swanFigure } from './swan';
import { paintSwirlsBauble } from './swirlsBauble';
import type { GlitterMaps } from './sphereMaps';

/**
 * The Glass Fir: a 2D-canvas fir with four painted glass baubles, a glass
 * songbird, a frosted glass heart, a plum glitter snowflake, and a clip-on
 * glass swan, golden songbird and ruby songbird rendered in WebGL above it
 * that spin and swing on interaction.
 *
 * Coordinates for the tree and baubles are in units of the tree's own height.
 */

type Tier = {
  y0: number;
  y1: number;
  wt: number;
  wb: number;
  fill: string;
  scallops: { x: number; dip: number; lift: number }[];
};

type Pattern =
  | 'jj'
  | 'streaks'
  | 'swirls'
  | 'copper'
  | 'bird'
  | 'heart'
  | 'snowflake'
  | 'swan'
  | 'goldbird'
  | 'redbird';

/** Ornaments that clip onto a branch: no string or cap, and a feather tail. */
const CLIPPED = { swan: swanFigure, goldbird: goldbirdFigure, redbird: redbirdFigure };
const isClipped = (p: Pattern): p is keyof typeof CLIPPED => p in CLIPPED;

type BaubleDef = {
  id: string;
  x: number;
  y: number;
  r: number;
  p: Pattern;
  /** What to call it when it is picked, if not `<id> bauble`. */
  label?: string;
  /** How far from its centre it can be grabbed, in units of `r` over a bauble's reach. */
  reach?: number;
};

/** Where a bauble hangs from, in units of the tree's height: x from the trunk, y down from the top. */
export type Position = { x: number; y: number };
export type Layout = Record<string, Position>;

export type GlassFirOptions = {
  /** A bauble was moved in edit mode. */
  onMove?: (id: string, position: Position) => void;
  /** A bauble was picked with the keyboard in edit mode; for announcing it. */
  onPick?: (label: string) => void;
};

export type GlassFir = {
  /** The baubles' positions, or null to show the tree bare. */
  setLayout: (layout: Layout | null) => void;
  setEditing: (editing: boolean) => void;
  /**
   * Pictures of every ornament on its own, resting and facing front, as transparent
   * PNG data URLs keyed by id; empty without WebGL or before the stage has a size.
   */
  snapshots: () => Record<string, string>;
  /** Sets one ornament swinging, to point it out. */
  nudge: (id: string) => void;
  destroy: () => void;
};

type Bauble = {
  def: BaubleDef;
  x: number;
  y: number;
  pivot: THREE.Group;
  spinner: THREE.Group;
  ball: THREE.Object3D;
  /** A clipped-on ornament: the tilt it rests at, how far it turns either side of that, and how hard its tail is blown, 0 to 1. */
  clip?: { rest: number; tilt: [number, number]; setGust: (gust: number) => void };
  /** A hanging ornament that only turns a little either side of a resting angle, rather than spinning round. */
  turn?: { rest: number; tilt: [number, number] };
  gust: number;
  spin: number;
  spinVel: number;
  base: number;
  sz: number;
  szv: number;
  sx: number;
  sxv: number;
  phase: number;
  sxp: number;
  syp: number;
  rp: number;
};

type Three = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  baubles: Bauble[];
  dispose: () => void;
};

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const TIERS: Tier[] = [
  { y0: 0.0, y1: 0.25, wt: 0, wb: 0.16, fill: '#386d50' },
  { y0: 0.15, y1: 0.43, wt: 0.07, wb: 0.245, fill: '#33674b' },
  { y0: 0.32, y1: 0.62, wt: 0.11, wb: 0.32, fill: '#2f6147' },
  { y0: 0.5, y1: 0.8, wt: 0.15, wb: 0.395, fill: '#2c5c43' },
  { y0: 0.68, y1: 0.93, wt: 0.19, wb: 0.46, fill: '#29573f' },
].map((t, i) => {
  const r = mulberry(11 + i * 7);
  const n = Math.round(t.wb * 16) + 2;
  return {
    ...t,
    scallops: Array.from({ length: n }, (_, k) => ({
      x: t.wb * 0.84 - ((k + 1) * 1.68 * t.wb) / n,
      dip: 0.09 + r() * 0.07,
      lift: k === n - 1 ? 0.01 : (r() - 0.5) * 0.035,
    })),
  };
});

// The figures took the places of the old numbered baubles and keep their ids, so saved
// layouts still place them: the songbird took number 1, the swan number 2, the heart
// number 3, the golden songbird number 4, the snowflake number 6 and the ruby songbird
// number 7. Their `r` is one figure unit.
export const BAUBLES: BaubleDef[] = [
  { id: 'lime-jj', x: 0.015, y: 0.13, r: 0.042, p: 'jj' },
  { id: 'burgundy-swirls', x: -0.12, y: 0.29, r: 0.037, p: 'swirls' },
  { id: 'grey-streaks', x: 0.145, y: 0.33, r: 0.04, p: 'streaks' },
  { id: 'gold', x: -0.01, y: 0.41, r: 0.045, p: 'bird', label: 'glass songbird' },
  { id: 'copper-winter', x: -0.23, y: 0.5, r: 0.042, p: 'copper' },
  {
    id: 'cream-stripes',
    x: 0.215,
    y: 0.52,
    r: 0.058,
    p: 'swan',
    label: 'emerald glass swan',
    reach: 1.4,
  },
  { id: 'teal-flakes', x: 0.03, y: 0.585, r: 0.062, p: 'heart', label: 'frosted glass heart' },
  {
    id: 'pink-bands',
    x: -0.31,
    y: 0.7,
    r: 0.05,
    p: 'goldbird',
    label: 'golden glass songbird',
    reach: 1.4,
  },
  {
    id: 'navy-meridians',
    x: 0.3,
    y: 0.68,
    r: 0.05,
    p: 'snowflake',
    label: 'plum glitter snowflake',
  },
  {
    id: 'red-stars',
    x: 0.12,
    y: 0.79,
    r: 0.04,
    p: 'redbird',
    label: 'ruby glass songbird',
    reach: 1.4,
  },
];

/** Baubles painted by hand with glitter, baked into full material maps. */
const GLITTERED: Partial<
  Record<
    Pattern,
    {
      paint: () => GlitterMaps;
      sheen: number;
      sheenColor: number;
      /** Glossy glass gets a clear coat over the maps. */
      clearcoat?: number;
    }
  >
> = {
  jj: { paint: paintJJBauble, sheen: 0.4, sheenColor: 0xd8f0b0 },
  streaks: { paint: paintStreaksBauble, sheen: 0.25, sheenColor: 0xd4d6da },
  swirls: { paint: paintSwirlsBauble, sheen: 0.25, sheenColor: 0xd05060 },
  copper: { paint: paintCopperBauble, sheen: 0.3, sheenColor: 0xf0a070, clearcoat: 1 },
};
export const DEFAULT_LAYOUT: Layout = Object.fromEntries(
  BAUBLES.map(({ id, x, y }) => [id, { x, y }])
);

const STRING = 0.03;
/** How far below its hanging point a bauble's centre sits, in tree units. */
const drop = (r: number) => STRING + 1.38 * r;
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
const round = (v: number) => Math.round(v * 10000) / 10000;

function star(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? R * 0.46 : R;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/**
 * The silver cap every bauble wears, in units of the bauble's radius with the
 * ball's centre 1.38 below the spinner: a fluted collar between beaded rims,
 * a domed top, and (unless `leaves` is false) a crown of leaves with bead tips
 * lying on the glass.
 */
function capGeometry(leaves = true) {
  const parts: THREE.BufferGeometry[] = [];
  const BALL = -1.38;

  const profile = [
    [0.27, -0.4],
    [0.31, -0.402],
    [0.326, -0.39],
    [0.33, -0.375],
    [0.326, -0.36],
    [0.305, -0.35],
    [0.288, -0.344],
    [0.29, -0.334],
    [0.29, -0.246],
    [0.288, -0.238],
    [0.305, -0.232],
    [0.313, -0.218],
    [0.305, -0.204],
    [0.282, -0.198],
    [0.25, -0.188],
    [0.19, -0.174],
    [0.12, -0.165],
    [0.05, -0.16],
    [0.001, -0.159],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const collar = new THREE.LatheGeometry(profile, 120);
  // Twelve flutes around the collar, fading out at its rims.
  const pos = collar.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.334 || y > -0.246) continue;
    const fade = Math.sin((Math.PI * (y + 0.334)) / 0.088);
    const k = 1 - 0.07 * fade * (0.5 + 0.5 * Math.cos(12 * Math.atan2(pos.getZ(i), pos.getX(i))));
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  parts.push(collar);

  // Beads around the upper rim and a collar bead under the loop.
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    const bead = new THREE.SphereGeometry(0.018, 8, 6);
    bead.translate(Math.cos(a) * 0.315, -0.218, Math.sin(a) * 0.315);
    parts.push(bead);
  }
  parts.push(new THREE.SphereGeometry(0.05, 16, 10).translate(0, -0.158, 0));

  // Leaves lying on the glass below the rim, each ending in a bead.
  const leaf = new THREE.SphereGeometry(1, 16, 10);
  const m = new THREE.Matrix4();
  for (let i = 0; i < (leaves ? 10 : 0); i++) {
    const phi = ((i + 0.5) * Math.PI * 2) / 10;
    const at = (theta: number, lift: number) =>
      new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
      )
        .multiplyScalar(1 + lift)
        .add(new THREE.Vector3(0, BALL, 0));
    const theta = 0.4;
    const n = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi)
    );
    const t = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      -Math.sin(theta),
      Math.cos(theta) * Math.sin(phi)
    );
    const b = new THREE.Vector3().crossVectors(n, t);
    m.makeBasis(b, n, t).setPosition(at(theta, 0));
    parts.push(leaf.clone().scale(0.06, 0.018, 0.13).applyMatrix4(m));
    parts.push(new THREE.SphereGeometry(0.026, 10, 8).translate(...at(0.54, 0.012).toArray()));
  }
  leaf.dispose();

  // Positions only, welded, so the lathe's seam shades smoothly.
  const bare = parts.map((p) => {
    const g = p.toNonIndexed();
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeVertices(mergeGeometries(bare)!, 1e-4);
  bare.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  parts.forEach((p) => p.dispose());
  return merged;
}

/** A tier's outline, mapped from tree units by X and Y. */
function tierPath(t: Tier, X: (u: number) => number, Y: (v: number) => number) {
  const p = new Path2D();
  const h = t.y1 - t.y0;
  const { wt, wb } = t;
  const tw = Math.max(wt, 0.006);
  const ty = t.y0 + (wt ? 0 : 0.006);
  p.moveTo(X(-tw), Y(ty));
  p.quadraticCurveTo(X(0), Y(t.y0 - h * (wt ? 0.06 : 0.03)), X(tw), Y(ty));
  p.bezierCurveTo(
    X(wt + (wb - wt) * 0.3),
    Y(t.y0 + h * 0.32),
    X(wb * 1.04),
    Y(t.y1 - h * 0.5),
    X(wb),
    Y(t.y1 - h * 0.13)
  );
  p.quadraticCurveTo(X(wb * 1.02), Y(t.y1 + h * 0.03), X(wb * 0.84), Y(t.y1 + h * 0.01));
  let prev = wb * 0.84;
  for (const s of t.scallops) {
    p.quadraticCurveTo(X((prev + s.x) / 2), Y(t.y1 + h * s.dip), X(s.x), Y(t.y1 + h * s.lift));
    prev = s.x;
  }
  p.quadraticCurveTo(X(-wb * 1.02), Y(t.y1 + h * 0.03), X(-wb), Y(t.y1 - h * 0.13));
  p.bezierCurveTo(
    X(-wb * 1.04),
    Y(t.y1 - h * 0.5),
    X(-wt - (wb - wt) * 0.3),
    Y(t.y0 + h * 0.32),
    X(-tw),
    Y(ty)
  );
  p.closePath();
  return p;
}

function initThree(canvas: HTMLCanvasElement, reduced: boolean): Three {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 1, 10000);
  const disposables: { dispose: () => void }[] = [renderer];

  // A soft studio box with three light panels, baked into an environment map for the glass reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x2a3f33, side: THREE.BackSide })
    )
  );
  const panel = (w: number, h: number, color: THREE.Color, pos: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(6, 4, new THREE.Color(2.4, 2.4, 2.3), [-4, 5, 6]);
  panel(3, 6, new THREE.Color(1.3, 1.15, 0.9), [7, 1, 2]);
  panel(12, 2, new THREE.Color(0.45, 0.6, 0.5), [0, -6, 2]);
  const envTarget = pmrem.fromScene(env, 0.02);
  scene.environment = envTarget.texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  disposables.push(envTarget);

  // Modern three.js no longer scales punctual light intensity by π; restore the original balance.
  const key = new THREE.DirectionalLight(0xffffff, 1.1 * Math.PI);
  key.position.set(-1, 1.4, 1.6);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.12 * Math.PI));

  // Bare until a layout arrives.
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const sphereGeo = new THREE.SphereGeometry(1, 64, 48);
  const capGeo = capGeometry();
  const collarGeo = capGeometry(false);
  const loopGeo = new THREE.TorusGeometry(0.1, 0.028, 10, 24);
  const stringGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 1, roughness: 0.22 });
  const stringMat = new THREE.MeshBasicMaterial({ color: 0x4a3c2a });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x9a4f86 });

  const sh = document.createElement('canvas');
  sh.width = sh.height = 128;
  const sg = sh.getContext('2d')!;
  const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(10,30,20,0.55)');
  grad.addColorStop(0.55, 'rgba(10,30,20,0.25)');
  grad.addColorStop(1, 'rgba(10,30,20,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sh);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  });
  disposables.push(
    sphereGeo,
    capGeo,
    collarGeo,
    loopGeo,
    stringGeo,
    planeGeo,
    capMat,
    stringMat,
    cordMat,
    shadowTex,
    shadowMat
  );

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const rnd = mulberry(3);
  const baubles = BAUBLES.map((def): Bauble => {
    let ball: THREE.Object3D;
    let clip: Bauble['clip'];
    const glitter = GLITTERED[def.p];
    if (def.p === 'bird') {
      const bird = songbirdMesh();
      ball = bird.mesh;
      disposables.push(bird);
    } else if (def.p === 'heart') {
      const heart = frostedHeartMesh();
      ball = heart.mesh;
      disposables.push(heart);
    } else if (def.p === 'snowflake') {
      const flake = snowflakeFigure();
      ball = flake.object;
      disposables.push(flake);
    } else if (isClipped(def.p)) {
      const figure = CLIPPED[def.p](reduced);
      ball = figure.object;
      clip = figure;
      disposables.push(figure);
    } else if (glitter) {
      // Glass with glitter: the maps carry the colour, the grain and which parts are metal.
      const maps = glitter.paint();
      const tex = (cv: HTMLCanvasElement) => {
        const t = new THREE.CanvasTexture(cv);
        t.anisotropy = aniso;
        disposables.push(t);
        return t;
      };
      const map = tex(maps.map);
      map.colorSpace = THREE.SRGBColorSpace;
      const rm = tex(maps.roughnessMetalnessMap);
      const mat = new THREE.MeshPhysicalMaterial({
        map,
        normalMap: tex(maps.normalMap),
        roughnessMap: rm,
        metalnessMap: rm,
        roughness: 1,
        metalness: 1,
        sheen: glitter.sheen,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(glitter.sheenColor),
        clearcoat: glitter.clearcoat ?? 0,
        clearcoatRoughness: 0.06,
      });
      disposables.push(mat);
      ball = new THREE.Mesh(sphereGeo, mat);
    } else {
      throw new Error(`No ornament for ${def.p}`);
    }

    const r = def.r;
    // The bird wears a smaller cap, sized to its head; the heart a plain collar over its neck.
    const capR = def.p === 'bird' ? HEAD * r : def.p === 'heart' ? HEART_CAP * r : r;
    const pivot = new THREE.Group();
    // The snowflake hangs on a mauve cord as thick as the one through its arm.
    const flake = def.p === 'snowflake';
    const str = new THREE.Mesh(stringGeo, flake ? cordMat : stringMat);
    const strR = flake ? SNOWFLAKE_CORD * r : 0.0011;
    str.scale.set(strR, STRING, strR);
    str.position.y = -STRING / 2;
    const spinner = new THREE.Group();
    spinner.position.y = -STRING;
    const loop = new THREE.Mesh(loopGeo, capMat);
    loop.scale.setScalar(capR);
    loop.position.y = -0.09 * capR;
    const cap = new THREE.Mesh(def.p === 'heart' ? collarGeo : capGeo, capMat);
    cap.scale.setScalar(capR);
    ball.scale.setScalar(r);
    ball.position.y = -1.38 * r;
    // The clipped ornaments sit on the branch: no string, loop or cap; the snowflake's cord runs
    // straight through its arm.
    if (clip || flake) spinner.add(ball);
    else spinner.add(loop, cap, ball);
    const shadow = new THREE.Mesh(planeGeo, shadowMat);
    if (def.p === 'bird') shadow.scale.set(r * 2.2, r * 3.6, 1);
    else if (def.p === 'heart') shadow.scale.set(r * 2.0, r * 1.8, 1);
    else if (flake) shadow.scale.set(r * 2.2, r * 2.4, 1);
    else if (def.p === 'swan') shadow.scale.set(r * 3.4, r * 2.2, 1);
    else if (def.p === 'goldbird') shadow.scale.set(r * 3.6, r * 1.5, 1);
    else if (def.p === 'redbird') shadow.scale.set(r * 4.2, r * 1.8, 1);
    else shadow.scale.setScalar(r * 2.7);
    shadow.position.set(r * 0.4, -STRING - 1.38 * r - r * 0.3, -r * 1.2);
    if (def.p === 'swan') shadow.position.x += r * 0.5;
    if (def.p === 'goldbird') shadow.position.x += r * 0.3;
    if (def.p === 'redbird') shadow.position.x += r * 0.5;
    pivot.add(...(clip ? [] : [str]), spinner, shadow);
    root.add(pivot);
    const turn = flake ? { rest: SNOWFLAKE_REST, tilt: SNOWFLAKE_TILT } : undefined;
    const limited = clip ?? turn;

    return {
      def,
      x: def.x,
      y: def.y,
      pivot,
      spinner,
      ball,
      clip,
      turn,
      gust: 0,
      // A clipped or turning ornament doesn't spin round: its spin is a tilt either side of its
      // resting angle.
      spin: limited ? 0 : rnd() * Math.PI * 2,
      spinVel: 0,
      base: reduced || limited ? 0 : (rnd() < 0.5 ? -1 : 1) * (0.18 + rnd() * 0.18),
      sz: 0,
      szv: 0,
      sx: 0,
      sxv: 0,
      phase: rnd() * Math.PI * 2,
      sxp: 0,
      syp: 0,
      rp: 0,
    };
  });

  return {
    renderer,
    scene,
    camera,
    root,
    baubles,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/**
 * Mounts the tree into `stage` (a positioned element), bare until it is given
 * a layout, and returns a handle to arrange it and to tear it down.
 */
export function mountGlassFir(stage: HTMLElement, options: GlassFirOptions = {}): GlassFir {
  const [treeCanvas, glCanvas] = ['tree', 'gl'].map((name) => {
    const cv = document.createElement('canvas');
    cv.dataset.layer = name;
    stage.append(cv);
    return cv;
  });
  const canvases = { tree: treeCanvas, gl: glCanvas };
  const treeCtx = canvases.tree.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (name: string) => getComputedStyle(stage).getPropertyValue(name).trim();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let TH = 0;
  let cx = 0;
  let top = 0;
  let paths: Path2D[] = [];

  const X = (u: number) => cx + u * TH;
  const Y = (v: number) => top + v * TH;

  function drawTree() {
    const ctx = treeCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const S = TH;

    ctx.fillStyle = css('--snow');
    ctx.beginPath();
    ctx.ellipse(X(0), Y(1.0), S * 0.44, S * 0.038, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6a4630';
    ctx.beginPath();
    ctx.moveTo(X(-0.032), Y(0.86));
    ctx.lineTo(X(0.032), Y(0.86));
    ctx.quadraticCurveTo(X(0.036), Y(0.96), X(0.05), Y(1.0));
    ctx.lineTo(X(-0.05), Y(1.0));
    ctx.quadraticCurveTo(X(-0.036), Y(0.96), X(-0.032), Y(0.86));
    ctx.fill();

    for (let i = TIERS.length - 1; i >= 0; i--) {
      const t = TIERS[i];
      const path = paths[i];
      // The tier above casts a flat shadow onto what is already drawn.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.translate(S * 0.005, S * 0.022);
      ctx.fillStyle = 'rgba(18, 44, 31, 0.78)';
      ctx.fill(path);
      ctx.restore();

      ctx.fillStyle = t.fill;
      ctx.fill(path);

      // Needles.
      ctx.save();
      ctx.clip(path);
      const r = mulberry(101 + i * 13);
      const count = Math.round(((t.wb + t.wt) * (t.y1 - t.y0)) / 0.0026);
      ctx.lineCap = 'round';
      for (let k = 0; k < count; k++) {
        const u = (r() * 2 - 1) * t.wb;
        const v = t.y0 + r() * (t.y1 - t.y0 + 0.03);
        const light = r() < 0.18;
        const a = -1.2 + (r() - 0.5) * 0.55;
        const len = S * (0.009 + r() * 0.007);
        ctx.strokeStyle = light ? 'rgba(98, 150, 116, 0.55)' : 'rgba(22, 52, 37, 0.85)';
        ctx.lineWidth = S * (light ? 0.0028 : 0.0034);
        ctx.beginPath();
        ctx.moveTo(X(u) - (Math.cos(a) * len) / 2, Y(v) - (Math.sin(a) * len) / 2);
        ctx.lineTo(X(u) + (Math.cos(a) * len) / 2, Y(v) + (Math.sin(a) * len) / 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    const sx = X(0);
    const sy = Y(-0.03);
    const R = S * 0.052;
    star(ctx, sx + S * 0.004, sy + S * 0.007, R, 0.12);
    ctx.fillStyle = '#b97d17';
    ctx.fill();
    star(ctx, sx, sy, R, 0.12);
    ctx.fillStyle = '#f2b534';
    ctx.fill();
  }

  let three: Three | null = null;
  try {
    three = initThree(canvases.gl, reduced);
  } catch {
    // No WebGL: the tree still renders, just without the glass baubles.
    three = null;
  }

  function place(b: Bauble) {
    b.pivot.position.set(b.x * TH, -b.y * TH, 0);
  }

  function layout() {
    const rect = stage.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    TH = Math.min((H * 0.94) / 1.08, (W - 32) / 0.98);
    cx = W / 2;
    top = (H - 1.08 * TH) / 2 + 0.07 * TH;
    canvases.tree.width = Math.round(W * dpr);
    canvases.tree.height = Math.round(H * dpr);
    paths = TIERS.map((t) => tierPath(t, X, Y));
    drawTree();

    if (three) {
      const { renderer, camera, root, baubles } = three;
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      const dist = H / 2 / Math.tan(THREE.MathUtils.degToRad(11));
      camera.position.set(0, 0, dist);
      camera.near = dist * 0.2;
      camera.far = dist * 3;
      camera.updateProjectionMatrix();
      root.position.set(cx - W / 2, H / 2 - top, 0);
      for (const b of baubles) {
        place(b);
        b.pivot.scale.setScalar(TH);
      }
    }
  }

  // ---------- The tree's silhouette ----------
  // Tiers traced at a fixed scale, so a point in tree units can be tested whatever the stage's size.
  const SIL = 1000;
  const silhouette = TIERS.map((t) =>
    tierPath(
      t,
      (u) => u * SIL,
      (v) => v * SIL
    )
  );
  const silCtx = document.createElement('canvas').getContext('2d')!;
  const inside = (u: number, v: number) =>
    silhouette.some((p) => silCtx.isPointInPath(p, u * SIL, v * SIL));

  /**
   * Moves a bauble's centre towards (u, v) in tree units, as far as it can go
   * along the way without leaving the tree. Returns whether it moved.
   */
  function moveCentre(b: Bauble, u: number, v: number) {
    const d = drop(b.def.r);
    const fromU = b.x;
    const fromV = b.y + d;
    let lo = 0;
    let hi = 1;
    if (!inside(u, v)) {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (inside(fromU + (u - fromU) * mid, fromV + (v - fromV) * mid)) lo = mid;
        else hi = mid;
      }
      hi = lo;
    }
    const nx = fromU + (u - fromU) * hi;
    const ny = fromV + (v - fromV) * hi - d;
    if (Math.abs(nx - b.x) < 1e-6 && Math.abs(ny - b.y) < 1e-6) return false;
    b.szv += clamp((nx - b.x) * 40, 1.5);
    b.x = nx;
    b.y = ny;
    if (TH) place(b);
    options.onMove?.(b.def.id, { x: round(b.x), y: round(b.y) });
    return true;
  }

  // ---------- Interaction ----------
  let editing = false;
  const shown = () => !!three?.root.visible;

  const v3 = new THREE.Vector3();
  function project() {
    if (!three) return;
    for (const b of three.baubles) {
      b.ball.getWorldPosition(v3).project(three.camera);
      b.sxp = ((v3.x + 1) / 2) * W;
      b.syp = ((1 - v3.y) / 2) * H;
      b.rp = b.def.r * TH;
    }
  }

  const hit = (x: number, y: number) => {
    if (!three || !shown()) return null;
    let best: Bauble | null = null;
    let bd = Infinity;
    for (const b of three.baubles) {
      const d = Math.hypot(b.sxp - x, b.syp - y);
      if (d < b.rp * 1.25 * (b.def.reach ?? 1) && d < bd) {
        best = b;
        bd = d;
      }
    }
    return best;
  };

  type Point = { x: number; y: number; t: number };
  let last: Point | null = null;
  let grabbed: Bauble | null = null;
  // In edit mode, where on the grabbed bauble the pointer holds it, from its centre in px.
  let hold = { x: 0, y: 0 };
  const local = (e: PointerEvent): Point => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  };

  const onPointerDown = (e: PointerEvent) => {
    const p = local(e);
    last = p;
    grabbed = hit(p.x, p.y);
    if (grabbed) {
      if (editing) {
        hold = { x: p.x - X(grabbed.x), y: p.y - Y(grabbed.y + drop(grabbed.def.r)) };
      }
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = 'grabbing';
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = local(e);
    if (!three) return;
    if (editing) {
      last = p;
      if (grabbed) moveCentre(grabbed, (p.x - hold.x - cx) / TH, (p.y - hold.y - top) / TH);
      else if (e.pointerType === 'mouse') stage.style.cursor = hit(p.x, p.y) ? 'grab' : 'default';
      return;
    }
    if (!last || (e.pointerType !== 'mouse' && e.buttons === 0)) {
      last = p;
      return;
    }
    const dx = clamp(p.x - last.x, 80);
    const dy = clamp(p.y - last.y, 80);
    const dt = Math.max(0.008, (p.t - last.t) / 1000);
    last = p;
    if (grabbed) {
      const turn = dx / grabbed.rp;
      grabbed.spin += turn;
      grabbed.spinVel = grabbed.spinVel * 0.5 + clamp(turn / dt, 18) * 0.5;
      grabbed.szv += dx * 0.004;
      return;
    }
    // Sweeping past the branches nudges every bauble within reach.
    for (const b of three.baubles) {
      const reach = b.rp * 1.7 + 30;
      const f = Math.exp(-((Math.hypot(b.sxp - p.x, b.syp - p.y) / reach) ** 2));
      if (f < 0.02) continue;
      b.spinVel = clamp(b.spinVel + (dx / b.rp) * 7 * f, 16);
      b.szv += dx * 0.011 * f;
      b.sxv += dy * 0.009 * f;
    }
    if (e.pointerType === 'mouse') stage.style.cursor = hit(p.x, p.y) ? 'grab' : 'default';
  };

  const release = () => {
    grabbed = null;
    stage.style.cursor = 'default';
  };
  const onPointerLeave = () => {
    if (!grabbed) last = null;
  };

  const KEYS: Record<string, [number, number, number]> = {
    ArrowLeft: [-5, -0.5, 0],
    ArrowRight: [5, 0.5, 0],
    ArrowUp: [0, 0, -0.5],
    ArrowDown: [0, 0, 0.5],
  };
  const STEPS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  // The bauble picked with [ and ] in edit mode.
  let picked = 0;
  const labelOf = (b: Bauble) => b.def.label ?? `${b.def.id.replace('-', ' ')} bauble`;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!three || !shown()) return;
    if (editing) {
      const { baubles } = three;
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        picked = (picked + (e.key === ']' ? 1 : -1) + baubles.length) % baubles.length;
        const b = baubles[picked];
        b.szv += 0.6;
        options.onPick?.(labelOf(b));
        return;
      }
      const step = STEPS[e.key];
      if (!step) return;
      e.preventDefault();
      const b = baubles[picked];
      const size = e.shiftKey ? 0.02 : 0.005;
      moveCentre(b, b.x + step[0] * size, b.y + drop(b.def.r) + step[1] * size);
      return;
    }
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    for (const b of three.baubles) {
      b.spinVel = clamp(b.spinVel + k[0] * (0.7 + Math.random() * 0.6), 16);
      b.szv += k[1] * (0.6 + Math.random() * 0.8);
      b.sxv += k[2] * (0.6 + Math.random() * 0.8);
    }
  };

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', onPointerLeave);
  stage.addEventListener('keydown', onKeyDown);

  // ---------- Loop ----------
  let prevT = performance.now();
  let raf = 0;
  function frame(now: number) {
    const dt = Math.min(0.05, (now - prevT) / 1000);
    prevT = now;
    const t = now / 1000;
    if (three) {
      for (const b of three.baubles) {
        const limited = b.clip ?? b.turn;
        if (limited) {
          // Clipped on or turning on its cord: a nudge tilts it a little and it springs back.
          if (b.clip) {
            // ...and blows through the plume.
            b.gust = Math.max(
              b.gust * Math.exp(-dt * 1.1),
              Math.min(1, Math.abs(b.spinVel) * 0.08 + Math.abs(b.szv) * 0.4)
            );
            b.clip.setGust(b.gust);
          }
          if (b !== grabbed || editing) {
            b.spinVel += (-10 * b.spin - 3 * b.spinVel) * dt;
            b.spin += b.spinVel * dt;
          }
          const tilt = Math.min(limited.tilt[1], Math.max(limited.tilt[0], b.spin));
          if (tilt !== b.spin) {
            b.spin = tilt;
            b.spinVel = 0;
          }
        } else if (b !== grabbed || editing) {
          b.spinVel += (b.base - b.spinVel) * (1 - Math.exp(-0.55 * dt));
          b.spin += b.spinVel * dt;
        }
        // Damped spring pulls each bauble back to hanging straight, with a slight idle sway.
        const k = 18;
        const c = 1.5;
        const idle = reduced ? 0 : Math.sin(t * 0.9 + b.phase) * 0.012;
        b.szv += (-k * (b.sz - idle) - c * b.szv) * dt;
        b.sxv += (-k * b.sx - c * b.sxv) * dt;
        b.sz = clamp(b.sz + b.szv * dt, 0.7);
        b.sx = clamp(b.sx + b.sxv * dt, 0.6);
        // A clipped ornament only wobbles a little on its branch.
        const sway = b.clip ? 0.3 : 1;
        b.spinner.rotation.y = limited ? limited.rest + b.spin : b.spin;
        b.pivot.rotation.z = b.sz * sway;
        b.pivot.rotation.x = b.sx * sway;
      }
      three.renderer.render(three.scene, three.camera);
      project();
    }
    raf = requestAnimationFrame(frame);
  }

  layout();
  const resizeObserver = new ResizeObserver(() => layout());
  resizeObserver.observe(stage);

  const redraw = () => {
    if (!W || !H) return;
    drawTree();
  };
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  darkQuery.addEventListener('change', redraw);

  // Opening: a wave of turning glass runs down the tree as the baubles appear.
  let timers: number[] = [];
  function wave() {
    if (!three || reduced) return;
    for (const b of three.baubles) {
      timers.push(
        window.setTimeout(
          () => {
            b.spinVel += 7 * (b.base < 0 ? -1 : 1);
            b.szv += 0.5 * (b.x < 0 ? -1 : 1);
          },
          300 + b.y * 1100
        )
      );
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    setLayout(next) {
      if (!three) return;
      const wasShown = shown();
      three.root.visible = !!next;
      if (!next) {
        timers.forEach(clearTimeout);
        timers = [];
        grabbed = null;
        return;
      }
      for (const b of three.baubles) {
        const p = next[b.def.id] ?? DEFAULT_LAYOUT[b.def.id];
        // Moves made here come back rounded; only a real change (load, discard) moves a bauble.
        if (Math.abs(b.x - p.x) < 2e-4 && Math.abs(b.y - p.y) < 2e-4) continue;
        b.x = p.x;
        b.y = p.y;
        if (TH) place(b);
        if (wasShown) b.szv += 0.4;
      }
      if (!wasShown) wave();
    },
    setEditing(on) {
      editing = on;
      grabbed = null;
      last = null;
      stage.style.cursor = 'default';
    },
    snapshots() {
      if (!three || !W || !H) return {};
      const { renderer, scene, camera, root, baubles } = three;
      // Square pictures as big as the stage allows, in CSS pixels.
      const size = Math.floor(Math.min(360, W, H));
      const px = Math.round(size * dpr);
      const shot = new THREE.PerspectiveCamera(22, 1, 1, 10000);
      const dist = size / 2 / Math.tan(THREE.MathUtils.degToRad(11));
      const out = document.createElement('canvas');
      out.width = out.height = px;
      const ctx = out.getContext('2d')!;
      const box = new THREE.Box3();
      const centre = new THREE.Vector3();
      const extent = new THREE.Vector3();
      const wasShown = root.visible;
      root.visible = true;
      const pictures: Record<string, string> = {};

      for (const b of baubles) {
        // Only this ornament, without its string or shadow, resting and facing front.
        const hidden = baubles.map((o) => [o.pivot, o.pivot.visible] as const);
        for (const o of baubles) o.pivot.visible = o === b;
        const parts = b.pivot.children.map((c) => [c, c.visible] as const);
        for (const c of b.pivot.children) c.visible = c === b.spinner;
        const pose = [
          b.spinner.rotation.y,
          b.pivot.rotation.x,
          b.pivot.rotation.z,
          b.pivot.scale.x,
        ];
        const limited = b.clip ?? b.turn;
        b.spinner.rotation.y = limited ? limited.rest : 0;
        b.pivot.rotation.set(0, 0, 0);

        // Scaled up rather than zoomed in on, so the raymarched figures keep their one-pixel edges.
        root.updateMatrixWorld(true);
        box.setFromObject(b.spinner).getSize(extent);
        b.pivot.scale.multiplyScalar((0.86 * size) / Math.max(extent.x, extent.y, 1e-6));
        root.updateMatrixWorld(true);
        box.setFromObject(b.spinner).getCenter(centre);
        shot.position.set(centre.x, centre.y, centre.z + dist);
        shot.near = dist * 0.2;
        shot.far = dist * 3;
        shot.lookAt(centre);
        shot.updateProjectionMatrix();

        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, size, size);
        renderer.setViewport(0, 0, size, size);
        renderer.clear();
        renderer.render(scene, shot);
        ctx.clearRect(0, 0, px, px);
        // The viewport sits at the canvas's bottom left.
        ctx.drawImage(glCanvas, 0, glCanvas.height - px, px, px, 0, 0, px, px);
        pictures[b.def.id] = out.toDataURL('image/png');

        b.spinner.rotation.y = pose[0];
        b.pivot.rotation.set(pose[1], 0, pose[2]);
        b.pivot.scale.setScalar(pose[3]);
        for (const [c, v] of parts) c.visible = v;
        for (const [o, v] of hidden) o.visible = v;
      }

      root.visible = wasShown;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
      renderer.render(scene, camera);
      return pictures;
    },
    nudge(id) {
      const b = three?.baubles.find((o) => o.def.id === id);
      if (!b) return;
      b.szv += 0.6;
      b.spinVel += (b.clip ?? b.turn) ? 1.5 : 3;
    },
    destroy() {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
      darkQuery.removeEventListener('change', redraw);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', release);
      stage.removeEventListener('pointercancel', release);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('keydown', onKeyDown);
      three?.dispose();
      for (const cv of [treeCanvas, glCanvas]) cv.remove();
    },
  };
}
