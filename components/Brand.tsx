import Link from 'next/link';

export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="13" fill="var(--brand)" />
      <path d="M19.57 33.81A11.50 11.50 0 1 1 32.31 30.39" fill="none" stroke="var(--on-brand)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="34.92" cy="35.19" r="4.4" fill="var(--marker)" />
    </svg>
  );
}

export function Wordmark() {
  return <span className="wm">Re<span>Q</span>uest</span>;
}

export function Header({ sub, right, href = '/app' }: { sub?: string; right?: React.ReactNode; href?: string }) {
  return (
    <header className="top">
      <Link href={href} className="brand" aria-label="ReQuest — на главную">
        <Mark />
        <div>
          <Wordmark />
          {sub ? <div className="sub">{sub}</div> : null}
        </div>
      </Link>
      {right}
    </header>
  );
}

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="btn ghost sm" type="submit">Выйти</button>
    </form>
  );
}
