'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { srsNext, ivlLabel, type SrsCard } from '@/lib/srs';
import { gradeCard } from '@/app/app/study-actions';

export type ReviewCard = SrsCard & { id: string; front: string; back: string };
const GR: [number, string, string][] = [[1, 'Снова', 'g1'], [2, 'Трудно', 'g2'], [3, 'Хорошо', 'g3'], [4, 'Легко', 'g4']];

/** Повторение колоды: показываем лицо, по нажатию — оборот, затем оценка 1–4. Клавиши: пробел, 1–4. */
export function Review({ cards, title, back }: { cards: ReviewCard[]; title: string; back: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [err, setErr] = useState('');
  const card = queue[0];

  const grade = useCallback(async (g: number) => {
    if (!card) return;
    const next = srsNext(card, g);
    setShown(false); setErr('');
    setQueue(q => (g === 1 ? [...q.slice(1), { ...card, ...next }] : q.slice(1)));
    if (g !== 1) setDone(d => d + 1);
    const r = await gradeCard(card.id, g).catch(() => ({ ok: false }));
    if (!r.ok) setErr('Не удалось сохранить ответ. Проверьте интернет.');
  }, [card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!shown) setShown(true); else grade(3); }
      else if (shown && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, grade]);

  if (!card) {
    return (
      <div className="panel stack" style={{ textAlign: 'center', justifyItems: 'center', padding: '36px 18px' }}>
        <div className="big">お疲れ様!</div>
        <p>{done ? `Повторено карточек: ${done}. На сегодня всё.` : 'Сейчас повторять нечего — загляните позже.'}</p>
        <div className="row" style={{ justifyContent: 'center' }}><Link className="btn pri" href={back} onClick={() => router.refresh()}>К колодам</Link></div>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="row between"><Link href={back} className="btn ghost sm" style={{ paddingLeft: 0 }}>← {title}</Link><span className="small muted num">осталось {queue.length} · готово {done}</span></div>
      <div className="flash" onClick={() => setShown(true)} role="button" tabIndex={0} aria-label={shown ? 'Оборот карточки' : 'Показать ответ'}>
        <div className="flash-f" lang="ja">{card.front}</div>
        {shown ? <div className="flash-b">{card.back}</div> : <div className="small muted">нажмите, чтобы увидеть ответ</div>}
        {card.reps === 0 ? <span className="chip c-ai" style={{ position: 'absolute', top: 12, left: 12 }}>новая</span> : null}
      </div>
      {shown ? (
        <div className="grades">{GR.map(([g, l, c]) => (
          <button key={g} className={c} onClick={() => grade(g)}>{l}<small>{ivlLabel(srsNext(card, g).ivl)}</small></button>
        ))}</div>
      ) : <button className="btn pri" style={{ width: '100%' }} onClick={() => setShown(true)}>Показать ответ</button>}
      {err ? <div className="alert err">{err}</div> : null}
      <p className="small muted" style={{ textAlign: 'center' }}>На компьютере: пробел — показать ответ, 1–4 — оценка.</p>
    </div>
  );
}
