import type { GarageConfig, WallFace } from '@/types';
import { getCarportLayout } from './garageExtras';
import { sharedRoofHeightAt, type SharedRoofProfile } from './garageAssembly';

export const GARAGE_HEIGHT_LABEL = 'Wysokość niższej ściany (do okapu)';
export const ROOF_HEIGHT_NOTICE = 'Podaj wysokość od podłoża do okapu przy niższej ścianie, bez szczytu dachu. Wysokość szczytu przy dachu dwuspadowym lub wyższej ściany przy dachu jednospadowym ustalimy po konsultacji z projektantem. Kształt i spadek dachu w podglądzie są orientacyjne.';
export const PDF_ROOF_HEIGHT_NOTICE = 'H min - wysokość niższej ściany do okapu. Wysokość szczytu lub wyższej ściany oraz spadek dachu ustalimy po konsultacji z projektantem. Dach na rysunkach jest orientacyjny.';

// The preview uses the existing schematic rise; it is not a production dimension.
export const PREVIEW_ROOF_RISE_CM = 40;
export function previewRoofHeight(config: GarageConfig, x: number, z: number, sharedRoof?: SharedRoofProfile | null, worldX = 0): number {
  if (sharedRoof) return sharedRoofHeightAt(sharedRoof, worldX + x);
  const sides = getCarportLayout(config), minX = -config.width / 2 - sides.left;
  const totalWidth = config.width + sides.left + sides.right, centerX = minX + totalWidth / 2;
  const rise = PREVIEW_ROOF_RISE_CM, h = config.height;
  switch (config.roofType) {
    case 'dual-slope': return h + rise * (1 - Math.abs(x - centerX) / (totalWidth / 2));
    case 'dual-slope-front-back': return h + rise * (1 - Math.abs(z) / (config.length / 2));
    case 'slope-front': return h + rise * (0.5 - z / config.length);
    case 'slope-back': return h + rise * (0.5 + z / config.length);
    case 'slope-left': return h + rise * (x - minX) / totalWidth;
    case 'slope-right': return h + rise * (1 - (x - minX) / totalWidth);
  }
}

export function elevationPosition(config: GarageConfig, wall: WallFace, offset: number): [number, number] {
  switch (wall) {
    case 'front': return [-config.width / 2 + offset, config.length / 2];
    case 'back': return [config.width / 2 - offset, -config.length / 2];
    case 'left': return [-config.width / 2, -config.length / 2 + offset];
    case 'right': return [config.width / 2, config.length / 2 - offset];
  }
}

export function planOpeningRange(wall: WallFace, wallSize: number, center: number, width: number): [number, number] {
  width = Math.min(wallSize, Math.max(0, width));
  const start = Math.max(0, Math.min(wallSize - width, wallSize / 2 + center - width / 2));
  return wall === 'back' || wall === 'right' ? [wallSize - start - width, wallSize - start] : [start, start + width];
}
