import type { GarageConfig } from '@/types';

export interface SavedProject { version: 1; id: string; name: string; savedAt: string; config: GarageConfig }
const roofs = ['dual-slope', 'dual-slope-front-back', 'slope-front', 'slope-back', 'slope-left', 'slope-right'];
const profiles = ['pionowe-t7','poziome-t7','pionowe-t14','poziome-t14','pionowe-t17','poziome-t17'];
const colorFields = ['wallColor','roofColor','gateColor','doorColor','windowColor','cornerFlashingColor','roofFlashingColor','gutterColor'];
const profileFields = ['wallProfile','roofProfile','gateProfile','doorProfile'];
const finiteBetween = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function isGarageProjectConfig(value: unknown): value is GarageConfig {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (!finiteBetween(c.width, 200, 3000) || !finiteBetween(c.length, 300, 3000) || !finiteBetween(c.height, 200, 350)) return false;
  if (c.roofRiseCm !== undefined && !finiteBetween(c.roofRiseCm, 0.01, 1750)) return false;
  if (!roofs.includes(String(c.roofType)) || (c.buildingMaterial !== undefined && !['sheet','pir'].includes(String(c.buildingMaterial)))) return false;
  if (!colorFields.every(key => typeof c[key] === 'string' && (c[key] as string).length <= 100)) return false;
  if (!profileFields.every(key => profiles.includes(String(c[key])))) return false;
  if (typeof c.gutters !== 'boolean' || typeof c.applyColorToAll !== 'boolean' || typeof c.removeFoil !== 'boolean') return false;
  if (c.extraOptions !== undefined && (!Array.isArray(c.extraOptions) || c.extraOptions.length > 50 || !c.extraOptions.every(id => typeof id === 'string' && id.length <= 100))) return false;
  if (c.hasCarport && (!finiteBetween(c.carportWidth ?? 300, 100, 500) || !['left','right',undefined].includes(c.carportSide as string | undefined))) return false;
  if (!Array.isArray(c.elements) || c.elements.length > 30) return false;
  const ids = new Set<string>();
  for (const el of c.elements) {
    if (!el || typeof el !== 'object' || typeof el.id !== 'string' || el.id.length > 80 || ids.has(el.id)) return false;
    ids.add(el.id);
    if (!['gate','door','window','pvc-window','skylight'].includes(el.type) || !['front','back','left','right'].includes(el.wall)) return false;
    if (!finiteBetween(el.width, 20, el.type === 'gate' ? 600 : 3000) || !finiteBetween(el.height, 20, 350) || !finiteBetween(el.x, -1500, 1500) || !finiteBetween(el.y, 0, 350)) return false;
    if (el.type === 'gate' && !['up-and-over','sectional','swing'].includes(el.gateType)) return false;
  }
  return true;
}

export function projectStorageKey(storeUrl: string, offerMode: boolean) {
  let store = 'local';
  try { store = new URL(storeUrl).origin; } catch { /* Standalone preview. */ }
  return `staleuro:garage-projects:v1:${store}:${offerMode ? 'offers' : 'customer'}`;
}

export function readDraft(storage: Pick<Storage, 'getItem'>, key: string): GarageConfig | null {
  try {
    const draft = JSON.parse(storage.getItem(key + ':draft') || 'null');
    return draft?.version === 1 && isGarageProjectConfig(draft.config) ? draft.config : null;
  } catch { return null; }
}

export function writeDraft(storage: Pick<Storage, 'setItem'>, key: string, config: GarageConfig) {
  storage.setItem(key + ':draft', JSON.stringify({version:1, config}));
}

export function parseProjectFile(text: string): SavedProject {
  if (text.length > 250000) throw new Error('Plik projektu jest zbyt duży.');
  const project = JSON.parse(text);
  if (project?.version !== 1 || !isGarageProjectConfig(project.config)) throw new Error('Plik nie zawiera poprawnego projektu garażu.');
  return {version:1,id:String(project.id || 'import'),name:String(project.name || 'Projekt z pliku').slice(0,80),savedAt:String(project.savedAt || ''),config:project.config};
}

export function readSavedProjects(storage: Pick<Storage,'getItem'>, key: string): SavedProject[] {
  try {
    const projects: unknown = JSON.parse(storage.getItem(key + ':saved') || '[]');
    return Array.isArray(projects) ? projects.slice(0,50).map(project => {
      try { return parseProjectFile(JSON.stringify(project)); } catch { return null; }
    }).filter((project): project is SavedProject => project !== null) : [];
  } catch { return []; }
}
