/** Painted sheet has a dielectric coating, including the printed wood finishes. */
export function getSheetAppearance(isWood: boolean, finishType = '') {
  const finish = finishType.toLocaleLowerCase('pl-PL');
  return {
    roughness: isWood ? 0.58 : finish.includes('mat') ? 0.76 : finish.includes('połysk') ? 0.38 : 0.54,
    metalness: isWood ? 0.03 : 0.12,
    envMapIntensity: 0.8,
  };
}
