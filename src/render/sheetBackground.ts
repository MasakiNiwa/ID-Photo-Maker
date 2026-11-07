import type { PatternKind, PlacedText } from '@/domain/sheetDesign';

export interface SheetDecoration {
  baseColor: string;
  accentColor: string;
  pattern: PatternKind;
  gradient: boolean;
  photoMat: boolean;
  texts: PlacedText[];
  textColor: string;
}

type Ctx = OffscreenCanvasRenderingContext2D;

/** 地の色・グラデーション（用紙全体、補正なし） */
export function drawBase(c: Ctx, d: SheetDecoration, W: number, H: number): void {
  if (d.gradient) {
    const g = c.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, d.baseColor);
    g.addColorStop(1, d.accentColor);
    c.fillStyle = g;
  } else {
    c.fillStyle = d.baseColor;
  }
  c.fillRect(0, 0, W, H);
}

/**
 * 柄を描く。c には mm 座標系の変換を設定しておくこと。
 * 柄はやわらかい色で、写真の邪魔をしない控えめな密度にする。
 */
export function drawPattern(c: Ctx, d: SheetDecoration, widthMm: number, heightMm: number): void {
  // グラデーション時は柄に地の色より少し濃い色を使う
  const color = d.gradient ? d.baseColor : d.accentColor;
  c.save();
  c.fillStyle = color;
  c.strokeStyle = color;
  switch (d.pattern) {
    case 'dots': {
      const step = 5;
      for (let y = 0, row = 0; y <= heightMm + step; y += step * 0.866, row++) {
        for (let x = row % 2 ? step / 2 : 0; x <= widthMm + step; x += step) {
          c.beginPath();
          c.arc(x, y, 0.55, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case 'grid': {
      c.lineWidth = 0.15;
      c.beginPath();
      for (let x = 0; x <= widthMm; x += 5) {
        c.moveTo(x, 0);
        c.lineTo(x, heightMm);
      }
      for (let y = 0; y <= heightMm; y += 5) {
        c.moveTo(0, y);
        c.lineTo(widthMm, y);
      }
      c.stroke();
      break;
    }
    case 'stripes': {
      c.lineWidth = 1.1;
      c.beginPath();
      for (let k = -heightMm; k <= widthMm + heightMm; k += 4) {
        c.moveTo(k, 0);
        c.lineTo(k + heightMm, heightMm);
      }
      c.stroke();
      break;
    }
    case 'check': {
      const s = 6;
      c.globalAlpha = 0.55;
      for (let x = 0; x < widthMm; x += s * 2) c.fillRect(x, 0, s, heightMm);
      for (let y = 0; y < heightMm; y += s * 2) c.fillRect(0, y, widthMm, s);
      break;
    }
    case 'waves': {
      c.lineWidth = 0.35;
      c.beginPath();
      for (let y = 2; y <= heightMm + 4; y += 4) {
        c.moveTo(0, y);
        for (let x = 0; x <= widthMm; x += 1) c.lineTo(x, y + Math.sin((x / 8) * Math.PI * 2) * 0.8);
      }
      c.stroke();
      break;
    }
    case 'none':
      break;
  }
  c.restore();
}

/** 文字（mm 座標系） */
export function drawTexts(c: Ctx, d: SheetDecoration): void {
  c.save();
  c.fillStyle = d.textColor;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  for (const t of d.texts) {
    c.font = `${t.bold ? 600 : 400} ${t.sizeMm}px system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    c.fillText(t.text, t.xMm, t.yMm);
  }
  c.restore();
}
