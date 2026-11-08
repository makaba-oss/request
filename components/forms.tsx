'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { FormState } from '@/app/app/actions';

export function Submit({ children, className = 'btn pri', pending: pendingText = 'Сохраняем…' }: { children: React.ReactNode; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending}>{pending ? pendingText : children}</button>;
}

/** Форма с серверным действием: показывает ошибку или «Сохранено» под полями. */
export function ActionForm({ action, children, className = 'stack', submit = 'Сохранить', pending }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; children: React.ReactNode; className?: string; submit?: string; pending?: string;
}) {
  const [state, run] = useFormState(action, null);
  return (
    <form action={run} className={className}>
      {children}
      {state?.error ? <div className="alert err" role="alert">{state.error}</div> : null}
      {state?.ok && state.message ? <div className="alert ok" role="status">{state.message}</div> : null}
      <div><Submit pending={pending}>{submit}</Submit></div>
    </form>
  );
}

export function NavTabs({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Разделы">
      {items.map(i => {
        const cur = i.href === '/app' ? path === '/app' || path.startsWith('/app/students') : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className="tab" aria-current={cur ? 'page' : undefined}>
            {i.label}{i.count ? <span className="count">{i.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
