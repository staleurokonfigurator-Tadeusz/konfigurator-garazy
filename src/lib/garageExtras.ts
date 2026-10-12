import type { CarportSettings, GarageConfig } from '@/types';

export type CarportSide = 'left' | 'right';
export function getCarportSides(config: GarageConfig): CarportSide[] {
  if (!config.hasCarport) return [];
  return config.carportSide === 'both' ? ['left', 'right'] : [config.carportSide === 'left' ? 'left' : 'right'];
}
export function getCarportSettings(config: GarageConfig, side: CarportSide) {
  const settings = side === 'left' ? config.carportLeft : config.carportRight;
  return {
    width: settings?.width || config.carportWidth || 300,
    postColor: settings?.postColor || config.carportBaseColor || '#333333',
    walls: settings?.walls ?? config.carportWalls ?? { front: false, back: false, side: false },
  };
}
export function withCarportSettings(config: GarageConfig, side: CarportSide, settings: CarportSettings): GarageConfig {
  const key = side === 'left' ? 'carportLeft' : 'carportRight';
  return { ...config, [key]: { ...getCarportSettings(config, side), ...settings } };
}
export function getCarportLayout(config: GarageConfig) {
  const sides = getCarportSides(config);
  const left = sides.includes('left') ? getCarportSettings(config, 'left').width : 0;
  const right = sides.includes('right') ? getCarportSettings(config, 'right').width : 0;
  return { left, right, extraWidth: left + right, totalWidth: config.width + left + right, centerX: (right - left) / 2 };
}
export function isAnchoringAddon(addon: { id: string; label?: string }) {
  return /kotwicz|anchor/i.test(`${addon.id} ${addon.label || ''}`);
}
export function getAnchoringPrice(config: Pick<GarageConfig, 'width' | 'length'>) {
  const area = config.width * config.length / 10000;
  return area <= 36 ? 250 : area <= 50 ? 350 : 450;
}
export function normalizeDimension(text: string, min: number, max: number, step = 10) {
  if (!text.trim()) return null;
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
}
