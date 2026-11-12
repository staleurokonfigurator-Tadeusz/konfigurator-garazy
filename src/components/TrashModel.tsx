"use client";

import { useEffect, useMemo } from 'react';
import { GarageConfig, WallFace } from '@/types';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { getTrashPanelBands, getTrashPanelColor, getTrashWallPanelHeightCm } from '@/lib/trashPanels';

interface TrashModelProps {
  config: GarageConfig;
  colors?: ColorOption[];
  lowPower?: boolean;
}

interface ColorOption { id: string; label?: string; type?: string; hex?: string; texture?: string }

const GOLDEN_OAK_TEXTURE = '/textures/zloty-dab-light-v3.webp';
const DARK_WALNUT_TEXTURE = '/textures/ciemny-orzech-light-v3.webp';
const WOOD_NORMAL_TEXTURE = '/textures/drewno-normal-light-v3.webp';
const SHEET_TEXTURE = '/textures/trapez.webp';

function resolveColor(colorId: string | undefined, colors: ColorOption[] = []): { hex: string; isWood: boolean; walnut: boolean } {
  if (!colorId) return { hex: '#d4d4d4', isWood: false, walnut: false };
  if (colorId.startsWith('#')) return { hex: colorId, isWood: false, walnut: false };
  const normalizedId = String(colorId).trim().toLowerCase();
  const found = colors.find(color => String(color.id).trim().toLowerCase() === normalizedId);
  if (!found) return { hex: '#d4d4d4', isWood: false, walnut: false };
  const signature = `${normalizedId} ${found.label || ''} ${found.type || ''}`.toLowerCase();
  const isWood = Boolean(found.texture) || /drewn|wood|d[aą]b|oak|orzech|walnut/.test(signature);
  return {
    hex: found.hex || '#d4d4d4',
    isWood,
    walnut: /orzech|walnut/.test(signature),
  };
}

function ClippedPanelMesh({
  points, depth, z, material, lowPower,
}: {
  points: Array<[number, number]>;
  depth: number;
  z: number;
  material: THREE.Material;
  lowPower: boolean;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
    shape.closePath();
    const next = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    next.translate(0, 0, -depth / 2);
    next.computeVertexNormals();
    return next;
  }, [depth, points]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh position={[0, 0, z]} castShadow={!lowPower} receiveShadow>
    <primitive object={geometry} attach="geometry" />
    <primitive object={material} attach="material" />
  </mesh>;
}

export default function TrashModel({ config, colors = [], lowPower = false }: TrashModelProps) {
  const w = config.width / 100;
  const l = config.length / 100;
  const h = config.height / 100;

  const t = 0.05;
  const slopeH = 0.4;

  // Tekstury są lokalne, małe i współdzielone przez wszystkie panele. Nie pobieramy
  // już osobnej tekstury z WordPressa dla każdego elementu modelu.
  const [oakSource, walnutSource, normalSource, sheetSource] = useTexture([
    GOLDEN_OAK_TEXTURE,
    DARK_WALNUT_TEXTURE,
    WOOD_NORMAL_TEXTURE,
    SHEET_TEXTURE,
  ]);
  const textures = useMemo(() => {
    const prepare = (source: THREE.Texture, colorSpace: THREE.ColorSpace, repeatX: number, repeatY: number) => {
      const texture = source.clone();
      texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.colorSpace = colorSpace;
      texture.repeat.set(repeatX, repeatY);
      texture.anisotropy = lowPower ? 1 : 2;
      texture.needsUpdate = true;
      return texture;
    };
    return {
      oak: prepare(oakSource, THREE.SRGBColorSpace, 1.5, 0.7),
      walnut: prepare(walnutSource, THREE.SRGBColorSpace, 1.5, 0.7),
      normal: prepare(normalSource, THREE.NoColorSpace, 1.5, 0.7),
      sheet: prepare(sheetSource, THREE.SRGBColorSpace, 2, 2),
    };
  }, [lowPower, normalSource, oakSource, sheetSource, walnutSource]);

  useEffect(() => () => {
    Object.values(textures).forEach(texture => texture.dispose());
  }, [textures]);

  const materials = useMemo(() => {
    const usedColorIds = new Set<string>();
    [config.wallColor, config.roofColor, config.gateColor, config.doorColor].forEach(color => {
      if (color) usedColorIds.add(color);
    });
    Object.values(config.trashPanelColors || {}).forEach(wallColors => {
      (wallColors || []).forEach(color => { if (color) usedColorIds.add(color); });
    });

    const surface = new Map<string, THREE.MeshStandardMaterial>();
    const roof = new Map<string, THREE.MeshStandardMaterial>();
    const create = (colorId: string, useSheetTexture: boolean) => {
      const resolved = resolveColor(colorId, colors);
      const woodTexture = resolved.walnut ? textures.walnut : textures.oak;
      return new THREE.MeshStandardMaterial({
        color: resolved.isWood ? '#ffffff' : resolved.hex,
        map: resolved.isWood ? woodTexture : useSheetTexture ? textures.sheet : null,
        normalMap: resolved.isWood ? textures.normal : null,
        normalScale: resolved.isWood ? new THREE.Vector2(0.14, 0.14) : undefined,
        roughness: resolved.isWood ? 0.58 : 0.54,
        metalness: resolved.isWood ? 0.03 : 0.12,
        envMapIntensity: 1.05,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide,
      });
    };
    usedColorIds.forEach(colorId => {
      surface.set(colorId, create(colorId, false));
      roof.set(colorId, create(colorId, true));
    });
    const fallback = create('#d4d4d4', false);
    const fallbackRoof = create('#d4d4d4', true);
    return { surface, roof, fallback, fallbackRoof };
  }, [colors, config.doorColor, config.gateColor, config.roofColor, config.trashPanelColors, config.wallColor, textures]);

  useEffect(() => () => {
    const unique = new Set<THREE.Material>([
      ...materials.surface.values(), ...materials.roof.values(), materials.fallback, materials.fallbackRoof,
    ]);
    unique.forEach(material => material.dispose());
  }, [materials]);

  const surfaceMaterial = (colorId?: string) => colorId ? materials.surface.get(colorId) || materials.fallback : materials.fallback;
  const roofMaterial = (colorId?: string) => colorId ? materials.roof.get(colorId) || materials.fallbackRoof : materials.fallbackRoof;
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const frameMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#25282b', roughness: 0.62, metalness: 0.28 }), []);
  useEffect(() => () => {
    unitBox.dispose();
    frameMaterial.dispose();
  }, [frameMaterial, unitBox]);

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

      const renderMainMat = (attachName: string) => <primitive object={roofMaterial(config.roofColor)} attach={attachName} />;

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
          <primitive object={roofMaterial(config.roofColor)} attach="material-2" />
          <meshStandardMaterial attach="material-3" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-4" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-5" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          {showGutters && gutterMesh}
        </mesh>
      </group>
    );
  };

  // Wysokości narożników sterują przycinaniem paneli do połaci dachu.
  let hFL = h, hFR = h, hBL = h, hBR = h;
  if (isDual) { hFL = h; hFR = h; hBL = h; hBR = h; }
  else if (isFront) { hBL = h + slopeH; hBR = h + slopeH; }
  else if (isBack) { hFL = h + slopeH; hFR = h + slopeH; }
  else if (isLeft) { hFR = h + slopeH; hBR = h + slopeH; }
  else if (isRight) { hFL = h + slopeH; hBL = h + slopeH; }

  // Panele są jedyną geometrią ścian. Zastępuje to kosztowne operacje CSG,
  // zachowując prawdziwe prześwity oraz otwory na bramy i drzwi.
  const renderPanelOverlay = (
    wall: WallFace,
    pos: [number, number, number],
    rotY: number,
    isSide: boolean,
    isLeftWall: boolean,
    wallWidth: number,
  ) => {
    const bands = getTrashPanelBands(getTrashWallPanelHeightCm(config, wall), 'wide');
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
    const roofHeightAt = (x: number) => {
      if (gable) {
        return h + slopeH * Math.max(0, 1 - Math.abs(x) / Math.max(wallWidth / 2, 0.001));
      }
      const progress = (x - minX) / Math.max(wallWidth, 0.001);
      return startHeight + (endHeight - startHeight) * progress;
    };
    const visibleInterval = (bandBottom: number): [number, number] | null => {
      if (gable) {
        if (bandBottom <= h) return [minX, maxX];
        if (bandBottom >= h + slopeH) return null;
        const halfWidth = wallWidth / 2 * (1 - (bandBottom - h) / slopeH);
        return [-halfWidth, halfWidth];
      }
      const low = Math.min(startHeight, endHeight);
      const high = Math.max(startHeight, endHeight);
      if (bandBottom <= low) return [minX, maxX];
      if (bandBottom >= high || Math.abs(endHeight - startHeight) < 0.001) return null;
      const threshold = minX + ((bandBottom - startHeight) / (endHeight - startHeight)) * wallWidth;
      return endHeight > startHeight ? [Math.max(minX, threshold), maxX] : [minX, Math.min(maxX, threshold)];
    };
    return <group position={pos} rotation={[0, rotY, 0]}>
      {bands.flatMap(band => {
        const bandBottom = band.bottomCm / 100;
        const bandTop = (band.bottomCm + band.heightCm) / 100;
        const wallInterval = visibleInterval(bandBottom);
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
        const panelMaterial = surfaceMaterial(getTrashPanelColor(config, wall, band.index));
        return intervals.filter(([from, to]) => to - from > 0.015).map(([from, to], segmentIndex) => {
          const topAtFrom = Math.min(bandTop, roofHeightAt(from));
          const topAtTo = Math.min(bandTop, roofHeightAt(to));
          const fullRectangle = topAtFrom >= bandTop - 0.0001 && topAtTo >= bandTop - 0.0001;
          if (fullRectangle) return <mesh key={`${wall}-${band.index}-${segmentIndex}`} position={[(from + to) / 2, bandBottom + (band.heightCm / 200), t + 0.004]} scale={[to - from, band.heightCm / 100, 0.018]} castShadow={!lowPower} receiveShadow>
            <primitive object={unitBox} attach="geometry" />
            <primitive object={panelMaterial} attach="material" />
          </mesh>;

          const points: Array<[number, number]> = [[from, bandBottom], [to, bandBottom], [to, topAtTo]];
          if (gable && from < 0 && to > 0) points.push([0, Math.min(bandTop, roofHeightAt(0))]);
          points.push([from, topAtFrom]);
          return <ClippedPanelMesh key={`${wall}-${band.index}-${segmentIndex}`} points={points} depth={0.018} z={t + 0.004} material={panelMaterial} lowPower={lowPower} />;
        });
      })}
    </group>;
  };

  const renderFrame = () => {
    const posts: Array<[number, number, number]> = [
      [-w / 2, l / 2, hFL], [w / 2, l / 2, hFR],
      [-w / 2, -l / 2, hBL], [w / 2, -l / 2, hBR],
    ];
    return <group>
      {posts.map(([x, z, height], index) => <mesh key={`post-${index}`} position={[x, height / 2, z]} scale={[0.085, height, 0.085]} castShadow={!lowPower} receiveShadow>
        <primitive object={unitBox} attach="geometry" />
        <primitive object={frameMaterial} attach="material" />
      </mesh>)}
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
              <primitive object={surfaceMaterial(el.type === 'gate' ? config.gateColor : config.doorColor)} attach="material" />
           </mesh>
           {el.type === 'gate' && el.gateType === 'swing' && <mesh position={[0, 0, 0.056]}><boxGeometry args={[0.018, elH, 0.018]} /><meshStandardMaterial color="#252525" roughness={0.75} /></mesh>}
           <mesh position={[el.hingeSide === 'right' ? -elW * 0.32 : elW * 0.32, 0, 0.06]}><sphereGeometry args={[0.025, 12, 12]} /><meshStandardMaterial color="#161616" metalness={0.6} roughness={0.35} /></mesh>
        </group>
      )
    });
  }

  return (
    <group name="trashModelGroup">
      {renderPanelOverlay('front', [0, 0, l / 2 - t], 0, false, false, w)}
      {renderPanelOverlay('back', [0, 0, -l / 2 + t], Math.PI, false, false, w)}
      {renderPanelOverlay('left', [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true, l - 2 * t)}
      {renderPanelOverlay('right', [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false, l - 2 * t)}

      {renderFrame()}
      {renderElements()}
      {renderRoof()}
    </group>
  );
}
