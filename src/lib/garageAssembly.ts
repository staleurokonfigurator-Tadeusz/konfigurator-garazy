import type { GarageConfig } from '@/types';
import { getCarportLayout } from './garageExtras';

export function hasSharedAssemblyRoof(config: GarageConfig): boolean {
  return Boolean(config.assembly) && ['dual-slope','slope-left','slope-right'].includes(config.roofType);
}
export function normalizeSharedRoof(config: GarageConfig): GarageConfig {
  if (!config.assembly || !hasSharedAssemblyRoof(config)) return config;
  const height = Math.max(config.height,config.assembly.second.height);
  const second = config.assembly.second;
  const roofOptions = ['roofTile','roofFlashings'];
  const extraOptions = [...(second.extraOptions || []).filter(id=>!roofOptions.includes(id)),...(config.extraOptions || []).filter(id=>roofOptions.includes(id))];
  const roofFields = ['roofColor','roofProfile','roofFlashingColor','gutterColor','gutters'] as const;
  if (config.height === height && second.height === height && roofFields.every(key=>config[key]===second[key])
    && (config.frontCanopy || 0)===(second.frontCanopy || 0) && config.frontCanopyWalls===second.frontCanopyWalls
    && roofOptions.every(id=>Boolean(config.extraOptions?.includes(id))===Boolean(second.extraOptions?.includes(id)))) return config;
  return {...config,height,assembly:{...config.assembly,second:{...second,height,extraOptions,
    roofColor:config.roofColor,roofProfile:config.roofProfile,roofFlashingColor:config.roofFlashingColor,gutterColor:config.gutterColor,gutters:config.gutters,
    frontCanopy:config.frontCanopy,frontCanopyWalls:config.frontCanopyWalls}}};
}
export interface SharedRoofProfile {
  minX: number; maxX: number; baseHeight: number;
  roofType: GarageConfig['roofType'];
}
// World coordinates and heights in centimetres, shared by walls, supports and drawings.
export function sharedRoofHeightAt(profile: SharedRoofProfile, x: number): number {
  const span = profile.maxX-profile.minX, center = (profile.maxX+profile.minX)/2;
  if (profile.roofType === 'dual-slope') return profile.baseHeight+40*(1-Math.abs(x-center)/(span/2));
  if (profile.roofType === 'slope-left') return profile.baseHeight+40*(x-profile.minX)/span;
  return profile.baseHeight+40*(profile.maxX-x)/span;
}
export function getSharedRoofProfile(config: GarageConfig): SharedRoofProfile | null {
  if (!hasSharedAssemblyRoof(config)) return null;
  const layout=getAssemblyLayout(config);
  return {minX:layout.centerX-layout.width/2,maxX:layout.centerX+layout.width/2,baseHeight:layout.height,roofType:config.roofType};
}

export function getFrontCanopy(config: GarageConfig) {
  return config.buildingMaterial === 'pir' && Number.isFinite(config.frontCanopy)
    ? Math.min(150, Math.max(0, Math.round(config.frontCanopy || 0))) : 0;
}
export function standaloneUnit(config: GarageConfig, outerSide?: 'left' | 'right'): GarageConfig {
  const unit = { ...config };
  delete unit.assembly;
  if (outerSide && unit.hasCarport) {
    const hasOuter = unit.carportSide === 'both' || (unit.carportSide || 'right') === outerSide;
    unit.hasCarport = hasOuter;
    unit.carportSide = outerSide;
  }
  if (unit.buildingMaterial !== 'pir') { delete unit.frontCanopy; }
  return unit;
}
export function getAssemblyLayout(config: GarageConfig) {
  config = normalizeSharedRoof(config);
  const first = standaloneUnit(config, config.assembly ? 'left' : undefined);
  const second = config.assembly ? {...standaloneUnit(config.assembly.second, 'right'),roofType:first.roofType} : null;
  const firstLayout = getCarportLayout(first);
  const gap = second ? Math.min(600, Math.max(200, Math.round(config.assembly!.gapWidth || 300))) : 0;
  const length = Math.max(first.length, second?.length || 0);
  const firstX = second ? -(gap + second.width) / 2 : 0;
  const secondX = second ? (gap + first.width) / 2 : 0;
  const left = firstX - first.width / 2 - firstLayout.left;
  const right = second ? secondX + second.width / 2 + getCarportLayout(second).right : first.width / 2 + firstLayout.right;
  const frontProjection = Math.max(getFrontCanopy(first), second ? getFrontCanopy(second) : 0);
  return {
    first, second, gap, length, width: right - left, centerX: (left + right) / 2,
    height: Math.max(first.height, second?.height || 0), frontProjection,
    firstX, secondX, firstZ: (length - first.length) / 2, secondZ: second ? (length - second.length) / 2 : 0,
    middleX: firstX + first.width / 2 + gap / 2,
    middleLength: second ? Math.min(first.length, second.length) : 0,
    middleHeight: second ? Math.min(first.height, second.height) : 0,
  };
}
