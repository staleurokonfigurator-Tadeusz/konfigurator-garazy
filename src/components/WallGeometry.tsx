"use client";

import { memo, useMemo } from 'react';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import * as THREE from 'three';

/** CSG depends only on shape and openings, never on colours or price selections. */
const WallGeometry = memo(function WallGeometry({ outlineKey, openingsKey, depth }: {
  outlineKey: string;
  openingsKey: string;
  depth: number;
}) {
  const shape = useMemo(() => new THREE.Shape((JSON.parse(outlineKey) as [number, number][])
    .map(([x, y]) => new THREE.Vector2(x, y))), [outlineKey]);
  const openings = useMemo(() => JSON.parse(openingsKey) as { x: number; y: number; width: number; height: number }[], [openingsKey]);
  const extrusion = useMemo(() => ({ depth, bevelEnabled: false }), [depth]);
  return <Geometry><Base><extrudeGeometry args={[shape, extrusion]} /></Base>
    {openings.map((opening, index) => <Subtraction key={index} position={[opening.x, opening.y, depth / 2]}>
      <boxGeometry args={[opening.width, opening.height, depth * 4]} />
    </Subtraction>)}
  </Geometry>;
});

export default WallGeometry;
