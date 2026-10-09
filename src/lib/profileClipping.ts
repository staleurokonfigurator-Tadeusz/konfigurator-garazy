import * as THREE from 'three';
export type ProfilePoint = [number, number];

// Clip a rectangular rib to a convex, counterclockwise wall outline.
export function clipProfilePolygon(points: ProfilePoint[], outline: ProfilePoint[]) {
  let result = points;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const distance = (p: ProfilePoint) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const input = result;
    result = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length];
      const dp = distance(p), dq = distance(q);
      if (dp >= 0) result.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const fraction = dp / (dp - dq);
        result.push([p[0] + fraction * (q[0] - p[0]), p[1] + fraction * (q[1] - p[1])]);
      }
    });
  }
  const area = result.reduce((sum, p, i) => {
    const q = result[(i + 1) % result.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return Math.abs(area) > 1e-10 ? result : [];
}

// Match ExtrudeGeometry's wall-face UV coordinates, including the side-wall offset.
export function applyWallUV(geometry: THREE.BufferGeometry, offsetX: number, offsetY: number) {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i) + offsetX, position.getY(i) + offsetY);
  uv.needsUpdate = true;
}
