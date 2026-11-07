import { describe, expect, it } from 'vitest';
import { autoCrop, type FaceGeometry, findHeadTop, levelingRotation, targetRatios } from './face';
import { type PhotoSpec, PRESET_SPECS } from './specs';

const passport = PRESET_SPECS.find((s) => s.id === 'passport') as PhotoSpec;
const img = { width: 1000, height: 1200 };
const face: FaceGeometry = {
  leftEye: { x: 440, y: 500 },
  rightEye: { x: 560, y: 500 },
  chin: { x: 500, y: 700 },
  headTop: { x: 500, y: 300 },
};

/** 構図 crop で、画像上の点 p が枠のどこ（枠中心原点・枠高さ=1）に来るか */
function project(p: { x: number; y: number }, crop: ReturnType<typeof autoCrop>) {
  const t = (crop.rotation * Math.PI) / 180;
  const ux = ((p.x - img.width / 2) / img.height) * (crop.flipH ? -1 : 1) * crop.scale;
  const uy = ((p.y - img.height / 2) / img.height) * crop.scale;
  return { x: crop.x + ux * Math.cos(t) - uy * Math.sin(t), y: crop.y + ux * Math.sin(t) + uy * Math.cos(t) };
}

describe('autoCrop', () => {
  it('頭頂とあごが規格の目安位置に来る', () => {
    const c = autoCrop(face, img, passport);
    const { head, top } = targetRatios(passport);
    expect(project(face.headTop, c).y).toBeCloseTo(-0.5 + top);
    expect(project(face.chin, c).y).toBeCloseTo(-0.5 + top + head);
    expect(project({ x: 500, y: 500 }, c).x).toBeCloseTo(0);
  });

  it('傾いた顔は目が水平になるよう回転し、位置も合う', () => {
    const tilted: FaceGeometry = {
      leftEye: { x: 440, y: 490 },
      rightEye: { x: 560, y: 510 },
      chin: { x: 490, y: 700 },
      headTop: { x: 520, y: 300 },
    };
    for (const flipH of [false, true]) {
      const c = autoCrop(tilted, img, passport, { flipH });
      const l = project(tilted.leftEye, c);
      const r = project(tilted.rightEye, c);
      expect(l.y).toBeCloseTo(r.y);
      expect((l.x + r.x) / 2).toBeCloseTo(0);
    }
  });

  it('levelingRotation は反転で符号が変わる', () => {
    const f = { ...face, rightEye: { x: 560, y: 520 } };
    expect(levelingRotation(f, false)).toBeCloseTo(-levelingRotation(f, true));
    expect(levelingRotation(f, false)).toBeLessThan(0);
  });
});

describe('findHeadTop', () => {
  it('マスクの人物領域の上端を頭頂とする', () => {
    const w = 100;
    const h = 120;
    const data = new Uint8Array(w * h);
    // y=30 以下（画像 300px 以下）が人物
    for (let y = 30; y < h; y++) for (let x = 20; x < 80; x++) data[y * w + x] = 255;
    const top = findHeadTop({ width: w, height: h, data }, img, { x: 500, y: 420 }, { x: 500, y: 700 }, 300);
    expect(top.y).toBeGreaterThan(290);
    expect(top.y).toBeLessThan(315);
  });
});
