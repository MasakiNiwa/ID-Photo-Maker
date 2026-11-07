import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router';
import { Shell } from '@/app/Shell';
import { EditorPage } from '@/features/editor/EditorPage';
import '@/styles/global.css';

// GitHub Pages ではサーバー側のルーティングができないため HashRouter を使う
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <EditorPage /> },
      // 作成以外のページは必要になったときに読み込む（初回表示を軽くする）
      {
        path: 'print',
        lazy: async () => ({ Component: (await import('@/features/print/PrintPage')).PrintPage }),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('@/features/settings/SettingsPage')).SettingsPage }),
      },
      {
        path: 'help',
        lazy: async () => ({ Component: (await import('@/features/help/HelpPage')).HelpPage }),
      },
      { path: '*', element: <EditorPage /> },
    ],
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
