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
export const TRASH_PANEL_HEIGHT_CM = 24;
export const TRASH_PANEL_GAP_CM = 3;

// Jedyny produkcyjny układ: pełne panele 24 cm rozdzielone szczeliną 3 cm.
// Zachowujemy identyfikator "wide", aby starsze zapisane oferty nadal się otwierały.
export const TRASH_PANEL_PATTERNS: TrashPanelPatternSettings[] = [
  { id: 'wide', label: 'Panele poziome 24 cm', description: 'Panel 24 cm · prześwit 3 cm', panelHeightsCm: [TRASH_PANEL_HEIGHT_CM], gapCm: TRASH_PANEL_GAP_CM },
];

export interface TrashPanelBand { index: number; bottomCm: number; heightCm: number }

export function getTrashPanelPatternSettings(pattern: TrashPanelPattern = 'wide'): TrashPanelPatternSettings {
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

export function getTrashPanelBands(heightCm: number, pattern: TrashPanelPattern = 'wide'): TrashPanelBand[] {
  const { panelHeightsCm, gapCm } = getTrashPanelPatternSettings(pattern);
  const panelHeightCm = panelHeightsCm[0];
  const count = Math.max(0, Math.min(80, Math.floor((Math.max(0, heightCm) + gapCm) / (panelHeightCm + gapCm))));
  return Array.from({ length: count }, (_, index) => ({
    index,
    bottomCm: index * (panelHeightCm + gapCm),
    heightCm: panelHeightCm,
  }));
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
