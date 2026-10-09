import type { GarageConfig, GarageElement } from '@/types';
import { checkCollision, checkWallBounds, findValidPosition, getElementRect } from './collision';

export interface PricedAddon { id: string; label?: string; type?: string; price?: number }

export function requiresSectionalGate(addon: Pick<PricedAddon, 'id' | 'label'>): boolean {
  const text = `${addon.id} ${addon.label || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /segment/.test(text) && /(naped|automat|motor)/.test(text);
}

export function isAddonAvailable(config: Pick<GarageConfig, 'elements'>, addon: PricedAddon): boolean {
  return !requiresSectionalGate(addon) || config.elements.some(el => el.type === 'gate' && el.gateType === 'sectional');
}

export function cleanUnavailableOptions(config: GarageConfig, addons: PricedAddon[]): GarageConfig {
  const extraOptions = config.extraOptions?.filter(id => {
    const addon = addons.find(item => item.id === id);
    return !addon || isAddonAvailable(config, addon);
  });
  const normalized = extraOptions?.length === config.extraOptions?.length ? config : { ...config, extraOptions };
  const obsolete = normalized as GarageConfig & { roofRiseCm?: unknown };
  if ((normalized.buildingMaterial === 'pir' && !normalized.gutters) || 'roofRiseCm' in obsolete) {
    const cleaned = { ...normalized, gutters: normalized.buildingMaterial === 'pir' || normalized.gutters };
    delete (cleaned as GarageConfig & { roofRiseCm?: unknown }).roofRiseCm;
    return cleaned;
  }
  return normalized;
}

// Move a resized gate to a valid position. If a centred neighbour prevents a
// larger gate fitting, repack the gates together while leaving other openings fixed.
export function updateGarageElement(config: GarageConfig, id: string, updates: Partial<GarageElement>): GarageConfig | null {
  const original = config.elements.find(el => el.id === id);
  if (!original) return null;
  const updated = { ...original, ...updates };
  const wallWidth = updated.wall === 'front' || updated.wall === 'back' ? config.width : config.length;
  const positionChanged = updates.x !== undefined || updates.y !== undefined;
  const geometryChanged = positionChanged || updates.width !== undefined || updates.height !== undefined || updates.wall !== undefined;
  if (!geometryChanged) return { ...config, elements: config.elements.map(el => el.id === id ? updated : el) };
  const pos = findValidPosition(updated, config.elements, wallWidth, config.height);
  if (pos) {
    if (positionChanged && (pos.x !== updated.x || pos.y !== updated.y)) return null;
    return { ...config, elements: config.elements.map(el => el.id === id ? { ...updated, ...pos } : el) };
  }
  if (positionChanged || updated.type !== 'gate') return null;
  const wallGates = config.elements.filter(el => el.type === 'gate' && el.wall === updated.wall)
    .map(el => el.id === id ? updated : el).sort((a, b) => a.x - b.x);
  const fixed = config.elements.filter(el => el.wall === updated.wall && el.type !== 'gate');
  const gap = 5;
  const totalWidth = wallGates.reduce((sum, gate) => sum + gate.width, 0) + gap * (wallGates.length - 1);
  const minCenter = -wallWidth / 2 + 5 + totalWidth / 2;
  const maxCenter = wallWidth / 2 - 5 - totalWidth / 2;
  if (minCenter > maxCenter) return null;
  const preferred = Math.min(maxCenter, Math.max(minCenter, wallGates.reduce((sum, gate) => sum + gate.x, 0) / wallGates.length));
  const centers = [preferred, minCenter, maxCenter];
  for (let center = minCenter; center <= maxCenter; center += 10) centers.push(center);
  centers.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  for (const center of centers) {
    let edge = center - totalWidth / 2;
    const placed = wallGates.map(gate => {
      const next = { ...gate, x: edge + gate.width / 2 };
      edge += gate.width + gap;
      return next;
    });
    if (placed.every(gate => checkWallBounds(getElementRect(gate), wallWidth, config.height)
      && !fixed.some(el => checkCollision(getElementRect(gate), getElementRect(el))))) {
      return { ...config, elements: config.elements.map(el => placed.find(gate => gate.id === el.id) || el) };
    }
  }
  return null;
}

