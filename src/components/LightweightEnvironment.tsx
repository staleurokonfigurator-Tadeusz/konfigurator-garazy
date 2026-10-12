"use client";

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Soft outdoor reflections, generated locally without downloading an HDR.
 */
export default function LightweightEnvironment({ intensity = 0.9 }: { intensity?: number }) {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    const width = 256, height = 128;
    const pixels = new Uint8Array(width * height * 4);
    const zenith = new THREE.Color('#adc8e0');
    const horizon = new THREE.Color('#eef0ec');
    const ground = new THREE.Color('#817c69');
    const skyColor = new THREE.Color();
    for (let y = 0; y < height; y++) {
      const altitude = Math.cos(Math.PI * (y + 0.5) / height);
      skyColor.copy(horizon).lerp(altitude >= 0 ? zenith : ground, Math.pow(Math.abs(altitude), 0.6));
      // DataTexture is sRGB; convert Three's linear colour values for storage.
      skyColor.convertLinearToSRGB();
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        pixels[offset] = Math.round(skyColor.r * 255);
        pixels[offset + 1] = Math.round(skyColor.g * 255);
        pixels[offset + 2] = Math.round(skyColor.b * 255);
        pixels[offset + 3] = 255;
      }
    }
    const sky = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
    sky.colorSpace = THREE.SRGBColorSpace;
    sky.mapping = THREE.EquirectangularReflectionMapping;
    sky.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromEquirectangular(sky);
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;

    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    invalidate();

    return () => {
      if (scene.environment === target.texture) scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      target.dispose();
      pmrem.dispose();
      sky.dispose();
      invalidate();
    };
  }, [gl, scene, intensity, invalidate]);

  return null;
}
