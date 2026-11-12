import type { GarageConfig, TrashPanelPattern, WallFace } from '@/types';

export interface TrashPanelPatternSettings {
  id: TrashPanelPattern;
  label: string;
  description: string;
  panelHeightsCm: number[];
  gapCm: number;
}

// Proporcje odpowiadają typowym poziomym lamelom: prześwit jest wyraźny,
// ale nie dominuje nad panelem. Te same dane sterują miniaturą, modelem 3D i PDF-em.
export const TRASH_PANEL_PATTERNS: TrashPanelPatternSettings[] = [
  { id: 'narrow', label: 'Wąskie lamele', description: 'Panele 14 cm · prześwit 4 cm', panelHeightsCm: [14], gapCm: 4 },
  { id: 'wide', label: 'Szerokie lamele', description: 'Panele 22 cm · prześwit 5 cm', panelHeightsCm: [22], gapCm: 5 },
  { id: 'mixed', label: 'Układ mieszany', description: 'Panele 22/14/14 cm · prześwit 4 cm', panelHeightsCm: [22, 14, 14], gapCm: 4 },
];

export interface TrashPanelBand { index: number; bottomCm: number; heightCm: number }

export function getTrashPanelPatternSettings(pattern: TrashPanelPattern = 'narrow'): TrashPanelPatternSettings {
  return TRASH_PANEL_PATTERNS.find(item => item.id === pattern) || TRASH_PANEL_PATTERNS[0];
}

export function getTrashWallPanelHeightCm(config: Pick<GarageConfig, 'height' | 'roofType'>, wall: WallFace): number {
  const rise = 40;
  const highWalls: Record<GarageConfig['roofType'], WallFace[]> = {
    'dual-slope': ['front', 'back'],
    'dual-slope-front-back': ['left', 'right'],
    'slope-front': ['back', 'left', 'right'],
    'slope-back': ['front', 'left', 'right'],
    'slope-left': ['front', 'back', 'right'],
    'slope-right': ['front', 'back', 'left'],
  };
  return config.height + (highWalls[config.roofType].includes(wall) ? rise : 0);
}

export function getTrashPanelBands(heightCm: number, pattern: TrashPanelPattern = 'narrow'): TrashPanelBand[] {
  const { panelHeightsCm, gapCm } = getTrashPanelPatternSettings(pattern);
  const bands: TrashPanelBand[] = [];
  let bottomCm = 0;
  let index = 0;
  while (bottomCm < heightCm && index < 80) {
    const height = Math.min(panelHeightsCm[index % panelHeightsCm.length], heightCm - bottomCm);
    if (height > 0) bands.push({ index, bottomCm, heightCm: height });
    bottomCm += height + gapCm;
    index += 1;
  }
  return bands;
}

export function getTrashPanelColor(config: GarageConfig, wall: WallFace, index: number): string {
  return config.trashPanelColors?.[wall]?.[index] || config.wallColor;
}

export function setTrashPanelColor(config: GarageConfig, wall: WallFace, index: number, colorId: string): GarageConfig {
  const nextWall = [...(config.trashPanelColors?.[wall] || [])];
  nextWall[index] = colorId;
  return {
    ...config,
    trashPanelColors: { ...(config.trashPanelColors || {}), [wall]: nextWall },
  };
}
