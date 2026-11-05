import * as THREE from 'three';

/**
 * Shared setup for ornaments that are raymarched as signed-distance figures:
 * a box around the figure whose material marches the view ray through it.
 *
 * The fragment shader works in the figure's own units, with `vPos + CY` the
 * point where the ray enters the box and `vCam` the camera in mesh space. It
 * gets `uTime` (seconds) and `uPx` (one screen pixel in figure units).
 */

const vertexShader = /* glsl */ `
varying vec3 vPos;
varying vec3 vCam;
void main(){
  vPos = position;
  vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const f = (n: number) => n.toFixed(4);

/** GLSL constants for a figure: `CY`, `BMIN` and `BMAX`, to put at the top of its shader. */
export const raymarchConstants = (cy: number, min: THREE.Vector3, max: THREE.Vector3) => {
  const v = (p: THREE.Vector3) => `vec3(${f(p.x)}, ${f(p.y)}, ${f(p.z)})`;
  return `const vec3 CY = vec3(0.0, ${f(cy)}, 0.0);
const vec3 BMIN = ${v(min)}, BMAX = ${v(max)};`;
};

/**
 * The mesh: a box from `min` to `max` in figure units, its origin at figure
 * point (0, cy, 0). It is scaled by the ornament's `r`, so one figure unit is
 * `r` tree units.
 */
export function raymarchedMesh(
  fragmentShader: string,
  cy: number,
  min: THREE.Vector3,
  max: THREE.Vector3
) {
  const size = new THREE.Vector3().subVectors(max, min);
  const mid = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z).translate(
    mid.x,
    mid.y - cy,
    mid.z
  );
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 }, uPx: { value: 0.01 } },
    alphaToCoverage: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const scale = new THREE.Vector3();
  mesh.onBeforeRender = (renderer) => {
    // One world unit is one CSS pixel at the tree's depth.
    material.uniforms.uPx.value = 1 / (renderer.getPixelRatio() * mesh.getWorldScale(scale).x);
    material.uniforms.uTime.value = performance.now() / 1000;
  };
  return { mesh, dispose: () => (geometry.dispose(), material.dispose()) };
}
