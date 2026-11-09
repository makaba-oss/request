'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ contact }: { contact?: string }) {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      const j = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил. Попробуйте ещё раз.' }));
      if (j.ok) { router.replace('/app'); router.refresh(); return; }
      setErr(j.error || 'Не получилось войти. Попробуйте ещё раз.');
    } catch {
      setErr('Нет связи с сервером. Проверьте интернет.');
    }
    setBusy(false);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field"><span>Логин</span>
        <input id="login" name="username" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={e => setLogin(e.target.value)} />
      </label>
      <label className="field"><span>Пароль</span>
        <input id="password" name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <label className="row small muted" style={{ gap: 6 }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Показать пароль</label>
      {err ? <div className="alert err" role="alert">{err}</div> : null}
      <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
      <p className="small muted">Логин и пароль выдаёт преподаватель{contact ? <>. Забыли пароль? Напишите: <span style={{ userSelect: 'all' }}>{contact}</span></> : '. Если забыли пароль, напишите преподавателю.'}</p>
    </form>
  );
}
