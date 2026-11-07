/** 印刷用紙の定義（mm、縦向き基準） */
export interface PaperSpec {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  note?: string;
}

export const PAPERS: readonly PaperSpec[] = [
  { id: 'L', name: 'L判', widthMm: 89, heightMm: 127, note: 'コンビニの写真プリントで一般的' },
  { id: '2L', name: '2L判', widthMm: 127, heightMm: 178 },
  { id: 'postcard', name: 'はがき（KG）', widthMm: 100, heightMm: 148 },
  { id: 'A4', name: 'A4', widthMm: 210, heightMm: 297, note: '自宅プリンター・コンビニのコピー機' },
  { id: 'B5', name: 'B5', widthMm: 182, heightMm: 257 },
];

export function findPaper(id: string): PaperSpec {
  return PAPERS.find((p) => p.id === id) ?? (PAPERS[0] as PaperSpec);
}

export function orient(paper: PaperSpec, landscape: boolean): { widthMm: number; heightMm: number } {
  return landscape
    ? { widthMm: paper.heightMm, heightMm: paper.widthMm }
    : { widthMm: paper.widthMm, heightMm: paper.heightMm };
}
