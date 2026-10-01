"use client";

import { useMemo, useState, useEffect } from 'react';
import { GarageConfig } from '@/types';
import * as THREE from 'three';
import { ContactShadows, useTexture } from '@react-three/drei';
import LightweightEnvironment from './LightweightEnvironment';

interface PergolaModelProps {
  config: GarageConfig;
  colors?: any[];
}

function resolveColor(colorId: string | undefined, colors: any[] = []): { hex: string; isWood: boolean; textureUrl: string } {
  if (!colorId) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };
  if (colorId.startsWith('#')) return { hex: colorId, isWood: false, textureUrl: '' };
  const found = (colors || []).find((c: any) => c.id === colorId);
  if (!found) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };
  return {
    hex: found.hex || '#d4d4d4',
    isWood: found.type === 'drewno',
    textureUrl: found.texture || '',
  };
}

export default function PergolaModel({ config, colors = [] }: PergolaModelProps) {
  // Wymiary w metrach
  const w = config.width / 100;
  const l = config.length / 100;
  const h = config.height / 100;

  const modulesCount = config.modulesCount || 1;

  const [trapezTex] = useTexture(['/textures/trapez.webp']);
  const [woodNormal] = useTexture(['/textures/drewno-normal.webp']);

  // Kolor konstrukcji
  const [dynamicStructColor, setDynamicStructColor] = useState<THREE.Texture | null>(null);
  // Kolor lameli
  const [dynamicLamellaColor, setDynamicLamellaColor] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const structColorData = colors.find((c: any) => c.id === config.wallColor);
    const lamellaColorData = colors.find((c: any) => c.id === config.roofColor);

    const loader = new THREE.TextureLoader();

    if (structColorData && structColorData.type === 'drewno' && structColorData.texture) {
      loader.load(structColorData.texture, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(2, 2);
        setDynamicStructColor(tex);
      });
    } else {
      setDynamicStructColor(null);
    }

    if (lamellaColorData && lamellaColorData.type === 'drewno' && lamellaColorData.texture) {
      loader.load(lamellaColorData.texture, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(2, 2);
        setDynamicLamellaColor(tex);
      });
    } else {
      setDynamicLamellaColor(null);
    }
  }, [colors, config.wallColor, config.roofColor]);

  // --- MATERIAŁY ---
  const { hex: structHex, isWood: isStructWood } = resolveColor(config.wallColor, colors);
  const structTex = dynamicStructColor || trapezTex;
  const structMat = <meshStandardMaterial 
    color={isStructWood ? '#ffffff' : structHex} 
    map={isStructWood ? structTex : undefined}
    roughness={0.8} 
    metalness={isStructWood ? 0.0 : 0.6} 
  />;

  const { hex: lamellaHex, isWood: isLamellaWood } = resolveColor(config.roofColor, colors);
  const lamellaTex = dynamicLamellaColor || trapezTex;
  const lamellaMat = <meshStandardMaterial 
    color={isLamellaWood ? '#ffffff' : lamellaHex} 
    map={isLamellaWood ? lamellaTex : undefined}
    roughness={0.7} 
    metalness={isLamellaWood ? 0.0 : 0.4} 
    side={THREE.DoubleSide}
  />;

  // --- LOGIKA SZKIELETU ---
  const pillarSize = 0.12; // 12x12 cm
  const beamHeight = 0.15; // 15 cm wysokości górnych belek
  const beamWidth = 0.12;  // 12 cm grubości górnych belek

  const zPositions = Array.from({ length: modulesCount + 1 }).map((_, i) => (l / 2) - i * (l / modulesCount));

  const renderPillar = (x: number, z: number) => (
    <mesh key={`pillar-${x}-${z}`} position={[x, h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[pillarSize, h, pillarSize]} />
      {structMat}
    </mesh>
  );

  const renderCrossBeam = (z: number) => (
    <mesh key={`crossbeam-${z}`} position={[0, h + beamHeight / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w + pillarSize, beamHeight, beamWidth]} />
      {structMat}
    </mesh>
  );

  const renderLongBeam = (x: number) => (
    <mesh key={`longbeam-${x}`} position={[x, h + beamHeight / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[beamWidth, beamHeight, l + pillarSize]} />
      {structMat}
    </mesh>
  );

  // --- LOGIKA LAMELI ---
  // Lamele biegną równolegle do szerokości (od lewej do prawej)
  // Wypełniają każdy moduł.
  const lamellaDepth = 0.20; // 20 cm szerokość lameli
  const lamellaThickness = 0.02; // 2 cm grubości
  const lamellaGap = 0.25; // odległość między osiami lameli
  const lamellaAngle = Math.PI / 4; // Obrócone o 45 stopni

  const renderLamellas = () => {
    const lamellas = [];
    for (let m = 0; m < modulesCount; m++) {
      const zStart = zPositions[m] - beamWidth / 2; // od tego z (przód modułu)
      const zEnd = zPositions[m + 1] + beamWidth / 2; // do tego z (tył modułu)
      const moduleLength = Math.abs(zStart - zEnd);
      
      const lCount = Math.floor(moduleLength / lamellaGap);
      const lStep = moduleLength / (lCount + 1);

      for (let i = 1; i <= lCount; i++) {
        const zPos = zStart - i * lStep;
        lamellas.push(
          <mesh key={`lamella-${m}-${i}`} position={[0, h + beamHeight / 2, zPos]} rotation={[lamellaAngle, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[w - beamWidth, lamellaDepth, lamellaThickness]} />
            {lamellaMat}
          </mesh>
        );
      }
    }
    return <group>{lamellas}</group>;
  };

  return (
    <>
      <LightweightEnvironment />
      <mesh scale={100}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#d1d5db" side={THREE.BackSide} />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} metalness={0.1} />
      </mesh>
      <gridHelper args={[150, 150, '#3a3a3a', '#555555']} position={[0, -0.02, 0]} />

      <ContactShadows resolution={256} frames={1} scale={25} blur={2.5} opacity={0.7} far={10} color="#000000" position={[0, 0, 0]} />
      
      <group>
        {/* Generowanie słupów lewych i prawych */}
        {zPositions.map(z => (
          <group key={`pillars-z-${z}`}>
            {renderPillar(-w/2, z)}
            {renderPillar(w/2, z)}
          </group>
        ))}

        {/* Belki wzdłużne */}
        {renderLongBeam(-w/2)}
        {renderLongBeam(w/2)}

        {/* Belki poprzeczne (na każdym słupie) */}
        {zPositions.map(z => renderCrossBeam(z))}

        {/* Zadaszenie żaluzjowe */}
        {renderLamellas()}
      </group>
    </>
  );
}
