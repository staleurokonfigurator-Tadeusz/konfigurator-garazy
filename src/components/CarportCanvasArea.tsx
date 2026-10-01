"use client";

import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { GarageConfig, WallFace } from '@/types';
import CarportModel from './CarportModel';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getThreePerformanceProfile } from '@/lib/threePerformance';

interface CanvasAreaProps {
  config: GarageConfig;
  selectedWall: WallFace;
  colors?: any[];
  isGeneratingAR?: boolean;
  onExportAR?: (url: string) => void;
}

function CameraRig({ selectedWall, config }: { selectedWall: WallFace; config: GarageConfig }) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const w = config.width * 0.01; 
    const l = config.length * 0.01; 
    const h = config.height * 0.01;
    let targetX = 0; let targetZ = 0; let camX = 0; let camZ = 0;
    const dist = Math.max(w, l) + 4;

    switch (selectedWall) {
      case 'front': targetZ = l / 2; camZ = l / 2 + dist; break;
      case 'back': targetZ = -l / 2; camZ = -l / 2 - dist; break;
      case 'left': targetX = -w / 2; camX = -w / 2 - dist; break;
      case 'right': targetX = w / 2; camX = w / 2 + dist; break;
    }
    controlsRef.current.setLookAt(camX, h / 2, camZ, targetX, h / 2, targetZ, true);
  }, [selectedWall, config.width, config.length, config.height]);

  return <CameraControls ref={controlsRef} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={2} maxDistance={25} makeDefault />;
}

function ARExporter({ isGenerating, onExport }: { isGenerating: boolean; onExport: (url: string) => void }) {
  const { scene } = useThree();

  useEffect(() => {
    if (!isGenerating) return;

    const performExport = async () => {
      try {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const exporter = new GLTFExporter();
        const carportGroup = scene; // Eksportujemy całą scenę lub można dodać nazwę do grupy
        
        exporter.parse(
          carportGroup,
          (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            onExport(url);
          },
          (error) => {
            console.error('Błąd parsowania GLTF:', error);
            onExport(''); 
          },
          { binary: true }
        );
      } catch (err) {
        console.error('Błąd krytyczny eksportu do AR:', err);
        onExport(''); 
      }
    };

    setTimeout(performExport, 500);

  }, [isGenerating, scene, onExport]);

  return null;
}

export default function CarportCanvasArea({ config, selectedWall, colors = [], isGeneratingAR = false, onExportAR }: CanvasAreaProps) {
  const renderProfile = useMemo(() => getThreePerformanceProfile(), []);
  return (
    <Canvas frameloop="demand" dpr={renderProfile.dpr} performance={{ min: renderProfile.lowPower ? 0.35 : 0.5 }} gl={{ preserveDrawingBuffer: true, powerPreference: renderProfile.lowPower ? 'default' : 'high-performance', antialias: renderProfile.antialias }} onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1; }} shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [5, 3, 7], fov: 50 }} className="w-full h-full">
      <ambientLight intensity={0.28} />
      <hemisphereLight args={['#dbeafe', '#544b3e', 0.55]} />
      <directionalLight position={[9, 13, 8]} intensity={1.75} castShadow shadow-mapSize-width={renderProfile.shadowMapSize} shadow-mapSize-height={renderProfile.shadowMapSize} shadow-bias={-0.0005} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} />
      <directionalLight position={[-8, 7, -5]} intensity={0.32} color="#c7d2fe" />

      <Suspense fallback={null}>
        <CarportModel config={config} colors={colors} />
      </Suspense>

      <CameraRig selectedWall={selectedWall} config={config} />
      
      {isGeneratingAR && onExportAR && <ARExporter isGenerating={isGeneratingAR} onExport={onExportAR} />}
    </Canvas>
  );
}
