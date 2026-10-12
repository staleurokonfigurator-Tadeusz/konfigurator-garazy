export type ThreePerformanceProfile = {
  lowPower: boolean;
  dpr: number | [number, number];
  antialias: boolean;
  shadowMapSize: number;
  contactShadowResolution: number;
};

export function getThreePerformanceProfile(): ThreePerformanceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { lowPower: false, dpr: [1, 1.15], antialias: true, shadowMapSize: 1024, contactShadowResolution: 128 };
  }

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 8;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const phone = window.innerWidth <= 768 || window.matchMedia?.('(pointer: coarse)').matches === true;
  const lowPower = deviceMemory <= 4 || cores <= 4 || reducedMotion || phone;

  return lowPower
    ? { lowPower: true, dpr: 1, antialias: false, shadowMapSize: 512, contactShadowResolution: 64 }
    : { lowPower: false, dpr: [1, 1.15], antialias: true, shadowMapSize: 1024, contactShadowResolution: 128 };
}
