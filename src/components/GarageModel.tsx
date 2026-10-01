"use client";

import { useMemo, useRef, useState, useEffect } from 'react';
import { GarageConfig, WallFace, SheetProfile } from '@/types';
import * as THREE from 'three';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import LightweightEnvironment from './LightweightEnvironment';

interface GarageModelProps {
  config: GarageConfig;
  colors?: any[];
}

const PROFILE_TYPES: SheetProfile[] = ['pionowe-t7', 'poziome-t7', 'pionowe-t14', 'poziome-t14', 'pionowe-t17', 'poziome-t17'];
const GOLDEN_OAK_TEXTURE = '/textures/zloty-dab-premium.webp';
const DARK_WALNUT_TEXTURE = '/textures/ciemny-orzech.webp';
const LOCAL_WOOD_TEXTURES = new Set([GOLDEN_OAK_TEXTURE, DARK_WALNUT_TEXTURE]);

function createProfileBumpTexture(profile: SheetProfile) {
  // Prawdziwa geometria odpowiada teraz za kształt profilu. Mapa 128 px
  // wystarcza do delikatnego cieniowania i zużywa cztery razy mniej pamięci.
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const ribs = profile.includes('t7') ? 18 : profile.includes('t14') ? 12 : 9;
  const horizontal = profile.startsWith('poziome');

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const axis = horizontal ? y : x;
      const phase = ((axis / size) * ribs) % 1;
      const distanceFromRib = Math.min(phase, 1 - phase);
      let height = 104;

      if (distanceFromRib < 0.055) height = 238;
      else if (distanceFromRib < 0.15) height = Math.round(238 - ((distanceFromRib - 0.055) / 0.095) * 112);
      else if (distanceFromRib < 0.22) height = Math.round(126 - ((distanceFromRib - 0.15) / 0.07) * 22);

      const offset = (y * size + x) * 4;
      data[offset] = height;
      data[offset + 1] = height;
      data[offset + 2] = height;
      data[offset + 3] = 255;
    }
  }

  // GLTFExporter akceptuje RGBA, więc ta sama mapa może bez ostrzeżeń
  // trafić do modelu AR generowanego dla konkretnej oferty.
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

type ProfileOpening = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ProfileReliefSpec = {
  spacing: number;
  ridgeWidth: number;
  ridgeDepth: number;
  shoulderWidth: number;
  shoulderDepth: number;
};

function getProfileReliefSpec(profile: SheetProfile): ProfileReliefSpec {
  // T-7, T-14 i T-17 dostają celowo różne rozstawy i wysokości.
  // Dzięki temu wzory są rozpoznawalne również z dalszej kamery, a nie
  // tylko w zbliżeniu lub przy idealnym kącie światła.
  if (profile.includes('t17')) {
    return { spacing: 0.34, ridgeWidth: 0.032, ridgeDepth: 0.034, shoulderWidth: 0.105, shoulderDepth: 0.011 };
  }
  if (profile.includes('t14')) {
    return { spacing: 0.22, ridgeWidth: 0.026, ridgeDepth: 0.026, shoulderWidth: 0.082, shoulderDepth: 0.009 };
  }
  return { spacing: 0.13, ridgeWidth: 0.018, ridgeDepth: 0.018, shoulderWidth: 0.058, shoulderDepth: 0.007 };
}

function subtractRange(ranges: Array<[number, number]>, cutStart: number, cutEnd: number) {
  return ranges.flatMap(([start, end]) => {
    if (cutEnd <= start || cutStart >= end) return [[start, end] as [number, number]];
    const result: Array<[number, number]> = [];
    if (cutStart > start) result.push([start, Math.min(cutStart, end)]);
    if (cutEnd < end) result.push([Math.max(cutEnd, start), end]);
    return result;
  });
}

function createProfileReliefGeometry(
  width: number,
  height: number,
  profile: SheetProfile,
  openings: ProfileOpening[],
  depthDirection: 1 | -1,
) {
  const spec = getProfileReliefSpec(profile);
  const isHorizontal = profile.startsWith('poziome');
  const parts: THREE.BufferGeometry[] = [];
  const clearance = 0.018;

  const addProfilePart = (
    partWidth: number,
    partHeight: number,
    x: number,
    y: number,
    depth: number,
  ) => {
    if (partWidth <= 0.008 || partHeight <= 0.008) return;
    const geometry = new THREE.BoxGeometry(partWidth, partHeight, depth);
    geometry.translate(x, y, depthDirection * depth / 2);
    parts.push(geometry);
  };

  if (isHorizontal) {
    const count = Math.max(1, Math.floor(height / spec.spacing) + 1);
    const startY = -((count - 1) * spec.spacing) / 2;
    for (let index = 0; index < count; index += 1) {
      const y = startY + index * spec.spacing;
      let ranges: Array<[number, number]> = [[-width / 2, width / 2]];
      openings.forEach((opening) => {
        const crossesOpening = Math.abs(y - opening.y) <= opening.height / 2 + spec.shoulderWidth / 2 + clearance;
        if (crossesOpening) {
          ranges = subtractRange(
            ranges,
            opening.x - opening.width / 2 - clearance,
            opening.x + opening.width / 2 + clearance,
          );
        }
      });

      ranges.forEach(([start, end]) => {
        const segmentWidth = end - start;
        const centerX = (start + end) / 2;
        addProfilePart(segmentWidth, spec.shoulderWidth, centerX, y, spec.shoulderDepth);
        addProfilePart(segmentWidth, spec.ridgeWidth, centerX, y, spec.ridgeDepth);
      });
    }
  } else {
    const count = Math.max(1, Math.floor(width / spec.spacing) + 1);
    const startX = -((count - 1) * spec.spacing) / 2;
    for (let index = 0; index < count; index += 1) {
      const x = startX + index * spec.spacing;
      let ranges: Array<[number, number]> = [[-height / 2, height / 2]];
      openings.forEach((opening) => {
        const crossesOpening = Math.abs(x - opening.x) <= opening.width / 2 + spec.shoulderWidth / 2 + clearance;
        if (crossesOpening) {
          ranges = subtractRange(
            ranges,
            opening.y - opening.height / 2 - clearance,
            opening.y + opening.height / 2 + clearance,
          );
        }
      });

      ranges.forEach(([start, end]) => {
        const segmentHeight = end - start;
        const centerY = (start + end) / 2;
        addProfilePart(spec.shoulderWidth, segmentHeight, x, centerY, spec.shoulderDepth);
        addProfilePart(spec.ridgeWidth, segmentHeight, x, centerY, spec.ridgeDepth);
      });
    }
  }

  const merged = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
  parts.forEach((part) => part.dispose());
  merged?.computeVertexNormals();
  return merged || new THREE.BufferGeometry();
}

function ProfileReliefSurface({
  width,
  height,
  profile,
  openings = [],
  depthDirection = 1,
  position = [0, 0, 0],
  color,
  colorMap,
  normalMap,
  isWood,
}: {
  width: number;
  height: number;
  profile: SheetProfile;
  openings?: ProfileOpening[];
  depthDirection?: 1 | -1;
  position?: [number, number, number];
  color: string;
  colorMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  isWood: boolean;
}) {
  const openingsKey = JSON.stringify(openings);
  const normalizedOpenings = useMemo<ProfileOpening[]>(() => JSON.parse(openingsKey), [openingsKey]);
  const geometry = useMemo(
    () => createProfileReliefGeometry(width, height, profile, normalizedOpenings, depthDirection),
    [width, height, profile, normalizedOpenings, depthDirection],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh position={position} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        key={`profile-relief-${profile}-${color}-${colorMap?.uuid || 'solid'}`}
        color={isWood ? '#ffffff' : color}
        map={colorMap}
        normalMap={normalMap}
        normalScale={normalMap ? new THREE.Vector2(0.42, 0.42) : undefined}
        roughness={isWood ? 0.6 : 0.44}
        metalness={isWood ? 0.04 : 0.3}
        envMapIntensity={0.92}
      />
    </mesh>
  );
}

type RoofSlopeAxis = 'x' | 'z';

function createRoofTileReliefGeometry(width: number, depth: number, slopeAxis: RoofSlopeAxis) {
  const widthSegments = Math.min(96, Math.max(28, Math.round(width / 0.07)));
  const depthSegments = Math.min(96, Math.max(28, Math.round(depth / 0.07)));
  const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const alongSlope = slopeAxis === 'x' ? x : z;
    const acrossSlope = slopeAxis === 'x' ? z : x;

    // Wyraźny profil fali biegnący od kalenicy do okapu oraz poprzeczny
    // uskok każdego rzędu dachówki. To rzeczywista geometria, nie płaski obraz.
    const channelPhase = (acrossSlope / 0.36) * Math.PI * 2;
    const channel = Math.pow((Math.cos(channelPhase) + 1) / 2, 7) * 0.045;
    const tileWave = (Math.sin(channelPhase * 2) + 1) * 0.004;
    const rowPeriod = 0.34;
    const rowPhase = ((alongSlope % rowPeriod) + rowPeriod) % rowPeriod;
    const rowLip = rowPhase < 0.055 ? (1 - rowPhase / 0.055) * 0.028 : 0;
    positions.setY(index, channel + tileWave + rowLip);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function RoofTileRelief({
  width,
  depth,
  slopeAxis,
  position,
  color,
  texture,
  normalTexture,
}: {
  width: number;
  depth: number;
  slopeAxis: RoofSlopeAxis;
  position: [number, number, number];
  color: string;
  texture: THREE.Texture;
  normalTexture?: THREE.Texture;
}) {
  const geometry = useMemo(() => createRoofTileReliefGeometry(width, depth, slopeAxis), [width, depth, slopeAxis]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh position={position} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        key={`roof-tile-${color}-${texture.uuid}`}
        map={texture}
        normalMap={normalTexture}
        normalScale={normalTexture ? new THREE.Vector2(0.48, 0.48) : undefined}
        color={color}
        roughness={normalTexture ? 0.6 : 0.42}
        metalness={normalTexture ? 0.08 : 0.38}
        envMapIntensity={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function resolveColor(colorId: string | undefined, colors: any[] = []): { hex: string; isWood: boolean; textureUrl: string } {
  const normalizedId = String(colorId || '');
  if (!normalizedId) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };
  if (normalizedId.startsWith('#')) return { hex: normalizedId, isWood: false, textureUrl: '' };
  const found = (colors || []).find((c: any) => String(c.id) === normalizedId);
  if (!found) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };

  const hasTexture = Boolean(found.texture && found.texture.trim() !== '');
  const isWoodType = found.type ? found.type.toLowerCase().includes('drewn') : false;
  const colorSignature = `${found.id || ''} ${found.label || ''}`.toLocaleLowerCase('pl-PL');
  let textureUrl = found.texture || '';

  // Najpopularniejsze dekory są utrzymywane razem z aplikacją. Dzięki temu
  // model, eksport GLB i PDF nie zależą od CORS ani od chwilowej dostępności
  // zewnętrznego hostingu mediów WordPressa.
  if (normalizedId === 'zloty-dab' || /z[lł]ot|golden|d[aą]b|oak/.test(colorSignature)) {
    textureUrl = GOLDEN_OAK_TEXTURE;
  } else if (normalizedId === 'ciemny-orzech' || /orzech|walnut/.test(colorSignature)) {
    textureUrl = DARK_WALNUT_TEXTURE;
  }

  return { hex: found.hex || '#d4d4d4', isWood: hasTexture || isWoodType || Boolean(textureUrl), textureUrl };
}

const PANEL_COUNT = 5;

// Mini komponent rysujący drzwi bezpośrednio na skrzydle bramy
const DoorInGate = ({ xOffset, yOffset, thick, gateMatComponent }: { xOffset: number, yOffset: number, thick: number, gateMatComponent: any }) => (
  <group position={[xOffset, yOffset, 0]}>
    <mesh><boxGeometry args={[0.9, 1.9, thick + 0.012]} /><meshStandardMaterial color="#222" roughness={0.8} /></mesh>
    <mesh position={[0,0,0]}><boxGeometry args={[0.84, 1.84, thick + 0.015]} />{gateMatComponent}</mesh>
    <group position={[-0.35, 0, thick/2 + 0.025]}>
      <mesh><sphereGeometry args={[0.025, 16, 16]} /><meshStandardMaterial color="#111" metalness={0.8} roughness={0.5} /></mesh>
    </group>
  </group>
);

function SectionalGate({ el, woodColor, woodNormal, woodColorHoriz, woodNormalHoriz, profileTextures, config, colors, loadedTextures }: any) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(el.isOpen ? 1 : 0);
  const elW = (el.width || 0) * 0.01; const elH = (el.height || 0) * 0.01; const thick = 0.05; const panelH = elH / PANEL_COUNT;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const target = el.isOpen ? 1 : 0;
    progress.current += (target - progress.current) * Math.min(1, delta * 3.0);
    if (Math.abs(target - progress.current) > 0.001) state.invalidate();
    const p = progress.current;
    const panels = groupRef.current.children;
    for (let i = 0; i < PANEL_COUNT; i++) {
      const panel = panels[i] as THREE.Group;
      if (!panel) continue;
      const startY = i * panelH + panelH / 2;
      const totalTravel = elH + 0.1; 
      const currentS = startY + p * totalTravel;
      const maxY = elH - panelH / 2;
      if (currentS <= maxY + 0.005) { panel.position.set(0, currentS, 0); panel.rotation.x = 0; } 
      else { const overflow = currentS - maxY; panel.position.set(0, maxY, -overflow); panel.rotation.x = -Math.PI / 2; panel.position.y = elH - thick / 2; }
    }
  });

  const { hex: gateHex, isWood, textureUrl } = resolveColor(config?.gateColor, colors);
  const gateProfile = ((el.profile || config?.gateProfile) || 'pionowe-t7') as SheetProfile;
  const isHorizontal = gateProfile.startsWith('poziome');
  const baseWoodColor = textureUrl && loadedTextures[textureUrl] ? loadedTextures[textureUrl] : woodColor;
  const baseWoodColorHoriz = textureUrl && loadedTextures[`${textureUrl}_horiz`] ? loadedTextures[`${textureUrl}_horiz`] : woodColorHoriz;
  const activeColorMap = isWood ? (isHorizontal ? baseWoodColorHoriz : baseWoodColor) : undefined;
  const activeNormalMap = isWood ? (isHorizontal ? woodNormalHoriz : woodNormal) : undefined;
  const profileMap = profileTextures[gateProfile] || profileTextures['poziome-t7'];

  return (
    <group ref={groupRef} position={[(el.x || 0) * 0.01, (el.y || 0) * 0.01, 0]}>
      {Array.from({ length: PANEL_COUNT }, (_, i) => (
        <group key={i} position={[0, i * panelH + panelH / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[elW - 0.02, panelH - 0.005, thick]} />
            <meshStandardMaterial key={`sectional-${config.gateColor}-${gateProfile}`} map={activeColorMap} normalMap={activeNormalMap} normalScale={isWood ? new THREE.Vector2(0.48, 0.48) : undefined} bumpMap={profileMap} bumpScale={0.14} color={isWood ? '#ffffff' : gateHex} roughness={isWood ? 0.62 : 0.48} metalness={isWood ? 0.05 : 0.28} envMapIntensity={0.85} />
          </mesh>
          <ProfileReliefSurface
            width={elW - 0.025}
            height={panelH - 0.012}
            profile={gateProfile}
            position={[0, 0, thick / 2 + 0.002]}
            color={gateHex}
            colorMap={activeColorMap}
            normalMap={activeNormalMap}
            isWood={isWood}
          />
        </group>
      ))}
    </group>
  );
}

function AnimatedGate({ el, woodColor, woodNormal, woodColorHoriz, woodNormalHoriz, profileTextures, config, colors, loadedTextures }: any) {
  const ref = useRef<THREE.Group>(null);
  const elW = (el.width || 0) * 0.01; const elH = (el.height || 0) * 0.01; const thick = 0.05;
  const animState = useRef({ progress: el.isOpen ? 1 : 0 });

  useFrame((state, delta) => {
    if (!ref.current) return;
    const target = el.isOpen ? 1 : 0;
    animState.current.progress += (target - animState.current.progress) * Math.min(1, delta * 2.5);
    if (Math.abs(target - animState.current.progress) > 0.001) state.invalidate();
    const phase = animState.current.progress;
    if (el.gateType === 'up-and-over') { const pivot = ref.current.children[0]; if (pivot) pivot.rotation.x = -phase * (Math.PI / 2); } 
    else if (el.gateType === 'swing') { const leftDoor  = ref.current.children[0]; const rightDoor = ref.current.children[1]; if (leftDoor) leftDoor.rotation.y = -phase * (Math.PI / 2); if (rightDoor) rightDoor.rotation.y = phase * (Math.PI / 2); }
  });

  if (el.gateType === 'sectional') return <SectionalGate el={el} woodColor={woodColor} woodNormal={woodNormal} woodColorHoriz={woodColorHoriz} woodNormalHoriz={woodNormalHoriz} profileTextures={profileTextures} config={config} colors={colors} loadedTextures={loadedTextures} />;

  const { hex: gateHex, isWood, textureUrl } = resolveColor(config?.gateColor, colors);
  const gateProfile = ((el.profile || config?.gateProfile) || 'pionowe-t7') as SheetProfile;
  const isHorizontal = gateProfile.startsWith('poziome');
  const baseWoodColor = textureUrl && loadedTextures[textureUrl] ? loadedTextures[textureUrl] : woodColor;
  const baseWoodColorHoriz = textureUrl && loadedTextures[`${textureUrl}_horiz`] ? loadedTextures[`${textureUrl}_horiz`] : woodColorHoriz;
  const activeColorMap = isWood ? (isHorizontal ? baseWoodColorHoriz : baseWoodColor) : undefined;
  const activeNormalMap = isWood ? (isHorizontal ? woodNormalHoriz : woodNormal) : undefined;
  const profileMap = profileTextures[gateProfile] || profileTextures['pionowe-t7'];

  const gateMatComponent = <meshStandardMaterial key={`gate-${config.gateColor}-${gateProfile}`} map={activeColorMap} normalMap={activeNormalMap} normalScale={isWood ? new THREE.Vector2(0.48, 0.48) : undefined} bumpMap={profileMap} bumpScale={0.16} color={isWood ? '#ffffff' : gateHex} roughness={isWood ? 0.62 : 0.48} metalness={isWood ? 0.05 : 0.28} envMapIntensity={0.85} />;
  const isLeftHinged = el.hingeSide === 'left';
  const handleXOffset = isLeftHinged ? (elW / 2 - 0.1) : -(elW / 2 - 0.1);

  if (el.gateType === 'swing') {
    return (
      <group ref={ref} position={[(el.x || 0) * 0.01, (el.y || 0) * 0.01, 0]}>
        <group position={[-elW / 2, 0, 0]}>
          <mesh position={[elW / 4, elH / 2, 0]} castShadow receiveShadow><boxGeometry args={[elW / 2 - 0.01, elH - 0.02, thick]} />{gateMatComponent}</mesh>
          <ProfileReliefSurface width={elW / 2 - 0.018} height={elH - 0.028} profile={gateProfile} position={[elW / 4, elH / 2, thick / 2 + 0.002]} color={gateHex} colorMap={activeColorMap} normalMap={activeNormalMap} isWood={isWood} />
          <group position={[elW / 2 - 0.1, elH / 2, thick / 2 + 0.025]}><mesh><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh></group>
        </group>
        <group position={[elW / 2, 0, 0]}>
          <mesh position={[-elW / 4, elH / 2, 0]} castShadow receiveShadow><boxGeometry args={[elW / 2 - 0.01, elH - 0.02, thick]} />{gateMatComponent}</mesh>
          <ProfileReliefSurface width={elW / 2 - 0.018} height={elH - 0.028} profile={gateProfile} position={[-elW / 4, elH / 2, thick / 2 + 0.002]} color={gateHex} colorMap={activeColorMap} normalMap={activeNormalMap} isWood={isWood} />
          <group position={[-elW / 2 + 0.1, elH / 2, thick / 2 + 0.025]}><mesh><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh></group>
          {el.hasDoor && <DoorInGate xOffset={-elW / 4} yOffset={0.95} thick={thick} gateMatComponent={gateMatComponent} />}
        </group>
      </group>
    );
  }
  
  return (
    <group ref={ref} position={[(el.x || 0) * 0.01, (el.y || 0) * 0.01, 0]}>
      <group position={[0, elH, 0]}>
        <mesh position={[0, -elH / 2, 0]} castShadow receiveShadow><boxGeometry args={[elW - 0.02, elH - 0.02, thick]} />{gateMatComponent}</mesh>
        <ProfileReliefSurface width={elW - 0.028} height={elH - 0.028} profile={gateProfile} position={[0, -elH / 2, thick / 2 + 0.002]} color={gateHex} colorMap={activeColorMap} normalMap={activeNormalMap} isWood={isWood} />
        <group position={[handleXOffset, -elH + 0.25, thick / 2 + 0.025]}><mesh><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh></group>
        {el.hasDoor && <DoorInGate xOffset={elW / 4} yOffset={-elH + 0.95} thick={thick} gateMatComponent={gateMatComponent} />}
      </group>
    </group>
  );
}

export default function GarageModel({ config, colors = [] }: GarageModelProps) {
  const w = (config.width || 300) * 0.01;
  const l = (config.length || 500) * 0.01;
  const h = (config.height || 210) * 0.01;
  const t = 0.05;     
  const slopeH = 0.4; 

  const hasCarport = config.hasCarport || false;
  const cw = hasCarport ? (config.carportWidth || 300) * 0.01 : 0;
  const cSide = config.carportSide || 'right';
  
  const minX = cSide === 'left' ? -w/2 - cw : -w/2;
  const maxX = cSide === 'right' ? w/2 + cw : w/2;
  const totalW = maxX - minX;
  const centerX = (minX + maxX) / 2; 

  const [woodNormalSource, premiumWoodSource, walnutWoodSource, roofTileSource] = useTexture([
    '/textures/drewno-normal.webp',
    GOLDEN_OAK_TEXTURE,
    DARK_WALNUT_TEXTURE,
    '/textures/blachodachowka-premium.webp',
  ]);
  const [loadedTextures, setLoadedTextures] = useState<Record<string, THREE.Texture>>({});

  useEffect(() => {
    const urlsToLoad = Array.from(new Set([
      resolveColor(config.wallColor, colors).textureUrl,
      resolveColor(config.roofColor, colors).textureUrl,
      resolveColor(config.gateColor, colors).textureUrl,
      resolveColor(config.doorColor, colors).textureUrl,
      resolveColor(config.windowColor, colors).textureUrl,
      resolveColor(config.cornerFlashingColor, colors).textureUrl,
      resolveColor(config.roofFlashingColor, colors).textureUrl,
      resolveColor(config.gutterColor, colors).textureUrl,
      resolveColor(config.carportBaseColor || '#333333', colors).textureUrl,
      resolveColor(config.carportInsertColor || config.gateColor, colors).textureUrl,
    ].filter(url => url !== '' && !LOCAL_WOOD_TEXTURES.has(url))));

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    urlsToLoad.forEach(url => {
      if (!loadedTextures[url]) {
        loader.load(url, (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.repeat.set(1, 1);

          const horizTex = tex.clone();
          horizTex.rotation = Math.PI / 2;
          horizTex.center.set(0.5, 0.5);
          horizTex.wrapS = horizTex.wrapT = THREE.RepeatWrapping;
          horizTex.needsUpdate = true;
          setLoadedTextures(prev => ({ ...prev, [url]: tex, [`${url}_horiz`]: horizTex }));
        });
      }
    });
  }, [config, colors, loadedTextures]);

  const showGutters = config.gutters || (config.extraOptions || []).some(id => id.toLowerCase().includes('rynn'));
  const showCornerFlashings = (config.extraOptions || []).includes('cornerFlashings');
  const showRoofFlashings = (config.extraOptions || []).includes('roofFlashings');
  const isRoofTile = (config.extraOptions || []).includes('roofTile');

  const { woodColor, woodColorHoriz, walnutColor, walnutColorHoriz, woodNormal, woodNormalHoriz, roofTileTexture } = useMemo(() => {
    const prepareClone = (source: THREE.Texture, rotate = false, repeat = 1.35) => {
      const texture = source.clone();
      texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.repeat.set(repeat, repeat);
      texture.center.set(0.5, 0.5);
      texture.rotation = rotate ? Math.PI / 2 : 0;
      texture.needsUpdate = true;
      return texture;
    };

    const verticalColor = prepareClone(premiumWoodSource);
    verticalColor.colorSpace = THREE.SRGBColorSpace;
    const horizontalColor = prepareClone(premiumWoodSource, true);
    horizontalColor.colorSpace = THREE.SRGBColorSpace;
    const verticalWalnut = prepareClone(walnutWoodSource);
    verticalWalnut.colorSpace = THREE.SRGBColorSpace;
    const horizontalWalnut = prepareClone(walnutWoodSource, true);
    horizontalWalnut.colorSpace = THREE.SRGBColorSpace;
    const verticalNormal = prepareClone(woodNormalSource, false, 2.2);
    verticalNormal.colorSpace = THREE.NoColorSpace;
    const horizontalNormal = prepareClone(woodNormalSource, true, 2.2);
    horizontalNormal.colorSpace = THREE.NoColorSpace;
    const roofTile = roofTileSource.clone();
    roofTile.wrapS = roofTile.wrapT = THREE.MirroredRepeatWrapping;
    roofTile.repeat.set(3.2, 4.2);
    roofTile.colorSpace = THREE.SRGBColorSpace;
    roofTile.anisotropy = 4;
    roofTile.needsUpdate = true;

    return {
      woodColor: verticalColor,
      woodColorHoriz: horizontalColor,
      walnutColor: verticalWalnut,
      walnutColorHoriz: horizontalWalnut,
      woodNormal: verticalNormal,
      woodNormalHoriz: horizontalNormal,
      roofTileTexture: roofTile,
    };
  }, [premiumWoodSource, walnutWoodSource, woodNormalSource, roofTileSource]);

  const materialTextures = useMemo<Record<string, THREE.Texture>>(() => ({
    ...loadedTextures,
    [GOLDEN_OAK_TEXTURE]: woodColor,
    [`${GOLDEN_OAK_TEXTURE}_horiz`]: woodColorHoriz,
    [DARK_WALNUT_TEXTURE]: walnutColor,
    [`${DARK_WALNUT_TEXTURE}_horiz`]: walnutColorHoriz,
  }), [loadedTextures, woodColor, woodColorHoriz, walnutColor, walnutColorHoriz]);

  useEffect(() => () => {
    woodColor.dispose();
    woodColorHoriz.dispose();
    walnutColor.dispose();
    walnutColorHoriz.dispose();
    woodNormal.dispose();
    woodNormalHoriz.dispose();
    roofTileTexture.dispose();
  }, [woodColor, woodColorHoriz, walnutColor, walnutColorHoriz, woodNormal, woodNormalHoriz, roofTileTexture]);

  const profileTextures = useMemo(() => {
    return PROFILE_TYPES.reduce((textures, profile) => {
      textures[profile] = createProfileBumpTexture(profile);
      return textures;
    }, {} as Record<SheetProfile, THREE.Texture>);
  }, []);

  useEffect(() => () => {
    Object.values(profileTextures).forEach(texture => texture.dispose());
  }, [profileTextures]);

  const rt = String(config.roofType || '').toLowerCase();
  const isDualFrontBack = rt === 'dual-slope-front-back' || rt.includes('dwuspad-przod-tyl');
  const isDualLeftRight = (rt.includes('dual') || rt.includes('dwuspad')) && !isDualFrontBack;
  const isFront = rt.includes('front') || rt.includes('przód');
  const isBack = rt.includes('back') || rt.includes('tył');
  const isLeft = rt.includes('left') || rt.includes('lewo');
  const isRight = rt.includes('right') || rt.includes('prawo');

  const getH = (x: number, z: number) => {
    if (isDualLeftRight) return h + slopeH * (1 - Math.abs(x - centerX) / (totalW / 2));
    if (isDualFrontBack) return h + slopeH * (1 - Math.abs(z) / (l / 2));
    if (isFront) return h + slopeH * (0.5 - z/l);
    if (isBack) return h + slopeH * (0.5 + z/l);
    if (isLeft) return h + slopeH * ((x - minX) / totalW); 
    if (isRight) return h + slopeH * (1 - (x - minX) / totalW);
    return h;
  };

  const createGarageFrontShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(w/2, getH(w/2, l/2));
    if (isDualLeftRight && centerX > -w/2 && centerX < w/2) s.lineTo(centerX, getH(centerX, l/2));
    s.lineTo(-w/2, getH(-w/2, l/2));
    s.closePath(); return s;
  };

  const createGarageBackShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(w/2, getH(-w/2, -l/2)); 
    if (isDualLeftRight && centerX > -w/2 && centerX < w/2) s.lineTo(-centerX, getH(centerX, -l/2));
    s.lineTo(-w/2, getH(w/2, -l/2)); 
    s.closePath(); return s;
  };

  const createGarageSideShape = (isRightSide: boolean) => {
    const s = new THREE.Shape();
    const wallX = isRightSide ? w/2 : -w/2;
    s.moveTo(0, 0); s.lineTo(l, 0);
    s.lineTo(l, getH(wallX, -l/2));
    if (isDualFrontBack) s.lineTo(l / 2, getH(wallX, 0));
    s.lineTo(0, getH(wallX, l/2));
    s.closePath(); return s;
  };

  const wallExtrude = { depth: t, bevelEnabled: false };

  const getSubtractions = (wall: WallFace, isSide = false, isLeftWall = false) => {
    return (config.elements || []).filter(e => e.wall === wall).map((el, i) => {
      let xShape = (el.x || 0) * 0.01;
      if (isSide) xShape = isLeftWall ? ((l - 2*t) / 2 - (el.x || 0) * 0.01) : ((l - 2*t) / 2 + (el.x || 0) * 0.01);
      return <Subtraction key={i} position={[xShape, (el.y || 0) * 0.01 + ((el.height || 0) * 0.01) / 2, t / 2]}><boxGeometry args={[(el.width || 0) * 0.01, (el.height || 0) * 0.01, t * 4]} /></Subtraction>;
    });
  };

  const getProfileOpenings = (wall: WallFace, isSide = false, isLeftWall = false): ProfileOpening[] => {
    return (config.elements || []).filter(e => e.wall === wall).map((el) => {
      let xShape = (el.x || 0) * 0.01;
      if (isSide) {
        xShape = isLeftWall
          ? ((l - 2 * t) / 2 - (el.x || 0) * 0.01)
          : ((l - 2 * t) / 2 + (el.x || 0) * 0.01);
      }

      return {
        x: isSide ? xShape - l / 2 : xShape,
        y: (el.y || 0) * 0.01 + ((el.height || 0) * 0.01) / 2 - h / 2,
        width: (el.width || 0) * 0.01,
        height: (el.height || 0) * 0.01,
      };
    });
  };

  const renderWallRelief = (
    wall: WallFace,
    pos: [number, number, number],
    rotY: number,
    isSide = false,
    isLeftWall = false,
  ) => {
    const profile = (config.wallProfile || 'pionowe-t7') as SheetProfile;
    const depthDirection: 1 | -1 = isLeftWall ? -1 : 1;
    const surfaceZ = isLeftWall ? -0.002 : t + 0.002;

    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        <ProfileReliefSurface
          width={isSide ? l : w}
          height={h}
          profile={profile}
          openings={getProfileOpenings(wall, isSide, isLeftWall)}
          depthDirection={depthDirection}
          position={[isSide ? l / 2 : 0, h / 2, surfaceZ]}
          color={wallHex}
          colorMap={activeWallColorMap}
          normalMap={activeWallNormalMap}
          isWood={isWallWood}
        />
      </group>
    );
  };

  const renderElements = (wall: WallFace, pos: [number, number, number], rotY: number, isSide = false, isLeftWall = false) => {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        {(config.elements || []).filter(e => e.wall === wall).map((el) => {
          const elW = (el.width || 0) * 0.01; const elH = (el.height || 0) * 0.01; const elY = (el.y || 0) * 0.01;
          let xPos = (el.x || 0) * 0.01;
          if (isSide) xPos = isLeftWall ? ((l - 2*t) / 2 - (el.x || 0) * 0.01) : ((l - 2*t) / 2 + (el.x || 0) * 0.01);

          if (el.type === 'window' || el.type === 'pvc-window') {
            const { hex: windowHex, isWood: isWinWood, textureUrl: winTexUrl } = resolveColor(config.windowColor, colors);
            const winTex = isWinWood && winTexUrl && materialTextures[winTexUrl] ? materialTextures[winTexUrl] : undefined;
            const fc = isWinWood ? '#ffffff' : (windowHex && windowHex !== '#d4d4d4' ? windowHex : '#333');
            
            return (
              <group key={el.id} position={[xPos, elY + elH / 2, t / 2]}>
                <mesh castShadow receiveShadow><boxGeometry args={[elW - 0.06, elH - 0.06, t - 0.02]} /><meshStandardMaterial color="#1a2a3a" opacity={0.55} transparent roughness={0.05} metalness={0.95} envMapIntensity={2.5} /></mesh>
                <mesh><boxGeometry args={[elW, 0.04, t + 0.02]} /><meshStandardMaterial color={fc} map={winTex} roughness={0.3} metalness={0.6} /></mesh>
                <mesh><boxGeometry args={[0.04, elH, t + 0.02]} /><meshStandardMaterial color={fc} map={winTex} roughness={0.3} metalness={0.6} /></mesh>
              </group>
            );
          } else if (el.type === 'skylight') {
            return <group key={el.id} position={[xPos, elY + elH / 2, t / 2]}><mesh castShadow={false}><boxGeometry args={[elW, elH, 0.01]} /><meshStandardMaterial color="#e0f7fa" opacity={0.4} transparent roughness={0.05} metalness={0.6} side={THREE.DoubleSide} /></mesh></group>;
          } else if (el.type === 'gate') {
            return <AnimatedGate key={el.id} el={{ ...el, x: xPos * 100 }} woodColor={woodColor} woodNormal={woodNormal} woodColorHoriz={woodColorHoriz} woodNormalHoriz={woodNormalHoriz} profileTextures={profileTextures} config={config} colors={colors} loadedTextures={materialTextures} />;
          } else {
            const { hex: doorHex, isWood: isDoorWood, textureUrl: doorTexUrl } = resolveColor(config.doorColor, colors);
            const isHorizontal = config.doorProfile?.startsWith('poziome');
            const baseDoorWood = doorTexUrl && materialTextures[doorTexUrl] ? materialTextures[doorTexUrl] : woodColor;
            const baseDoorWoodHoriz = doorTexUrl && materialTextures[`${doorTexUrl}_horiz`] ? materialTextures[`${doorTexUrl}_horiz`] : woodColorHoriz;
            const activeColorMap = isDoorWood ? (isHorizontal ? baseDoorWoodHoriz : baseDoorWood) : undefined;
            const activeNormalMap = isDoorWood ? (isHorizontal ? woodNormalHoriz : woodNormal) : undefined;
            const doorProfileMap = profileTextures[config.doorProfile] || profileTextures['pionowe-t7'];
            const isLeftHinged = el.hingeSide === 'left';
            const handleXOffset = isLeftHinged ? (elW / 2 - 0.1) : -(elW / 2 - 0.1);
            const hingeXOffset = isLeftHinged ? -(elW / 2 - 0.02) : (elW / 2 - 0.02);

            return (
              <group key={el.id} position={[xPos, elY + elH / 2, t / 2]}>
                <mesh castShadow receiveShadow><boxGeometry args={[elW - 0.02, elH - 0.02, t + 0.01]} /><meshStandardMaterial key={`door-${config.doorColor}-${config.doorProfile}`} map={activeColorMap} normalMap={activeNormalMap} normalScale={isDoorWood ? new THREE.Vector2(0.48, 0.48) : undefined} bumpMap={doorProfileMap} bumpScale={0.15} color={isDoorWood ? '#ffffff' : doorHex} roughness={isDoorWood ? 0.62 : 0.48} metalness={isDoorWood ? 0.05 : 0.28} envMapIntensity={0.85} /></mesh>
                <ProfileReliefSurface width={elW - 0.028} height={elH - 0.028} profile={(config.doorProfile || 'pionowe-t7') as SheetProfile} position={[0, 0, (t + 0.01) / 2 + 0.002]} color={doorHex} colorMap={activeColorMap} normalMap={activeNormalMap} isWood={isDoorWood} />
                <group position={[handleXOffset, 0, t / 2 + 0.025]}><mesh><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh></group>
                <mesh position={[hingeXOffset, elH / 3, t / 2 + 0.01]}><boxGeometry args={[0.02, 0.08, 0.02]} /><meshStandardMaterial color="#333" /></mesh>
                <mesh position={[hingeXOffset, -elH / 3, t / 2 + 0.01]}><boxGeometry args={[0.02, 0.08, 0.02]} /><meshStandardMaterial color="#333" /></mesh>
              </group>
            );
          }
        })}
      </group>
    );
  };

  const renderRoof = () => {
    const { hex: gutterHex, isWood: isGutterWood, textureUrl: gutterTexUrl } = resolveColor(config.gutterColor, colors);
    const gutterMatProps = { color: isGutterWood ? '#ffffff' : gutterHex, map: isGutterWood && gutterTexUrl && materialTextures[gutterTexUrl] ? materialTextures[gutterTexUrl] : undefined, roughness: 0.6, metalness: 0.5 };
    
    const oX = 0.15; const oZ = 0.15; 
    const rL = l + (oZ * 2); const rW = totalW + (oX * 2); 

    const { hex: roofHex, isWood: isRoofWood, textureUrl: roofTexUrl } = resolveColor(config.roofColor, colors);
    const { hex: fasciaHex, isWood: isFasciaWood, textureUrl: fasciaTexUrl } = resolveColor(config.roofFlashingColor, colors);
    
    const baseRoofWood = roofTexUrl && materialTextures[roofTexUrl] ? materialTextures[roofTexUrl] : woodColor;
    const baseFasciaWood = fasciaTexUrl && materialTextures[fasciaTexUrl] ? materialTextures[fasciaTexUrl] : undefined;

    const roofTexToUse = isRoofWood ? baseRoofWood : undefined;
    const roofReliefTexture = isRoofWood ? baseRoofWood : roofTileTexture;

    const renderFasciaMat = (attachName: string) => <meshStandardMaterial attach={attachName} color={isFasciaWood ? '#ffffff' : fasciaHex} map={isFasciaWood && baseFasciaWood ? baseFasciaWood : undefined} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} />;
    const roofProfileMap = profileTextures[config.roofProfile] || profileTextures['pionowe-t7'];
    const renderMainRoofMat = (attachName: string) => <meshStandardMaterial key={`roof-${config.roofColor}-${config.roofProfile}-${isRoofTile}`} attach={attachName} color={isRoofWood ? '#ffffff' : roofHex} map={isRoofTile ? undefined : roofTexToUse} normalMap={isRoofWood && !isRoofTile ? woodNormal : undefined} normalScale={isRoofWood && !isRoofTile ? new THREE.Vector2(0.48, 0.48) : undefined} bumpMap={isRoofTile ? undefined : roofProfileMap} bumpScale={0.12} roughness={isRoofWood ? 0.62 : 0.48} metalness={isRoofWood ? 0.05 : 0.28} envMapIntensity={0.85} side={THREE.DoubleSide} />;

    const gutterR = 0.035; const pipeR = 0.025;
    
    const renderGutterPipe = (length: number, rot: [number, number, number], posGutter: [number, number, number], posPipe: [number, number, number], pipeHeight: number) => (
      <group>
        <mesh position={posGutter} rotation={rot} castShadow><cylinderGeometry args={[gutterR, gutterR, length, 16]} /><meshStandardMaterial {...gutterMatProps} /></mesh>
        <mesh position={[posPipe[0], posPipe[1] + pipeHeight/2, posPipe[2]]} castShadow><cylinderGeometry args={[pipeR, pipeR, pipeHeight, 16]} /><meshStandardMaterial {...gutterMatProps} /></mesh>
      </group>
    );

    if (isDualLeftRight) {
      const roofTheta = Math.atan2(slopeH, totalW/2);
      const overlap = 0.08; 
      const paneLen = (totalW/2 + oX) / Math.cos(roofTheta) + overlap;
      const liftY = (t/2) / Math.cos(roofTheta); 
      const ridgeY = h + slopeH + liftY; 
      const eavesY = h + liftY - Math.tan(roofTheta)*oX;

      return (
        <group position={[centerX, ridgeY, 0]}>
          <group rotation={[0, 0, roofTheta]}>
            <mesh position={[-(paneLen/2 - overlap/2), 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[paneLen, t, rL]} />
              {renderFasciaMat("material-0")}{renderFasciaMat("material-1")}{renderMainRoofMat("material-2")}{renderFasciaMat("material-3")}{renderFasciaMat("material-4")}{renderFasciaMat("material-5")}
            </mesh>
            {isRoofTile && <RoofTileRelief width={paneLen} depth={rL} slopeAxis="x" position={[-(paneLen/2 - overlap/2), t/2 + 0.002, 0]} color={isRoofWood ? '#ffffff' : roofHex} texture={roofReliefTexture} normalTexture={isRoofWood ? woodNormal : undefined} />}
          </group>
          <group rotation={[0, 0, -roofTheta]}>
            <mesh position={[(paneLen/2 - overlap/2), 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[paneLen, t, rL]} />
              {renderFasciaMat("material-0")}{renderFasciaMat("material-1")}{renderMainRoofMat("material-2")}{renderFasciaMat("material-3")}{renderFasciaMat("material-4")}{renderFasciaMat("material-5")}
            </mesh>
            {isRoofTile && <RoofTileRelief width={paneLen} depth={rL} slopeAxis="x" position={[(paneLen/2 - overlap/2), t/2 + 0.002, 0]} color={isRoofWood ? '#ffffff' : roofHex} texture={roofReliefTexture} normalTexture={isRoofWood ? woodNormal : undefined} />}
          </group>
          {showGutters && (
            <>
              {renderGutterPipe(rL, [Math.PI/2, 0, 0], [-totalW/2 - oX, eavesY - ridgeY - 0.01, 0], [-totalW/2 - oX + 0.035, -ridgeY, -l/2 - oZ + 0.05], eavesY)}
              {renderGutterPipe(rL, [Math.PI/2, 0, 0], [ totalW/2 + oX, eavesY - ridgeY - 0.01, 0], [ totalW/2 + oX - 0.035, -ridgeY, -l/2 - oZ + 0.05], eavesY)}
            </>
          )}
        </group>
      );
    }

    if (isDualFrontBack) {
      const roofTheta = Math.atan2(slopeH, l / 2);
      const overlap = 0.08;
      const paneLen = (l / 2 + oZ) / Math.cos(roofTheta) + overlap;
      const liftY = (t / 2) / Math.cos(roofTheta);
      const ridgeY = h + slopeH + liftY;
      const eavesY = h + liftY - Math.tan(roofTheta) * oZ;

      return (
        <group position={[centerX, ridgeY, 0]}>
          <group rotation={[roofTheta, 0, 0]}>
            <mesh position={[0, 0, paneLen / 2 - overlap / 2]} castShadow receiveShadow>
              <boxGeometry args={[rW, t, paneLen]} />
              {renderFasciaMat("material-0")}{renderFasciaMat("material-1")}{renderMainRoofMat("material-2")}{renderFasciaMat("material-3")}{renderFasciaMat("material-4")}{renderFasciaMat("material-5")}
            </mesh>
            {isRoofTile && <RoofTileRelief width={rW} depth={paneLen} slopeAxis="z" position={[0, t / 2 + 0.002, paneLen / 2 - overlap / 2]} color={isRoofWood ? '#ffffff' : roofHex} texture={roofReliefTexture} normalTexture={isRoofWood ? woodNormal : undefined} />}
          </group>
          <group rotation={[-roofTheta, 0, 0]}>
            <mesh position={[0, 0, -(paneLen / 2 - overlap / 2)]} castShadow receiveShadow>
              <boxGeometry args={[rW, t, paneLen]} />
              {renderFasciaMat("material-0")}{renderFasciaMat("material-1")}{renderMainRoofMat("material-2")}{renderFasciaMat("material-3")}{renderFasciaMat("material-4")}{renderFasciaMat("material-5")}
            </mesh>
            {isRoofTile && <RoofTileRelief width={rW} depth={paneLen} slopeAxis="z" position={[0, t / 2 + 0.002, -(paneLen / 2 - overlap / 2)]} color={isRoofWood ? '#ffffff' : roofHex} texture={roofReliefTexture} normalTexture={isRoofWood ? woodNormal : undefined} />}
          </group>
          {showGutters && (
            <>
              {renderGutterPipe(rW, [0, 0, Math.PI / 2], [0, eavesY - ridgeY - 0.01, l / 2 + oZ], [totalW / 2 + oX - 0.05, -ridgeY, l / 2 + oZ - 0.035], eavesY)}
              {renderGutterPipe(rW, [0, 0, Math.PI / 2], [0, eavesY - ridgeY - 0.01, -l / 2 - oZ], [totalW / 2 + oX - 0.05, -ridgeY, -l / 2 - oZ + 0.035], eavesY)}
            </>
          )}
        </group>
      );
    }

    let roofRotX = 0, roofRotZ = 0; let gutterSystem = null;
    let paneLenX = rW, paneLenZ = rL; let liftY = 0; let eavesY = h;

    if (isFront) {
      roofRotX = Math.atan2(slopeH, l); liftY = (t/2)/Math.cos(roofRotX); eavesY = h + liftY - Math.tan(roofRotX)*oZ;
      paneLenZ = (l + oZ*2) / Math.cos(roofRotX);
      gutterSystem = renderGutterPipe(rW, [0, 0, Math.PI/2], [0, eavesY - 0.01, l/2 + oZ], [totalW/2 + oX - 0.05, 0, l/2 + oZ - 0.035], eavesY);
    } else if (isBack) {
      roofRotX = -Math.atan2(slopeH, l); liftY = (t/2)/Math.cos(Math.abs(roofRotX)); eavesY = h + liftY - Math.tan(Math.abs(roofRotX))*oZ;
      paneLenZ = (l + oZ*2) / Math.cos(Math.abs(roofRotX));
      gutterSystem = renderGutterPipe(rW, [0, 0, Math.PI/2], [0, eavesY - 0.01, -l/2 - oZ], [totalW/2 + oX - 0.05, 0, -l/2 - oZ + 0.035], eavesY);
    } else if (isLeft) {
      roofRotZ = Math.atan2(slopeH, totalW); liftY = (t/2)/Math.cos(roofRotZ); eavesY = h + liftY - Math.tan(roofRotZ)*oX;
      paneLenX = (totalW + oX*2) / Math.cos(roofRotZ);
      gutterSystem = renderGutterPipe(rL, [Math.PI/2, Math.PI, 0], [-totalW/2 - oX, eavesY - 0.01, 0], [-totalW/2 - oX + 0.035, 0, -l/2 - oZ + 0.05], eavesY);
    } else if (isRight) {
      roofRotZ = -Math.atan2(slopeH, totalW); liftY = (t/2)/Math.cos(Math.abs(roofRotZ)); eavesY = h + liftY - Math.tan(Math.abs(roofRotZ))*oX;
      paneLenX = (totalW + oX*2) / Math.cos(Math.abs(roofRotZ));
      gutterSystem = renderGutterPipe(rL, [Math.PI/2, 0, 0], [totalW/2 + oX, eavesY - 0.01, 0], [totalW/2 + oX - 0.035, 0, -l/2 - oZ + 0.05], eavesY);
    }

    const ridgeZ = isFront ? -l/2 - oZ : (isBack ? l/2 + oZ : 0);
    const ridgeX = isLeft ? maxX + oX : (isRight ? minX - oX : centerX);
    const ridgeY = h + slopeH + liftY;

    const zShift = isFront ? paneLenZ/2 : (isBack ? -paneLenZ/2 : 0);
    const xShift = isLeft ? -paneLenX/2 : (isRight ? paneLenX/2 : 0);

    return (
      <group>
        <group position={[ridgeX, ridgeY, ridgeZ]} rotation={[roofRotX, 0, roofRotZ]}>
          <mesh position={[xShift, 0, zShift]} castShadow receiveShadow>
            <boxGeometry args={[paneLenX, t, paneLenZ]} />
            {renderFasciaMat("material-0")}{renderFasciaMat("material-1")}{renderMainRoofMat("material-2")}{renderFasciaMat("material-3")}{renderFasciaMat("material-4")}{renderFasciaMat("material-5")}
          </mesh>
          {isRoofTile && <RoofTileRelief width={paneLenX} depth={paneLenZ} slopeAxis={isFront || isBack ? 'z' : 'x'} position={[xShift, t/2 + 0.002, zShift]} color={isRoofWood ? '#ffffff' : roofHex} texture={roofReliefTexture} normalTexture={isRoofWood ? woodNormal : undefined} />}
        </group>
        {showGutters && <group position={[centerX, 0, 0]}>{gutterSystem}</group>}
      </group>
    );
  };

  const { hex: wallHex, isWood: isWallWood, textureUrl: wallTexUrl } = resolveColor(config?.wallColor, colors);
  const isWallHorizontal = config?.wallProfile?.startsWith('poziome');
  const baseWallWood = wallTexUrl && materialTextures[wallTexUrl] ? materialTextures[wallTexUrl] : woodColor;
  const baseWallWoodHoriz = wallTexUrl && materialTextures[`${wallTexUrl}_horiz`] ? materialTextures[`${wallTexUrl}_horiz`] : woodColorHoriz;
  const activeWallColorMap = isWallWood ? (isWallHorizontal ? baseWallWoodHoriz : baseWallWood) : undefined;
  const activeWallNormalMap = isWallWood ? (isWallHorizontal ? woodNormalHoriz : woodNormal) : undefined;
  const wallProfileMap = profileTextures[config.wallProfile] || profileTextures['pionowe-t7'];
  
  const wallMaterialComponent = <meshStandardMaterial key={`wall-${config.wallColor}-${config.wallProfile}`} map={activeWallColorMap} normalMap={activeWallNormalMap} normalScale={isWallWood ? new THREE.Vector2(0.48, 0.48) : undefined} bumpMap={wallProfileMap} bumpScale={0.16} color={isWallWood ? '#ffffff' : wallHex} roughness={isWallWood ? 0.62 : 0.48} metalness={isWallWood ? 0.05 : 0.28} envMapIntensity={0.85} side={THREE.DoubleSide} />;

  const { carportBaseMaterial, carportInsertMaterial } = useMemo(() => {
    const baseResult = resolveColor(config.carportBaseColor || '#333333', colors);
    const insertResult = resolveColor(config.carportInsertColor || config.gateColor, colors);
    const baseTexture = baseResult.isWood
      ? (materialTextures[baseResult.textureUrl] || woodColor)
      : null;
    const insertTexture = insertResult.isWood
      ? (materialTextures[`${insertResult.textureUrl}_horiz`] || woodColorHoriz)
      : null;
    const baseOptions: THREE.MeshStandardMaterialParameters = {
      color: baseResult.isWood ? '#ffffff' : baseResult.hex,
      roughness: 0.8,
      metalness: 0.2,
    };
    const insertOptions: THREE.MeshStandardMaterialParameters = {
      color: insertResult.isWood ? '#ffffff' : insertResult.hex,
      roughness: insertResult.isWood ? 0.7 : 0.4,
      metalness: insertResult.isWood ? 0 : 0.6,
    };
    if (baseTexture) baseOptions.map = baseTexture;
    if (insertTexture) {
      insertOptions.map = insertTexture;
      insertOptions.normalMap = woodNormalHoriz;
    }

    return {
      carportBaseMaterial: new THREE.MeshStandardMaterial(baseOptions),
      carportInsertMaterial: new THREE.MeshStandardMaterial(insertOptions),
    };
  }, [config.carportBaseColor, config.carportInsertColor, config.gateColor, colors, materialTextures, woodColor, woodColorHoriz, woodNormalHoriz]);

  useEffect(() => () => {
    carportBaseMaterial.dispose();
    carportInsertMaterial.dispose();
  }, [carportBaseMaterial, carportInsertMaterial]);

  const renderCarport = () => {
    if (!hasCarport || cw === 0) return null;

    const pillars = []; const pSize = 0.08;
    pillars.push([cSide === 'right' ? maxX - pSize/2 : minX + pSize/2, h/2, l/2 - pSize/2]); 
    pillars.push([cSide === 'right' ? maxX - pSize/2 : minX + pSize/2, h/2, -l/2 + pSize/2]); 
    pillars.push([cSide === 'right' ? w/2 + pSize/2 : -w/2 - pSize/2, h/2, l/2 - pSize/2]); 
    pillars.push([cSide === 'right' ? w/2 + pSize/2 : -w/2 - pSize/2, h/2, -l/2 + pSize/2]); 

    const slatH = 0.12; const slatGap = 0.04; const step = slatH + slatGap;
    const numSlats = Math.floor((h - 0.05) / step);
    const slats = [];

    for (let i = 0; i < numSlats; i++) {
      const y = i * step + slatH/2 + 0.05;
      const isInsert = (i === Math.floor(numSlats/2) || i === Math.floor(numSlats/2) - 1);

      if (config.carportWalls?.side) {
        const x = cSide === 'right' ? maxX - pSize/2 : minX + pSize/2;
        slats.push(
          <mesh key={`side-${i}`} position={[x, y, 0]} castShadow>
            <boxGeometry args={[0.02, slatH, l - pSize*2]} />
            {isInsert ? <primitive object={carportInsertMaterial} attach="material" /> : wallMaterialComponent}
          </mesh>
        );
      }
      if (config.carportWalls?.front) {
        const x = cSide === 'right' ? w/2 + cw/2 : -w/2 - cw/2;
        slats.push(
          <mesh key={`front-${i}`} position={[x, y, l/2 - pSize/2]} castShadow>
            <boxGeometry args={[cw - pSize*2, slatH, 0.02]} />
            {isInsert ? <primitive object={carportInsertMaterial} attach="material" /> : wallMaterialComponent}
          </mesh>
        );
      }
      if (config.carportWalls?.back) {
        const x = cSide === 'right' ? w/2 + cw/2 : -w/2 - cw/2;
        slats.push(
          <mesh key={`back-${i}`} position={[x, y, -l/2 + pSize/2]} castShadow>
            <boxGeometry args={[cw - pSize*2, slatH, 0.02]} />
            {isInsert ? <primitive object={carportInsertMaterial} attach="material" /> : wallMaterialComponent}
          </mesh>
        );
      }
    }

    const sF = new THREE.Shape();
    if (cSide === 'right') { sF.moveTo(w/2, h); sF.lineTo(maxX, h); sF.lineTo(maxX, getH(maxX, l/2)); if (isDualLeftRight && centerX > w/2 && centerX < maxX) sF.lineTo(centerX, getH(centerX, l/2)); sF.lineTo(w/2, getH(w/2, l/2)); }
    else { sF.moveTo(minX, h); sF.lineTo(-w/2, h); sF.lineTo(-w/2, getH(-w/2, l/2)); if (isDualLeftRight && centerX > minX && centerX < -w/2) sF.lineTo(centerX, getH(centerX, l/2)); sF.lineTo(minX, getH(minX, l/2)); }
    sF.closePath();

    const sB = new THREE.Shape();
    if (cSide === 'right') { sB.moveTo(w/2, h); sB.lineTo(maxX, h); sB.lineTo(maxX, getH(maxX, -l/2)); if (isDualLeftRight && centerX > w/2 && centerX < maxX) sB.lineTo(centerX, getH(centerX, -l/2)); sB.lineTo(w/2, getH(w/2, -l/2)); }
    else { sB.moveTo(minX, h); sB.lineTo(-w/2, h); sB.lineTo(-w/2, getH(-w/2, -l/2)); if (isDualLeftRight && centerX > minX && centerX < -w/2) sB.lineTo(centerX, getH(centerX, -l/2)); sB.lineTo(minX, getH(minX, -l/2)); }
    sB.closePath();

    const sS = new THREE.Shape();
    sS.moveTo(0, h); sS.lineTo(l, h);
    if (cSide === 'right') { sS.lineTo(l, getH(maxX, -l/2)); if (isDualFrontBack) sS.lineTo(l / 2, getH(maxX, 0)); sS.lineTo(0, getH(maxX, l/2)); }
    else { sS.lineTo(l, getH(minX, -l/2)); if (isDualFrontBack) sS.lineTo(l / 2, getH(minX, 0)); sS.lineTo(0, getH(minX, l/2)); }
    sS.closePath();

    return (
      <group>
        {pillars.map((pos, idx) => <mesh key={`p-${idx}`} position={pos as [number,number,number]} material={carportBaseMaterial} castShadow><boxGeometry args={[pSize, h, pSize]} /></mesh>)}
        {slats}
        <mesh position={[0, 0, l/2 - t]} castShadow><extrudeGeometry args={[sF, wallExtrude]} />{wallMaterialComponent}</mesh>
        <mesh position={[0, 0, -l/2]} castShadow><extrudeGeometry args={[sB, wallExtrude]} />{wallMaterialComponent}</mesh>
        <mesh position={[cSide === 'right' ? maxX - t : minX, 0, l/2 - t]} rotation={[0, Math.PI/2, 0]} castShadow><extrudeGeometry args={[sS, wallExtrude]} />{wallMaterialComponent}</mesh>
      </group>
    );
  };

  const renderCornerTrim = (xPos: number, zPos: number, hTrim: number) => {
    const { hex, isWood, textureUrl } = resolveColor(config?.cornerFlashingColor, colors);
    return <mesh position={[xPos, hTrim / 2, zPos]} castShadow><boxGeometry args={[t + 0.01, hTrim + 0.01, t + 0.01]} /><meshStandardMaterial color={isWood ? '#ffffff' : hex} map={isWood && textureUrl && materialTextures[textureUrl] ? materialTextures[textureUrl] : undefined} roughness={0.6} metalness={0.4} /></mesh>;
  };

  return (
    <>
      <LightweightEnvironment intensity={0.72} />
      <color attach="background" args={['#dbe4ea']} />
      
      <group name="garageModelGroup">
        {showCornerFlashings && (
          <>
            {renderCornerTrim(-w/2 + t/2, l/2 - t/2, getH(-w/2, l/2))}
            {renderCornerTrim(w/2 - t/2, l/2 - t/2, getH(w/2, l/2))}
            {renderCornerTrim(-w/2 + t/2, -l/2 + t/2, getH(-w/2, -l/2))}
            {renderCornerTrim(w/2 - t/2, -l/2 + t/2, getH(w/2, -l/2))}
          </>
        )}

        <group>
          <mesh position={[0, 0, l / 2 - t]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageFrontShape(), wallExtrude]} /></Base>{getSubtractions('front')}</Geometry>{wallMaterialComponent}</mesh>
          {renderWallRelief('front', [0, 0, l / 2 - t], 0)}
          {renderElements('front', [0, 0, l / 2 - t], 0)}

          <mesh position={[0, 0, -l / 2 + t]} rotation={[0, Math.PI, 0]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageBackShape(), wallExtrude]} /></Base>{getSubtractions('back')}</Geometry>{wallMaterialComponent}</mesh>
          {renderWallRelief('back', [0, 0, -l / 2 + t], Math.PI)}
          {renderElements('back', [0, 0, -l / 2 + t], Math.PI)}

          <mesh position={[-w / 2, 0, l / 2 - t]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageSideShape(false), wallExtrude]} /></Base>{getSubtractions('left', true, true)}</Geometry>{wallMaterialComponent}</mesh>
          {renderWallRelief('left', [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true)}
          {renderElements('left', [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true)}

          <mesh position={[w / 2 - t, 0, l / 2 - t]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageSideShape(true), wallExtrude]} /></Base>{getSubtractions('right', true, false)}</Geometry>{wallMaterialComponent}</mesh>
          {renderWallRelief('right', [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false)}
          {renderElements('right', [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false)}

          {renderRoof()}
        </group>

        {renderCarport()}
      </group>
    </>
  );
}
