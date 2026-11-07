import type { CropState } from './edit';
import type { PhotoSpec } from './specs';

/** 画像のピクセル座標（向き補正済みの元画像、左上原点） */
export interface Pt {
  x: number;
  y: number;
}

/** 顔検出の結果から求めた、位置合わせに必要な特徴点 */
export interface FaceGeometry {
  /** 画像上で左側に写っている目 / 右側に写っている目 */
  leftEye: Pt;
  rightEye: Pt;
  chin: Pt;
  /** 髪を含めた頭頂 */
  headTop: Pt;
}

/** 規格の頭の大きさ・上余白の目安（枠の高さに対する比率、目安範囲の中央） */
export function targetRatios(spec: PhotoSpec): { head: number; top: number } {
  const g = spec.guide;
  if (!g) return { head: 0.65, top: 0.11 };
  return {
    head: (g.headHeightMm[0] + g.headHeightMm[1]) / 2 / spec.heightMm,
    top: (g.topMarginMm[0] + g.topMarginMm[1]) / 2 / spec.heightMm,
  };
}

/** 目を水平にするための回転角（度）。左右反転時は向きが逆になる */
export function levelingRotation(face: FaceGeometry, flipH: boolean): number {
  const dx = face.rightEye.x - face.leftEye.x;
  const dy = face.rightEye.y - face.leftEye.y;
  if (Math.abs(dx) < 1e-9) return 0;
  const deg = (-Math.atan(dy / dx) * 180) / Math.PI;
  return flipH ? -deg : deg;
}

/**
 * 顔の特徴点から、規格に合った構図（拡大率・位置・傾き）を計算する。
 * 座標変換は描画（Worker / CSS）と同じ「平行移動 → 回転 → 反転 → 拡大」。
 */
export function autoCrop(
  face: FaceGeometry,
  image: { width: number; height: number },
  spec: PhotoSpec,
  opts: { flipH?: boolean; level?: boolean } = {},
): CropState {
  const flipH = opts.flipH ?? false;
  const rotation = opts.level === false ? 0 : levelingRotation(face, flipH);
  const t = (rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const H = image.height;
  // 画像中心を原点、画像の高さを1とした座標 → 反転 → 回転
  const map = (p: Pt): Pt => {
    const ux = ((p.x - image.width / 2) / H) * (flipH ? -1 : 1);
    const uy = (p.y - image.height / 2) / H;
    return { x: ux * cos - uy * sin, y: ux * sin + uy * cos };
  };
  const top = map(face.headTop);
  const chin = map(face.chin);
  const eyes = map({ x: (face.leftEye.x + face.rightEye.x) / 2, y: (face.leftEye.y + face.rightEye.y) / 2 });
  const { head, top: topRatio } = targetRatios(spec);
  const headLen = Math.max(1e-6, chin.y - top.y);
  const scale = head / headLen;
  return {
    scale,
    rotation,
    flipH,
    x: -scale * eyes.x,
    y: -0.5 + topRatio - scale * top.y,
  };
}

/**
 * セグメンテーションの信頼度マスクから頭頂（髪の上端）を探す。
 * 額から顔の上方向へ進み、人物領域が途切れる位置を返す。見つからなければ顔の比率から推定する。
 */
export function findHeadTop(
  mask: { width: number; height: number; data: Uint8Array },
  image: { width: number; height: number },
  forehead: Pt,
  chin: Pt,
  faceWidth: number,
): Pt {
  const ax = forehead.x - chin.x;
  const ay = forehead.y - chin.y;
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len;
  const uy = ay / len;
  const sample = (x: number, y: number) => {
    const mx = Math.floor((x / image.width) * mask.width);
    const my = Math.floor((y / image.height) * mask.height);
    if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) return 0;
    return mask.data[my * mask.width + mx] ?? 0;
  };
  const step = Math.max(1, image.height / mask.height / 2);
  let best = 0;
  // 分け目などで中央だけ途切れることがあるので、左右にもずらして最も遠い点を採用する
  for (const off of [-0.18, -0.09, 0, 0.09, 0.18]) {
    const ox = -uy * off * faceWidth;
    const oy = ux * off * faceWidth;
    let d = 0;
    let miss = 0;
    for (let s = 0; s < len * 1.2; s += step) {
      if (sample(forehead.x + ox + ux * s, forehead.y + oy + uy * s) >= 128) {
        d = s;
        miss = 0;
      } else if (++miss * step > len * 0.04) {
        break;
      }
    }
    best = Math.max(best, d);
  }
  if (best <= 0) best = len * 0.3;
  return { x: forehead.x + ux * best, y: forehead.y + uy * best };
}
