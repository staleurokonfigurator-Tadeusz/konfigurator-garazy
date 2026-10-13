import type { GarageConfig, WallFace } from '@/types';
import { getAssemblyLayout } from './garageAssembly';
import { getGarageCameraDistance } from './garageMaterial';

export function getGarageCameraView(config: GarageConfig, wall: WallFace, aspect: number, activeGarage: 0 | 1 = 0, activeDimId?: string | null, overview = false) {
  const layout = getAssemblyLayout(config);
  const distance = getGarageCameraDistance(config, wall, aspect);
  const internalWall = layout.second && !overview && ((activeGarage === 1 && wall === 'left') || (activeGarage === 0 && wall === 'right'));
  if (internalWall) {
    const unit = activeGarage === 1 ? layout.second! : layout.first;
    const unitX = (activeGarage === 1 ? layout.secondX : layout.firstX) / 100;
    const unitZ = (activeGarage === 1 ? layout.secondZ : layout.firstZ) / 100;
    const element = unit.elements.find(el => el.id === activeDimId && el.wall === wall);
    const targetX = unitX + (wall === 'left' ? -1 : 1) * unit.width / 200;
    const targetY = element ? (element.y + element.height / 2) / 100 : unit.height / 200;
    const targetZ = unitZ + (element ? (wall === 'left' ? 1 : -1) * element.x / 100 : 0);
    // Look through the open front. A camera on the outer side of the building
    // would see the other garage instead of the edited wall.
    const frontZ = (layout.length / 2 + layout.frontProjection) / 100;
    const approach = element ? 1.2 : Math.max(3, layout.gap / 100 * 1.2);
    return {
      position: [layout.middleX / 100, targetY + 0.2, frontZ + approach] as const,
      target: [targetX, targetY, targetZ] as const,
      distance,
    };
  }
  const centerX = layout.centerX / 100;
  const width = layout.width / 100, length = (layout.length + layout.frontProjection) / 100;
  const height = layout.height / 200;
  const zoom = activeDimId ? 0.45 : 1;
  let targetX = centerX, targetZ = 0, cameraX = centerX, cameraZ = 0;
  switch (wall) {
    case 'front': targetZ = length / 2; cameraZ = targetZ + distance * zoom; break;
    case 'back': targetZ = -length / 2; cameraZ = targetZ - distance * zoom; break;
    case 'left': targetX = centerX - width / 2; cameraX = targetX - distance * zoom; break;
    case 'right': targetX = centerX + width / 2; cameraX = targetX + distance * zoom; break;
  }
  return {position: [cameraX, height, cameraZ] as const, target: [targetX, height, targetZ] as const, distance};
}
