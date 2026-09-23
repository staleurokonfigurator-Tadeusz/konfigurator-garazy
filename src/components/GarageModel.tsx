"use client";

import { useMemo, useRef, useState, useEffect } from 'react';
import { GarageConfig, WallFace, GarageElement } from '@/types';
import * as THREE from 'three';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, useTexture } from '@react-three/drei';

interface GarageModelProps {
  config: GarageConfig;
  colors?: any[];
}

function resolveColor(colorId: string | undefined, colors: any[] = []): { hex: string; isWood: boolean; textureUrl: string } {
  if (!colorId) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };
  if (colorId.startsWith('#')) return { hex: colorId, isWood: false, textureUrl: '' };
  const found = (colors || []).find((c: any) => c.id === colorId);
  if (!found) return { hex: '#d4d4d4', isWood: false, textureUrl: '' };

  const hasTexture = Boolean(found.texture && found.texture.trim() !== '');
  const isWoodType = found.type ? found.type.toLowerCase().includes('drewn') : false;

  return { hex: found.hex || '#d4d4d4', isWood: hasTexture || isWoodType, textureUrl: found.texture || '' };
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

function SectionalGate({ el, woodColor, woodNormal, trapezTex, trapezTexHoriz, woodColorHoriz, woodNormalHoriz, config, colors, loadedTextures }: any) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(el.isOpen ? 1 : 0);
  const elW = (el.width || 0) * 0.01; const elH = (el.height || 0) * 0.01; const thick = 0.05; const panelH = elH / PANEL_COUNT;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = el.isOpen ? 1 : 0;
    progress.current += (target - progress.current) * Math.min(1, delta * 3.0);
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
  const isHorizontal = config?.gateProfile?.startsWith('poziome') || el.gateType === 'sectional';
  const baseWoodColor = textureUrl && loadedTextures[textureUrl] ? loadedTextures[textureUrl] : woodColor;
  const baseWoodColorHoriz = textureUrl && loadedTextures[`${textureUrl}_horiz`] ? loadedTextures[`${textureUrl}_horiz`] : woodColorHoriz;
  const activeColorMap = isWood ? (isHorizontal ? baseWoodColorHoriz : baseWoodColor) : (isHorizontal ? trapezTexHoriz : trapezTex);
  const activeNormalMap = isWood ? (isHorizontal ? woodNormalHoriz : woodNormal) : undefined;

  return (
    <group ref={groupRef} position={[(el.x || 0) * 0.01, (el.y || 0) * 0.01, 0]}>
      {Array.from({ length: PANEL_COUNT }, (_, i) => (
        <group key={i} position={[0, i * panelH + panelH / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[elW - 0.02, panelH - 0.005, thick]} />
            <meshStandardMaterial map={activeColorMap} normalMap={activeNormalMap} normalScale={isWood ? new THREE.Vector2(1.5, 1.5) : undefined} color={isWood ? '#ffffff' : gateHex} roughness={isWood ? 0.7 : 0.4} metalness={isWood ? 0.0 : 0.6} envMapIntensity={1.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function AnimatedGate({ el, woodColor, woodNormal, trapezTex, trapezTexHoriz, woodColorHoriz, woodNormalHoriz, config, colors, loadedTextures }: any) {
  const ref = useRef<THREE.Group>(null);
  const elW = (el.width || 0) * 0.01; const elH = (el.height || 0) * 0.01; const thick = 0.05;
  const animState = useRef({ progress: el.isOpen ? 1 : 0 });

  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = el.isOpen ? 1 : 0;
    animState.current.progress += (target - animState.current.progress) * Math.min(1, delta * 2.5);
    const phase = animState.current.progress;
    if (el.gateType === 'up-and-over') { const pivot = ref.current.children[0]; if (pivot) pivot.rotation.x = -phase * (Math.PI / 2); } 
    else if (el.gateType === 'swing') { const leftDoor  = ref.current.children[0]; const rightDoor = ref.current.children[1]; if (leftDoor) leftDoor.rotation.y = -phase * (Math.PI / 2); if (rightDoor) rightDoor.rotation.y = phase * (Math.PI / 2); }
  });

  if (el.gateType === 'sectional') return <SectionalGate el={el} woodColor={woodColor} woodNormal={woodNormal} trapezTex={trapezTex} trapezTexHoriz={trapezTexHoriz} woodColorHoriz={woodColorHoriz} woodNormalHoriz={woodNormalHoriz} config={config} colors={colors} loadedTextures={loadedTextures} />;

  const { hex: gateHex, isWood, textureUrl } = resolveColor(config?.gateColor, colors);
  const isHorizontal = config?.gateProfile?.startsWith('poziome');
  const baseWoodColor = textureUrl && loadedTextures[textureUrl] ? loadedTextures[textureUrl] : woodColor;
  const baseWoodColorHoriz = textureUrl && loadedTextures[`${textureUrl}_horiz`] ? loadedTextures[`${textureUrl}_horiz`] : woodColorHoriz;
  const activeColorMap = isWood ? (isHorizontal ? baseWoodColorHoriz : baseWoodColor) : (isHorizontal ? trapezTexHoriz : trapezTex);
  const activeNormalMap = isWood ? (isHorizontal ? woodNormalHoriz : woodNormal) : undefined;

  const gateMatComponent = <meshStandardMaterial map={activeColorMap} normalMap={activeNormalMap} normalScale={isWood ? new THREE.Vector2(1.5, 1.5) : undefined} color={isWood ? '#ffffff' : gateHex} roughness={isWood ? 0.7 : 0.4} metalness={isWood ? 0.0 : 0.6} envMapIntensity={1.5} />;
  const isLeftHinged = el.hingeSide === 'left';
  const handleXOffset = isLeftHinged ? (elW / 2 - 0.1) : -(elW / 2 - 0.1);

  if (el.gateType === 'swing') {
    return (
      <group ref={ref} position={[(el.x || 0) * 0.01, (el.y || 0) * 0.01, 0]}>
        <group position={[-elW / 2, 0, 0]}>
          <mesh position={[elW / 4, elH / 2, 0]} castShadow receiveShadow><boxGeometry args={[elW / 2 - 0.01, elH - 0.02, thick]} />{gateMatComponent}</mesh>
          <group position={[elW / 2 - 0.1, elH / 2, thick / 2 + 0.025]}><mesh><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh></group>
        </group>
        <group position={[elW / 2, 0, 0]}>
          <mesh position={[-elW / 4, elH / 2, 0]} castShadow receiveShadow><boxGeometry args={[elW / 2 - 0.01, elH - 0.02, thick]} />{gateMatComponent}</mesh>
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
        <group position={[handleXOffset, -elH + 0.25, thick / 2 + 0.025]}><mesh><sphereGeometry args={[0.028, 16, 16]} /><meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial color="#333" roughness={0.5} /></mesh></group>
        {el.hasDoor && <DoorInGate xOffset={elW / 4} yOffset={-elH + 0.95} thick={thick} gateMatComponent={gateMatComponent} />}
      </group>
    </group>
  );
}

export default function GarageModel({ config, colors = [] }: GarageModelProps) {
  if (!config) return null;

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

  const [trapezTex] = useTexture(['/textures/trapez.jpg']);
  const [woodNormal] = useTexture(['/textures/drewno-normal.jpg']);
  const [loadedTextures, setLoadedTextures] = useState<Record<string, THREE.Texture>>({});
  const [roofTileTex, setRoofTileTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/blachodachowka.jpg', 
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4); 
        tex.colorSpace = THREE.SRGBColorSpace;
        setRoofTileTex(tex);
      },
      undefined,
      () => {
        const rTex = trapezTex.clone();
        rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping;
        rTex.repeat.set(15, 3); 
        rTex.needsUpdate = true;
        setRoofTileTex(rTex);
      }
    );
  }, [trapezTex]);

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
    ].filter(url => url !== '')));

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

  const { trapezTexHoriz, woodNormalHoriz } = useMemo(() => {
    trapezTex.wrapS = trapezTex.wrapT = THREE.RepeatWrapping;
    const profileRepeat = config.wallProfile?.includes('t7') ? 6 : config.wallProfile?.includes('t17') ? 2 : 4; 
    trapezTex.repeat.set(profileRepeat, profileRepeat);
    woodNormal.wrapS = woodNormal.wrapT = THREE.RepeatWrapping;
    woodNormal.repeat.set(1, 1);
    const rotateTexture = (tex: THREE.Texture) => { const clone = tex.clone(); clone.rotation = Math.PI / 2; clone.center.set(0.5, 0.5); clone.needsUpdate = true; return clone; };
    return { trapezTexHoriz: rotateTexture(trapezTex), woodNormalHoriz: rotateTexture(woodNormal) };
  }, [trapezTex, woodNormal, config.wallProfile]);

  const rt = String(config.roofType || '').toLowerCase();
  const isDual = rt.includes('dual') || rt.includes('dwuspad');
  const isFront = rt.includes('front') || rt.includes('przód');
  const isBack = rt.includes('back') || rt.includes('tył');
  const isLeft = rt.includes('left') || rt.includes('lewo');
  const isRight = rt.includes('right') || rt.includes('prawo');

  const getH = (x: number, z: number) => {
    if (isDual) return h + slopeH * (1 - Math.abs(x - centerX) / (totalW / 2));
    if (isFront) return h + slopeH * (0.5 - z/l);
    if (isBack) return h + slopeH * (0.5 + z/l);
    if (isLeft) return h + slopeH * ((x - minX) / totalW); 
    if (isRight) return h + slopeH * (1 - (x - minX) / totalW);
    return h;
  };

  const createGarageFrontShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(w/2, getH(w/2, l/2));
    if (isDual && centerX > -w/2 && centerX < w/2) s.lineTo(centerX, getH(centerX, l/2));
    s.lineTo(-w/2, getH(-w/2, l/2));
    s.closePath(); return s;
  };

  const createGarageBackShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(w/2, getH(-w/2, -l/2)); 
    if (isDual && centerX > -w/2 && centerX < w/2) s.lineTo(-centerX, getH(centerX, -l/2));
    s.lineTo(-w/2, getH(w/2, -l/2)); 
    s.closePath(); return s;
  };

  const createGarageSideShape = (isRightSide: boolean) => {
    const s = new THREE.Shape();
    const wallX = isRightSide ? w/2 : -w/2;
    s.moveTo(0, 0); s.lineTo(l, 0);
    s.lineTo(l, getH(wallX, -l/2));
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

  const renderElements = (wall: WallFace, pos: [number, number, number], rotY: number, isSide = false, isLeftWall = false) => {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        {(config.elements || []).filter(e => e.wall === wall).map((el) => {
          const elW = (el.width || 0) * 0.01; const elH = (el.height || 0) * 0.01; const elY = (el.y || 0) * 0.01;
          let xPos = (el.x || 0) * 0.01;
          if (isSide) xPos = isLeftWall ? ((l - 2*t) / 2 - (el.x || 0) * 0.01) : ((l - 2*t) / 2 + (el.x || 0) * 0.01);

          if (el.type === 'window' || el.type === 'pvc-window') {
            const { hex: windowHex, isWood: isWinWood, textureUrl: winTexUrl } = resolveColor(config.windowColor, colors);
            const winTex = isWinWood && winTexUrl && loadedTextures[winTexUrl] ? loadedTextures[winTexUrl] : undefined;
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
            return <AnimatedGate key={el.id} el={{ ...el, x: xPos * 100 }} woodColor={trapezTex} woodNormal={woodNormal} trapezTex={trapezTex} trapezTexHoriz={trapezTexHoriz} woodColorHoriz={trapezTexHoriz} woodNormalHoriz={woodNormalHoriz} config={config} colors={colors} loadedTextures={loadedTextures} />;
          } else {
            const { hex: doorHex, isWood: isDoorWood, textureUrl: doorTexUrl } = resolveColor(config.doorColor, colors);
            const isHorizontal = config.doorProfile?.startsWith('poziome');
            const baseDoorWood = doorTexUrl && loadedTextures[doorTexUrl] ? loadedTextures[doorTexUrl] : trapezTex;
            const baseDoorWoodHoriz = doorTexUrl && loadedTextures[`${doorTexUrl}_horiz`] ? loadedTextures[`${doorTexUrl}_horiz`] : trapezTexHoriz;
            const activeColorMap = isDoorWood ? (isHorizontal ? baseDoorWoodHoriz : baseDoorWood) : (isHorizontal ? trapezTexHoriz : trapezTex);
            const activeNormalMap = isDoorWood ? (isHorizontal ? woodNormalHoriz : woodNormal) : undefined;
            const isLeftHinged = el.hingeSide === 'left';
            const handleXOffset = isLeftHinged ? (elW / 2 - 0.1) : -(elW / 2 - 0.1);
            const hingeXOffset = isLeftHinged ? -(elW / 2 - 0.02) : (elW / 2 - 0.02);

            return (
              <group key={el.id} position={[xPos, elY + elH / 2, t / 2]}>
                <mesh castShadow receiveShadow><boxGeometry args={[elW - 0.02, elH - 0.02, t + 0.01]} /><meshStandardMaterial map={activeColorMap} normalMap={activeNormalMap} normalScale={isDoorWood ? new THREE.Vector2(1.5, 1.5) : undefined} color={isDoorWood ? '#ffffff' : doorHex} roughness={isDoorWood ? 0.7 : 0.4} metalness={isDoorWood ? 0.0 : 0.6} envMapIntensity={1.5} /></mesh>
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
    const gutterMatProps = { color: isGutterWood ? '#ffffff' : gutterHex, map: isGutterWood && gutterTexUrl && loadedTextures[gutterTexUrl] ? loadedTextures[gutterTexUrl] : undefined, roughness: 0.6, metalness: 0.5 };
    
    const oX = 0.15; const oZ = 0.15; 
    const rL = l + (oZ * 2); const rW = totalW + (oX * 2); 

    const { hex: roofHex, isWood: isRoofWood, textureUrl: roofTexUrl } = resolveColor(config.roofColor, colors);
    const { hex: fasciaHex, isWood: isFasciaWood, textureUrl: fasciaTexUrl } = resolveColor(config.roofFlashingColor, colors);
    
    const baseRoofWood = roofTexUrl && loadedTextures[roofTexUrl] ? loadedTextures[roofTexUrl] : trapezTex;
    const baseFasciaWood = fasciaTexUrl && loadedTextures[fasciaTexUrl] ? loadedTextures[fasciaTexUrl] : undefined;

    const roofTexToUse = isRoofTile ? (roofTileTex || trapezTex) : (isRoofWood ? baseRoofWood : trapezTex);

    const renderFasciaMat = (attachName: string) => <meshStandardMaterial attach={attachName} color={isFasciaWood ? '#ffffff' : fasciaHex} map={isFasciaWood && baseFasciaWood ? baseFasciaWood : undefined} roughness={0.8} metalness={0.2} visible={!!showRoofFlashings} side={THREE.DoubleSide} />;
    const renderMainRoofMat = (attachName: string) => <meshStandardMaterial attach={attachName} color={isRoofWood ? '#ffffff' : roofHex} map={roofTexToUse} normalMap={isRoofWood ? woodNormal : undefined} normalScale={isRoofWood ? new THREE.Vector2(1.5, 1.5) : undefined} roughness={isRoofWood ? 0.7 : 0.4} metalness={isRoofWood ? 0.0 : 0.6} envMapIntensity={1.5} side={THREE.DoubleSide} />;

    const gutterR = 0.035; const pipeR = 0.025;
    
    const renderGutterPipe = (length: number, rot: [number, number, number], posGutter: [number, number, number], posPipe: [number, number, number], pipeHeight: number) => (
      <group>
        <mesh position={posGutter} rotation={rot} castShadow><cylinderGeometry args={[gutterR, gutterR, length, 16]} /><meshStandardMaterial {...gutterMatProps} /></mesh>
        <mesh position={[posPipe[0], posPipe[1] + pipeHeight/2, posPipe[2]]} castShadow><cylinderGeometry args={[pipeR, pipeR, pipeHeight, 16]} /><meshStandardMaterial {...gutterMatProps} /></mesh>
      </group>
    );

    if (isDual) {
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
          </group>
          <group rotation={[0, 0, -roofTheta]}>
            <mesh position={[(paneLen/2 - overlap/2), 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[paneLen, t, rL]} />
              {renderFasciaMat("material-0")}{renderFasciaMat("material-1")}{renderMainRoofMat("material-2")}{renderFasciaMat("material-3")}{renderFasciaMat("material-4")}{renderFasciaMat("material-5")}
            </mesh>
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
        </group>
        {showGutters && <group position={[centerX, 0, 0]}>{gutterSystem}</group>}
      </group>
    );
  };

  const { hex: wallHex, isWood: isWallWood, textureUrl: wallTexUrl } = resolveColor(config?.wallColor, colors);
  const isWallHorizontal = config?.wallProfile?.startsWith('poziome');
  const baseWallWood = wallTexUrl && loadedTextures[wallTexUrl] ? loadedTextures[wallTexUrl] : trapezTex;
  const baseWallWoodHoriz = wallTexUrl && loadedTextures[`${wallTexUrl}_horiz`] ? loadedTextures[`${wallTexUrl}_horiz`] : trapezTexHoriz;
  const activeWallColorMap = isWallWood ? (isWallHorizontal ? baseWallWoodHoriz : baseWallWood) : (isWallHorizontal ? trapezTexHoriz : trapezTex);
  const activeWallNormalMap = isWallWood ? (isWallHorizontal ? woodNormalHoriz : woodNormal) : undefined;
  
  const wallMaterialComponent = <meshStandardMaterial map={activeWallColorMap} normalMap={activeWallNormalMap} normalScale={isWallWood ? new THREE.Vector2(1.5, 1.5) : undefined} color={isWallWood ? '#ffffff' : wallHex} roughness={isWallWood ? 0.7 : 0.4} metalness={isWallWood ? 0.0 : 0.6} envMapIntensity={1.5} side={THREE.DoubleSide} />;

  const renderCarport = () => {
    if (!hasCarport || cw === 0) return null;

    const baseRes = resolveColor(config.carportBaseColor || '#333333', colors);
    const insertRes = resolveColor(config.carportInsertColor || config.gateColor, colors);

    const baseMat = new THREE.MeshStandardMaterial({ color: baseRes.isWood ? '#ffffff' : baseRes.hex, map: baseRes.isWood && loadedTextures[baseRes.textureUrl] ? loadedTextures[baseRes.textureUrl] : undefined, roughness: 0.8, metalness: 0.2 });
    const insertTex = insertRes.textureUrl && loadedTextures[`${insertRes.textureUrl}_horiz`] ? loadedTextures[`${insertRes.textureUrl}_horiz`] : undefined;
    const insertMat = new THREE.MeshStandardMaterial({ color: insertRes.isWood ? '#ffffff' : insertRes.hex, map: insertRes.isWood ? insertTex : undefined, normalMap: insertRes.isWood ? woodNormalHoriz : undefined, roughness: insertRes.isWood ? 0.7 : 0.4, metalness: insertRes.isWood ? 0.0 : 0.6 });

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
            {isInsert ? <primitive object={insertMat} attach="material" /> : wallMaterialComponent}
          </mesh>
        );
      }
      if (config.carportWalls?.front) {
        const x = cSide === 'right' ? w/2 + cw/2 : -w/2 - cw/2;
        slats.push(
          <mesh key={`front-${i}`} position={[x, y, l/2 - pSize/2]} castShadow>
            <boxGeometry args={[cw - pSize*2, slatH, 0.02]} />
            {isInsert ? <primitive object={insertMat} attach="material" /> : wallMaterialComponent}
          </mesh>
        );
      }
      if (config.carportWalls?.back) {
        const x = cSide === 'right' ? w/2 + cw/2 : -w/2 - cw/2;
        slats.push(
          <mesh key={`back-${i}`} position={[x, y, -l/2 + pSize/2]} castShadow>
            <boxGeometry args={[cw - pSize*2, slatH, 0.02]} />
            {isInsert ? <primitive object={insertMat} attach="material" /> : wallMaterialComponent}
          </mesh>
        );
      }
    }

    const sF = new THREE.Shape();
    if (cSide === 'right') { sF.moveTo(w/2, h); sF.lineTo(maxX, h); sF.lineTo(maxX, getH(maxX, l/2)); if (isDual && centerX > w/2 && centerX < maxX) sF.lineTo(centerX, getH(centerX, l/2)); sF.lineTo(w/2, getH(w/2, l/2)); } 
    else { sF.moveTo(minX, h); sF.lineTo(-w/2, h); sF.lineTo(-w/2, getH(-w/2, l/2)); if (isDual && centerX > minX && centerX < -w/2) sF.lineTo(centerX, getH(centerX, l/2)); sF.lineTo(minX, getH(minX, l/2)); }
    sF.closePath();

    const sB = new THREE.Shape();
    if (cSide === 'right') { sB.moveTo(w/2, h); sB.lineTo(maxX, h); sB.lineTo(maxX, getH(maxX, -l/2)); if (isDual && centerX > w/2 && centerX < maxX) sB.lineTo(centerX, getH(centerX, -l/2)); sB.lineTo(w/2, getH(w/2, -l/2)); } 
    else { sB.moveTo(minX, h); sB.lineTo(-w/2, h); sB.lineTo(-w/2, getH(-w/2, -l/2)); if (isDual && centerX > minX && centerX < -w/2) sB.lineTo(centerX, getH(centerX, -l/2)); sB.lineTo(minX, getH(minX, -l/2)); }
    sB.closePath();

    const sS = new THREE.Shape();
    sS.moveTo(0, h); sS.lineTo(l, h);
    if (cSide === 'right') { sS.lineTo(l, getH(maxX, -l/2)); sS.lineTo(0, getH(maxX, l/2)); } 
    else { sS.lineTo(l, getH(minX, -l/2)); sS.lineTo(0, getH(minX, l/2)); }
    sS.closePath();

    return (
      <group>
        {pillars.map((pos, idx) => <mesh key={`p-${idx}`} position={pos as [number,number,number]} material={baseMat} castShadow><boxGeometry args={[pSize, h, pSize]} /></mesh>)}
        {slats}
        <mesh position={[0, 0, l/2 - t]} castShadow><extrudeGeometry args={[sF, wallExtrude]} />{wallMaterialComponent}</mesh>
        <mesh position={[0, 0, -l/2]} castShadow><extrudeGeometry args={[sB, wallExtrude]} />{wallMaterialComponent}</mesh>
        <mesh position={[cSide === 'right' ? maxX - t : minX, 0, l/2 - t]} rotation={[0, Math.PI/2, 0]} castShadow><extrudeGeometry args={[sS, wallExtrude]} />{wallMaterialComponent}</mesh>
      </group>
    );
  };

  const renderCornerTrim = (xPos: number, zPos: number, hTrim: number) => {
    const { hex, isWood, textureUrl } = resolveColor(config?.cornerFlashingColor, colors);
    return <mesh position={[xPos, hTrim / 2, zPos]} castShadow><boxGeometry args={[t + 0.01, hTrim + 0.01, t + 0.01]} /><meshStandardMaterial color={isWood ? '#ffffff' : hex} map={isWood && textureUrl && loadedTextures[textureUrl] ? loadedTextures[textureUrl] : undefined} roughness={0.6} metalness={0.4} /></mesh>;
  };

  return (
    <>
      <Environment preset="city" />
      <mesh scale={100}><sphereGeometry args={[1, 32, 32]} /><meshBasicMaterial color="#d1d5db" side={THREE.BackSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[150, 150]} /><meshStandardMaterial color="#4a4a4a" roughness={0.9} metalness={0.1} /></mesh>
      <gridHelper args={[150, 150, '#3a3a3a', '#555555']} position={[0, -0.02, 0]} />
      <ContactShadows resolution={1024} scale={25} blur={2.5} opacity={0.7} far={10} color="#000000" position={[0, 0, 0]} />
      
      <group name="garageModelGroup" position={[-centerX, 0, 0]}>
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
          {renderElements('front', [0, 0, l / 2 - t], 0)}

          <mesh position={[0, 0, -l / 2 + t]} rotation={[0, Math.PI, 0]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageBackShape(), wallExtrude]} /></Base>{getSubtractions('back')}</Geometry>{wallMaterialComponent}</mesh>
          {renderElements('back', [0, 0, -l / 2 + t], Math.PI)}

          <mesh position={[-w / 2, 0, l / 2 - t]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageSideShape(false), wallExtrude]} /></Base>{getSubtractions('left', true, true)}</Geometry>{wallMaterialComponent}</mesh>
          {renderElements('left', [-w / 2, 0, l / 2 - t], Math.PI / 2, true, true)}

          <mesh position={[w / 2 - t, 0, l / 2 - t]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><Geometry><Base><extrudeGeometry args={[createGarageSideShape(true), wallExtrude]} /></Base>{getSubtractions('right', true, false)}</Geometry>{wallMaterialComponent}</mesh>
          {renderElements('right', [w / 2 - t, 0, l / 2 - t], Math.PI / 2, true, false)}

          {renderRoof()}
        </group>

        {renderCarport()}
      </group>
    </>
  );
}