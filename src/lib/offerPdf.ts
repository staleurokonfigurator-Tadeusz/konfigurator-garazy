import { previewRoofHeight, elevationPosition, planOpeningRange, PDF_ROOF_HEIGHT_NOTICE, PREVIEW_ROOF_RISE_CM } from './roofDimensions';
import { getAssemblyLayout, getFrontCanopy, getSharedRoofProfile, sharedRoofHeightAt, type SharedRoofProfile } from './garageAssembly';
import { getCarportLayout, getCarportSides, getCarportSettings } from './garageExtras';
import type { GarageConfig, GarageElement, WallFace } from '@/types';
import {
  PDF_FONT, PDF_INK, PDF_MUTED, PDF_BOTTOM,
  safePdfText, loadOfferFonts, drawPdfCard, drawPdfImage, createOfferLayout,
} from './offerPdfLayout';

export interface OfferCustomer {
  brand: 'gardhouse' | 'staleuro';
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  validDays: number;
  arUrl: string;
}

export interface OfferPdfInput {
  offerNumber: string;
  customer: OfferCustomer;
  config: GarageConfig;
  estimatedPrice: number;
  currency?: string;
  colorLabels: Record<string, string>;
  optionLabels?: Record<string, string>;
  views: Partial<Record<WallFace, string>>;
  priceVerified?: boolean;
  priceSource?: 'catalogue' | 'manual';
}

const wallNames: Record<WallFace, string> = {
  front: 'Widok z przodu',
  right: 'Widok z prawej strony',
  back: 'Widok z tyłu',
  left: 'Widok z lewej strony',
};

const gateNames: Record<string, string> = {
  'up-and-over': 'uchylna',
  swing: 'dwuskrzydłowa',
  sectional: 'segmentowa',
};

const roofNames: Record<string, string> = {
  'dual-slope': 'dwuspadowy prawo-lewo',
  'dual-slope-front-back': 'dwuspadowy przód-tył',
  'slope-front': 'spad w przód',
  'slope-back': 'spad w tył',
  'slope-left': 'spad w lewo',
  'slope-right': 'spad w prawo',
};

const safeText = safePdfText;

const profileNames: Record<string, string> = {
  'pionowe-t7': 'Pionowe T-7', 'poziome-t7': 'Poziome T-7',
  'pionowe-t14': 'Pionowe T-14', 'poziome-t14': 'Poziome T-14',
  'pionowe-t17': 'Pionowe T-17 (mini rąbek)', 'poziome-t17': 'Poziome T-17',
};
const faceNames: Record<WallFace, string> = { front: 'Przód', back: 'Tył', left: 'Lewa', right: 'Prawa' };
const materialLabel = (config: GarageConfig) => config.buildingMaterial === 'pir' ? 'Płyta warstwowa PIR' : 'Blacha standardowa';

const profileLabel = (profile: string | undefined) => profileNames[profile || ''] || profile || 'Według konfiguracji';

function getCarportWidthCm(config: GarageConfig) {
  const rawEnabled: unknown = (config as unknown as Record<string, unknown>).hasCarport;
  const width = Number(config.carportWidth);
  const storedWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const enabled = rawEnabled === true
    || rawEnabled === 1
    || rawEnabled === '1'
    || rawEnabled === 'true'
    || ((rawEnabled === undefined || rawEnabled === null) && storedWidth > 0);
  if (!enabled) return 0;
  return getCarportLayout({...config,hasCarport:true,carportWidth:storedWidth || 300}).extraWidth;
}

function getPdfCarports(config: GarageConfig) {
  const normalized = {...config,hasCarport:getCarportWidthCm(config) > 0};
  return getCarportSides(normalized).map(side => ({side,...getCarportSettings(normalized,side)}));
}

function elementDescription(element: GarageElement) {
  if (element.type === 'gate') {
    return `Brama ${gateNames[element.gateType || 'up-and-over'] || element.gateType}\n${profileLabel(element.profile)}${element.hasDoor ? '\nDrzwi w bramie' : ''}`;
  }
  const labels: Record<string, string> = { door: 'Drzwi', window: 'Okno', 'pvc-window': 'Okno PCV', skylight: 'Świetlik' };
  return `${labels[element.type] || element.type}${element.type === 'door' ? `\nZawiasy: ${element.hingeSide === 'right' ? 'prawe' : 'lewe'}` : ''}`;
}

function drawDimensionPlan(doc: import('jspdf').jsPDF, config: GarageConfig, x: number, y: number, maxWidth: number, maxHeight = 70) {
  const carportWidthCm = getCarportWidthCm(config);
  const totalWidthCm = config.width + carportWidthCm;
  const ratio = Math.min(maxWidth / totalWidthCm, maxHeight / (config.length+getFrontCanopy(config)));
  const width = totalWidthCm * ratio;
  const garageWidth = config.width * ratio;
  const carports = getPdfCarports(config);
  const leftWidth = carports.find(item => item.side === 'left')?.width || 0;
  const length = config.length * ratio;
  const garageX = x + leftWidth * ratio;

  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.7);
  doc.rect(garageX, y, garageWidth, length);
  for (const item of carports) {
    const carportWidth = item.width * ratio;
    const carportX = item.side === 'left' ? x : garageX + garageWidth;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(100, 116, 139);
    doc.setLineDashPattern([2, 1], 0);
    doc.rect(carportX, y, carportWidth, length, 'FD');
    doc.setLineDashPattern([], 0);
    doc.setFillColor(71, 85, 105);
    [[carportX, y], [carportX + carportWidth, y], [carportX, y + length], [carportX + carportWidth, y + length]].forEach(([postX, postY]) => {
      doc.rect(postX - 0.8, postY - 0.8, 1.6, 1.6, 'F');
    });
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('WIATA', carportX + carportWidth / 2, y + length / 2, { align: 'center', angle: 90 });
  }
  if (config.roofType === 'dual-slope' || config.roofType === 'dual-slope-front-back') {
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2, 1.5], 0);
    if (config.roofType === 'dual-slope') {
      doc.line(x + width / 2, y, x + width / 2, y + length);
    } else {
      doc.line(x, y + length / 2, x + width, y + length / 2);
    }
    doc.setLineDashPattern([], 0);
  }
  doc.setTextColor(30, 30, 30);
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.2);
  doc.line(x, y - 5, x + width, y - 5);
  doc.line(x, y - 7, x, y - 3);
  doc.line(x + width, y - 7, x + width, y - 3);
  doc.line(x - 5, y, x - 5, y + length);
  doc.line(x - 7, y, x - 3, y);
  doc.line(x - 7, y + length, x - 3, y + length);
  doc.setFontSize(9);
  doc.text(`${totalWidthCm} cm`, x + width / 2, y - 7, { align: 'center' });
  doc.text(`${config.length} cm`, x - 8, y + length / 2, { angle: 90, align: 'center' });
  if (carports.length) {
    doc.setFontSize(6.5);
    doc.text(`Garaż ${config.width} cm`, garageX + garageWidth / 2, y + length + 8, { align: 'center' });
    carports.forEach(item => {
      const carportWidth = item.width * ratio;
      const carportX = item.side === 'left' ? x : garageX + garageWidth;
      doc.text('Wiata ' + item.width + ' cm', carportX + carportWidth / 2, y + length + 8, { align:'center' });
    });
  }

  const markOpening = (element: GarageElement, index: number) => {
    const isHorizontalWall = element.wall === 'front' || element.wall === 'back';
    const wallSize = isHorizontalWall ? config.width : config.length;
    const [start, end] = planOpeningRange(element.wall, wallSize, element.x, element.width);
    const code = (element.type === 'gate' ? 'BR' : element.type === 'door' ? 'D' : element.type === 'pvc-window' ? 'OP' : element.type === 'window' ? 'O' : 'S') + (index + 1);

    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(1.4);
    doc.setFontSize(5.5);
    doc.setTextColor(120, 53, 15);

    if (element.wall === 'front') {
      const x1 = garageX + start * ratio;
      const x2 = garageX + end * ratio;
      doc.line(x1, y + length, x2, y + length);
      doc.text(code, (x1 + x2) / 2, y + length + 3, { align: 'center' });
    } else if (element.wall === 'back') {
      const x1 = garageX + start * ratio;
      const x2 = garageX + end * ratio;
      doc.line(x1, y, x2, y);
      doc.text(code, (x1 + x2) / 2, y - 2, { align: 'center' });
    } else if (element.wall === 'left') {
      const y1 = y + start * ratio;
      const y2 = y + end * ratio;
      doc.line(garageX, y1, garageX, y2);
      doc.text(code, garageX + 2, (y1 + y2) / 2);
    } else {
      const y1 = y + start * ratio;
      const y2 = y + end * ratio;
      doc.line(garageX + garageWidth, y1, garageX + garageWidth, y2);
      doc.text(code, garageX + garageWidth - 2, (y1 + y2) / 2, { align: 'right' });
    }
  };

  if (getFrontCanopy(config)) {
    doc.setDrawColor(100,116,139);doc.setLineDashPattern([2,1],0);
    doc.rect(x,y+length,width,getFrontCanopy(config)*ratio);
    doc.setLineDashPattern([],0);doc.setFontSize(6.5);
    if (config.frontCanopyWalls !== false) {
      doc.setLineWidth(0.7);
      doc.line(garageX,y+length,garageX,y+length+getFrontCanopy(config)*ratio);
      doc.line(garageX+garageWidth,y+length,garageX+garageWidth,y+length+getFrontCanopy(config)*ratio);
    }
    doc.text('Wypust PIR: '+getFrontCanopy(config)+' cm',x+width/2,y+length+getFrontCanopy(config)*ratio+6,{align:'center'});
  }
  config.elements.forEach(markOpening);
  doc.setTextColor(30, 30, 30);
  doc.setLineWidth(0.2);
}

function drawElevationPlan(
  doc: import('jspdf').jsPDF,
  config: GarageConfig,
  wall: WallFace,
  title: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight = 48,
  sharedRoof?: SharedRoofProfile | null,
  worldX = 0,
) {
  const isFrontBack = wall === 'front' || wall === 'back';
  const wallWidthCm = isFrontBack ? config.width : config.length;
  const integratedCarportWidthCm = getCarportWidthCm(config);
  const carportWidthCm = isFrontBack ? integratedCarportWidthCm : 0;
  const drawingWidthCm = wallWidthCm + carportWidthCm;
  const scale = Math.min(maxWidth / drawingWidthCm, maxHeight / (config.height + PREVIEW_ROOF_RISE_CM));
  const width = drawingWidthCm * scale;
  const garageWidth = wallWidthCm * scale;
  const carports = getPdfCarports(config);
  const paperLeft = wall === 'back' ? 'right' : 'left';
  const leftWidth = isFrontBack ? (carports.find(item => item.side === paperLeft)?.width || 0) : 0;
  const garageX = x + leftWidth * scale;
  const wallHeight = config.height * scale;
  const roofBaseYAt = (pointX: number) => {
    const [localX, localZ] = elevationPosition(config, wall, (pointX - garageX) / scale);
    return y - (previewRoofHeight(config, localX, localZ, sharedRoof, worldX) - config.height) * scale;
  };
  let ridge: number | null = null;
  if (config.roofType === 'dual-slope' && isFrontBack) {
    const sides = getCarportLayout(config);
    const localRidge = sharedRoof ? (sharedRoof.minX + sharedRoof.maxX) / 2 - worldX : (sides.right - sides.left) / 2;
    ridge = garageX + (config.width / 2 + (wall === 'back' ? -1 : 1) * localRidge) * scale;
  } else if (config.roofType === 'dual-slope-front-back' && !isFrontBack) ridge = garageX + garageWidth / 2;
  const roofBreakpoints = (from: number, to: number) => [from, ...(ridge !== null && ridge > from && ridge < to ? [ridge] : []), to];
  const visibleRoofRise = Math.max(0, ...roofBreakpoints(x, x + width).map(pointX => y - roofBaseYAt(pointX)));
  const drawWallOutline = (sectionX: number, sectionWidth: number, style?: string) => {
    const points = roofBreakpoints(sectionX, sectionX + sectionWidth).map(pointX => [pointX, roofBaseYAt(pointX)]);
    points.push([sectionX + sectionWidth, y + wallHeight], [sectionX, y + wallHeight]);
    doc.lines(points.slice(1).map((point,index) => [point[0]-points[index][0], point[1]-points[index][1]]), points[0][0], points[0][1], [1,1], style, true);
  };

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_INK);
  doc.text(title, x, y - visibleRoofRise - 6);
  doc.setFont(PDF_FONT, 'normal');doc.setFontSize(5.5);
  doc.text('Szczyt / H max: po konsultacji', x, y - visibleRoofRise - 2.5);
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.5);
  doc.setFillColor(255, 255, 255);
  drawWallOutline(garageX, garageWidth, 'FD');
  if (isFrontBack) { for (const item of carports) {
    const carportWidth = item.width * scale;
    const carportX = item.side === paperLeft ? x : garageX + garageWidth;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(100, 116, 139);
    doc.setLineDashPattern([2, 1], 0);
    drawWallOutline(carportX, carportWidth, 'FD');
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(1.1);
    doc.line(carportX, roofBaseYAt(carportX), carportX, y + wallHeight);
    doc.line(carportX + carportWidth, roofBaseYAt(carportX + carportWidth), carportX + carportWidth, y + wallHeight);
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('WIATA', carportX + carportWidth / 2, y + wallHeight / 2, { align: 'center' });
  }} else if (carports.some(item => item.side === wall)) {
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(239, 246, 255);
    doc.setLineDashPattern([2, 1], 0);
    drawWallOutline(x, width, 'FD');
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(1.1);
    doc.line(x, roofBaseYAt(x) - 2.5, x, y + wallHeight);
    doc.line(x + width, roofBaseYAt(x + width) - 2.5, x + width, y + wallHeight);
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('WIATA', x + 5, y + 7);
  }
  doc.setTextColor(30, 30, 30);
  doc.setDrawColor(35, 35, 35);
  doc.setFillColor(244, 244, 245);
  doc.setLineWidth(0.45);
  const overhang = Math.min(2.5, Math.max(1.2, width * 0.018));
  const roofThickness = 1.4;
  const roofLeft = x - overhang;
  const roofRight = x + width + overhang;
  const top = roofBreakpoints(roofLeft, roofRight).map(pointX => [pointX, roofBaseYAt(pointX)]);
  const roofPoints = [...top, ...top.slice().reverse().map(([pointX,pointY]) => [pointX, pointY - roofThickness])];
  doc.lines(roofPoints.slice(1).map((point,index) => [point[0]-roofPoints[index][0], point[1]-roofPoints[index][1]]), roofPoints[0][0], roofPoints[0][1], [1,1], 'FD', true);

  const elementCodes: Record<GarageElement['type'], string> = {
    gate: 'BR', door: 'D', window: 'O', 'pvc-window': 'OP', skylight: 'S',
  };

  config.elements.forEach((element, index) => {
    if (element.wall !== wall) return;
    const leftCm = Math.max(0, Math.min(wallWidthCm - element.width, wallWidthCm / 2 + element.x - element.width / 2));
    const bottomCm = Math.max(0, element.y);
    const boundedHeightCm = Math.max(0, Math.min(element.height, config.height - bottomCm));
    if (boundedHeightCm === 0) return;
    const elementX = garageX + leftCm * scale;
    const elementY = y + wallHeight - (bottomCm + boundedHeightCm) * scale;
    const elementWidth = Math.min(element.width, wallWidthCm) * scale;
    const elementHeight = boundedHeightCm * scale;
    const code = elementCodes[element.type];

    if (element.type === 'gate') doc.setFillColor(255, 237, 213);
    else if (element.type === 'door') doc.setFillColor(254, 249, 195);
    else doc.setFillColor(219, 234, 254);
    doc.setDrawColor(194, 65, 12);
    doc.setLineWidth(0.4);
    doc.rect(elementX, elementY, elementWidth, elementHeight, 'FD');
    doc.setTextColor(55, 55, 55);
    doc.setFont(PDF_FONT, 'bold');
    // Numer łączy otwór z tabelą; małe okna nie dostają nachodzących na siebie opisów.
    const symbol = `${code}${index + 1}`;
    if (elementWidth >= 12 && elementHeight >= 8) {
      doc.setFontSize(6.2);
      doc.text([symbol, `${element.width} x ${element.height}`], elementX + elementWidth / 2, elementY + elementHeight / 2 - 0.7, { align: 'center', lineHeightFactor: 1.3 });
    } else if (elementWidth >= 4 && elementHeight >= 3) {
      doc.setFontSize(5.2);
      doc.text(symbol, elementX + elementWidth / 2, elementY + elementHeight / 2 + 0.6, { align: 'center' });
    }
  });

  doc.setTextColor(30, 30, 30);
  doc.setDrawColor(PDF_MUTED);
  doc.setLineWidth(0.2);
  doc.line(x, y + wallHeight + 5, x + width, y + wallHeight + 5);
  doc.line(x, y + wallHeight + 3, x, y + wallHeight + 7);
  doc.line(x + width, y + wallHeight + 3, x + width, y + wallHeight + 7);
  // H min ends at the lower eaves datum, even on a taller wall.
  if (Math.abs(roofBaseYAt(x) - y) > 0.1 || Math.abs(roofBaseYAt(x + width) - y) > 0.1) {
    doc.setLineDashPattern([1,1],0); doc.line(x,y,x+width,y); doc.setLineDashPattern([],0);
  }
  doc.line(x - 5, y, x - 5, y + wallHeight);
  doc.line(x - 7, y, x - 3, y);
  doc.line(x - 7, y + wallHeight, x - 3, y + wallHeight);
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  doc.text(`${drawingWidthCm} cm`, x + width / 2, y + wallHeight + 10, { align: 'center' });
  if (carportWidthCm > 0) {
    doc.setFontSize(5.8);
    doc.text(`Garaż ${wallWidthCm} cm + wiata ${carportWidthCm} cm`, x + width / 2, y + wallHeight + 14, { align: 'center' });
  }
  doc.text(`H min ${config.height} cm`, x - 8, y + wallHeight / 2, { angle: 90, align: 'center' });
}

function drawCarportTechnicalPage(doc: import('jspdf').jsPDF, config: GarageConfig) {
  const carportWidth = getCarportWidthCm(config);
  const carportSide: WallFace = config.carportSide === 'left' ? 'left' : 'right';
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(PDF_MUTED);
  doc.text(getPdfCarports(config).map(item => (item.side === 'left' ? 'Wiata lewa: ' : 'Wiata prawa: ') + item.width + ' cm').join('; ') + '. Konstrukcja oznaczona linią przerywaną.', 16, 55, { maxWidth: 178 });
  drawPdfCard(doc, 16, 65, 178, 110, '#f8fafc');
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_INK);
  doc.text('Rzut z góry - garaż z wiatą', 22, 76);
  const scale = Math.min(142 / (config.width + carportWidth), 65 / config.length);
  drawDimensionPlan(doc, config, 105 - (config.width + carportWidth) * scale / 2, 88, 142, 65);
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(PDF_MUTED);
  doc.text('Widoki uzupełniają rysunki wszystkich czterech elewacji.', 16, 184);
  drawPdfCard(doc, 16, 191, 85, 81);
  drawPdfCard(doc, 109, 191, 85, 81);
  drawElevationPlan(doc, config, 'front', 'Front z wiatą', 27, 220, 66, 29);
  drawElevationPlan(doc, config, carportSide, `Strona wiaty - ${faceNames[carportSide].toLowerCase()}`, 120, 220, 66, 29);
}

function drawTechnicalLegend(doc: import('jspdf').jsPDF, y: number, includeOffsets = false) {
  const items = [
    ['BR', 'Brama'],
    ['D', 'Drzwi'],
    ['O', 'Okno'],
    ['OP', 'Okno PCV'],
    ['S', 'Świetlik'],
  ];
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(16, y, 178, includeOffsets ? 31 : 27, 2, 2, 'FD');
  doc.setFont(PDF_FONT, 'bold');
  doc.setTextColor(39, 39, 42);
  doc.setFontSize(8);
  doc.text('Legenda rysunków', 22, y + 7);

  items.forEach(([code, label], index) => {
    const itemX = 22 + index * 33.5;
    doc.setFillColor(234, 88, 12);
    doc.rect(itemX, y + 11, 6, 2.2, 'F');
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(6.5);
    doc.text(code, itemX + 8, y + 13);
    doc.setFont(PDF_FONT, 'normal');
    doc.text(label, itemX + 8, y + 17);
  });

  if (includeOffsets) {
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(82, 82, 91);
    doc.text('L - od lewej krawędzi ściany   |   P - od posadzki', 22, y + 23);
  }
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(PDF_MUTED);
  doc.text('Numery przy symbolach odpowiadają LP. w tabeli elementów. Położenie i wymiary podano w tabeli.', 22, y + (includeOffsets ? 28 : 24));
  doc.setTextColor(30, 30, 30);
}

function drawSharedAssemblyElevation(doc: import('jspdf').jsPDF, config: GarageConfig, x: number,y: number,maxWidth: number,maxHeight: number) {
  const layout=getAssemblyLayout(config),profile=getSharedRoofProfile(config);
  if (!profile || !layout.second) return;
  const scale=Math.min(maxWidth/layout.width,maxHeight/(layout.height+40));
  const sx=(world: number)=>x+(world-profile.minX)*scale;
  const sy=(height: number)=>y+(layout.height+40-height)*scale;
  const bottom=sy(0),center=(profile.minX+profile.maxX)/2;
  doc.setDrawColor(PDF_INK);doc.setLineWidth(0.5);doc.setFillColor('#e2e8f0');
  for (const [unit,offset] of [[layout.first,layout.firstX],[layout.second,layout.secondX]] as const) {
    const sides = getCarportLayout(unit);
    for (const [from,to] of [[offset-unit.width/2-sides.left,offset-unit.width/2],[offset+unit.width/2,offset+unit.width/2+sides.right]]) {
      if (to <= from) continue;
      doc.setDrawColor(PDF_MUTED);doc.setLineWidth(0.5);doc.setLineDashPattern([2,1],0);
      doc.line(sx(from),bottom,sx(to),bottom);
      for (const world of [from,to]) doc.line(sx(world),sy(sharedRoofHeightAt(profile,world)),sx(world),bottom);
      doc.setLineDashPattern([],0);doc.setFont(PDF_FONT,'normal');doc.setFontSize(6.5);
      doc.text('WIATA',sx((from+to)/2),bottom+7,{align:'center'});
    }
    doc.setDrawColor(PDF_INK);doc.setLineWidth(0.5);doc.setFillColor('#e2e8f0');
    const left=offset-unit.width/2,right=offset+unit.width/2;
    const top=[left,...(config.roofType==='dual-slope' && center>left && center<right ? [center]:[]),right].map(world=>[sx(world),sy(sharedRoofHeightAt(profile,world))]);
    const points=[...top,[sx(right),bottom],[sx(left),bottom]];
    doc.lines(points.slice(1).map((point,index)=>[point[0]-points[index][0],point[1]-points[index][1]]),points[0][0],points[0][1],[1,1],'FD',true);
    for (const element of unit.elements.filter(element=>element.wall==='front')) {
      doc.setFillColor('#fff7ed');doc.setDrawColor('#ea580c');
      doc.rect(sx(offset+element.x-element.width/2),bottom-(element.y+element.height)*scale,element.width*scale,element.height*scale,'FD');
    }
  }
  if(config.assembly?.middleType === 'recess') {
    const left=layout.middleX-layout.gap/2,right=layout.middleX+layout.gap/2;
    const top=[left,...(config.roofType==='dual-slope' && center>left && center<right ? [center] : []),right].map(world=>[sx(world),sy(sharedRoofHeightAt(profile,world))]);
    const points=[...top,[sx(right),sy(layout.height-10)],[sx(left),sy(layout.height-10)]];
    doc.setDrawColor(PDF_INK);doc.setFillColor('#e2e8f0');doc.lines(points.slice(1).map((point,index)=>[point[0]-points[index][0],point[1]-points[index][1]]),points[0][0],points[0][1],[1,1],'FD',true);
  }
  doc.setDrawColor(PDF_INK);doc.setLineWidth(1.3);
  const roof=[profile.minX,...(config.roofType==='dual-slope' ? [center]:[]),profile.maxX];
  roof.slice(1).forEach((world,index)=>doc.line(sx(roof[index]),sy(sharedRoofHeightAt(profile,roof[index])),sx(world),sy(sharedRoofHeightAt(profile,world))));
  doc.setLineWidth(0.8);
  for (const world of [layout.middleX-layout.gap/2,layout.middleX+layout.gap/2]) doc.line(sx(world),sy(sharedRoofHeightAt(profile,world)),sx(world),bottom);
  doc.setFont(PDF_FONT,'normal');doc.setFontSize(8);doc.setTextColor(PDF_INK);
  doc.text('GARAŻ 1',sx(layout.firstX),bottom+7,{align:'center'});doc.text(config.assembly?.middleType === 'recess' ? 'WNĘKA' : 'WIATA',sx(layout.middleX),bottom+7,{align:'center'});doc.text('GARAŻ 2',sx(layout.secondX),bottom+7,{align:'center'});
  doc.text('Wspólna szerokość dachu: '+layout.width+' cm',x,bottom+17);
  const datum = sy(layout.height);
  doc.setLineWidth(0.2);doc.setDrawColor(PDF_MUTED);
  doc.line(x-5,datum,x-5,bottom);doc.line(x-7,datum,x-3,datum);doc.line(x-7,bottom,x-3,bottom);
  doc.text('H min '+layout.height+' cm',x-8,(datum+bottom)/2,{angle:90,align:'center'});
  doc.setLineDashPattern([1,1],0);doc.line(x,datum,x+layout.width*scale,datum);doc.setLineDashPattern([],0);
  doc.line(x,bottom+12,x+layout.width*scale,bottom+12);doc.line(x,bottom+10,x,bottom+14);doc.line(x+layout.width*scale,bottom+10,x+layout.width*scale,bottom+14);
  doc.setFontSize(7.5);doc.text(doc.splitTextToSize(PDF_ROOF_HEIGHT_NOTICE,maxWidth),x,bottom+25);
}

export async function generateOfferPdf(input: OfferPdfInput) {
  const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  await loadOfferFonts(doc);
  const config = input.config;
  const currency = input.currency || 'PLN';
  const createdAt = new Date();
  const validUntil = new Date(createdAt);
  validUntil.setDate(validUntil.getDate() + input.customer.validDays);
  const formatDate = (date: Date) => date.toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' });
  const brand = input.customer.brand === 'staleuro' ? 'STAL EURO' : 'GARDHOUSE';
  const accent = input.customer.brand === 'staleuro' ? '#dc2626' : '#ea580c';
  const layout = createOfferLayout(doc, brand, input.offerNumber, accent);
  const carportWidth = getCarportWidthCm(config);
  const color = (id: string) => safeText(input.colorLabels[id] || id, 180);
  const orderedWalls: WallFace[] = ['front', 'right', 'back', 'left'];
  const availableViews = orderedWalls.filter(wall => Boolean(input.views[wall]));
  const price = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(input.estimatedPrice) + (currency === 'PLN' ? ' zł' : ` ${safeText(currency, 8)}`);
  doc.setProperties({
    title: `${brand} - oferta ${safeText(input.offerNumber, 60)}`,
    subject: 'Indywidualna konfiguracja garażu, rysunki i wizualizacje',
    author: brand, creator: 'Konfigurator garaży',
  });

  // Strona otwierająca: czytelne dane klienta, jedna cena i wizualizacja bez rozciągania.
  layout.header(config.assembly ? (config.assembly.middleType === 'recess' ? 'Dwa garaże z wnęką' : 'Dwa garaże z wiatą') : carportWidth > 0 ? 'Oferta na garaż z wiatą' : 'Oferta na garaż');
  layout.font(8.5, false, PDF_MUTED);
  doc.text(`Data przygotowania: ${formatDate(createdAt)}`, 16, 56);
  doc.text(`Ważna do: ${formatDate(validUntil)}`, 194, 56, { align: 'right' });
  const customerBlocks = [
    { value: input.customer.name || 'Nie podano danych klienta', size: 10.5, bold: true, limit: 120 },
    { value: input.customer.company, size: 9, bold: false, limit: 120 },
    { value: input.customer.email, size: 9, bold: false, limit: 160 },
    { value: input.customer.phone, size: 9, bold: false, limit: 40 },
    { value: input.customer.address, size: 9, bold: false, limit: 240 },
  ].filter(block => block.value).map(block => {
    layout.font(block.size, block.bold);
    return { ...block, lines: doc.splitTextToSize(safeText(block.value, block.limit), 84) as string[] };
  });
  const customerHeight = Math.max(60, 23 + customerBlocks.reduce((height, block) => height + block.lines.length * 4.2 + 1.8, 0));
  drawPdfCard(doc, 16, 65, 100, customerHeight);
  layout.font(7.5, true, PDF_MUTED);
  doc.text('PRZYGOTOWANO DLA', 24, 76);
  let customerY = 85;
  customerBlocks.forEach(block => {
    layout.font(block.size, block.bold);
    doc.text(block.lines, 24, customerY, { lineHeightFactor: 1.3 });
    customerY += block.lines.length * 4.2 + 1.8;
  });
  drawPdfCard(doc, 124, 65, 70, customerHeight, PDF_INK);
  doc.setFillColor(accent);
  doc.roundedRect(132, 73, 16, 1.2, 0.5, 0.5, 'F');
  layout.font(9, true, '#ffffff');
  doc.text(input.priceVerified ? 'Cena oferty' : 'Cena orientacyjna', 132, 84);
  let priceSize = 23;
  layout.font(priceSize, true, '#ffffff');
  while (doc.getTextWidth(price) > 54 && priceSize > 11) layout.font(--priceSize, true, '#ffffff');
  doc.text(price, 132, 98);
  layout.font(7.5, false, '#cbd5e1');
  doc.text(input.priceSource === 'manual' ? 'Cena ustalona indywidualnie przez sprzedawcę.' : input.priceVerified ? 'Obliczona według aktualnego cennika.' : 'Do potwierdzenia przez sprzedawcę.', 132, 109, { maxWidth: 54, lineHeightFactor: 1.4 });

  const heroY = 65 + customerHeight + 9;
  const hero = input.views.front || input.views[availableViews[0]];
  const heroHeight = hero ? Math.max(32, Math.min(86, 231 - heroY)) : 47;
  drawPdfCard(doc, 16, heroY, 178, heroHeight, '#f8fafc');
  if (hero) {
    drawPdfImage(doc, hero, 20, heroY + 3, 170, heroHeight - 13);
    layout.font(7, false, PDF_MUTED);
    doc.text('Wizualizacja konfiguracji przypisanej do tej oferty', 23, heroY + heroHeight - 4);
  } else {
    layout.font(11, true);
    doc.text('Konfiguracja indywidualna', 24, heroY + 12);
    layout.font(9, false, PDF_MUTED);
    doc.text(`Dach ${roofNames[config.roofType] || config.roofType}\nŚciany: ${config.buildingMaterial === 'pir' ? materialLabel(config) : profileLabel(config.wallProfile)} / ${color(config.wallColor)}`, 24, heroY + 22, { maxWidth: 158, lineHeightFactor: 1.45 });
  }
  const metricY = heroY + heroHeight + 7;
  const metrics = [['SZEROKOŚĆ UKŁADU', getAssemblyLayout(config).width], ['DŁUGOŚĆ', getAssemblyLayout(config).length], ['WYSOKOŚĆ NIŻSZEJ ŚCIANY', getAssemblyLayout(config).height]] as const;
  metrics.forEach(([label, value], index) => {
    const x = 16 + index * 61;
    drawPdfCard(doc, x, metricY, 56, 24);
    layout.font(7, true, PDF_MUTED);
    doc.text(label, x + 6, metricY + 8);
    layout.font(16, true);
    doc.text(`${(value / 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} m`, x + 6, metricY + 18);
  });
  if (metricY + 31 < PDF_BOTTOM) {
    layout.font(7, false, PDF_MUTED);
    doc.text(doc.splitTextToSize(PDF_ROOF_HEIGHT_NOTICE,178), 16, metricY + 31);
  }

  const assembly = getAssemblyLayout(config);
  const sharedRoof = getSharedRoofProfile(config);
  if (assembly.second) {
    layout.page(config.assembly?.middleType === 'recess' ? 'Układ dwóch garaży i wnęki' : 'Układ dwóch garaży i wiaty');
    const scale = Math.min(150 / assembly.width, 108 / (assembly.length + assembly.frontProjection));
    const origin = 105 - assembly.width * scale / 2;
    const leftEdge = assembly.centerX - assembly.width / 2;
    doc.setLineWidth(0.5);
    for (const [index, unit, unitX] of [[1, assembly.first, assembly.firstX], [2, assembly.second, assembly.secondX]] as const) {
      const x = origin + (unitX - unit.width/2 - leftEdge) * scale;
      const y = 82 + (assembly.length-unit.length)*scale;
      doc.setDrawColor(PDF_INK);doc.setFillColor('#e2e8f0');doc.rect(x,y,unit.width*scale,unit.length*scale,'FD');
      layout.font(8,true);doc.text('GARAŻ ' + index,x+unit.width*scale/2,y+unit.length*scale/2,{align:'center'});
      const side = index === 1 ? 'left' : 'right';
      const outer = getCarportLayout(unit)[side];
      if (outer) {doc.setFillColor('#f1f5f9');doc.rect(index===1 ? x-outer*scale : x+unit.width*scale,y,outer*scale,unit.length*scale,'FD');}
      if (getFrontCanopy(unit)) {doc.setLineDashPattern([2,1],0);doc.rect(x,82+assembly.length*scale,unit.width*scale,getFrontCanopy(unit)*scale);doc.setLineDashPattern([],0);}
    }
    const middleX=origin+(assembly.middleX-assembly.gap/2-leftEdge)*scale;
    doc.setFillColor('#fff7ed');doc.setDrawColor('#ea580c');doc.rect(middleX,82+(assembly.length-assembly.middleLength)*scale,assembly.gap*scale,assembly.middleLength*scale,'FD');
    if (config.assembly?.middleType === 'recess') {doc.setDrawColor(PDF_INK);doc.setLineWidth(1.2);doc.line(middleX,82+(assembly.length-assembly.middleLength)*scale,middleX+assembly.gap*scale,82+(assembly.length-assembly.middleLength)*scale);}
    layout.font(8,true);doc.text(config.assembly?.middleType === 'recess' ? 'WNĘKA' : 'WIATA',middleX+assembly.gap*scale/2,82+(assembly.length-assembly.middleLength/2)*scale,{align:'center'});
    layout.font(10,true);doc.text('Szerokość całego układu: ' + assembly.width + ' cm',16,64);
    doc.text('PRZÓD / WJAZD',105,82+(assembly.length+assembly.frontProjection)*scale+10,{align:'center'});
    if (sharedRoof) {doc.setDrawColor(PDF_INK);doc.setLineDashPattern([3,1],0);doc.rect(origin,82,assembly.width*scale,(assembly.length+assembly.frontProjection)*scale);doc.setLineDashPattern([],0);}
    layout.table(['ELEMENT','WYMIARY'],[
      ['Garaż 1 (szer. x dł. x H min)',assembly.first.width+' × '+assembly.first.length+' × '+assembly.first.height+' cm'],
      ['Garaż 2 (szer. x dł. x H min)',assembly.second.width+' × '+assembly.second.length+' × '+assembly.second.height+' cm'],
      [config.assembly?.middleType === 'recess' ? 'Wnęka środkowa (pełna ściana tylna)' : 'Wiata środkowa',assembly.gap+' × '+assembly.middleLength+' cm / dach: '+(roofNames[assembly.first.roofType] || assembly.first.roofType)+''],
      ['Wypusty PIR','Garaż 1: '+getFrontCanopy(assembly.first)+' cm / Garaż 2: '+getFrontCanopy(assembly.second)+' cm'],
    ],[55,123],218,'Układ - ciąg dalszy');
  }
  if (sharedRoof) {
    layout.page('Jeden dach nad całym układem');
    layout.font(9,false,PDF_MUTED);doc.text(config.assembly?.middleType === 'recess' ? 'Wspólny dach nad garażami i wnęką z pełną ścianą tylną.' : 'Wspólna kalenica lub jedna połać nad garażami i wiatą.',16,55);
    drawPdfCard(doc,16,68,178,155,'#f8fafc');
    drawSharedAssemblyElevation(doc,input.config,28,98,154,80);
  }
  for (const [unitIndex, config] of (assembly.second ? [assembly.first,assembly.second] : [assembly.first]).entries()) {
  const carportWidth = getCarportWidthCm(config);
  const unitLabel = assembly.second ? ' · Garaż ' + (unitIndex+1) : '';
  // Specyfikacja i otwory nie mają sztywnej wysokości: tabela przechodzi na kolejną stronę.
  layout.page('Specyfikacja i wyposażenie' + unitLabel);
  layout.font(9, false, PDF_MUTED);
  doc.text('Zakres konfiguracji stanowiący podstawę tej oferty.', 16, 55);
  const builtInOptions = new Set(['roofTile', 'cornerFlashings', 'roofFlashings']);
  const extraOptions = (config.extraOptions || []).filter(id => !builtInOptions.has(id))
    .map(id => input.optionLabels?.[id] || id);
  const carportDetails = getPdfCarports(config).map(item => {
    const walls = (['front','back','side'] as const).filter(face => item.walls[face])
      .map(face => face === 'front' ? 'przód' : face === 'back' ? 'tył' : 'bok').join(', ');
    return `${item.side === 'left' ? 'Lewa' : 'Prawa'}: ${item.width} cm / słupy: ${color(item.postColor)}\nZabudowa: ${walls || 'bez zabudowy'}`;
  }).join('\n');
  const details = [
    ['Wymiary garażu', `${config.width} x ${config.length} x ${config.height} cm (szer. x dł. x wysokość niższej ściany)`],
    ['Wysokość szczytu / wyższej ściany', 'Do ustalenia po konsultacji z projektantem. Dach w podglądzie jest orientacyjny.'],
    ['Materiał ścian i dachu', materialLabel(config)],
    ['Profil wzmocniony 60×40',config.buildingMaterial === 'pir' ? 'W cenie PIR' : 'Według wybranych opcji'],
    ['Wypust przed garażem', getFrontCanopy(config) ? `${getFrontCanopy(config)} cm / w cenie PIR / ściany boczne: ${config.frontCanopyWalls !== false ? 'tak' : 'nie'}` : 'Nie'],
    ['Typ dachu', (roofNames[config.roofType] || config.roofType)+(sharedRoof ? ' / wspólny dla całego układu' : '')],
    ['Pokrycie dachu', config.buildingMaterial === 'pir' ? `${materialLabel(config)} / ${profileLabel('pionowe-t7')}` : config.extraOptions?.includes('roofTile') ? 'Blachodachówka' : `Blacha trapezowa / ${profileLabel('pionowe-t7')}`],
    ['Ściany', `${config.buildingMaterial === 'pir' ? materialLabel(config) : profileLabel(config.wallProfile)}\nKolor: ${color(config.wallColor)}`],
    ['Dach - kolor', color(config.roofColor)],
    ['Bramy - wykończenie', `${profileLabel(config.gateProfile)}\nKolor: ${color(config.gateColor)}`],
    ['Drzwi / okna - kolory', `Drzwi: ${color(config.doorColor)}\nOkna: ${color(config.windowColor)}`],
    ['Rynny i rury spustowe', config.buildingMaterial === 'pir' ? `Tak, w cenie PIR / ${color(config.gutterColor)}` : config.gutters ? `Tak / ${color(config.gutterColor)}` : 'Nie'],
    ['Obróbki narożne', config.extraOptions?.includes('cornerFlashings') ? `Tak / ${color(config.cornerFlashingColor)}` : 'Nie'],
    ['Obróbki dachu', config.extraOptions?.includes('roofFlashings') ? `Tak / ${color(config.roofFlashingColor)}` : 'Nie'],
    ['Wiaty zintegrowane', carportWidth > 0 ? carportDetails : 'Nie'],
    ['Usunięcie folii ochronnej', config.removeFoil ? 'Tak' : 'Nie'],
    ['Opcje dodatkowe', extraOptions.length ? extraOptions.join(', ') : 'Brak dodatkowych opcji'],
  ];
  let specY = layout.table(['PARAMETR', 'WYBRANY WARIANT'], details, [55, 123], 63, 'Specyfikacja - ciąg dalszy') + 12;
  if (specY + 33 > PDF_BOTTOM) { layout.page('Bramy, drzwi i okna' + unitLabel); specY = 59; }
  specY = layout.section('Bramy, drzwi, okna i świetliki', specY);
  if (config.elements.length) {
    const rows = config.elements.map((element, index) => {
      const width = element.wall === 'front' || element.wall === 'back' ? config.width : config.length;
      const left = Math.max(0, Math.min(width - element.width, width / 2 + element.x - element.width / 2));
      return [String(index + 1).padStart(2, '0'), elementDescription(element) + (config.buildingMaterial === 'pir' && element === config.elements.find(item => item.type === 'gate') ? ' / W cenie PIR' : ''), faceNames[element.wall],
        `${element.width} x ${element.height} cm`, `L: ${Math.round(left)} cm\nP: ${Math.round(element.y)} cm`];
    });
    specY = layout.table(['LP.', 'ELEMENT / WARIANT', 'ŚCIANA', 'SZER. x WYS.', 'POŁOŻENIE'], rows, [12, 60, 23, 38, 45], specY, 'Elementy - ciąg dalszy' + unitLabel);
    if (specY + 8 <= PDF_BOTTOM) {
      layout.font(7.5, false, PDF_MUTED);
      doc.text('L - od lewej krawędzi ściany; P - od posadzki. Szczegóły pokazano na rysunkach.', 16, specY + 7);
    }
  } else {
    layout.font(9, false, PDF_MUTED);
    doc.text('Nie wybrano bram, drzwi, okien ani świetlików.', 16, specY + 4);
  }

  layout.page('Rzut z góry' + unitLabel);
  layout.font(9, false, PDF_MUTED);
  doc.text('Rozmieszczenie otworów oraz podstawowe wymiary w centymetrach.', 16, 55);
  drawPdfCard(doc, 16, 66, 178, 126, '#f8fafc');
  const planScale = Math.min(142 / (config.width + carportWidth), 78 / (config.length+getFrontCanopy(config)));
  drawDimensionPlan(doc, config, 105 - (config.width + carportWidth) * planScale / 2, 89, 142, 78);
  layout.font(8, true, PDF_MUTED);
  doc.text('PRZÓD GARAŻU', 105, 89 + config.length * planScale + 17, { align: 'center' });
  drawTechnicalLegend(doc, 202);
  layout.font(10, true);
  doc.text(`Wysokość niższej ściany do okapu (H min): ${config.height} cm`, 16, 240);
  layout.font(9, false, PDF_MUTED);
  doc.text(carportWidth > 0 ? `Łączna szerokość garażu z wiatą: ${config.width + carportWidth} cm.` : `Powierzchnia garażu: ${(config.width * config.length / 10000).toLocaleString('pl-PL')} m².`, 16, 250);
  layout.font(7.5, false, PDF_MUTED);
  doc.text(doc.splitTextToSize(PDF_ROOF_HEIGHT_NOTICE,178), 16, 264);

  layout.page('Cztery elewacje' + unitLabel);
  layout.font(9, false, PDF_MUTED);
  doc.text('Położenie bram, drzwi, okien i świetlików dla każdej ściany.', 16, 55);
  [[16, 65, 85, 80], [109, 65, 85, 80], [16, 151, 85, 76], [109, 151, 85, 76]].forEach(([x, y, w, h]) => drawPdfCard(doc, x, y, w, h));
  drawElevationPlan(doc, config, 'front', 'Elewacja frontowa', 27, 93, 66, 38,sharedRoof,unitIndex===0 ? assembly.firstX : assembly.secondX);
  drawElevationPlan(doc, config, 'right', 'Elewacja prawa', 120, 93, 66, 38,sharedRoof,unitIndex===0 ? assembly.firstX : assembly.secondX);
  drawElevationPlan(doc, config, 'back', 'Elewacja tylna', 27, 180, 66, 38,sharedRoof,unitIndex===0 ? assembly.firstX : assembly.secondX);
  drawElevationPlan(doc, config, 'left', 'Elewacja lewa', 120, 180, 66, 38,sharedRoof,unitIndex===0 ? assembly.firstX : assembly.secondX);
  drawTechnicalLegend(doc, 232, true);
  layout.font(6.8,false,PDF_MUTED);doc.text(doc.splitTextToSize(PDF_ROOF_HEIGHT_NOTICE,178),16,267);

  if (getFrontCanopy(config)) {
    layout.page('Wypust dachu PIR' + unitLabel);
    layout.font(10,true);doc.text('Wysunięcie przed ścianą frontową: '+getFrontCanopy(config)+' cm',16,62);
    const scale = Math.min(142/(config.length+getFrontCanopy(config)),68/(config.height+40));
    const x=27,y=91, wallLength=config.length*scale, wallHeight=config.height*scale, projection=getFrontCanopy(config)*scale;
    doc.setDrawColor(PDF_INK);doc.setLineWidth(0.6);doc.rect(x,y,wallLength,wallHeight);
    if (config.frontCanopyWalls !== false) {doc.setFillColor('#fff7ed');doc.rect(x+wallLength,y,projection,wallHeight,'FD');}
    doc.setLineWidth(1.5);doc.line(x,y,x+wallLength+projection,y);
    doc.setLineWidth(0.2);doc.line(x+wallLength,y-8,x+wallLength+projection,y-8);
    layout.font(8,true);doc.text(getFrontCanopy(config)+' cm',x+wallLength+projection/2,y-11,{align:'center'});
    layout.font(9);doc.text('Ściana frontowa / brama',x+wallLength,y+wallHeight+8,{align:'right'});
    layout.table(['PARAMETR','USTALENIE'],[
      ['Długość garażu',config.length+' cm'],['Wypust PIR',getFrontCanopy(config)+' cm'],
      ['Długość wraz z wypustem',(config.length+getFrontCanopy(config))+' cm (bez standardowych okapów)'],
      ['Ściany boczne',config.frontCanopyWalls !== false ? 'Tak' : 'Nie'],['Dopłata','0 zł - w cenie PIR'],
    ],[55,123],192,'Wypust - ciąg dalszy');
    layout.font(8,false,PDF_MUTED);doc.text('Schemat wysunięcia dachu. Konstrukcja i wymiary produkcyjne do zatwierdzenia.',16,264);
  }
  if (carportWidth > 0) {
    layout.page('Wiata zintegrowana' + unitLabel);
    drawCarportTechnicalPage(doc, config);
  }

  }

  for (let index = 0; index < availableViews.length; index += 2) {
    layout.page('Wizualizacje Twojego garażu');
    layout.font(9, false, PDF_MUTED);
    doc.text('Widoki tej samej konfiguracji. Kolory mają charakter poglądowy.', 16, 55);
    availableViews.slice(index, index + 2).forEach((wall, localIndex) => {
      const top = localIndex === 0 ? 65 : 170;
      drawPdfCard(doc, 16, top, 178, 96, '#f8fafc');
      layout.font(9.5, true);
      doc.text(wallNames[wall], 22, top + 9);
      drawPdfImage(doc, input.views[wall]!, 20, top + 14, 170, 78);
    });
  }

  layout.page('Uwagi i model AR');
  layout.font(9, false, PDF_MUTED);
  doc.text('Dodatkowe ustalenia i dostęp do modelu przypisanego do oferty.', 16, 55);
  let arUrl = '';
  try {
    const url = new URL(input.customer.arUrl);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) arUrl = url.href;
  } catch { /* Brak poprawnego adresu - nie tworzymy aktywnego odnośnika. */ }
  const notesWidth = arUrl ? 104 : 162;
  layout.font(9.5);
  const notes: string[] = doc.splitTextToSize(safeText(input.customer.notes || 'Brak dodatkowych uwag.', 1200), notesWidth);
  const noteHeight = Math.max(49, Math.min(notes.length, 31) * 4.5 + 24);
  drawPdfCard(doc, 16, 65, arUrl ? 120 : 178, noteHeight);
  layout.font(11, true);
  doc.text('Uwagi do oferty', 24, 77);
  layout.font(9.5);
  doc.text(notes.slice(0, 31), 24, 88, { lineHeightFactor: 1.34 });
  if (arUrl) {
    const qrData = await QRCode.toDataURL(arUrl, { width: 440, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#202938', light: '#ffffff' } });
    drawPdfCard(doc, 144, 65, 50, 88);
    doc.addImage(qrData, 'PNG', 149, 70, 40, 40);
    layout.font(8.5, true);
    doc.text('TWÓJ MODEL AR', 169, 118, { align: 'center' });
    layout.font(7.5, false, PDF_MUTED);
    doc.text('Zeskanuj telefonem, aby\nzobaczyć model garażu.', 169, 125, { align: 'center', lineHeightFactor: 1.35 });
    doc.setFillColor(accent);
    doc.roundedRect(150, 137, 38, 8, 1.5, 1.5, 'F');
    layout.font(7.5, true, '#ffffff');
    doc.text('OTWÓRZ MODEL ONLINE', 169, 142.5, { align: 'center' });
    doc.link(150, 137, 38, 8, { url: arUrl });
  }
  let notesY = 65 + Math.max(noteHeight, arUrl ? 88 : 0) + 14;
  if (notes.length > 31) {
    layout.page('Uwagi - ciąg dalszy');
    notesY = 61;
    for (const line of notes.slice(31)) {
      if (notesY + 5 > PDF_BOTTOM) { layout.page('Uwagi - ciąg dalszy'); notesY = 61; }
      layout.font(9.5);
      doc.text(line, 16, notesY);
      notesY += 4.5;
    }
    notesY += 12;
  }
  if (notesY + 63 > PDF_BOTTOM) { layout.page('Ważne informacje'); notesY = 61; }
  drawPdfCard(doc, 16, notesY, 178, 63, '#f8fafc');
  layout.font(11, true);
  doc.text('Ważne informacje', 24, notesY + 12);
  const terms = [
    input.priceSource === 'manual' ? 'Ostateczna cena została ustalona indywidualnie przez sprzedawcę. Zakres oferty odpowiada konfiguracji opisanej w dokumencie.' : input.priceVerified
      ? 'Cena została obliczona według aktualnego cennika. Zakres oferty odpowiada konfiguracji opisanej w dokumencie.'
      : 'Cena ma charakter orientacyjny i wymaga potwierdzenia przez sprzedawcę.',
    'Kolory na ekranie i wydruku mogą różnić się od rzeczywistych. Odcień należy potwierdzić na próbniku.',
    'Zakres dostawy, montażu i przygotowania podłoża określa zatwierdzona umowa lub zamówienie.',
    'Rysunki mają charakter poglądowy. Wysokość szczytu lub wyższej ściany ustalimy po konsultacji z projektantem.',
  ];
  let termsY = notesY + 21;
  terms.forEach((term, index) => {
    layout.font(8, true, accent);
    doc.text(String(index + 1).padStart(2, '0'), 24, termsY);
    layout.font(8.5, false, PDF_MUTED);
    const lines: string[] = doc.splitTextToSize(term, 150);
    doc.text(lines, 35, termsY, { lineHeightFactor: 1.35 });
    termsY += lines.length * 4 + 3;
  });
  layout.footers();
  const safeNumber = safeText(input.offerNumber, 60).replace(/[^a-zA-Z0-9_-]+/g, '-');
  doc.save(`oferta-${safeNumber || Date.now()}.pdf`);
}

