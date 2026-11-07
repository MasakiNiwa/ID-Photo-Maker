import Dexie, { type EntityTable } from 'dexie';

/** 端末内 IndexedDB。写真は外部に送信せず、この中だけに保存する。 */
export interface KvRow {
  key: string;
  value: string;
}

export interface ImageRow {
  id: string;
  blob: Blob;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

/** 人物マスク（AI の推論結果、低解像度） */
export interface MaskRow {
  imageId: string;
  width: number;
  height: number;
  data: Uint8Array;
}

class AppDB extends Dexie {
  kv!: EntityTable<KvRow, 'key'>;
  images!: EntityTable<ImageRow, 'id'>;
  masks!: EntityTable<MaskRow, 'imageId'>;

  constructor() {
    super('id-photo-maker');
    // スキーマ変更時は version を上げて upgrade を追加する
    this.version(1).stores({ kv: 'key', images: 'id, createdAt' });
    this.version(2).stores({ masks: 'imageId' });
  }
}

export const db = new AppDB();

// ドラッグ中など高頻度の更新でも IndexedDB へ書き込みすぎないよう、キーごとにまとめて書く
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  timer = undefined;
  const rows = [...pending].map(([key, value]) => ({ key, value }));
  pending.clear();
  if (rows.length) void db.kv.bulkPut(rows);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/** zustand persist 用の非同期ストレージ */
export const dexieStorage = {
  getItem: async (key: string) => pending.get(key) ?? (await db.kv.get(key))?.value ?? null,
  setItem: (key: string, value: string) => {
    pending.set(key, value);
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  },
  removeItem: async (key: string) => {
    await db.kv.delete(key);
  },
};

export async function clearAllData(): Promise<void> {
  pending.clear();
  clearTimeout(timer);
  await db.delete();
  await db.open();
}

/** ブラウザに保存領域の永続化を依頼する（容量逼迫時に消されにくくする） */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // 非対応ブラウザでは何もしない
  }
}
