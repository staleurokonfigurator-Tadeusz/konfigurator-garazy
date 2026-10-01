import type { RoofType } from '@/types';

type Point = [number, number];
type RoofPlane = { corners: Point[]; ribs: [Point, Point][]; fill: string };

// Wszystkie miniatury mają tę samą perspektywę; zmienia się rzeczywisty profil dachu.
const project = (x: number, depth: number, height: number): Point => [
  20 + x * 58 + depth * 26,
  82 + x * 14 - depth * 18 - height * 0.75,
];
const points = (vertices: Point[]) => vertices.map(p => p.join(',')).join(' ');
const interpolate = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

function createMiniature(type: RoofType) {
  const dualAcrossWidth = type === 'dual-slope';
  const dualAcrossDepth = type === 'dual-slope-front-back';
  const ribsAlongDepth = dualAcrossDepth || type === 'slope-front' || type === 'slope-back';
  const heightAt = (x: number, z: number) => {
    if (dualAcrossWidth) return 38 + 22 * (1 - Math.abs(x - 0.5) * 2);
    if (dualAcrossDepth) return 38 + 22 * (1 - Math.abs(z - 0.5) * 2);
    if (type === 'slope-front') return 38 + 20 * z;
    if (type === 'slope-back') return 58 - 20 * z;
    if (type === 'slope-left') return 38 + 20 * x;
    return 58 - 20 * x;
  };
  const roofPoint = (x: number, z: number, lift = 0) => project(x, z, heightAt(x, z) + lift);
  const plane = (x1: number, x2: number, z1: number, z2: number, fill: string): RoofPlane => {
    const corners = [roofPoint(x1, z1), roofPoint(x2, z1), roofPoint(x2, z2), roofPoint(x1, z2)];
    const ribs = Array.from({ length: 7 }, (_, i): [Point, Point] => {
      const t = (i + 1) / 8;
      return ribsAlongDepth
        ? [interpolate(corners[0], corners[1], t), interpolate(corners[3], corners[2], t)]
        : [interpolate(corners[0], corners[3], t), interpolate(corners[1], corners[2], t)];
    });
    return { corners, ribs, fill };
  };
  const front = [project(0, 0, 0), project(1, 0, 0), roofPoint(1, 0)];
  if (dualAcrossWidth) front.push(roofPoint(0.5, 0));
  front.push(roofPoint(0, 0));
  const side = [project(1, 0, 0), project(1, 1, 0), roofPoint(1, 1)];
  if (dualAcrossDepth) side.push(roofPoint(1, 0.5));
  side.push(roofPoint(1, 0));

  const planes = dualAcrossWidth
    ? [plane(-0.06, 0.5, -0.07, 1.07, '#8492a5'), plane(0.5, 1.06, -0.07, 1.07, '#475569')]
    : dualAcrossDepth
      ? [plane(-0.06, 1.06, 0.5, 1.07, '#8492a5'), plane(-0.06, 1.06, -0.07, 0.5, '#475569')]
      : [plane(-0.06, 1.06, -0.07, 1.07, '#64748b')];

  const arrow = (x1: number, z1: number, x2: number, z2: number) => {
    const start = roofPoint(x1, z1, 1.2);
    const end = roofPoint(x2, z2, 1.2);
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const dx = (end[0] - start[0]) / length;
    const dy = (end[1] - start[1]) / length;
    const head1: Point = [end[0] - dx * 5 + dy * 3, end[1] - dy * 5 - dx * 3];
    const head2: Point = [end[0] - dx * 5 - dy * 3, end[1] - dy * 5 + dx * 3];
    return `M${start.join(',')}L${end.join(',')}M${head1.join(',')}L${end.join(',')}L${head2.join(',')}`;
  };
  const arrows = dualAcrossWidth
    ? [arrow(0.46, 0.48, 0.12, 0.48), arrow(0.54, 0.48, 0.88, 0.48)]
    : dualAcrossDepth
      ? [arrow(0.5, 0.46, 0.5, 0.1), arrow(0.5, 0.54, 0.5, 0.9)]
      : type === 'slope-front' ? [arrow(0.5, 0.82, 0.5, 0.18)]
        : type === 'slope-back' ? [arrow(0.5, 0.18, 0.5, 0.82)]
          : type === 'slope-left' ? [arrow(0.82, 0.5, 0.18, 0.5)]
            : [arrow(0.18, 0.5, 0.82, 0.5)];
  return { front, side, planes, arrows };
}

const miniatures = Object.fromEntries(([
  'dual-slope', 'dual-slope-front-back', 'slope-front', 'slope-back', 'slope-left', 'slope-right',
] as RoofType[]).map(type => [type, createMiniature(type)])) as Record<RoofType, ReturnType<typeof createMiniature>>;
const door = points([project(0.18, 0, 2), project(0.82, 0, 2), project(0.82, 0, 29), project(0.18, 0, 29)]);

export default function RoofTypeIcon({ type }: { type: RoofType }) {
  const miniature = miniatures[type];
  return (
    <svg viewBox="0 0 128 108" aria-hidden="true" focusable="false"
      className="h-[88px] w-[104px] shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5">
      <ellipse cx="64" cy="86" rx="48" ry="12" fill="#0f172a" opacity="0.07" />
      <g stroke="#b8c3d0" strokeWidth="0.9" strokeLinejoin="round">
        <polygon points={points(miniature.side)} fill="#dbe3ec" />
        <polygon points={points(miniature.front)} fill="#f8fafc" />
        <polygon points={door} fill="#cbd5e1" />
        {[8, 15, 22].map(height => (
          <path key={height} d={`M${project(0.2, 0, height).join(',')}L${project(0.8, 0, height).join(',')}`}
            stroke="#edf2f7" strokeWidth="1.2" />
        ))}
      </g>
      {miniature.planes.map((plane, index) => (
        <g key={index}>
          <polygon points={points(plane.corners)} fill={plane.fill} stroke="#334155" strokeWidth="0.9" strokeLinejoin="round" />
          {plane.ribs.map(([start, end], rib) => (
            <path key={rib} d={`M${start.join(',')}L${end.join(',')}`} stroke="#e2e8f0" strokeOpacity="0.3" strokeWidth="0.7" />
          ))}
        </g>
      ))}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {miniature.arrows.map((path, index) => (
          <g key={index}>
            <path d={path} stroke="white" strokeWidth="5" />
            <path d={path} stroke="var(--theme)" strokeWidth="2.6" />
          </g>
        ))}
      </g>
    </svg>
  );
}
