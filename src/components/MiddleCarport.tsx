"use client";

import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { GarageConfig } from '@/types';
import { getAssemblyLayout, getSharedRoofProfile, sharedRoofHeightAt } from '@/lib/garageAssembly';
import GarageModel from './GarageModel';
import { getSheetAppearance } from '@/lib/surfaceAppearance';

type Color = {id: string;hex?: string;type?: string;label?: string;texture?: string};
function materialColor(id: string, colors: Color[]) {
  const entry = colors.find(color=>color.id===id);
  const wood = /drewn/i.test(entry?.type || '') || Boolean(entry?.texture);
  const walnut = /orzech|walnut/i.test(`${id} ${entry?.label || ''}`);
  return {wood,walnut,hex: id.startsWith('#') ? id : entry?.hex || '#555555',type:entry?.type || ''};
}
export default function MiddleCarport({config,colors}: {config: GarageConfig;colors: Color[]}) {
  const layout = getAssemblyLayout(config);
  const width = layout.gap / 100, depth = layout.middleLength / 100;
  const posts = materialColor(config.cornerFlashingColor,colors);
  const [oak,walnut] = useTexture(['/textures/zloty-dab-light-v3.webp','/textures/ciemny-orzech-light-v3.webp']);
  const textures = useMemo(()=>[oak,walnut].map(source=>{
    const texture=source.clone(); texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2; return texture;
  }),[oak,walnut]);
  useEffect(()=>()=>textures.forEach(texture=>texture.dispose()),[textures]);
  const sharedRoof = getSharedRoofProfile(config);
  const recess = config.assembly?.middleType === 'recess';
  const height = layout.middleHeight / 100;
  const roofHeight = (x: number,z: number) => {
    if (sharedRoof) return sharedRoofHeightAt(sharedRoof,layout.middleX+x*100)/100;
    const rise=0.4, type=layout.first.roofType;
    if(type==='dual-slope') return height+rise*(1-Math.abs(x)/(width/2));
    if(type==='dual-slope-front-back') return height+rise*(1-Math.abs(z)/(depth/2));
    if(type==='slope-front')return height+rise*(0.5-z/depth);
    if(type==='slope-back')return height+rise*(0.5+z/depth);
    if(type==='slope-left')return height+rise*(0.5+x/width);
    return height+rise*(0.5-x/width);
  };
  const segments = Math.max(1,Math.ceil(depth/3));
  const postRows = Array.from(new Set([...Array.from({length:segments+1},(_,index)=>-depth/2+index*depth/segments),0])).sort((a,b)=>a-b);
  const roofConfig = {...layout.first,width:layout.gap,length:layout.middleLength,height:layout.middleHeight,hasCarport:false,elements:[],frontCanopy:0};
  const beam = (from: THREE.Vector3,to: THREE.Vector3,key: string) => {
    const center=from.clone().add(to).multiplyScalar(0.5),direction=to.clone().sub(from);
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    return <mesh key={key} castShadow position={center} quaternion={rotation}><boxGeometry args={[0.08,direction.length(),0.12]}/>{postMaterial}</mesh>;
  };
  const crossPoints = Array.from(new Set([-width/2+0.07,sharedRoof && config.roofType === 'dual-slope' ? Math.max(-width/2+0.07,Math.min(width/2-0.07,((sharedRoof.minX+sharedRoof.maxX)/2-layout.middleX)/100)) : 0,width/2-0.07])).sort((a,b)=>a-b);
  const postMaterial = <meshStandardMaterial color={posts.wood ? '#ffffff':posts.hex} map={posts.wood? textures[posts.walnut?1:0]:undefined} {...getSheetAppearance(posts.wood,posts.type)} />;
  return <group name="middleCarport" position={[layout.middleX/100,0,(layout.length-layout.middleLength)/200]}>
    {!sharedRoof && <GarageModel config={roofConfig} colors={colors} roofOnly />}
    {recess && <GarageModel config={roofConfig} colors={colors} recessWallsOnly sharedRoof={sharedRoof || undefined} worldX={layout.middleX} />}
    {!recess && ([-1,1] as const).flatMap(side=>postRows.map((z,index)=>{
      const postHeight=roofHeight(side*(width/2-0.07),z)-0.09;
      return <mesh key={`${side}-${index}`} castShadow position={[side*(width/2-0.07),postHeight/2,z]}><boxGeometry args={[0.08,postHeight,0.08]}/>{postMaterial}</mesh>;
    }))}
    {!recess && ([-1,1] as const).flatMap(side=>postRows.slice(1).map((z,index)=>beam(new THREE.Vector3(side*(width/2-0.07),roofHeight(side*(width/2-0.07),postRows[index])-0.09,postRows[index]),new THREE.Vector3(side*(width/2-0.07),roofHeight(side*(width/2-0.07),z)-0.09,z),side+'-'+index)))}
    {!recess && [-depth/2,depth/2].flatMap(z=>crossPoints.slice(1).map((x,index)=>beam(new THREE.Vector3(crossPoints[index],roofHeight(crossPoints[index],z)-0.09,z),new THREE.Vector3(x,roofHeight(x,z)-0.09,z),z+'-'+index)))}


  </group>;
}
