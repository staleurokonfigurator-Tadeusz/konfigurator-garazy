import type { GarageConfig } from '@/types';
import { getCarportLayout } from './garageExtras';

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
