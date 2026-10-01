"use client";

import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, ContactShadows, Edges, Html, Line, useTexture } from '@react-three/drei';
import { GarageConfig, WallFace } from '@/types';
import GarageModel from './GarageModel';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface CanvasAreaProps {
  config: GarageConfig;
  selectedWall: WallFace;
  activeDimId?: string | null;
  colors?: any[];
  isGeneratingAR?: boolean;
  onExportAR?: (url: string) => void;
}

function CameraRig({ selectedWall, config, activeDimId }: { selectedWall: WallFace; config: GarageConfig, activeDimId?: string | null }) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const w = config.width * 0.01; 
    const l = config.length * 0.01; 
    const h = config.height * 0.01;
    
    let sceneCenterX = 0;
    let sceneWidth = w;
    if (config.hasCarport && config.carportWidth) {
      const cw_m = config.carportWidth * 0.01;
      sceneWidth += cw_m;
      if (config.carportSide === 'right') sceneCenterX = cw_m / 2;
      else if (config.carportSide === 'left') sceneCenterX = -cw_m / 2;
    }

    let targetX = sceneCenterX;
    let targetZ = 0;
    let camX = sceneCenterX;
    let camZ = 0;
    
    const dist = Math.max(sceneWidth, l) + 4;
    const zoomMultiplier = activeDimId ? 0.45 : 1; 

    switch (selectedWall) {
      case 'front': targetZ = l / 2; camZ = l / 2 + dist * zoomMultiplier; break;
      case 'back': targetZ = -l / 2; camZ = -l / 2 - dist * zoomMultiplier; break;
      case 'left': targetX = -w / 2; camX = -w / 2 - dist * zoomMultiplier; break;
      case 'right': targetX = w / 2; camX = w / 2 + dist * zoomMultiplier; break;
    }
    controlsRef.current.setLookAt(camX, h / 2, camZ, targetX, h / 2, targetZ, true);
  }, [selectedWall, config.width, config.length, config.height, activeDimId, config.hasCarport, config.carportWidth, config.carportSide]);

  return <CameraControls ref={controlsRef} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={2} maxDistance={25} makeDefault />;
}

function MeasurementArrow({ start, end, value }: { start: [number, number, number], end: [number, number, number], value: number }) {
  if (value <= 0) return null; 
  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;
  const midZ = (start[2] + end[2]) / 2;
  return (
    <group>
      <Line points={[start, end]} color="#ea580c" lineWidth={2} dashed={true} dashSize={0.1} gapSize={0.05} />
      <Html position={[midX, midY, midZ]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div className="bg-white text-zinc-900 text-[11px] font-black px-1.5 py-0.5 rounded shadow-sm border border-zinc-200 whitespace-nowrap">{value} cm</div>
      </Html>
    </group>
  );
}

function DimensionsOverlay({ config, activeId }: { config: GarageConfig, activeId: string }) {
  const el = config.elements.find(e => e.id === activeId);
  if (!el) return null;

  const w = config.width / 100; const l = config.length / 100; const h = config.height / 100;
  const wallW = (el.wall === 'front' || el.wall === 'back') ? w : l;
  const elW = el.width / 100; const elH = el.height / 100; const elX = el.x / 100; const elY = el.y / 100;

  const gapLeft = (elX - elW / 2) - (-wallW / 2);
  const gapRight = (wallW / 2) - (elX + elW / 2);
  const gapBottom = elY;
  const gapTop = h - (elY + elH);

  let pos: [number, number, number] = [0, 0, 0];
  let rot: [number, number, number] = [0, 0, 0];

  const offset = 0.05; 
  if (el.wall === 'front') { pos = [elX, elY + elH/2, l/2 + offset]; }
  else if (el.wall === 'back') { pos = [-elX, elY + elH/2, -l/2 - offset]; rot = [0, Math.PI, 0]; }
  else if (el.wall === 'left') { pos = [-w/2 - offset, elY + elH/2, elX]; rot = [0, -Math.PI/2, 0]; }
  else if (el.wall === 'right') { pos = [w/2 + offset, elY + elH/2, -elX]; rot = [0, Math.PI/2, 0]; }

  // ODWROTNY FORMAT WYMIARÓW DLA ARCHITEKTURY
  const labelText = `${el.height} x ${el.width} cm`;

  return (
    <group position={pos} rotation={rot}>
      <mesh><planeGeometry args={[elW, elH]} /><meshBasicMaterial color="#ea580c" transparent opacity={0.3} depthTest={false} side={THREE.DoubleSide} /><Edges color="#ea580c" scale={1} /></mesh>
      <Html center position={[0, 0, 0]} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg border-2 border-orange-500 shadow-2xl flex flex-col items-center whitespace-nowrap animate-bounce-in"><span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Wymiary Otworu</span><span className="text-lg font-black">{labelText}</span></div>
      </Html>
      <MeasurementArrow start={[-elW/2, 0, 0]} end={[-elW/2 - gapLeft, 0, 0]} value={Math.round(gapLeft * 100)} />
      <MeasurementArrow start={[elW/2, 0, 0]} end={[elW/2 + gapRight, 0, 0]} value={Math.round(gapRight * 100)} />
      <MeasurementArrow start={[0, -elH/2, 0]} end={[0, -elH/2 - gapBottom, 0]} value={Math.round(gapBottom * 100)} />
      <MeasurementArrow start={[0, elH/2, 0]} end={[0, elH/2 + gapTop, 0]} value={Math.round(gapTop * 100)} />
    </group>
  );
}

function SceneGround({ config }: { config: GarageConfig }) {
  const grassSource = useTexture('/textures/trawa.webp');
  const grass = useMemo(() => {
    const texture = grassSource.clone();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [grassSource]);

  useEffect(() => () => grass.dispose(), [grass]);

  const drivewayWidth = Math.max(3.2, Math.min(6, config.width / 100));
  const garageFront = config.length / 200;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.035, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial map={grass} color="#8ca276" roughness={0.98} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.018, garageFront + 4]}>
        <planeGeometry args={[drivewayWidth, 8]} />
        <meshStandardMaterial color="#a7a29a" roughness={0.92} metalness={0.02} />
      </mesh>
    </group>
  );
}

function ARExporter({ isGenerating, onExport }: { isGenerating: boolean; onExport: (url: string) => void }) {
  const { scene } = useThree();

  useEffect(() => {
    if (!isGenerating) return;

    const performExport = async () => {
      try {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const exporter = new GLTFExporter();
        const garageGroup = scene.getObjectByName('garageModelGroup');
        
        if (!garageGroup) {
          throw new Error("Główna grupa modelu nie została znaleziona.");
        }

        exporter.parse(
          garageGroup,
          (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
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

    const timer = window.setTimeout(performExport, 500);
    return () => window.clearTimeout(timer);

  }, [isGenerating, scene, onExport]);

  return null;
}

export default function CanvasArea({ config, selectedWall, activeDimId, colors = [], isGeneratingAR = false, onExportAR }: CanvasAreaProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{ preserveDrawingBuffer: true, powerPreference: 'high-performance', antialias: true }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
      shadows={{ type: THREE.PCFSoftShadowMap as any }}
      camera={{ position: [5, 3, 7], fov: 50 }}
      className="w-full h-full"
    >
      <ambientLight intensity={0.28} />
      <hemisphereLight args={['#dbeafe', '#544b3e', 0.55]} />
      <directionalLight position={[9, 13, 8]} intensity={1.75} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} />
      <directionalLight position={[-8, 7, -5]} intensity={0.32} color="#c7d2fe" />

      <Suspense fallback={null}>
        <GarageModel config={config} colors={colors} />
        {activeDimId && <DimensionsOverlay config={config} activeId={activeDimId} />}
        <SceneGround config={config} />
      </Suspense>

      <ContactShadows position={[0, -0.01, 0]} opacity={0.52} scale={30} blur={2.8} far={7} resolution={512} />

      <CameraRig selectedWall={selectedWall} config={config} activeDimId={activeDimId} />
      
      {isGeneratingAR && onExportAR && <ARExporter isGenerating={isGeneratingAR} onExport={onExportAR} />}
    </Canvas>
  );
}
