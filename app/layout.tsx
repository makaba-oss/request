import type { Metadata, Viewport } from 'next';
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import '@fontsource/unbounded/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ReQuest', template: '%s · ReQuest' },
  description: 'Кабинет ученика: расписание, задания, материалы и оплата занятий.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F4F6FB' }, { media: '(prefers-color-scheme: dark)', color: '#0E1224' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
