import { getCarportLayout } from './garageExtras';
import type { GarageConfig, WallFace } from '@/types';

export const DEFAULT_PIR_PRICE_PER_M2 = 1300;
export const MAX_GARAGE_WIDTH_CM = 3000;
export const MAX_GARAGE_LENGTH_CM = 3000;

export const isPirGarage = (config: Pick<GarageConfig, 'buildingMaterial'>) =>
  config.buildingMaterial === 'pir';

export function getPirPricePerM2(value: unknown): number {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : DEFAULT_PIR_PRICE_PER_M2;
}

export function getGarageCameraDistance(config: GarageConfig, wall: WallFace, aspect: number): number {
  const width = getCarportLayout(config).totalWidth / 100;
  const length = config.length / 100;
  const previousDistance = Math.max(width, length) + 4;
  // A wide phone preview otherwise leaves two carports too small to inspect.
  if (config.hasCarport && config.carportSide === 'both' && aspect > 1.3) {
    const layout = getCarportLayout(config);
    const span = wall === 'front' || wall === 'back' ? width : length;
    const halfFovTangent = Math.tan(50 * Math.PI / 360);
    const nearExtension = wall === 'left' ? layout.left / 100 : wall === 'right' ? layout.right / 100 : 0;
    return nearExtension + Math.max((config.height / 100 + 1) * 1.1 / (2 * halfFovTangent), (span + 1) * 1.1 / (2 * halfFovTangent * aspect));
  }
  if (config.width <= 800 && config.length <= 1000) return previousDistance;
  const span = wall === 'front' || wall === 'back' ? width : length;
  const halfFovTangent = Math.tan(50 * Math.PI / 360);
  return Math.max(previousDistance, (span + 1) * 1.1 / (2 * halfFovTangent * Math.max(aspect, 0.1)));
}
