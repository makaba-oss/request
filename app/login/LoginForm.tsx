'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function post(url: string, body: object) {
    setBusy(true); setErr('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил. Попробуйте ещё раз.' }));
      if (!j.ok) setErr(j.error || 'Что-то пошло не так. Попробуйте ещё раз.');
      return !!j.ok;
    } catch {
      setErr('Нет связи с сервером. Проверьте интернет.');
      return false;
    } finally { setBusy(false); }
  }

  if (step === 'email') {
    return (
      <form className="stack" onSubmit={async e => { e.preventDefault(); if (await post('/api/auth/request-code', { email })) setStep('code'); }}>
        <label className="field"><span>Электронная почта</span>
          <input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="row small muted" style={{ alignItems: 'flex-start', gap: 8 }}>
          <input id="agree" type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Я согласен(на) на обработку персональных данных в соответствии с <a href="/privacy" target="_blank">политикой конфиденциальности</a></span>
        </label>
        {err ? <div className="alert err">{err}</div> : null}
        <button className="btn pri" type="submit" disabled={busy || !agree}>{busy ? 'Отправляем…' : 'Получить код'}</button>
        <p className="small muted">Пароль не нужен: пришлём на почту код из 6 цифр.</p>
      </form>
    );
  }
  return (
    <form className="stack" onSubmit={async e => { e.preventDefault(); if (await post('/api/auth/verify', { email, code })) { router.replace('/app'); router.refresh(); } }}>
      <p>Код отправлен на <strong>{email}</strong>. Проверьте почту, в том числе папку «Спам».</p>
      <label className="field"><span>Код из письма</span>
        <input id="code" className="code-input" type="text" required autoFocus autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
      </label>
      {err ? <div className="alert err">{err}</div> : null}
      <button className="btn pri" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Проверяем…' : 'Войти'}</button>
      <div className="row between small">
        <button type="button" className="btn ghost sm" onClick={() => { setStep('email'); setCode(''); setErr(''); }}>Изменить почту</button>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => post('/api/auth/request-code', { email })}>Отправить код ещё раз</button>
      </div>
    </form>
  );
}
