"use client";

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PanelOpening {
  x: number;
  y: number;
  width: number;
  height: number;
}

// One metre panel modules. Split the joints around openings so they do not
// cross a gate, door or window. The joints are geometry, also visible in AR.
export function createPirJointGeometry(width: number, height: number, openings: PanelOpening[] = []) {
  const parts: THREE.BufferGeometry[] = [];
  for (let x = -width / 2 + 1; x < width / 2 - 0.001; x += 1) {
    let spans: [number, number][] = [[-height / 2, height / 2]];
    for (const opening of openings) {
      if (Math.abs(x - opening.x) > opening.width / 2 + 0.004) continue;
      const bottom = opening.y - opening.height / 2 - 0.004;
      const top = opening.y + opening.height / 2 + 0.004;
      spans = spans.flatMap(([from, to]): [number, number][] => {
        if (top <= from || bottom >= to) return [[from, to]];
        const remaining: [number, number][] = [];
        if (bottom > from) remaining.push([from, bottom]);
        if (top < to) remaining.push([top, to]);
        return remaining;
      });
    }
    for (const [from, to] of spans) {
      if (to - from <= 0.001) continue;
      const part = new THREE.BoxGeometry(0.008, to - from, 0.003);
      part.translate(x, (from + to) / 2, 0);
      parts.push(part);
    }
  }
  const geometry = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
  parts.forEach(part => part.dispose());
  return geometry;
}

export default function PirPanelJoints({ width, height, openings = [], color, position = [0, 0, 0], rotation = [0, 0, 0] }: {
  width: number;
  height: number;
  openings?: PanelOpening[];
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const openingKey = JSON.stringify(openings);
  const geometry = useMemo(
    () => createPirJointGeometry(width, height, JSON.parse(openingKey)),
    [width, height, openingKey],
  );
  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  if (!geometry?.getAttribute('position')) return null;
  return <mesh geometry={geometry} position={position} rotation={rotation}>
    <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.65)} roughness={0.75} metalness={0.15} />
  </mesh>;
}
