import { GarageElement, WallFace } from '@/types';

interface Rect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export function getElementRect(el: GarageElement): Rect {
  return {
    left: el.x - el.width / 2,
    right: el.x + el.width / 2,
    bottom: el.y,
    top: el.y + el.height,
  };
}

export function checkCollision(
  rect1: Rect,
  rect2: Rect,
  margin = 5 // 5cm margin between elements
): boolean {
  return !(
    rect1.right + margin <= rect2.left ||
    rect1.left - margin >= rect2.right ||
    rect1.top + margin <= rect2.bottom ||
    rect1.bottom - margin >= rect2.top
  );
}

export function checkWallBounds(
  rect: Rect,
  wallWidth: number,
  wallHeight: number,
  margin = 5
): boolean {
  const wallLeft = -wallWidth / 2;
  const wallRight = wallWidth / 2;
  
  if (rect.left < wallLeft + margin) return false;
  if (rect.right > wallRight - margin) return false;
  if (rect.bottom < 0) return false;
  if (rect.top > wallHeight - margin) return false; // This is a rough check, roof shapes might clip corners, but it's okay for basic configuration.

  return true;
}

export function findValidPosition(
  element: GarageElement,
  otherElements: GarageElement[],
  wallWidth: number,
  wallHeight: number
): { x: number; y: number } | null {
  // If current position is valid, return it
  const currentRect = getElementRect(element);
  const wallElems = otherElements.filter((e) => e.wall === element.wall && e.id !== element.id);
  
  const isValid = (rect: Rect) => {
    if (!checkWallBounds(rect, wallWidth, wallHeight)) return false;
    for (const other of wallElems) {
      if (checkCollision(rect, getElementRect(other))) return false;
    }
    return true;
  };

  if (isValid(currentRect)) return { x: element.x, y: element.y };

  // Windows and skylights keep their chosen height: a collision moves them
  // sideways, rather than silently dropping the opening to floor level.
  const keepHeight = ['window', 'pvc-window', 'skylight'].includes(element.type);
  const step = 10;
  const rows = [element.y];
  if (!keepHeight) for (let y = 0; y <= wallHeight - element.height; y += step) if (y !== element.y) rows.push(y);
  for (const y of rows) {
    const edges = [
      -wallWidth / 2 + element.width / 2 + 5,
      wallWidth / 2 - element.width / 2 - 5,
      ...wallElems.flatMap(other => {
        const rect = getElementRect(other);
        return [rect.left - element.width / 2 - 5, rect.right + element.width / 2 + 5];
      }),
    ].sort((a, b) => Math.abs(a - element.x) - Math.abs(b - element.x));
    for (const x of edges) {
      if (isValid(getElementRect({ ...element, x, y }))) return { x, y };
    }
    for (let x = -wallWidth / 2 + element.width / 2 + 5; x <= wallWidth / 2 - element.width / 2 - 5; x += step) {
      const testRect = {
        left: x - element.width / 2,
        right: x + element.width / 2,
        bottom: y,
        top: y + element.height,
      };
      if (isValid(testRect)) {
        return { x, y };
      }
    }
  }

  return null; // Could not fit
}
