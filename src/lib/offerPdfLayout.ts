import type { jsPDF } from 'jspdf';

export const PDF_FONT = 'OfferSans';
export const PDF_INK = '#202938';
export const PDF_MUTED = '#64748b';
export const PDF_LINE = '#e2e8f0';
export const PDF_PAPER = '#f8fafc';
export const PDF_MARGIN = 16;
export const PDF_WIDTH = 178;
export const PDF_BOTTOM = 272;

export const safePdfText = (value: unknown, maxLength = 1200) => String(value ?? '')
  .normalize('NFC')
  .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
  .replace(/[\u2010-\u2015\u2212]/g, '-')
  .trim().slice(0, maxLength);

let fontsPromise: Promise<string[]> | undefined;

export async function loadOfferFonts(doc: jsPDF) {
  // Czcionki są pobierane z naszej domeny dopiero podczas tworzenia PDF.
  // Żadne dane klienta nie są częścią tych zapytań.
  fontsPromise ??= Promise.all(['Regular', 'Bold'].map(async style => {
    const response = await fetch(`/fonts/LiberationSans-${style}.ttf`, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Nie udało się wczytać czcionki PDF. Odśwież stronę i spróbuj ponownie.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  })).catch(error => { fontsPromise = undefined; throw error; });
  const [regular, bold] = await fontsPromise;
  doc.addFileToVFS('LiberationSans-Regular.ttf', regular);
  doc.addFileToVFS('LiberationSans-Bold.ttf', bold);
  doc.addFont('LiberationSans-Regular.ttf', PDF_FONT, 'normal');
  doc.addFont('LiberationSans-Bold.ttf', PDF_FONT, 'bold');
  doc.setFont(PDF_FONT, 'normal');
}

export function drawPdfCard(doc: jsPDF, x: number, y: number, width: number, height: number, fill = '#ffffff') {
  doc.setFillColor(fill);
  doc.setDrawColor(PDF_LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD');
}

export function drawPdfImage(doc: jsPDF, image: string, x: number, y: number, width: number, height: number) {
  const properties = doc.getImageProperties(image);
  const scale = Math.min(width / properties.width, height / properties.height);
  const imageWidth = properties.width * scale;
  const imageHeight = properties.height * scale;
  doc.addImage(image, properties.fileType, x + (width - imageWidth) / 2, y + (height - imageHeight) / 2,
    imageWidth, imageHeight, undefined, 'FAST');
}

export function createOfferLayout(doc: jsPDF, brand: string, offerNumber: string, accent: string) {
  const font = (size = 9, bold = false, color = PDF_INK) => {
    doc.setFont(PDF_FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.setCharSpace(0);
  };
  const header = (title: string) => {
    font(17, true);
    doc.text(brand, PDF_MARGIN, 18);
    font(7, false, PDF_MUTED);
    doc.setCharSpace(1.1);
    doc.text('OFERTA GARAŻU', PDF_MARGIN, 25);
    doc.setCharSpace(0);
    font(8, false, PDF_MUTED);
    const numberLines: string[] = doc.splitTextToSize(`Oferta nr ${safePdfText(offerNumber, 60)}`, 72);
    doc.text(numberLines, 194, 17, { align: 'right', lineHeightFactor: 1.2 });
    doc.setDrawColor(PDF_LINE);
    doc.setLineWidth(0.25);
    doc.line(PDF_MARGIN, 31, 194, 31);
    doc.setFillColor(accent);
    doc.rect(PDF_MARGIN, 30.4, 20, 1.2, 'F');
    font(20, true);
    doc.text(title, PDF_MARGIN, 46);
  };
  const page = (title: string) => { doc.addPage(); header(title); };
  const section = (title: string, y: number) => {
    font(11, true);
    doc.text(title, PDF_MARGIN, y);
    return y + 7;
  };
  const table = (labels: string[], rows: string[][], widths: number[], startY: number, continuationTitle: string) => {
    let y = startY;
    const rowLines = (row: string[]): string[][] => row.map((cell, index) => {
      font(8.5);
      return doc.splitTextToSize(safePdfText(cell, 800), widths[index] - 8);
    });
    const heading = () => {
      doc.setFillColor(PDF_INK);
      doc.roundedRect(PDF_MARGIN, y, PDF_WIDTH, 9, 1.5, 1.5, 'F');
      let x = PDF_MARGIN;
      labels.forEach((label, i) => { font(8, true, '#ffffff'); doc.text(label, x + 4, y + 6); x += widths[i]; });
      y += 9;
    };
    font(8.5);
    if (y + 9 + Math.max(9, ...rowLines(rows[0] || ['']).map(lines => lines.length * 4 + 5)) > PDF_BOTTOM) {
      page(continuationTitle);
      y = 59;
    }
    heading();
    rows.forEach((row, index) => {
      const lines = rowLines(row);
      const height = Math.max(9, ...lines.map(cell => cell.length * 4 + 5));
      if (y + height > PDF_BOTTOM) { page(continuationTitle); y = 59; heading(); }
      if (index % 2 === 0) { doc.setFillColor(PDF_PAPER); doc.rect(PDF_MARGIN, y, PDF_WIDTH, height, 'F'); }
      let x = PDF_MARGIN;
      lines.forEach((cell, i) => {
        font(8.5, i === 0, i === 0 ? PDF_MUTED : PDF_INK);
        doc.text(cell, x + 4, y + 5.8, { lineHeightFactor: 1.33 });
        x += widths[i];
      });
      doc.setDrawColor(PDF_LINE);
      doc.setLineWidth(0.2);
      doc.line(PDF_MARGIN, y + height, 194, y + height);
      y += height;
    });
    return y;
  };
  const footers = () => {
    const total = doc.getNumberOfPages();
    for (let index = 1; index <= total; index++) {
      doc.setPage(index);
      doc.setDrawColor(PDF_LINE);
      doc.setLineWidth(0.25);
      doc.line(PDF_MARGIN, 279, 194, 279);
      font(7, false, PDF_MUTED);
      doc.text(`${brand}  |  Oferta ${safePdfText(offerNumber, 45)}`, PDF_MARGIN, 285);
      font(8, true, PDF_MUTED);
      doc.text(`${index} / ${total}`, 194, 285, { align: 'right' });
    }
  };
  return { font, header, page, section, table, footers, accent };
}
