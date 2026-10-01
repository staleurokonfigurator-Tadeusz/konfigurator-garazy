export type ThreePerformanceProfile = {
  lowPower: boolean;
  dpr: number | [number, number];
  antialias: boolean;
  shadowMapSize: number;
  contactShadowResolution: number;
};

export function getThreePerformanceProfile(): ThreePerformanceProfile {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { lowPower: false, dpr: [1, 1.35], antialias: true, shadowMapSize: 1024, contactShadowResolution: 256 };
  }

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 8;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const lowPower = deviceMemory <= 4 || cores <= 4 || reducedMotion;

  return lowPower
    ? { lowPower: true, dpr: 1, antialias: false, shadowMapSize: 512, contactShadowResolution: 128 }
    : { lowPower: false, dpr: [1, 1.35], antialias: true, shadowMapSize: 1024, contactShadowResolution: 256 };
}
