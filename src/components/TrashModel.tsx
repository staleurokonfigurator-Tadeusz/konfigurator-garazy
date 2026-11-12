"use client";

import { useEffect } from 'react';
import { GarageConfig, WallFace } from '@/types';
import * as THREE from 'three';
import { ContactShadows, useTexture } from '@react-three/drei';
import LightweightEnvironment from './LightweightEnvironment';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { getTrashPanelBands, getTrashPanelColor, getTrashWallPanelHeightCm } from '@/lib/trashPanels';

interface TrashModelProps {
  config: GarageConfig;
  colors?: ColorOption[];
}

interface ColorOption { id: string; type?: string; hex?: string; texture?: string }

function resolveColor(colorId: string | undefined, colors: ColorOption[] = []): { hex: string; isWood: boolean; textureUrl: string } {
  if (!colorId) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };
  if (colorId.startsWith('#')) return { hex: colorId, isWood: false, textureUrl: '' };
  const found = colors.find(color => color.id === colorId);
  if (!found) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };
  return {
    hex: found.hex || '#d4d4d4',
    isWood: String(found.type || '').toLowerCase().includes('drew'),
    textureUrl: found.texture || '',
  };
}

function TrashSurfaceMaterial({ colorId, colors, attach, metalTexture = false }: { colorId?: string; colors: ColorOption[]; attach?: string; metalTexture?: boolean }) {
  const resolved = resolveColor(colorId, colors);
  const [selectedTexture, sheetTexture, woodNormal] = useTexture([
    resolved.textureUrl || '/textures/trapez.webp',
    '/textures/trapez.webp',
    '/textures/drewno-normal.webp',
  ]);
  useEffect(() => {
    [selectedTexture, sheetTexture, woodNormal].forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = texture === woodNormal ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      texture.repeat.set(2, 2);
      texture.needsUpdate = true;
    });
  }, [selectedTexture, sheetTexture, woodNormal]);
  return <meshStandardMaterial
    attach={attach}
    color={resolved.isWood ? '#ffffff' : resolved.hex}
    map={resolved.isWood ? selectedTexture : metalTexture ? sheetTexture : undefined}
    normalMap={resolved.isWood ? woodNormal : undefined}
    normalScale={resolved.isWood ? new THREE.Vector2(1.1, 1.1) : undefined}
    roughness={resolved.isWood ? 0.72 : 0.56}
    metalness={resolved.isWood ? 0 : 0.35}
    envMapIntensity={1.25}
    side={THREE.DoubleSide}
    shadowSide={THREE.DoubleSide}
  />;
}

export default function TrashModel({ config, colors = [] }: TrashModelProps) {
  const w = config.width / 100;
  const l = config.length / 100;
  const h = config.height / 100;

  const t = 0.05;
  const slopeH = 0.4;

  const showGutters = config.extraOptions?.includes('gutters') ?? config.gutters;
  const showRoofFlashings = config.extraOptions?.includes('roofFlashings');

  // --- LOGIKA DACHU ---
  const isDual = config.roofType === 'dual-slope';
  const isFront = config.roofType === 'slope-front';
  const isBack = config.roofType === 'slope-back';
  const isLeft = config.roofType === 'slope-left';
  const isRight = config.roofType === 'slope-right';

  const renderRoof = () => {
    const gutterMat = <meshStandardMaterial color="#3b3b3c" roughness={0.6} metalness={0.55} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />;
    const rL = l + 0.4;
    const rW = w + 0.4;

    const { hex: roofHex } = resolveColor(config.roofColor, colors);
    const roofFasciaColor = roofHex;

    if (isDual) {
      const oX = 0.2;
      const roofTheta = Math.atan2(slopeH, w/2);
      const halfRoofW = w/2 + oX;
      const overlap = 0.08;
      const paneLen = halfRoofW / Math.cos(roofTheta) + overlap;

      const liftY = (t/2) / Math.cos(roofTheta);
      const ridgeY = h + slopeH + liftY;
      const eavesY = h + liftY - Math.tan(roofTheta)*oX;

      const renderFasciaMat = (attachName: string) => (
        <meshStandardMaterial attach={attachName} color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
      );

      const renderMainMat = (attachName: string) => <TrashSurfaceMaterial attach={attachName} colorId={config.roofColor} colors={colors} metalTexture />;

      return (
        <group frustumCulled={false}>
          <group position={[0, ridgeY, 0]} rotation={[0, 0, roofTheta]} frustumCulled={false}>
            <mesh position={[-(paneLen/2 - overlap/2), 0, 0]} castShadow receiveShadow frustumCulled={false}>
              <boxGeometry args={[paneLen, t, rL]} />
              {renderFasciaMat("material-0")}
              {renderFasciaMat("material-1")}
              {renderMainMat("material-2")}
              {renderFasciaMat("material-3")}
              {renderFasciaMat("material-4")}
              {renderFasciaMat("material-5")}
            </mesh>
          </group>
          <group position={[0, ridgeY, 0]} rotation={[0, 0, -roofTheta]} frustumCulled={false}>
            <mesh position={[(paneLen/2 - overlap/2), 0, 0]} castShadow receiveShadow frustumCulled={false}>
              <boxGeometry args={[paneLen, t, rL]} />
              {renderFasciaMat("material-0")}
              {renderFasciaMat("material-1")}
              {renderMainMat("material-2")}
              {renderFasciaMat("material-3")}
              {renderFasciaMat("material-4")}
              {renderFasciaMat("material-5")}
            </mesh>
          </group>
          {showGutters && (
            <group frustumCulled={false}>
              <mesh position={[-w/2 - oX, eavesY - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow frustumCulled={false}><cylinderGeometry args={[0.05, 0.05, rL]} />{gutterMat}</mesh>
              <mesh position={[ w/2 + oX, eavesY - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow frustumCulled={false}><cylinderGeometry args={[0.05, 0.05, rL]} />{gutterMat}</mesh>
              <mesh position={[-w/2 - oX + 0.035, eavesY/2, -l/2 - 0.2 + 0.05]} castShadow frustumCulled={false}><cylinderGeometry args={[0.04, 0.04, eavesY]} />{gutterMat}</mesh>
              <mesh position={[ w/2 + oX - 0.035, eavesY/2, -l/2 - 0.2 + 0.05]} castShadow frustumCulled={false}><cylinderGeometry args={[0.04, 0.04, eavesY]} />{gutterMat}</mesh>
            </group>
          )}
        </group>
      );
    }

    let roofRotX = 0, roofRotZ = 0;
    let gutterMesh = null;

    if (isFront) {
      roofRotX = Math.atan2(slopeH, l);
      gutterMesh = <mesh position={[0, -0.02, rL / 2]} rotation={[0, 0, Math.PI / 2]} castShadow frustumCulled={false}><cylinderGeometry args={[0.06, 0.06, rW]} />{gutterMat}</mesh>;
    } else if (isBack) {
      roofRotX = -Math.atan2(slopeH, l);
      gutterMesh = <mesh position={[0, -0.02, -rL / 2]} rotation={[0, 0, Math.PI / 2]} castShadow frustumCulled={false}><cylinderGeometry args={[0.06, 0.06, rW]} />{gutterMat}</mesh>;
    } else if (isLeft) {
      roofRotZ = Math.atan2(slopeH, w);
      gutterMesh = <mesh position={[-rW / 2, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow frustumCulled={false}><cylinderGeometry args={[0.06, 0.06, rL]} />{gutterMat}</mesh>;
    } else if (isRight) {
      roofRotZ = -Math.atan2(slopeH, w);
      gutterMesh = <mesh position={[rW / 2, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow frustumCulled={false}><cylinderGeometry args={[0.06, 0.06, rL]} />{gutterMat}</mesh>;
    }

    const zOffset = isFront ? -(t / 2) * Math.sin(roofRotX) : (isBack ? (t / 2) * Math.sin(Math.abs(roofRotX)) : 0);
    const xOffset = isLeft ? (t / 2) * Math.sin(roofRotZ) : (isRight ? -(t / 2) * Math.sin(Math.abs(roofRotZ)) : 0);

    return (
      <group frustumCulled={false}>
        <mesh position={[xOffset, h + slopeH / 2 + t / 2, zOffset]} rotation={[roofRotX, 0, roofRotZ]} castShadow receiveShadow frustumCulled={false}>
          <boxGeometry args={[rW, t, rL]} />
          <meshStandardMaterial attach="material-0" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-1" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <TrashSurfaceMaterial attach="material-2" colorId={config.roofColor} colors={colors} metalTexture />
          <meshStandardMaterial attach="material-3" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-4" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-5" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          {showGutters && gutterMesh}
        </mesh>
      </group>
    );
  };

  // --- LOGIKA ŚCIAN Z CSG (LAMELKI) ---
  let hFL = h, hFR = h, hBL = h, hBR = h;
  if (isDual) { hFL = h; hFR = h; hBL = h; hBR = h; }
  else if (isFront) { hBL = h + slopeH; hBR = h + slopeH; }
  else if (isBack) { hFL = h + slopeH; hFR = h + slopeH; }
  else if (isLeft) { hFR = h + slopeH; hBR = h + slopeH; }
  else if (isRight) { hFL = h + slopeH; hBL = h + slopeH; }

  const createFBShape = (leftH: number, rightH: number, isTri = false) => {
    const shape = new THREE.Shape();
    const halfW = w / 2;
    shape.moveTo(-halfW, 0);
    shape.lineTo( halfW, 0);
    shape.lineTo( halfW, rightH);
    if (isTri) shape.lineTo(0, rightH + slopeH);
    shape.lineTo(-halfW, leftH);
    shape.closePath();
    return shape;
  };

  const createSideShape = (frontH: number, rearH: number) => {
    const shape = new THREE.Shape();
    const sideL = l - 2 * t;
    shape.moveTo(0, 0);
    shape.lineTo(sideL, 0);
    shape.lineTo(sideL, rearH);
    shape.lineTo(0, frontH);
    shape.closePath();
    return shape;
  };

  const wallExtrude = { depth: t, bevelEnabled: false };
  const frontShape = createFBShape(hFL, hFR, isDual);
  const backShape = createFBShape(hBR, hBL, isDual);
  const leftSideShape  = createSideShape(hFL, hBL);
  const rightSideShape = createSideShape(hFR, hBR);

  const getElementSubtractions = (wall: WallFace, isSide = false, isLeftWall = false) => {
    return (config.elements || []).filter(e => e.wall === wall).map((el, i) => {
      let xShape = (el.x || 0) * 0.01;
      if (isSide) xShape = isLeftWall ? ((l - 2*t) / 2 - (el.x || 0) * 0.01) : ((l - 2*t) / 2 + (el.x || 0) * 0.01);
      return (
        <Subtraction key={`el-${i}`} position={[xShape, (el.y || 0) * 0.01 + ((el.height || 0) * 0.01) / 2, t / 2]}>
          <boxGeometry args={[(el.width || 0) * 0.01, (el.height || 0) * 0.01, t * 4]} />
        </Subtraction>
      );
    });
  };

  const getLouversSubtractions = (wallW: number, wallMaxH: number, isSide = false) => {
    const subs: React.ReactNode[] = [];
    const bands = getTrashPanelBands(wallMaxH * 100, config.trashPanelPattern || 'narrow');
    const posX = isSide ? wallW / 2 : 0;
    bands.slice(0, -1).forEach((band, index) => {
      const gapStartCm = band.bottomCm + band.heightCm;
      const gapHeightCm = Math.max(0, bands[index + 1].bottomCm - gapStartCm);
      if (gapHeightCm <= 0) return;
      subs.push(
        <Subtraction key={`gap-${index}`} position={[posX, (gapStartCm + gapHeightCm / 2) / 100, t / 2]}>
          <boxGeometry args={[20, gapHeightCm / 100, t * 4]} />
        </Subtraction>
      );
    });
    return subs;
  };

  const renderAzurowaWall = (
    wallType: WallFace,
    shape: THREE.Shape,
    pos: [number, number, number],
    rotY: number,
    isSide = false,
    isLeftWall = false,
    wallW: number
  ) => {
    return (
      <mesh position={pos} rotation={[0, rotY, 0]} castShadow receiveShadow>
        <Geometry computeVertexNormals>
          <Base>
            <extrudeGeometry args={[shape, wallExtrude]} />
          </Base>
          {getElementSubtractions(wallType, isSide, isLeftWall)}
          {getLouversSubtractions(wallW, h + slopeH + 0.5, isSide)}
        </Geometry>
        <TrashSurfaceMaterial colorId={config.wallColor} colors={colors} />
      </mesh>
    );
  };

  // Widoczne panele są osobnymi elementami. Dzięki temu każdy z nich może mieć
  // własny kolor, a otwory na bramy i drzwi nadal pozostają rzeczywistymi otworami.
  const renderPanelOverlay = (
    wall: WallFace,
    pos: [number, number, number],
    rotY: number,
    isSide: boolean,
    isLeftWall: boolean,
    wallWidth: number,
  ) => {
    const bands = getTrashPanelBands(getTrashWallPanelHeightCm(config, wall), config.trashPanelPattern || 'narrow');
    const wallElements = (config.elements || []).filter(element => element.wall === wall);
    const minX = isSide ? 0 : -wallWidth / 2;
    const maxX = isSide ? wallWidth : wallWidth / 2;
    const [startHeight, endHeight, gable]: [number, number, boolean] = wall === 'front'
      ? [hFL, hFR, isDual]
      : wall === 'back'
        ? [hBR, hBL, isDual]
        : wall === 'left'
          ? [hFL, hBL, false]
          : [hFR, hBR, false];
    const visibleInterval = (bandTop: number): [number, number] | null => {
      if (gable) {
        if (bandTop <= h) return [minX, maxX];
        if (bandTop >= h + slopeH) return null;
        const halfWidth = wallWidth / 2 * (1 - (bandTop - h) / slopeH);
        return [-halfWidth, halfWidth];
      }
      const low = Math.min(startHeight, endHeight);
      const high = Math.max(startHeight, endHeight);
      if (bandTop <= low) return [minX, maxX];
      if (bandTop >= high || Math.abs(endHeight - startHeight) < 0.001) return null;
      const threshold = minX + ((bandTop - startHeight) / (endHeight - startHeight)) * wallWidth;
      return endHeight > startHeight ? [Math.max(minX, threshold), maxX] : [minX, Math.min(maxX, threshold)];
    };
    return <group position={pos} rotation={[0, rotY, 0]}>
      {bands.flatMap(band => {
        const bandBottom = band.bottomCm / 100;
        const bandTop = (band.bottomCm + band.heightCm) / 100;
        const wallInterval = visibleInterval(bandTop);
        if (!wallInterval) return [];
        let intervals: Array<[number, number]> = [wallInterval];
        for (const element of wallElements) {
          const elementBottom = (element.y || 0) / 100;
          const elementTop = elementBottom + (element.height || 0) / 100;
          if (elementTop <= bandBottom || elementBottom >= bandTop) continue;
          const center = isSide
            ? (isLeftWall ? wallWidth / 2 - (element.x || 0) / 100 : wallWidth / 2 + (element.x || 0) / 100)
            : (element.x || 0) / 100;
          const openingFrom = center - (element.width || 0) / 200;
          const openingTo = center + (element.width || 0) / 200;
          intervals = intervals.flatMap(([from, to]) => {
            if (openingTo <= from || openingFrom >= to) return [[from, to]];
            const next: Array<[number, number]> = [];
            if (openingFrom > from) next.push([from, Math.min(openingFrom, to)]);
            if (openingTo < to) next.push([Math.max(openingTo, from), to]);
            return next;
          });
        }
        return intervals.filter(([from, to]) => to - from > 0.015).map(([from, to], segmentIndex) => <mesh key={`${wall}-${band.index}-${segmentIndex}`} position={[(from + to) / 2, bandBottom + (band.heightCm / 200), t + 0.004]} castShadow receiveShadow>
          <boxGeometry args={[to - from, band.heightCm / 100, 0.018]} />
          <TrashSurfaceMaterial colorId={getTrashPanelColor(config, wall, band.index)} colors={colors} />
        </mesh>);
      })}
    </group>;
  };

  // --- ELEMENTY (BRAMY, DRZWI) ---
  const renderElements = () => {
    return config.elements.map(el => {
      const elW = el.width / 100;
      const elH = el.height / 100;
      const elX = el.x / 100;
      const elY = el.y / 100;

      let pos: [number, number, number] = [0, 0, 0];
      let rot: [number, number, number] = [0, 0, 0];

      if (el.wall === 'front') { pos = [elX, elY + elH/2, l/2]; }
      if (el.wall === 'back') { pos = [-elX, elY + elH/2, -l/2]; rot = [0, Math.PI, 0]; }
      if (el.wall === 'left') { pos = [-w/2, elY + elH/2, -elX]; rot = [0, -Math.PI/2, 0]; }
      if (el.wall === 'right') { pos = [w/2, elY + elH/2, elX]; rot = [0, Math.PI/2, 0]; }

      return (
        <group key={el.id} position={pos} rotation={rot}>
           {/* Ramka */}
           <mesh position={[0, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[elW + 0.04, elH + 0.04, 0.05]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
           </mesh>
           <mesh position={[0, 0, 0.035]} castShadow receiveShadow>
              <boxGeometry args={[elW, elH, 0.035]} />
              <TrashSurfaceMaterial colorId={el.type === 'gate' ? config.gateColor : config.doorColor} colors={colors} metalTexture />
           </mesh>
           {el.type === 'gate' && el.gateType === 'swing' && <mesh position={[0, 0, 0.056]}><boxGeometry args={[0.018, elH, 0.018]} /><meshStandardMaterial color="#252525" roughness={0.75} /></mesh>}
           <mesh position={[el.hingeSide === 'right' ? -elW * 0.32 : elW * 0.32, 0, 0.06]}><sphereGeometry args={[0.025, 12, 12]} /><meshStandardMaterial color="#161616" metalness={0.6} roughness={0.35} /></mesh>
        </group>
      )
    });
  }

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
        {renderAzurowaWall('front', frontShape, [0, 0, l / 2 - t], 0, false, false, w)}
        {renderAzurowaWall('back', backShape, [0, 0, -l / 2 + t], Math.PI, false, false, w)}
        {renderAzurowaWall('left', leftSideShape, [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true, l - 2 * t)}
        {renderAzurowaWall('right', rightSideShape, [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false, l - 2 * t)}

        {renderPanelOverlay('front', [0, 0, l / 2 - t], 0, false, false, w)}
        {renderPanelOverlay('back', [0, 0, -l / 2 + t], Math.PI, false, false, w)}
        {renderPanelOverlay('left', [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true, l - 2 * t)}
        {renderPanelOverlay('right', [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false, l - 2 * t)}

        {renderElements()}
        {renderRoof()}
      </group>
    </>
  );
}
