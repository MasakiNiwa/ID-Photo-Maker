import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { NumberField } from '@/components/controls';
import { CUSTOM_LIMITS, createCustomSpec, isValidCustomSize, type PhotoSpec } from '@/domain/specs';
import { useSettings } from '@/stores/settings';

/** 任意サイズの規格を作成する */
export function CustomSpecDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (spec: PhotoSpec) => void;
}) {
  const [name, setName] = useState('');
  const [w, setW] = useState(30);
  const [h, setH] = useState(40);
  const add = useSettings((s) => s.addCustomSpec);
  const valid = isValidCustomSize(w) && isValidCustomSize(h);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog">
          <Dialog.Title className="dialog-title">任意サイズを追加</Dialog.Title>
          <Dialog.Description className="dialog-desc">
            提出先で指定されたサイズを mm で入力してください（{CUSTOM_LIMITS.minMm}〜{CUSTOM_LIMITS.maxMm}
            mm）。
          </Dialog.Description>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              const spec = createCustomSpec(name, w, h);
              add(spec);
              onCreated?.(spec);
              onOpenChange(false);
              setName('');
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="custom-name">
                名前（任意）
              </label>
              <input
                id="custom-name"
                className="input"
                value={name}
                placeholder="例：〇〇試験 願書用"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid-2">
              <NumberField label="幅" unit="mm" value={w} onChange={setW} step={0.5} />
              <NumberField label="高さ" unit="mm" value={h} onChange={setH} step={0.5} />
            </div>
            {!valid && (
              <p className="notice notice-warn">
                サイズは {CUSTOM_LIMITS.minMm}〜{CUSTOM_LIMITS.maxMm}mm の範囲で入力してください。
              </p>
            )}
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="btn">
                  キャンセル
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={!valid}>
                追加
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
