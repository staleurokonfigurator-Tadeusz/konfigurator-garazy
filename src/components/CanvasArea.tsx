"use client";

import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, ContactShadows, Edges, Html, Line, useTexture } from '@react-three/drei';
import { GarageConfig, WallFace } from '@/types';
import MiddleCarport from './MiddleCarport';
import LightweightEnvironment from './LightweightEnvironment';
import { getAssemblyLayout } from '@/lib/garageAssembly';
import GarageModel from './GarageModel';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getThreePerformanceProfile } from '@/lib/threePerformance';
import { getGarageCameraDistance } from '@/lib/garageMaterial';

interface CanvasAreaProps {
  config: GarageConfig;
  activeGarage?: 0 | 1;
  selectedWall: WallFace;
  activeDimId?: string | null;
  colors?: any[];
  isGeneratingAR?: boolean;
  onExportAR?: (url: string) => void;
}

function CameraRig({ selectedWall, config, activeDimId }: { selectedWall: WallFace; config: GarageConfig, activeDimId?: string | null }) {
  const controlsRef = useRef<any>(null);
  const size = useThree(state => state.size);
  const distance = getGarageCameraDistance(config, selectedWall, size.width / Math.max(size.height, 1));
  const layout = getAssemblyLayout(config);
  const sceneCenterX = layout.centerX / 100;
  const sceneWidth = layout.width / 100, sceneLength = (layout.length + layout.frontProjection) / 100, sceneHeight = layout.height / 100;

  useEffect(() => {
    if (!controlsRef.current) return;
    const w = sceneWidth, l = sceneLength, h = sceneHeight;
    

    let targetX = sceneCenterX;
    let targetZ = 0;
    let camX = sceneCenterX;
    let camZ = 0;
    
    const dist = distance;
    const zoomMultiplier = activeDimId ? 0.45 : 1; 

    switch (selectedWall) {
      case 'front': targetZ = l / 2; camZ = l / 2 + dist * zoomMultiplier; break;
      case 'back': targetZ = -l / 2; camZ = -l / 2 - dist * zoomMultiplier; break;
      case 'left': targetX = sceneCenterX - w / 2; camX = sceneCenterX - w / 2 - dist * zoomMultiplier; break;
      case 'right': targetX = sceneCenterX + w / 2; camX = sceneCenterX + w / 2 + dist * zoomMultiplier; break;
    }
    controlsRef.current.setLookAt(camX, h / 2, camZ, targetX, h / 2, targetZ, true);
  }, [selectedWall, sceneWidth, sceneLength, sceneHeight, activeDimId, sceneCenterX, distance]);

  return <CameraControls ref={controlsRef} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={2} maxDistance={Math.max(25, distance * 1.5)} makeDefault />;
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
  const size = useThree(state => state.size);
  const aspect = size.width / Math.max(size.height, 1);
  const groundSize = Math.max(60, 2 * (
    Math.max(getGarageCameraDistance(config, 'front', aspect), getGarageCameraDistance(config, 'left', aspect))
    + Math.max(config.width, config.length) / 200 + 10
  ));
  const grassSource = useTexture('/textures/trawa-light-v3.webp');
  const drivewaySource = useTexture('/textures/podjazd-light-v3.webp');
  const grass = useMemo(() => {
    const texture = grassSource.clone();
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.repeat.set(groundSize * 0.3, groundSize * 0.3);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
    return texture;
  }, [grassSource, groundSize]);

  const driveway = useMemo(() => {
    const texture = drivewaySource.clone();
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
    return texture;
  }, [drivewaySource]);

  const drivewayBump = useMemo(() => {
    const texture = drivewaySource.clone();
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
    return texture;
  }, [drivewaySource]);

  const layout = getAssemblyLayout(config);
  const drivewayWidth = config.assembly ? layout.width / 100 : Math.max(3.2, Math.min(6, config.width / 100));
  const garageFront = layout.length / 200;

  useEffect(() => {
    const tileSize = 1.35;
    driveway.repeat.set(drivewayWidth / tileSize, 8 / tileSize);
    drivewayBump.repeat.copy(driveway.repeat);
  }, [driveway, drivewayBump, drivewayWidth]);

  useEffect(() => () => {
    grass.dispose();
    driveway.dispose();
    drivewayBump.dispose();
  }, [grass, driveway, drivewayBump]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.035, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial map={grass} color="#c2ccb5" roughness={0.98} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[layout.centerX/100, -0.018, garageFront + 4]}>
        <planeGeometry args={[drivewayWidth, 8]} />
        <meshStandardMaterial map={driveway} bumpMap={drivewayBump} bumpScale={0.016} color="#ece8e1" roughness={0.94} metalness={0} />
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

export default function CanvasArea({ config, activeGarage = 0, selectedWall, activeDimId, colors = [], isGeneratingAR = false, onExportAR }: CanvasAreaProps) {
  const renderProfile = useMemo(() => getThreePerformanceProfile(), []);
  const layout = getAssemblyLayout(config);
  const edited = activeGarage && layout.second ? layout.second : layout.first;
  const shadowExtent = Math.max(10, layout.width / 100, (layout.length + layout.frontProjection) / 100) * 0.75;
  const contactShadowKey = useMemo(() => JSON.stringify({
    width: config.width,
    length: config.length,
    height: config.height,
    roof: config.roofType,
    carport: [config.hasCarport, config.carportWidth, config.carportSide, config.carportLeft, config.carportRight],
    elements: config.elements,
    assembly: config.assembly,
    projection: config.frontCanopy,
  }), [config.width, config.length, config.height, config.roofType, config.hasCarport, config.carportWidth, config.carportSide, config.carportLeft, config.carportRight, config.elements, config.assembly, config.frontCanopy]);

  return (
    <Canvas
      frameloop="demand"
      dpr={renderProfile.dpr}
      performance={{ min: renderProfile.lowPower ? 0.35 : 0.5 }}
      gl={{ preserveDrawingBuffer: true, powerPreference: renderProfile.lowPower ? 'default' : 'high-performance', antialias: renderProfile.antialias }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      camera={{ position: [5, 3, 7], fov: 50 }}
      className="w-full h-full"
    >
      <color attach="background" args={['#dbe4ea']} />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={['#e5edf4', '#8c8373', 0.65]} />
      <directionalLight position={[shadowExtent * 0.8, shadowExtent * 1.4, shadowExtent * 0.9]} intensity={2.0} color="#fff5e6" castShadow shadow-mapSize-width={renderProfile.shadowMapSize} shadow-mapSize-height={renderProfile.shadowMapSize} shadow-bias={-0.00015} shadow-normalBias={0.015} shadow-camera-near={0.5} shadow-camera-far={shadowExtent * 5} shadow-camera-left={-shadowExtent} shadow-camera-right={shadowExtent} shadow-camera-top={shadowExtent} shadow-camera-bottom={-shadowExtent} />
      <directionalLight position={[-8, 7, -5]} intensity={0.2} color="#dbe7f2" />

      <Suspense fallback={null}>
        <LightweightEnvironment intensity={0.9} />
        <group name="garageModelGroup">
          <group position={[layout.firstX/100,0,layout.firstZ/100]}><GarageModel config={layout.first} colors={colors} /></group>
          {layout.second && <>
            <group position={[layout.secondX/100,0,layout.secondZ/100]}><GarageModel config={layout.second} colors={colors} /></group>
            <MiddleCarport config={config} colors={colors} />
          </>}
        </group>
        {activeDimId && <group position={activeGarage && layout.second ? [layout.secondX/100,0,layout.secondZ/100] : [layout.firstX/100,0,layout.firstZ/100]}><DimensionsOverlay config={edited} activeId={activeDimId} /></group>}
        <SceneGround config={config} />
      </Suspense>

      <ContactShadows key={contactShadowKey} position={[0, -0.01, 0]} opacity={0.4} scale={Math.max(30, shadowExtent * 3)} blur={3} far={7} resolution={renderProfile.contactShadowResolution} frames={1} />

      <CameraRig selectedWall={selectedWall} config={config} activeDimId={activeDimId} />
      
      {isGeneratingAR && onExportAR && <ARExporter isGenerating={isGeneratingAR} onExport={onExportAR} />}
    </Canvas>
  );
}
