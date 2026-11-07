import { MM_PER_INCH } from '@/domain/units';

const PT_PER_INCH = 72;

/** 面付け済み JPEG を実寸の PDF 1ページにする（pdf-lib は必要時のみ読み込む） */
export async function exportPdf(jpeg: Blob, widthMm: number, heightMm: number): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('証明写真');
  doc.setCreator('証明写真 ID Photo Maker');
  const w = (widthMm / MM_PER_INCH) * PT_PER_INCH;
  const h = (heightMm / MM_PER_INCH) * PT_PER_INCH;
  const page = doc.addPage([w, h]);
  const img = await doc.embedJpg(await jpeg.arrayBuffer());
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  const bytes = await doc.save();
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}
