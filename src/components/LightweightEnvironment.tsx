"use client";

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Lokalne, proceduralne oświetlenie odbić. Zastępuje presety HDR pobierane
 * z zewnętrznego CDN, dzięki czemu model może pojawić się bez dodatkowego
 * oczekiwania na duży plik środowiskowy.
 */
export default function LightweightEnvironment({ intensity = 0.72 }: { intensity?: number }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.04);
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;

    scene.environment = target.texture;
    scene.environmentIntensity = intensity;

    return () => {
      if (scene.environment === target.texture) scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      target.dispose();
      pmrem.dispose();
      room.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.filter(Boolean).forEach((material) => material.dispose());
      });
    };
  }, [gl, scene, intensity]);

  return null;
}
