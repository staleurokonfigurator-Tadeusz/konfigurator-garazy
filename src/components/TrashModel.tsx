"use client";

import { useMemo, useState, useEffect } from 'react';
import { GarageConfig, GarageElement, WallFace } from '@/types';
import * as THREE from 'three';
import { Environment, ContactShadows, useTexture } from '@react-three/drei';
import { Geometry, Base, Subtraction } from '@react-three/csg';

interface TrashModelProps {
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

export default function TrashModel({ config, colors = [] }: TrashModelProps) {
  const w = config.width / 100;
  const l = config.length / 100;
  const h = config.height / 100;

  const t = 0.05; 
  const slopeH = 0.4; 

  const [trapezTex] = useTexture(['/textures/trapez.webp']);
  const [woodNormal] = useTexture(['/textures/drewno-normal.webp']);

  const [dynamicWoodColor, setDynamicWoodColor] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const wallColorData = colors.find((c: any) => c.id === config.wallColor);
    if (wallColorData && wallColorData.type === 'drewno' && wallColorData.texture) {
      const loader = new THREE.TextureLoader();
      loader.load(wallColorData.texture, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(2, 2);
        setDynamicWoodColor(tex);
      });
    } else {
      setDynamicWoodColor(null);
    }
  }, [colors, config.wallColor]);

  const showGutters = config.extraOptions?.includes('gutters') ?? config.gutters;
  const showRoofFlashings = config.extraOptions?.includes('roofFlashings');

  const woodColor = dynamicWoodColor || trapezTex;

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

    const { hex: roofHex, isWood: isRoofWood } = resolveColor(config.roofColor, colors);
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

      const renderMainMat = (attachName: string) => (
        <meshStandardMaterial 
          attach={attachName}
          map={isRoofWood ? woodColor : trapezTex}
          normalMap={isRoofWood ? woodNormal : undefined}
          normalScale={isRoofWood ? new THREE.Vector2(1.5, 1.5) : undefined}
          color={isRoofWood ? '#ffffff' : roofFasciaColor}
          roughness={isRoofWood ? 0.7 : 0.4}
          metalness={isRoofWood ? 0.0 : 0.6}
          envMapIntensity={1.5}
          side={THREE.DoubleSide}
          shadowSide={THREE.DoubleSide}
        />
      );

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
          <meshStandardMaterial attach="material-2" 
            map={isRoofWood ? woodColor : trapezTex}
            normalMap={isRoofWood ? woodNormal : undefined}
            normalScale={isRoofWood ? new THREE.Vector2(1.5, 1.5) : undefined}
            color={isRoofWood ? '#ffffff' : roofFasciaColor}
            roughness={isRoofWood ? 0.7 : 0.4}
            metalness={isRoofWood ? 0.0 : 0.6}
            envMapIntensity={1.5}
            side={THREE.DoubleSide}
            shadowSide={THREE.DoubleSide}
          />
          <meshStandardMaterial attach="material-3" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-4" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          <meshStandardMaterial attach="material-5" color={roofFasciaColor} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide} />
          {showGutters && gutterMesh}
        </mesh>
      </group>
    );
  };

  // --- LOGIKA ŚCIAN Z CSG (LAMELKI) ---
  const { hex: wallHex, isWood: isWallWood } = resolveColor(config.wallColor, colors);
  const wallMat = <meshStandardMaterial 
    color={isWallWood ? '#ffffff' : wallHex} 
    map={isWallWood ? woodColor : undefined}
    roughness={0.8} 
    metalness={isWallWood ? 0.0 : 0.2} 
    side={THREE.DoubleSide}
    shadowSide={THREE.DoubleSide}
  />;

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
    const subs = [];
    const lamellaH = 0.10;
    const gapH = 0.03;
    const step = lamellaH + gapH;
    let i = 0;
    const posX = isSide ? wallW / 2 : 0;
    // Wycinamy szpary co `step` poczynając od wysokości 10cm.
    for (let y = lamellaH; y < wallMaxH; y += step) {
      subs.push(
        <Subtraction key={`gap-${i++}`} position={[posX, y + gapH / 2, t / 2]}>
          <boxGeometry args={[20, gapH, t * 4]} />
        </Subtraction>
      );
    }
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
        {wallMat}
      </mesh>
    );
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

      const { hex: gateHex, isWood: isGateWood } = resolveColor(el.type === 'gate' ? config.gateColor : config.doorColor, colors);
      const elMat = <meshStandardMaterial 
        color={isGateWood ? '#ffffff' : gateHex} 
        map={isGateWood ? woodColor : undefined}
        roughness={0.7} 
      />;

      return (
        <group key={el.id} position={pos} rotation={rot}>
           <mesh castShadow receiveShadow>
              <boxGeometry args={[elW, elH, 0.04]} />
              {elMat}
           </mesh>
           {/* Ramka */}
           <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[elW + 0.04, elH + 0.04, 0.05]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
           </mesh>
        </group>
      )
    });
  }

  return (
    <>
      <Environment preset="city" />
      <mesh scale={100}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#d1d5db" side={THREE.BackSide} />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} metalness={0.1} />
      </mesh>
      <gridHelper args={[150, 150, '#3a3a3a', '#555555']} position={[0, -0.02, 0]} />

      <ContactShadows resolution={1024} scale={25} blur={2.5} opacity={0.7} far={10} color="#000000" position={[0, 0, 0]} />
      
      <group>
        {renderAzurowaWall('front', frontShape, [0, 0, l / 2 - t], 0, false, false, w)}
        {renderAzurowaWall('back', backShape, [0, 0, -l / 2 + t], Math.PI, false, false, w)}
        {renderAzurowaWall('left', leftSideShape, [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true, l - 2 * t)}
        {renderAzurowaWall('right', rightSideShape, [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false, l - 2 * t)}
        
        {renderElements()}
        {renderRoof()}
      </group>
    </>
  );
}
