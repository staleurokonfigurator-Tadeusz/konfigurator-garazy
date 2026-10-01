export type RoofType = 'dual-slope' | 'dual-slope-front-back' | 'slope-front' | 'slope-back' | 'slope-left' | 'slope-right';
export type WallFace = 'front' | 'back' | 'left' | 'right';
export type GateType = 'up-and-over' | 'swing' | 'sectional';

export type SheetProfile = 'pionowe-t7' | 'poziome-t7' | 'pionowe-t14' | 'poziome-t14' | 'pionowe-t17' | 'poziome-t17';

export interface GarageElement {
  id: string;
  type: 'gate' | 'door' | 'window' | 'pvc-window' | 'skylight';
  wall: WallFace;
  x: number;
  y: number;
  width: number;
  height: number;
  isOpen?: boolean;
  hingeSide?: 'left' | 'right';
  gateType?: GateType;
  clearanceHeight?: number;
  profile?: SheetProfile;
  hasDoor?: boolean;
}

export interface GarageConfig {
  width: number;
  length: number;
  height: number;
  roofType: RoofType;
  gutters: boolean;
  elements: GarageElement[];
  extraOptions?: string[];
  modulesCount?: number; // Używane w Pergoli
  
  // NOWY SYSTEM KOLORÓW I OBRÓBEK
  applyColorToAll: boolean; // Checkbox "Zastosuj do wszystkich"
  removeFoil: boolean;
  
  wallProfile: SheetProfile;
  wallColor: string;
  
  roofProfile: SheetProfile;
  roofColor: string;
  
  gateProfile: SheetProfile;
  gateColor: string;
  
  doorProfile: SheetProfile;
  doorColor: string;
  
  cornerFlashingColor: string; 
  roofFlashingColor: string;   
  gutterColor: string; // NOWE: Kolor rynien
  
  windowColor: string;

  // Dopisz to wewnątrz interfejsu GarageConfig w pliku types.ts:
  
  // NOWE: Zintegrowana Wiata (Carport)
  hasCarport?: boolean;
  carportWidth?: number; // np. od 100 do 400 cm
  carportSide?: 'left' | 'right';
  carportWalls?: {
    front: boolean;
    back: boolean;
    side: boolean;
  };
  carportBaseColor?: string;
  carportInsertColor?: string;
}
