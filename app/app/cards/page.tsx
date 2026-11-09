import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/me';
import { sql } from '@/lib/db';
import { READY_DECKS } from '@/lib/ready-decks';
import { NEW_PER_SESSION, ivlLabel } from '@/lib/srs';
import { ActionForm, Submit } from '@/components/forms';
import { Review, type ReviewCard } from '@/components/Review';
import { createDeck, addReadyDeck, addCards, updateCard, deleteCard, resetCard, renameDeck, deleteDeck } from '../study-actions';

export const metadata = { title: 'Карточки' };
type DeckRow = { id: string; title: string; readyId: string | null; total: number; due: number; fresh: number; learned: number };

const decksOf = (studentId: string) => sql<DeckRow[]>`
  SELECT d.id, d.title, d.ready_id, count(c.id)::int AS total,
    count(c.id) FILTER (WHERE c.due IS NOT NULL AND c.due <= now())::int AS due,
    count(c.id) FILTER (WHERE c.due IS NULL)::int AS fresh,
    count(c.id) FILTER (WHERE c.ivl >= 21)::int AS learned
  FROM decks d LEFT JOIN cards c ON c.deck_id = d.id WHERE d.student_id = ${studentId}
  GROUP BY d.id ORDER BY d.created_at`;

export default async function CardsPage({ searchParams }: { searchParams: { deck?: string; review?: string } }) {
  const me = await requireStudent();
  if (searchParams.review) return <ReviewPage studentId={me.id} deckId={searchParams.review} />;
  if (searchParams.deck) return <DeckPage studentId={me.id} deckId={searchParams.deck} />;
  const decks = await decksOf(me.id);
  const have = new Set(decks.map(d => d.readyId).filter(Boolean));
  const allDue = decks.reduce((a, d) => a + d.due + Math.min(d.fresh, NEW_PER_SESSION), 0);
  return (
    <div className="stack">
      <div className="row between">
        <p className="muted" style={{ maxWidth: 560 }}>Карточки для слов, кандзи и фраз. Карточка возвращается тем реже, чем лучше вы её помните — как в Anki.</p>
        {decks.length > 1 && allDue ? <Link href="/app/cards?review=all" className="btn pri">Повторить всё · {allDue}</Link> : null}
      </div>
      {decks.length ? (
        <div className="grid">{decks.map(d => {
          const todo = d.due + Math.min(d.fresh, NEW_PER_SESSION);
          return (
            <section key={d.id} className="panel stack" style={{ gap: 10 }}>
              <div className="row between"><h3>{d.title}</h3><span className="small muted num">{d.total} карт.</span></div>
              <div className="deck-stats"><span><b style={{ color: 'var(--danger)' }}>{d.due}</b> повторить</span><span><b style={{ color: 'var(--brand)' }}>{d.fresh}</b> новых</span><span><b style={{ color: 'var(--good)' }}>{d.learned}</b> выучено</span></div>
              <div className="row" style={{ gap: 6 }}>
                {todo ? <Link href={`/app/cards?review=${d.id}`} className="btn pri sm">Учить · {todo}</Link> : <span className="chip c-good">на сегодня всё</span>}
                <Link href={`/app/cards?deck=${d.id}`} className="btn ghost sm">Карточки</Link>
              </div>
            </section>
          );
        })}</div>
      ) : <div className="empty"><strong>Колод пока нет</strong>Создайте свою или возьмите готовую ниже.</div>}

      <section className="panel stack">
        <h2>Новая колода</h2>
        <ActionForm action={createDeck} submit="Создать колоду" pending="Создаём…">
          <label className="field"><span>Название</span><input type="text" name="title" required maxLength={100} placeholder="Например, Урок 5" /></label>
          <label className="field"><span>Карточки сразу (необязательно): по одной в строке, лицо и оборот через «;»</span><textarea name="lines" rows={4} lang="ja" placeholder={'猫 ; кошка\n犬 ; собака'} /></label>
        </ActionForm>
      </section>

      <section className="stack">
        <h2>Готовые колоды</h2>
        <div className="grid">{READY_DECKS.map(r => (
          <section key={r.id} className="panel stack" style={{ gap: 8 }}>
            <div className="row between"><h3>{r.title}</h3><span className="chip c-mute">{r.level}</span></div>
            <p className="small muted">{r.desc}</p>
            <p className="small" lang="ja">{r.cards.slice(0, 4).map(c => c.f.split('|')[0]).join(' · ')} …</p>
            <form action={addReadyDeck} className="row between">
              <input type="hidden" name="readyId" value={r.id} />
              <span className="small muted num">{r.cards.length} карточек</span>
              {have.has(r.id) ? <span className="chip c-good">уже у вас</span> : <Submit className="btn sm" pending="…">Добавить себе</Submit>}
            </form>
          </section>
        ))}</div>
      </section>
    </div>
  );
}

async function ReviewPage({ studentId, deckId }: { studentId: string; deckId: string }) {
  const all = deckId === 'all';
  const [deck] = all ? [{ title: 'Все колоды' }] : await sql<{ title: string }[]>`SELECT title FROM decks WHERE id = ${deckId} AND student_id = ${studentId}`;
  if (!deck) notFound();
  const due = await sql<ReviewCard[]>`
    SELECT c.id, c.front, c.back, c.reps, c.ivl, c.ef, c.lapses, c.due FROM cards c JOIN decks d ON d.id = c.deck_id
    WHERE d.student_id = ${studentId} AND (${all} OR d.id = ${deckId}) AND c.due IS NOT NULL AND c.due <= now() ORDER BY c.due LIMIT 300`;
  const fresh = await sql<ReviewCard[]>`
    SELECT c.id, c.front, c.back, c.reps, c.ivl, c.ef, c.lapses, c.due FROM cards c JOIN decks d ON d.id = c.deck_id
    WHERE d.student_id = ${studentId} AND (${all} OR d.id = ${deckId}) AND c.due IS NULL ORDER BY d.created_at, c.pos LIMIT ${NEW_PER_SESSION}`;
  const cards = [...due, ...fresh].map(c => ({ ...c, due: null }));
  return <Review cards={cards} title={deck.title} back="/app/cards" />;
}

async function DeckPage({ studentId, deckId }: { studentId: string; deckId: string }) {
  const [deck] = await sql<{ id: string; title: string }[]>`SELECT id, title FROM decks WHERE id = ${deckId} AND student_id = ${studentId}`;
  if (!deck) notFound();
  const cards = await sql<{ id: string; front: string; back: string; reps: number; ivl: number; due: Date | null }[]>`
    SELECT id, front, back, reps, ivl, due FROM cards WHERE deck_id = ${deck.id} ORDER BY pos`;
  return (
    <div className="stack">
      <div className="row between">
        <Link href="/app/cards" className="btn ghost sm" style={{ paddingLeft: 0 }}>← Все колоды</Link>
        <Link href={`/app/cards?review=${deck.id}`} className="btn pri sm">Учить</Link>
      </div>
      <form action={renameDeck} className="row">
        <input type="hidden" name="id" value={deck.id} />
        <input type="text" name="title" defaultValue={deck.title} required maxLength={100} aria-label="Название колоды" style={{ flex: '1 1 220px', fontWeight: 600 }} />
        <Submit className="btn sm" pending="…">Переименовать</Submit>
      </form>

      <section className="panel stack">
        <h3>Добавить карточку</h3>
        <ActionForm action={addCards} submit="Добавить" pending="…">
          <input type="hidden" name="deckId" value={deck.id} />
          <div className="fgrid">
            <label className="field"><span>Лицо</span><input type="text" name="front" maxLength={300} lang="ja" placeholder="食べる" /></label>
            <label className="field"><span>Оборот</span><input type="text" name="back" maxLength={500} placeholder="たべる — есть" /></label>
          </div>
          <details><summary className="small" style={{ cursor: 'pointer', color: 'var(--brand)' }}>Добавить много сразу</summary>
            <label className="field" style={{ marginTop: 8 }}><span>По одной в строке, лицо и оборот через «;» (можно скопировать из таблицы)</span><textarea name="lines" rows={5} lang="ja" /></label>
          </details>
        </ActionForm>
      </section>

      <section className="panel stack" style={{ gap: 10 }}>
        <h3>Карточки · {cards.length}</h3>
        {cards.length ? cards.map(c => (
          <details key={c.id} className="cardrow" style={{ display: 'block' }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none' }} className="cardrow" >
              <span lang="ja" style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{c.front}</span>
              <span className="small cb" style={{ overflowWrap: 'anywhere' }}>{c.back}</span>
              <span className={'chip ' + (c.due === null ? 'c-ai' : c.ivl >= 21 ? 'c-good' : 'c-mute')}>{c.due === null ? 'новая' : ivlLabel(c.ivl)}</span>
            </summary>
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <form action={updateCard} className="row" style={{ flex: '1 1 300px', gap: 6 }}>
                <input type="hidden" name="id" value={c.id} />
                <input type="text" name="front" defaultValue={c.front} required lang="ja" style={{ flex: '1 1 120px' }} aria-label="Лицо" />
                <input type="text" name="back" defaultValue={c.back} required style={{ flex: '2 1 160px' }} aria-label="Оборот" />
                <Submit className="btn sm" pending="…">Сохранить</Submit>
              </form>
              {c.due !== null ? <form action={resetCard}><input type="hidden" name="id" value={c.id} /><Submit className="btn ghost sm" pending="…">Учить заново</Submit></form> : null}
              <form action={deleteCard}><input type="hidden" name="id" value={c.id} /><Submit className="btn ghost sm danger" pending="…">Удалить</Submit></form>
            </div>
          </details>
        )) : <p className="muted">В колоде пока нет карточек.</p>}
      </section>
      <form action={deleteDeck}><input type="hidden" name="id" value={deck.id} /><Submit className="btn ghost sm danger" pending="…">Удалить колоду целиком</Submit></form>
    </div>
  );
}
