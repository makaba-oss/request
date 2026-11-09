'use client';
import { useEffect, useRef, useState } from 'react';
import { ROWS, BASE_ROWS, DAK_ROWS, KANA, ALT, type Kana } from '@/lib/kana';
import { saveKana } from '@/app/app/study-actions';

type Mode = 'k2r' | 'r2k' | 'type' | 'pair' | 'table';
type Script = 'hira' | 'kata' | 'mix';
const MODES: [Mode, string][] = [['k2r', 'Кана → ромадзи'], ['r2k', 'Ромадзи → кана'], ['type', 'Ввод'], ['pair', 'Хирагана ↔ катакана'], ['table', 'Таблица']];
const shuffle = <T,>(a: T[]) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ROMAJI = [...new Set(KANA.map(x => x.r))];

export function KanaTrainer({ saved }: { saved: { right: number; wrong: number; best: number; weak: Record<string, number> } }) {
  const [mode, setMode] = useState<Mode>('k2r');
  const [script, setScript] = useState<Script>('hira');
  const [rows, setRows] = useState<string[]>(['a', 'k', 's']);
  const [weakOnly, setWeakOnly] = useState(false);
  const [q, setQ] = useState<Kana | null>(null);
  const [opts, setOpts] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [sess, setSess] = useState({ right: 0, wrong: 0, streak: 0, best: 0, weak: {} as Record<string, number> });
  const [savedState, setSaved] = useState(saved);
  const [hideR, setHideR] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const inRef = useRef<HTMLInputElement>(null);
  const sessRef = useRef(sess); sessRef.current = sess;

  const weakChars = Object.entries(savedState.weak).sort((a, b) => b[1] - a[1]);
  const pool = () => {
    const scripts = mode === 'pair' || script === 'mix' ? ['hira', 'kata'] : [script];
    if (weakOnly) { const w = new Set(weakChars.map(x => x[0])); const wp = KANA.filter(x => w.has(x.c) && (mode === 'pair' || scripts.includes(x.s))); if (wp.length >= 2) return wp; }
    const p = KANA.filter(x => scripts.includes(x.s) && rows.includes(x.row));
    return p.length ? p : KANA.filter(x => x.row === 'a' && scripts.includes(x.s));
  };
  const next = (prev?: Kana | null) => {
    const p = pool(); let n: Kana, tries = 0;
    do { n = p[Math.floor(Math.random() * p.length)]; } while (p.length > 1 && prev && n.c === prev.c && ++tries < 10);
    setQ(n); setPicked(null); setTyped('');
    if (mode === 'k2r') setOpts(shuffle([n.r, ...shuffle(ROMAJI.filter(r => r !== n.r)).slice(0, 3)]));
    else if (mode === 'r2k') { const same = KANA.filter(x => x.s === n.s && x.r !== n.r), near = same.filter(x => rows.includes(x.row)); setOpts(shuffle([n.c, ...shuffle(near.length >= 3 ? near : same).slice(0, 3).map(x => x.c)])); }
    else if (mode === 'pair') { const other = KANA.filter(x => x.s !== n.s && x.r !== n.r); setOpts(shuffle([n.p, ...shuffle(other).slice(0, 3).map(x => x.c)])); }
    else setOpts([]);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode !== 'table') next(null); }, [mode, script, rows.join(), weakOnly]);
  useEffect(() => { if (mode === 'type' && !picked) inRef.current?.focus(); }, [q, mode, picked]);

  const flush = async (quiet = false) => {
    const s = sessRef.current;
    if (!s.right && !s.wrong) return;
    setSess(x => ({ ...x, right: 0, wrong: 0, weak: {} }));
    const r = await saveKana({ right: s.right, wrong: s.wrong, best: s.best, weak: s.weak }).catch(() => ({ ok: false }));
    if (r.ok) {
      setSaved(v => { const weak = { ...v.weak }; for (const [c, n] of Object.entries(s.weak)) weak[c] = (weak[c] || 0) + n; return { right: v.right + s.right, wrong: v.wrong + s.wrong, best: Math.max(v.best, s.best), weak }; });
      if (!quiet) setMsg('Результат сохранён');
    } else { setSess(x => ({ ...x, right: x.right + s.right, wrong: x.wrong + s.wrong })); setMsg('Не удалось сохранить. Проверьте интернет.'); }
  };
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (ok: boolean) => {
    setMsg('');
    setSess(s => {
      const n = ok ? { ...s, right: s.right + 1, streak: s.streak + 1, best: Math.max(s.best, s.streak + 1) }
        : { ...s, wrong: s.wrong + 1, streak: 0, weak: { ...s.weak, [q!.c]: (s.weak[q!.c] || 0) + 1 } };
      if ((n.right + n.wrong) % 20 === 0) setTimeout(() => flush(true), 0);
      return n;
    });
  };
  const correct = q ? (mode === 'k2r' || mode === 'type' ? q.r : mode === 'r2k' ? q.c : q.p) : '';
  const pick = (o: string) => { if (picked || !q) return; setPicked(o); answer(o === correct); };
  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (picked) { next(q); return; }
    const t = typed.trim().toLowerCase(); if (!t || !q) return;
    const ok = t === q.r || (ALT[q.r] || []).includes(t);
    setPicked(ok ? 'ok' : 'x'); answer(ok);
  };
  const toggleRow = (id: string) => setRows(r => (r.includes(id) ? (r.length > 1 ? r.filter(x => x !== id) : r) : [...r, id]));
  const firstOf = (id: string) => { const r = ROWS.find(x => x[0] === id)!; return [...(script === 'kata' ? r[2] : r[1])].find(c => c !== '_'); };

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="seg scroll" role="group" aria-label="Упражнение">{MODES.map(([v, l]) => <button key={v} aria-pressed={mode === v} onClick={() => setMode(v)}>{l}</button>)}</div>
        <div className="row between">
          {mode !== 'pair' ? <div className="seg" role="group" aria-label="Азбука">{([['hira', 'Хирагана'], ['kata', 'Катакана'], ['mix', 'Обе']] as [Script, string][]).filter(([v]) => mode !== 'table' || v !== 'mix').map(([v, l]) => <button key={v} aria-pressed={script === v} onClick={() => setScript(v)}>{l}</button>)}</div> : <span />}
          {mode !== 'table' && weakChars.length >= 2 ? <label className="gchip"><input type="checkbox" checked={weakOnly} onChange={e => setWeakOnly(e.target.checked)} />Только трудные знаки</label> : null}
        </div>
        {mode !== 'table' && !weakOnly ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 6 }}>{BASE_ROWS.map(id => <button key={id} className="rowchip" lang="ja" aria-pressed={rows.includes(id)} onClick={() => toggleRow(id)}>{firstOf(id)}</button>)}</div>
            <div className="row" style={{ gap: 6 }}>{DAK_ROWS.map(id => <button key={id} className="rowchip" lang="ja" aria-pressed={rows.includes(id)} onClick={() => toggleRow(id)}>{firstOf(id)}</button>)}
              <button className="btn ghost sm" onClick={() => setRows(BASE_ROWS)}>Все основные</button><button className="btn ghost sm" onClick={() => setRows([...BASE_ROWS, ...DAK_ROWS])}>Все</button></div>
          </div>
        ) : null}

        {mode === 'table' ? (
          <div className="stack">
            <div className="row between"><p className="small muted">Нажмите на знак, чтобы {hideR ? 'увидеть' : 'скрыть'} чтение. Удобно для самопроверки.</p><label className="gchip"><input type="checkbox" checked={hideR} onChange={e => { setHideR(e.target.checked); setReveal({}); }} />Скрыть ромадзи</label></div>
            <div className="ktable">{ROWS.map(([id, h, kk, r]) => { const kata = script === 'kata', cs = [...(kata ? kk : h)], other = [...(kata ? h : kk)], rs = r.split(' ');
              return <div key={id} className="krow" style={id === 'g' ? { marginTop: 10 } : undefined}>{cs.map((c, i) => c === '_' ? <div key={i} className="kcell blank" /> : (
                <button key={i} className="kcell" onClick={() => setReveal(v => ({ ...v, [c]: !v[c] }))}><span className="g" lang="ja">{c}<small>{other[i]}</small></span><span className="r">{(hideR ? reveal[c] : !reveal[c]) ? rs[i] : ''}</span></button>
              ))}</div>; })}</div>
          </div>
        ) : q ? (
          <div className="quiz">
            {mode === 'r2k' ? <><div className="glyph ro">{q.r}</div><div className="small muted">Найдите в {q.s === 'hira' ? 'хирагане' : 'катакане'}</div></>
              : mode === 'pair' ? <><div className="glyph" lang="ja">{q.c}</div><div className="small muted">Та же буква в {q.s === 'hira' ? 'катакане' : 'хирагане'}</div></>
              : <div className="glyph" lang="ja">{q.c}</div>}
            {mode === 'type' ? (
              <form className="typein" onSubmit={check}>
                <input ref={inRef} type="text" value={typed} onChange={e => setTyped(e.target.value)} readOnly={!!picked} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="ромадзи" aria-label="Чтение латиницей" className={picked ? (picked === 'ok' ? 'right' : 'wrong') : ''} />
                <button className="btn pri" type="submit">{picked ? 'Дальше' : 'Проверить'}</button>
              </form>
            ) : (
              <div className="opts">{opts.map(o => <button key={o} className={'opt' + (mode === 'k2r' ? '' : ' k') + (picked ? (o === correct ? ' right' : o === picked ? ' wrong' : '') : '')} disabled={!!picked} onClick={() => pick(o)} lang={mode === 'k2r' ? undefined : 'ja'}>{o}</button>)}</div>
            )}
            <div className="row" style={{ minHeight: 40, justifyContent: 'center' }}>
              {picked ? ((mode === 'type' ? picked === 'ok' : picked === correct) ? <span className="chip c-good">Верно</span>
                : <span className="chip c-bad">Правильно: {mode === 'pair' ? `${q.p} (${q.r})` : mode === 'r2k' ? q.c : q.r}</span>) : null}
              {picked && mode !== 'type' ? <button className="btn pri" autoFocus onClick={() => next(q)}>Дальше →</button> : null}
            </div>
            <div className="score"><span>Верно <b>{sess.right}</b></span><span>Ошибок <b>{sess.wrong}</b></span><span>Серия <b>{sess.streak}</b></span><span>Рекорд <b>{Math.max(sess.best, savedState.best)}</b></span></div>
            {sess.right + sess.wrong ? <button className="btn sm" onClick={() => flush()}>Сохранить результат</button> : null}
            {msg ? <span className="small muted">{msg}</span> : null}
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <div className="row between"><h3>Ваш прогресс</h3><span className="small muted num">всего верно {savedState.right} · ошибок {savedState.wrong} · рекорд серии {savedState.best}</span></div>
        {weakChars.length ? <>
          <div className="weak">{weakChars.slice(0, 16).map(([c, n]) => <span key={c} lang="ja">{c}<small>×{n}</small></span>)}</div>
          <p className="small muted">Трудные знаки — где чаще всего ошибались. Результат сохраняется сам каждые 20 ответов и когда вы уходите со страницы.</p>
        </> : <p className="small muted">Пока ошибок нет. Результат сохраняется сам каждые 20 ответов и когда вы уходите со страницы.</p>}
      </section>
    </div>
  );
}
