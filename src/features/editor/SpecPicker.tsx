import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { formatSize, type PhotoSpec } from '@/domain/specs';
import { useAllSpecs } from '@/stores/specs';
import { CustomSpecDialog } from './CustomSpecDialog';

/** 規格の選択。よく使う規格 + ユーザーが追加した任意サイズ */
export function SpecPicker({
  value,
  onSelect,
  marked,
}: {
  value?: string;
  onSelect: (spec: PhotoSpec) => void;
  /** 調整済みなど、チェックを付ける規格 */
  marked?: (id: string) => boolean;
}) {
  const specs = useAllSpecs();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="spec-grid" role="listbox" aria-label="写真の規格">
        {specs.map((s) => (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={s.id === value}
            className="spec-option"
            onClick={() => onSelect(s)}
          >
            <span
              className="spec-shape"
              style={{ aspectRatio: `${s.widthMm} / ${s.heightMm}` }}
              aria-hidden
            />
            <span className="spec-text">
              <span className="spec-name">{s.name}</span>
              <span className="spec-size">{formatSize(s)}</span>
            </span>
            {marked?.(s.id) && <Check className="spec-check" size={14} aria-label="調整済み" />}
          </button>
        ))}
        <button type="button" className="spec-option spec-add" onClick={() => setOpen(true)}>
          <Plus size={18} />
          <span className="spec-text">
            <span className="spec-name">任意サイズ</span>
            <span className="spec-size">mmで指定</span>
          </span>
        </button>
      </div>
      <CustomSpecDialog open={open} onOpenChange={setOpen} onCreated={onSelect} />
    </>
  );
}
