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
  return storedWidth || 300;
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
  const ratio = Math.min(maxWidth / totalWidthCm, maxHeight / config.length);
  const width = totalWidthCm * ratio;
  const garageWidth = config.width * ratio;
  const carportWidth = carportWidthCm * ratio;
  const length = config.length * ratio;
  const garageX = carportWidth > 0 && config.carportSide === 'left' ? x + carportWidth : x;
  const carportX = config.carportSide === 'left' ? x : garageX + garageWidth;

  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.7);
  doc.rect(garageX, y, garageWidth, length);
  if (carportWidth > 0) {
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
  if (carportWidth > 0) {
    doc.setFontSize(6.5);
    doc.text(`Garaż ${config.width} cm`, garageX + garageWidth / 2, y + length + 8, { align: 'center' });
    doc.text(`Wiata ${carportWidthCm} cm`, carportX + carportWidth / 2, y + length + 8, { align: 'center' });
  }

  const markOpening = (element: GarageElement, index: number) => {
    const isHorizontalWall = element.wall === 'front' || element.wall === 'back';
    const wallSize = isHorizontalWall ? config.width : config.length;
    const start = Math.max(0, Math.min(wallSize, wallSize / 2 + element.x - element.width / 2));
    const end = Math.max(start, Math.min(wallSize, start + element.width));
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
) {
  const isFrontBack = wall === 'front' || wall === 'back';
  const wallWidthCm = isFrontBack ? config.width : config.length;
  const integratedCarportWidthCm = getCarportWidthCm(config);
  const carportWidthCm = isFrontBack ? integratedCarportWidthCm : 0;
  const drawingWidthCm = wallWidthCm + carportWidthCm;
  const scale = Math.min(maxWidth / drawingWidthCm, maxHeight / config.height);
  const width = drawingWidthCm * scale;
  const garageWidth = wallWidthCm * scale;
  const carportWidth = carportWidthCm * scale;
  const garageX = carportWidth > 0 && config.carportSide === 'left' ? x + carportWidth : x;
  const carportX = config.carportSide === 'left' ? x : garageX + garageWidth;
  const wallHeight = config.height * scale;
  const isDualLeftRight = config.roofType === 'dual-slope';
  const isDualFrontBack = config.roofType === 'dual-slope-front-back';
  const isDual = isDualLeftRight || isDualFrontBack;
  const roofRise = isDual ? Math.min(16, width * 0.16) : Math.min(10, width * 0.1);
  const slopesAcrossThisWall = ((wall === 'front' || wall === 'back') && (config.roofType === 'slope-left' || config.roofType === 'slope-right'))
    || ((wall === 'left' || wall === 'right') && (config.roofType === 'slope-front' || config.roofType === 'slope-back'));
  const highOnLeft = (config.roofType === 'slope-right' && wall === 'front')
    || (config.roofType === 'slope-left' && wall === 'back')
    || (config.roofType === 'slope-front' && wall === 'left')
    || (config.roofType === 'slope-back' && wall === 'right');
  const showsDualGable = (isDualLeftRight && isFrontBack) || (isDualFrontBack && !isFrontBack);
  const visibleRoofRise = showsDualGable || slopesAcrossThisWall ? roofRise : 1.5;
  const roofBaseYAt = (pointX: number) => {
    if (!slopesAcrossThisWall || width <= 0) return y;
    const leftY = highOnLeft ? y - roofRise : y;
    const rightY = highOnLeft ? y : y - roofRise;
    return leftY + ((pointX - x) / width) * (rightY - leftY);
  };
  const drawWallOutline = (sectionX: number, sectionWidth: number, style?: string) => {
    if (!slopesAcrossThisWall) {
      doc.rect(sectionX, y, sectionWidth, wallHeight, style);
      return;
    }
    const leftY = roofBaseYAt(sectionX);
    const rightY = roofBaseYAt(sectionX + sectionWidth);
    const bottomY = y + wallHeight;
    doc.lines([
      [sectionWidth, rightY - leftY],
      [0, bottomY - rightY],
      [-sectionWidth, 0],
      [0, leftY - bottomY],
    ], sectionX, leftY, [1, 1], style, true);
  };

  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_INK);
  doc.text(title, x, y - visibleRoofRise - 6);
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.5);
  doc.setFillColor(255, 255, 255);
  drawWallOutline(garageX, garageWidth, 'FD');
  if (carportWidth > 0) {
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
  } else if (integratedCarportWidthCm > 0 && wall === config.carportSide) {
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
  const roofWidth = roofRight - roofLeft;
  if (showsDualGable) {
    const ridgeX = x + width / 2;
    doc.lines([
      [ridgeX - roofLeft, -roofRise],
      [roofRight - ridgeX, roofRise],
      [0, -roofThickness],
      [ridgeX - roofRight, -roofRise],
      [roofLeft - ridgeX, roofRise],
      [0, roofThickness],
    ], roofLeft, y, [1, 1], 'FD', true);
  } else if (isDual) {
    doc.rect(roofLeft, y - roofThickness, roofWidth, roofThickness, 'FD');
  } else {
    if (slopesAcrossThisWall) {
      const leftY = highOnLeft ? y - roofRise : y;
      const rightY = highOnLeft ? y : y - roofRise;
      doc.lines([
        [roofWidth, rightY - leftY],
        [0, -roofThickness],
        [-roofWidth, leftY - rightY],
        [0, roofThickness],
      ], roofLeft, leftY, [1, 1], 'FD', true);
    } else {
      doc.rect(roofLeft, y - roofThickness, roofWidth, roofThickness, 'FD');
    }
  }

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
  doc.line(x - 5, y, x - 5, y + wallHeight);
  doc.line(x - 7, y, x - 3, y);
  doc.line(x - 7, y + wallHeight, x - 3, y + wallHeight);
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  doc.text(`${drawingWidthCm} cm`, x + width / 2, y + wallHeight + 10, { align: 'center' });
  if (carportWidth > 0) {
    doc.setFontSize(5.8);
    doc.text(`Garaż ${wallWidthCm} cm + wiata ${carportWidthCm} cm`, x + width / 2, y + wallHeight + 14, { align: 'center' });
  }
  doc.text(`${config.height} cm`, x - 8, y + wallHeight / 2, { angle: 90, align: 'center' });
}

function drawCarportTechnicalPage(doc: import('jspdf').jsPDF, config: GarageConfig) {
  const carportWidth = getCarportWidthCm(config);
  const carportSide: WallFace = config.carportSide === 'left' ? 'left' : 'right';
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(PDF_MUTED);
  doc.text(`Wiata: ${carportWidth} cm, strona ${carportSide === 'left' ? 'lewa' : 'prawa'}. Konstrukcja wiaty oznaczona linią przerywaną.`, 16, 55, { maxWidth: 178 });
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
  layout.header(carportWidth > 0 ? 'Oferta na garaż z wiatą' : 'Oferta na garaż');
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
  doc.text(input.priceVerified ? 'Obliczona według aktualnego cennika.' : 'Do potwierdzenia przez sprzedawcę.', 132, 109, { maxWidth: 54, lineHeightFactor: 1.4 });

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
  const metrics = [['SZEROKOŚĆ GARAŻU', config.width], ['DŁUGOŚĆ', config.length], ['WYSOKOŚĆ ŚCIAN', config.height]] as const;
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
    doc.text('Szczegółowa specyfikacja, rysunki i model AR na kolejnych stronach.', 16, metricY + 31);
  }

  // Specyfikacja i otwory nie mają sztywnej wysokości: tabela przechodzi na kolejną stronę.
  layout.page('Specyfikacja i wyposażenie');
  layout.font(9, false, PDF_MUTED);
  doc.text('Zakres konfiguracji stanowiący podstawę tej oferty.', 16, 55);
  const builtInOptions = new Set(['roofTile', 'cornerFlashings', 'roofFlashings']);
  const extraOptions = (config.extraOptions || []).filter(id => !builtInOptions.has(id))
    .map(id => input.optionLabels?.[id] || id);
  const carportWalls = ['front', 'back', 'side'].filter(face => config.carportWalls?.[face as keyof NonNullable<GarageConfig['carportWalls']>] === true)
    .map(face => face === 'front' ? 'przód' : face === 'back' ? 'tył' : 'bok').join(', ');
  const details = [
    ['Wymiary garażu', `${config.width} x ${config.length} x ${config.height} cm (szer. x dł. x wys. ścian)`],
    ['Materiał ścian i dachu', materialLabel(config)],
    ['Typ dachu', roofNames[config.roofType] || config.roofType],
    ['Pokrycie dachu', config.buildingMaterial === 'pir' ? materialLabel(config) : config.extraOptions?.includes('roofTile') ? 'Blachodachówka' : `Blacha trapezowa / ${profileLabel(config.roofProfile)}`],
    ['Ściany', `${config.buildingMaterial === 'pir' ? materialLabel(config) : profileLabel(config.wallProfile)}\nKolor: ${color(config.wallColor)}`],
    ['Dach - kolor', color(config.roofColor)],
    ['Bramy - wykończenie', `${profileLabel(config.gateProfile)}\nKolor: ${color(config.gateColor)}`],
    ['Drzwi / okna - kolory', `Drzwi: ${color(config.doorColor)}\nOkna: ${color(config.windowColor)}`],
    ['Rynny i rury spustowe', config.gutters ? `Tak / ${color(config.gutterColor)}` : 'Nie'],
    ['Obróbki narożne', config.extraOptions?.includes('cornerFlashings') ? `Tak / ${color(config.cornerFlashingColor)}` : 'Nie'],
    ['Obróbki dachu', config.extraOptions?.includes('roofFlashings') ? `Tak / ${color(config.roofFlashingColor)}` : 'Nie'],
    ['Wiata zintegrowana', carportWidth > 0 ? `Szerokość ${carportWidth} cm / strona ${config.carportSide === 'left' ? 'lewa' : 'prawa'}\nZabudowa: ${carportWalls || 'bez zabudowy'}` : 'Nie'],
    ['Usunięcie folii ochronnej', config.removeFoil ? 'Tak' : 'Nie'],
    ['Opcje dodatkowe', extraOptions.length ? extraOptions.join(', ') : 'Brak dodatkowych opcji'],
  ];
  let specY = layout.table(['PARAMETR', 'WYBRANY WARIANT'], details, [55, 123], 63, 'Specyfikacja - ciąg dalszy') + 12;
  if (specY + 33 > PDF_BOTTOM) { layout.page('Bramy, drzwi i okna'); specY = 59; }
  specY = layout.section('Bramy, drzwi, okna i świetliki', specY);
  if (config.elements.length) {
    const rows = config.elements.map((element, index) => {
      const width = element.wall === 'front' || element.wall === 'back' ? config.width : config.length;
      const left = Math.max(0, Math.min(width - element.width, width / 2 + element.x - element.width / 2));
      return [String(index + 1).padStart(2, '0'), elementDescription(element), faceNames[element.wall],
        `${element.width} x ${element.height} cm`, `L: ${Math.round(left)} cm\nP: ${Math.round(element.y)} cm`];
    });
    specY = layout.table(['LP.', 'ELEMENT / WARIANT', 'ŚCIANA', 'SZER. x WYS.', 'POŁOŻENIE'], rows, [12, 60, 23, 38, 45], specY, 'Elementy - ciąg dalszy');
    if (specY + 8 <= PDF_BOTTOM) {
      layout.font(7.5, false, PDF_MUTED);
      doc.text('L - od lewej krawędzi ściany; P - od posadzki. Szczegóły pokazano na rysunkach.', 16, specY + 7);
    }
  } else {
    layout.font(9, false, PDF_MUTED);
    doc.text('Nie wybrano bram, drzwi, okien ani świetlików.', 16, specY + 4);
  }

  layout.page('Rzut z góry');
  layout.font(9, false, PDF_MUTED);
  doc.text('Rozmieszczenie otworów oraz podstawowe wymiary w centymetrach.', 16, 55);
  drawPdfCard(doc, 16, 66, 178, 126, '#f8fafc');
  const planScale = Math.min(142 / (config.width + carportWidth), 78 / config.length);
  drawDimensionPlan(doc, config, 105 - (config.width + carportWidth) * planScale / 2, 89, 142, 78);
  layout.font(8, true, PDF_MUTED);
  doc.text('PRZÓD GARAŻU', 105, 89 + config.length * planScale + 17, { align: 'center' });
  drawTechnicalLegend(doc, 202);
  layout.font(10, true);
  doc.text(`Wysokość ścian: ${config.height} cm`, 16, 240);
  layout.font(9, false, PDF_MUTED);
  doc.text(carportWidth > 0 ? `Łączna szerokość garażu z wiatą: ${config.width + carportWidth} cm.` : `Powierzchnia garażu: ${(config.width * config.length / 10000).toLocaleString('pl-PL')} m².`, 16, 250);
  layout.font(7.5, false, PDF_MUTED);
  doc.text('Rysunki poglądowe. Wymiary produkcyjne wymagają zatwierdzenia technicznego.', 16, 269);

  layout.page('Cztery elewacje');
  layout.font(9, false, PDF_MUTED);
  doc.text('Położenie bram, drzwi, okien i świetlików dla każdej ściany.', 16, 55);
  [[16, 65, 85, 87], [109, 65, 85, 87], [16, 158, 85, 84], [109, 158, 85, 84]].forEach(([x, y, w, h]) => drawPdfCard(doc, x, y, w, h));
  drawElevationPlan(doc, config, 'front', 'Elewacja frontowa', 27, 93, 66, 38);
  drawElevationPlan(doc, config, 'right', 'Elewacja prawa', 120, 93, 66, 38);
  drawElevationPlan(doc, config, 'back', 'Elewacja tylna', 27, 187, 66, 38);
  drawElevationPlan(doc, config, 'left', 'Elewacja lewa', 120, 187, 66, 38);
  drawTechnicalLegend(doc, 244, true);

  if (carportWidth > 0) {
    layout.page('Wiata zintegrowana');
    drawCarportTechnicalPage(doc, config);
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
    input.priceVerified
      ? 'Cena została obliczona według aktualnego cennika. Zakres oferty odpowiada konfiguracji opisanej w dokumencie.'
      : 'Cena ma charakter orientacyjny i wymaga potwierdzenia przez sprzedawcę.',
    'Kolory na ekranie i wydruku mogą różnić się od rzeczywistych. Odcień należy potwierdzić na próbniku.',
    'Zakres dostawy, montażu i przygotowania podłoża określa zatwierdzona umowa lub zamówienie.',
    'Rysunki mają charakter poglądowy i nie zastępują dokumentacji wykonawczej.',
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

