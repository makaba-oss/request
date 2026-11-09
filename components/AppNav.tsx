'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; short?: string; icon: keyof typeof ICONS; count?: number };
const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M17 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-3-5.2',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 2v4M15 2v4',
  task: 'M9 4h6M8 3h8v3H8zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 13l3 3 5-6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2H6',
  cards: 'M7 3h11a2 2 0 0 1 2 2v12M4 7h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  kana: 'M5 7h14M12 4v16M8 11c0 5 4 8 9 9M16 11c-1 4-4 7-9 9',
  pay: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

const isCur = (path: string, href: string) => (href === '/app' ? path === '/app' || path.startsWith('/app/students') : path.startsWith(href));

/** Вкладки сверху на компьютере и панель снизу на телефоне. */
export function AppNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <>
      <nav className="tabs top-tabs" aria-label="Разделы">
        {items.map(i => <Link key={i.href} href={i.href} className="tab" aria-current={isCur(path, i.href) ? 'page' : undefined}>{i.label}{i.count ? <span className="count">{i.count}</span> : null}</Link>)}
      </nav>
      <nav className="bnav" aria-label="Разделы">
        {items.map(i => (
          <Link key={i.href} href={i.href} aria-current={isCur(path, i.href) ? 'page' : undefined}>
            <span className="bic"><svg viewBox="0 0 24 24" aria-hidden><path d={ICONS[i.icon]} /></svg>{i.count ? <span className="count">{i.count}</span> : null}</span>
            <span>{i.short || i.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
