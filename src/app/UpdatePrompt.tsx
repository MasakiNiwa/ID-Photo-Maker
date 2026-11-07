import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { toast } from '@/components/toast';

/** 新しいバージョンが公開されたら通知し、ワンタップで更新できるようにする */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // 1時間ごとに更新を確認
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  useEffect(() => {
    if (needRefresh) {
      toast('新しいバージョンがあります', {
        action: { label: '更新', run: () => void updateServiceWorker(true) },
        duration: 15000,
      });
    }
  }, [needRefresh, updateServiceWorker]);
  return null;
}
