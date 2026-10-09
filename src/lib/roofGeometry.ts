import type { GarageConfig } from '@/types';

export const MIN_ROOF_ANGLE = 1;
export const MAX_ROOF_ANGLE = 45;
export function isDualRoof(config: GarageConfig) {
  return config.roofType === 'dual-slope' || config.roofType === 'dual-slope-front-back';
}
export function roofSpanCm(config: GarageConfig) {
  return config.roofType === 'dual-slope-front-back' ? config.length
    : config.width + (config.hasCarport ? (config.carportWidth || 300) : 0);
}
export function roofRiseLimits(config: GarageConfig) {
  const half = roofSpanCm(config) / 2;
  return { min: half * Math.tan(MIN_ROOF_ANGLE * Math.PI / 180), max: half };
}
// Store rise only: angle is derived, so saved configurations cannot disagree.
// Legacy projects retain the existing 40 cm rise, even outside the editing range.
export function roofRiseCm(config: GarageConfig) {
  if (!isDualRoof(config) || config.roofRiseCm === undefined) return 40;
  const limits = roofRiseLimits(config);
  return Number.isFinite(config.roofRiseCm)
    ? Math.min(limits.max, Math.max(limits.min, config.roofRiseCm)) : 40;
}
export function roofAngleDeg(config: GarageConfig) {
  return Math.atan2(roofRiseCm(config), roofSpanCm(config) / 2) * 180 / Math.PI;
}
export function withRoofRise(config: GarageConfig, rise: number): GarageConfig {
  if (!Number.isFinite(rise) || !isDualRoof(config)) return config;
  const limits = roofRiseLimits(config);
  return { ...config, roofRiseCm: Math.min(limits.max, Math.max(limits.min, rise)) };
}
export function withRoofAngle(config: GarageConfig, angle: number): GarageConfig {
  if (!Number.isFinite(angle)) return config;
  const bounded = Math.min(MAX_ROOF_ANGLE, Math.max(MIN_ROOF_ANGLE, angle));
  return withRoofRise(config, roofSpanCm(config) / 2 * Math.tan(bounded * Math.PI / 180));
}
export function totalHeightCm(config: GarageConfig) {
  return config.height + roofRiseCm(config);
}
