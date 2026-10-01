import type { GarageConfig, GarageElement, WallFace } from '@/types';

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
  views: Partial<Record<WallFace, string>>;
  priceVerified?: boolean;
}

const wallNames: Record<WallFace, string> = {
  front: 'Widok z przodu',
  right: 'Widok z prawej strony',
  back: 'Widok z tylu',
  left: 'Widok z lewej strony',
};

const gateNames: Record<string, string> = {
  'up-and-over': 'uchylna',
  swing: 'dwuskrzydlowa',
  sectional: 'segmentowa',
};

const roofNames: Record<string, string> = {
  'dual-slope': 'dwuspadowy',
  'slope-front': 'spad w przod',
  'slope-back': 'spad w tyl',
  'slope-left': 'spad w lewo',
  'slope-right': 'spad w prawo',
};

const ascii = (value: string) => value
  .replace(/[ąćęłńóśźż]/g, char => ({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' }[char] || char))
  .replace(/[ĄĆĘŁŃÓŚŹŻ]/g, char => ({ Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' }[char] || char));

const safeText = (value: unknown, maxLength = 500) => ascii(String(value ?? '').trim().slice(0, maxLength));

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
  const dimensions = `${element.width} x ${element.height} cm`;
  if (element.type === 'gate') {
    return `Brama ${gateNames[element.gateType || 'up-and-over'] || element.gateType}: ${dimensions}, profil ${element.profile || 'wg konfiguracji'}`;
  }
  const labels: Record<string, string> = {
    door: 'Drzwi',
    window: 'Okno',
    'pvc-window': 'Okno PCV',
    skylight: 'Swietlik',
  };
  return `${labels[element.type] || element.type}: ${dimensions}`;
}

function drawDimensionPlan(doc: import('jspdf').jsPDF, config: GarageConfig, x: number, y: number, maxWidth: number) {
  const carportWidthCm = getCarportWidthCm(config);
  const totalWidthCm = config.width + carportWidthCm;
  const ratio = Math.min(maxWidth / totalWidthCm, 70 / config.length);
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('WIATA', carportX + carportWidth / 2, y + length / 2, { align: 'center', angle: 90 });
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
    doc.text(`Garaz ${config.width} cm`, garageX + garageWidth / 2, y + length + 8, { align: 'center' });
    doc.text(`Wiata ${carportWidthCm} cm`, carportX + carportWidth / 2, y + length + 8, { align: 'center' });
  }

  const markOpening = (element: GarageElement) => {
    const isHorizontalWall = element.wall === 'front' || element.wall === 'back';
    const wallSize = isHorizontalWall ? config.width : config.length;
    const start = Math.max(0, Math.min(wallSize, wallSize / 2 + element.x - element.width / 2));
    const end = Math.max(start, Math.min(wallSize, start + element.width));
    const code = element.type === 'gate' ? 'BR' : element.type === 'door' ? 'D' : element.type === 'pvc-window' ? 'OP' : element.type === 'window' ? 'O' : 'S';

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
  const roofRise = config.roofType === 'dual-slope' ? Math.min(16, width * 0.16) : Math.min(10, width * 0.1);
  const slopesAcrossThisWall = ((wall === 'front' || wall === 'back') && (config.roofType === 'slope-left' || config.roofType === 'slope-right'))
    || ((wall === 'left' || wall === 'right') && (config.roofType === 'slope-front' || config.roofType === 'slope-back'));
  const highOnLeft = (config.roofType === 'slope-right' && wall === 'front')
    || (config.roofType === 'slope-left' && wall === 'back')
    || (config.roofType === 'slope-front' && wall === 'left')
    || (config.roofType === 'slope-back' && wall === 'right');
  const visibleRoofRise = (config.roofType === 'dual-slope' && isFrontBack) || slopesAcrossThisWall ? roofRise : 1.5;
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
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
    doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'bold');
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
  if (config.roofType === 'dual-slope' && (wall === 'front' || wall === 'back')) {
    const ridgeX = x + width / 2;
    doc.lines([
      [ridgeX - roofLeft, -roofRise],
      [roofRight - ridgeX, roofRise],
      [0, -roofThickness],
      [ridgeX - roofRight, -roofRise],
      [roofLeft - ridgeX, roofRise],
      [0, roofThickness],
    ], roofLeft, y, [1, 1], 'FD', true);
  } else if (config.roofType === 'dual-slope') {
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

  config.elements.filter(element => element.wall === wall).forEach(element => {
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text(`${code} ${element.width}x${element.height}`, elementX + elementWidth / 2, elementY + Math.max(4, elementHeight / 2), { align: 'center', maxWidth: Math.max(9, elementWidth - 1) });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.text(`L:${Math.round(leftCm)} P:${Math.round(bottomCm)} cm`, elementX + elementWidth / 2, elementY + elementHeight + 3, { align: 'center' });
  });

  doc.setTextColor(30, 30, 30);
  doc.setLineWidth(0.2);
  doc.line(x, y + wallHeight + 5, x + width, y + wallHeight + 5);
  doc.line(x, y + wallHeight + 3, x, y + wallHeight + 7);
  doc.line(x + width, y + wallHeight + 3, x + width, y + wallHeight + 7);
  doc.line(x - 5, y, x - 5, y + wallHeight);
  doc.line(x - 7, y, x - 3, y);
  doc.line(x - 7, y + wallHeight, x - 3, y + wallHeight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${drawingWidthCm} cm`, x + width / 2, y + wallHeight + 10, { align: 'center' });
  if (carportWidth > 0) {
    doc.setFontSize(5.8);
    doc.text(`Garaz ${wallWidthCm} cm + wiata ${carportWidthCm} cm`, x + width / 2, y + wallHeight + 14, { align: 'center' });
  }
  doc.text(`${config.height} cm`, x - 8, y + wallHeight / 2, { angle: 90, align: 'center' });
}

function drawCarportTechnicalPage(doc: import('jspdf').jsPDF, config: GarageConfig) {
  const carportWidthCm = getCarportWidthCm(config);
  const carportSide: WallFace = config.carportSide === 'left' ? 'left' : 'right';
  const oppositeSide: WallFace = carportSide === 'left' ? 'right' : 'left';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(63, 63, 70);
  doc.text(
    `Wiata zintegrowana: ${carportWidthCm} cm, strona ${carportSide === 'left' ? 'lewa' : 'prawa'}. Linie niebieskie oznaczaja konstrukcje i slupy wiaty.`,
    14,
    32,
    { maxWidth: 182 },
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text('Rzut z gory - garaz z wiata', 14, 46);
  drawDimensionPlan(doc, config, 30, 56, 150);

  drawElevationPlan(doc, config, 'front', 'Elewacja frontowa z wiata', 24, 157, 162, 38);

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(37, 99, 235);
  doc.roundedRect(18, 222, 174, 64, 2, 2, 'FD');
  drawElevationPlan(doc, config, carportSide, `Widok od strony wiaty (${carportSide === 'left' ? 'lewa' : 'prawa'})`, 28, 247, 70, 28);
  drawElevationPlan(doc, config, oppositeSide, 'Widok od strony przeciwnej', 112, 247, 70, 28);
}

function drawTechnicalLegend(doc: import('jspdf').jsPDF, y: number, includeOffsets = false) {
  const items = [
    ['BR', 'Brama'],
    ['D', 'Drzwi'],
    ['O', 'Okno'],
    ['OP', 'Okno PCV'],
    ['S', 'Swietlik'],
  ];
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(14, y, 182, includeOffsets ? 28 : 23, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(39, 39, 42);
  doc.setFontSize(8);
  doc.text('Legenda rysunkow', 19, y + 7);

  items.forEach(([code, label], index) => {
    const itemX = 19 + index * 34.5;
    doc.setFillColor(234, 88, 12);
    doc.rect(itemX, y + 11, 6, 2.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(code, itemX + 8, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(label, itemX + 8, y + 17);
  });

  if (includeOffsets) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(82, 82, 91);
    doc.text('L - odleglosc od lewej krawedzi sciany   |   P - odleglosc od posadzki', 19, y + 24);
  }
  doc.setTextColor(30, 30, 30);
}

export async function generateOfferPdf(input: OfferPdfInput) {
  const [{ jsPDF }, QRCode] = await Promise.all([
    import('jspdf'),
    import('qrcode'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const currency = input.currency || 'PLN';
  const createdAt = new Date();
  const validUntil = new Date(createdAt);
  validUntil.setDate(validUntil.getDate() + input.customer.validDays);
  const offerBrand = input.customer.brand === 'staleuro' ? 'STAL EURO' : 'GARDHOUSE';

  const addHeader = (subtitle: string) => {
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(`${offerBrand} - OFERTA GARAZU`, 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(safeText(subtitle), 14, 18);
    doc.setTextColor(30, 30, 30);
  };

  addHeader(`Oferta nr ${safeText(input.offerNumber, 60)}`);
  doc.setFontSize(10);
  doc.text(`Data: ${createdAt.toLocaleDateString('pl-PL')}`, 14, 34);
  doc.text(`Wazna do: ${validUntil.toLocaleDateString('pl-PL')}`, 14, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Klient', 14, 51);
  doc.setFont('helvetica', 'normal');
  const customerLines = [
    input.customer.name,
    input.customer.company,
    input.customer.email,
    input.customer.phone,
    input.customer.address,
  ].map(value => safeText(value, 160)).filter(Boolean);
  doc.text(customerLines.length ? customerLines : ['Nie podano danych klienta'], 14, 58);

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(112, 34, 84, 34, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(input.priceVerified ? 'Cena potwierdzona' : 'Cena orientacyjna', 120, 45);
  doc.setFontSize(22);
  doc.text(`${input.estimatedPrice.toLocaleString('pl-PL')} ${currency}`, 120, 58);

  doc.setFontSize(13);
  doc.text('Konfiguracja', 14, 87);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const details = [
    `Wymiary: ${input.config.width} x ${input.config.length} x ${input.config.height} cm`,
    `Dach: ${roofNames[input.config.roofType] || input.config.roofType}`,
    `Profil scian: ${input.config.wallProfile}`,
    `Profil dachu: ${input.config.roofProfile}`,
    `Kolor scian: ${input.colorLabels[input.config.wallColor] || input.config.wallColor}`,
    `Kolor dachu: ${input.colorLabels[input.config.roofColor] || input.config.roofColor}`,
    `Kolor bramy: ${input.colorLabels[input.config.gateColor] || input.config.gateColor}`,
    `Rynny: ${input.config.gutters ? 'tak' : 'nie'}`,
    `Wiata zintegrowana: ${getCarportWidthCm(input.config) > 0 ? `${getCarportWidthCm(input.config)} cm, ${input.config.carportSide || 'prawa'}` : 'nie'}`,
    ...input.config.elements.map(elementDescription),
  ].map(line => safeText(line, 220));
  doc.text(details, 14, 95, { maxWidth: 182, lineHeightFactor: 1.35 });

  doc.addPage();
  addHeader('Rzut techniczny i podstawowe wymiary');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Rzut z gory', 14, 38);
  drawDimensionPlan(doc, input.config, 40, 54, 130);
  doc.setFontSize(10);
  doc.text(`Wysokosc scian: ${input.config.height} cm`, 14, 145);
  drawTechnicalLegend(doc, 151);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Rysunki maja charakter pogladowy. Wymiary produkcyjne wymagaja zatwierdzenia technicznego.', 14, 267);

  doc.addPage();
  addHeader('Rysunki techniczne - wszystkie cztery sciany');
  drawElevationPlan(doc, input.config, 'front', 'Elewacja frontowa', 17, 62, 78);
  drawElevationPlan(doc, input.config, 'right', 'Elewacja prawa', 112, 62, 78);
  drawElevationPlan(doc, input.config, 'back', 'Elewacja tylna', 17, 177, 78);
  drawElevationPlan(doc, input.config, 'left', 'Elewacja lewa', 112, 177, 78);
  drawTechnicalLegend(doc, 258, true);

  if (getCarportWidthCm(input.config) > 0) {
    doc.addPage();
    addHeader('Rysunki techniczne - wiata zintegrowana');
    drawCarportTechnicalPage(doc, input.config);
  }

  const orderedWalls: WallFace[] = ['front', 'right', 'back', 'left'];
  const availableViews = orderedWalls.filter(wall => Boolean(input.views[wall]));
  for (let index = 0; index < availableViews.length; index += 2) {
    doc.addPage();
    addHeader('Wizualizacje konfiguracji');
    availableViews.slice(index, index + 2).forEach((wall, localIndex) => {
      const image = input.views[wall];
      if (!image) return;
      const top = localIndex === 0 ? 38 : 158;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(wallNames[wall], 14, top);
      doc.addImage(image, 'JPEG', 14, top + 5, 182, 105, undefined, 'FAST');
    });
  }

  doc.addPage();
  addHeader('Podsumowanie oferty');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Uwagi', 14, 39);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(safeText(input.customer.notes || 'Brak dodatkowych uwag.', 1200), 14, 48, { maxWidth: 125 });

  if (input.customer.arUrl) {
    const qrData = await QRCode.toDataURL(input.customer.arUrl, { width: 520, margin: 1, errorCorrectionLevel: 'M' });
    doc.addImage(qrData, 'PNG', 148, 40, 45, 45);
    doc.setFontSize(8);
    doc.text('Model AR / konfiguracja', 170.5, 90, { align: 'center' });
  }

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, 212, 182, 42, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Wazne informacje', 21, 223);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text([
    input.priceVerified
      ? 'Cena zostala ponownie obliczona przez serwer WordPress na podstawie zapisanego cennika.'
      : 'Cena w tym dokumencie jest kalkulacja orientacyjna i powinna zostac potwierdzona przez sprzedawce.',
    'Kolory na ekranie moga roznic sie od rzeczywistych. Ostateczny odcien nalezy potwierdzic na probniku.',
    'Zakres dostawy, montazu i przygotowania podloza okresla zatwierdzona umowa lub zamowienie.',
  ], 21, 232, { maxWidth: 165, lineHeightFactor: 1.4 });

  const safeNumber = safeText(input.offerNumber, 60).replace(/[^a-zA-Z0-9_-]+/g, '-');
  doc.save(`oferta-${safeNumber || Date.now()}.pdf`);
}


