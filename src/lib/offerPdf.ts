import type { GarageConfig, GarageElement, WallFace } from '@/types';

export interface OfferCustomer {
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
  const ratio = Math.min(maxWidth / config.width, 70 / config.length);
  const width = config.width * ratio;
  const length = config.length * ratio;

  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.7);
  doc.rect(x, y, width, length);
  doc.setLineWidth(0.2);
  doc.line(x, y - 5, x + width, y - 5);
  doc.line(x, y - 7, x, y - 3);
  doc.line(x + width, y - 7, x + width, y - 3);
  doc.line(x - 5, y, x - 5, y + length);
  doc.line(x - 7, y, x - 3, y);
  doc.line(x - 7, y + length, x - 3, y + length);
  doc.setFontSize(9);
  doc.text(`${config.width} cm`, x + width / 2, y - 7, { align: 'center' });
  doc.text(`${config.length} cm`, x - 8, y + length / 2, { angle: 90, align: 'center' });
}

function drawElevationPlan(
  doc: import('jspdf').jsPDF,
  config: GarageConfig,
  widthCm: number,
  title: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const scale = Math.min(maxWidth / widthCm, 48 / config.height);
  const width = widthCm * scale;
  const wallHeight = config.height * scale;
  const roofRise = config.roofType === 'dual-slope' ? Math.min(16, width * 0.16) : Math.min(10, width * 0.1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, x, y - 7);
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.5);
  doc.rect(x, y, width, wallHeight);
  if (config.roofType === 'dual-slope') {
    doc.line(x, y, x + width / 2, y - roofRise);
    doc.line(x + width / 2, y - roofRise, x + width, y);
  } else {
    doc.line(x, y - roofRise, x + width, y);
    doc.line(x, y - roofRise, x, y);
  }
  doc.setLineWidth(0.2);
  doc.line(x, y + wallHeight + 5, x + width, y + wallHeight + 5);
  doc.line(x, y + wallHeight + 3, x, y + wallHeight + 7);
  doc.line(x + width, y + wallHeight + 3, x + width, y + wallHeight + 7);
  doc.line(x - 5, y, x - 5, y + wallHeight);
  doc.line(x - 7, y, x - 3, y);
  doc.line(x - 7, y + wallHeight, x - 3, y + wallHeight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${widthCm} cm`, x + width / 2, y + wallHeight + 10, { align: 'center' });
  doc.text(`${config.height} cm`, x - 8, y + wallHeight / 2, { angle: 90, align: 'center' });
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

  const addHeader = (subtitle: string) => {
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('STAL EURO - OFERTA GARAZU', 14, 11);
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
    `Wiata zintegrowana: ${input.config.hasCarport ? `${input.config.carportWidth || 0} cm, ${input.config.carportSide || 'prawa'}` : 'nie'}`,
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
  drawElevationPlan(doc, input.config, input.config.width, 'Elewacja frontowa', 20, 188, 75);
  drawElevationPlan(doc, input.config, input.config.length, 'Elewacja boczna', 115, 188, 75);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Rysunki maja charakter pogladowy. Wymiary produkcyjne wymagaja zatwierdzenia technicznego.', 14, 267);

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

