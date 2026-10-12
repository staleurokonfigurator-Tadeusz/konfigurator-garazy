import * as THREE from 'three';

/** One corrugated T-7 surface: ribs follow the fall from ridge to eaves. */
export function createRoofSheetGeometry(width: number, depth: number, slopeAxis: 'x' | 'z') {
  const across = slopeAxis === 'x' ? depth : width;
  const half = across / 2;
  const stations: [number, number][] = [[-half, 0]];
  const pitch = 0.13;
  const count = Math.floor(across / pitch);
  const first = -((count - 1) * pitch) / 2;
  for (let i = 0; i < count; i++) {
    const center = first + i * pitch;
    for (const [offset, height] of [[-0.032, 0], [-0.014, 0.007], [0.014, 0.007], [0.032, 0]]) {
      const position = center + offset;
      if (position > -half && position < half) stations.push([position, height]);
    }
  }
  stations.push([half, 0]);
  const positions: number[] = [], uvs: number[] = [], shades: number[] = [];
  const push = (across: number, height: number, along: number) => {
    const x = slopeAxis === 'x' ? along : across;
    const z = slopeAxis === 'x' ? across : along;
    positions.push(x, height, z);
    uvs.push(x + width / 2, z + depth / 2);
    // Subtle valley occlusion keeps the shallow T-7 readable without an AO texture.
    const shade = height > 0 ? 1 : 0.82;
    shades.push(shade, shade, shade);
  };
  const alongHalf = (slopeAxis === 'x' ? width : depth) / 2;
  for (let i = 0; i < stations.length - 1; i++) {
    const [a, ay] = stations[i], [b, by] = stations[i + 1];
    const corners = [[a, ay, -alongHalf], [a, ay, alongHalf], [b, by, -alongHalf], [b, by, alongHalf]];
    const order = slopeAxis === 'x' ? [0, 2, 1, 2, 3, 1] : [0, 1, 2, 2, 1, 3];
    for (const index of order) push(corners[index][0], corners[index][1], corners[index][2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
  geometry.computeVertexNormals();
  return geometry;
}
