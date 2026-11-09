import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { getStudent } from '@/lib/students';
import { getWorkspace, goalsOf, fio, FORMATS, LEVELS } from '@/lib/workspace';
import { ActionForm, Submit } from '@/components/forms';
import { saveStudent, setArchived, resetPassword } from '../../actions';
import { sql } from '@/lib/db';
import { studentLessons, upcoming, balanceOf, LESSON_STATUS } from '@/lib/schedule';
import { fmtDay, fmtWhen, timeEnd, todayMsk, rub, plural } from '@/lib/dates';
import { OwnerHomeworkView, type HwRow } from '@/components/Homework';
import { hwStatus } from '@/lib/files';
import { ivlLabel } from '@/lib/srs';
import { addLessons, addPayment, deletePayment, setLessonStatus, decidePayNotice } from '../../schedule-actions';

const TABS = [['profile', 'Профиль'], ['lessons', 'Занятия и оплаты'], ['homework', 'Задания'], ['progress', 'Прогресс']] as const;

export const metadata = { title: 'Ученик' };

export default async function StudentPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const owner = await requireOwner();
  const [s, ws] = await Promise.all([getStudent(owner.workspaceId, params.id), getWorkspace(owner.workspaceId)]);
  if (!s || s.status === 'pending') notFound();
  const goals = [...goalsOf(ws), ...s.goals.filter(g => !goalsOf(ws).includes(g))];
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab : 'profile';
  return (
    <div className="stack">
      <div className="row between">
        <div><Link href="/app" className="btn ghost sm" style={{ paddingLeft: 0 }}>← Все ученики</Link><h2 style={{ fontSize: '1.4rem', marginTop: 4 }}>{fio(s)}</h2><div className="small muted">{s.email}</div></div>
        {s.status === 'active' ? (
          <form action={setArchived}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="archived" value="1" /><Submit className="btn ghost sm danger" pending="…">Убрать в архив</Submit></form>
        ) : <span className="chip c-mute">в архиве</span>}
      </div>

      <nav className="tabs" aria-label="Разделы ученика" style={{ marginBottom: 0 }}>
        {TABS.map(([k, l]) => <Link key={k} href={`/app/students/${s.id}?tab=${k}`} className="tab" aria-current={tab === k ? 'page' : undefined}>{l}</Link>)}
      </nav>

      {tab === 'homework' ? <HomeworkTab id={s.id} name={fio(s)} /> : null}
      {tab === 'progress' ? <ProgressTab id={s.id} /> : null}
      {tab === 'lessons' ? <LessonsTab studentId={s.id} price={s.price} priceLessons={s.priceLessons} active={s.status === 'active'} /> : tab === 'profile' ? <>
      <section className="panel stack">
        <div className="row between"><h3>Доступ</h3><span className="small muted">Логин: <strong className="cred" style={{ color: 'var(--ink)' }}>{s.email}</strong></span></div>
        <ActionForm action={resetPassword} submit="Выдать новый пароль" pending="…" submitClass="btn sm"><input type="hidden" name="userId" value={s.userId} /><p className="small muted">Старый пароль перестанет работать, ученика выкинет из кабинета на всех устройствах.</p></ActionForm>
      </section>

      <ActionForm action={saveStudent} submit="Сохранить">
        <input type="hidden" name="id" value={s.id} />
        <section className="panel stack">
          <h3>Данные ученика</h3>
          <div className="fgrid">
            <label className="field"><span>Фамилия</span><input name="lastName" type="text" defaultValue={s.lastName} required /></label>
            <label className="field"><span>Имя</span><input name="firstName" type="text" defaultValue={s.firstName} required /></label>
            <label className="field"><span>Отчество</span><input name="middleName" type="text" defaultValue={s.middleName} /></label>
          </div>
          <label className="field"><span>Связь (Telegram, телефон)</span><input name="contact" type="text" defaultValue={s.contact} /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend className="small muted" style={{ marginBottom: 6 }}>Цели</legend>
            <div className="choices">{goals.map(g => <label key={g} className="gchip"><input type="checkbox" name="goal" value={g} defaultChecked={s.goals.includes(g)} />{g}</label>)}</div>
          </fieldset>
          {s.about ? <div className="small" style={{ background: 'var(--sunk)', borderRadius: 8, padding: '12px 14px' }}><div className="label" style={{ marginBottom: 4 }}>Ученик о себе</div><p className="pre">{s.about}</p></div> : null}
          <p className="small muted">Уровень при регистрации: {s.startLevel || '—'}</p>
        </section>

        <section className="panel stack">
          <h3>Обучение</h3>
          <div className="fgrid">
            <label className="field"><span>Формат</span><select name="format" defaultValue={s.format}>{Object.entries(FORMATS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Уровень</span><select name="level" defaultValue={s.level}>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>
            <label className="field"><span>Учебник / курс</span><input name="book" type="text" defaultValue={s.book} placeholder="Например, Minna no Nihongo I" /></label>
          </div>
          <label className="field"><span>Сообщение ученику (видит на главной)</span><textarea name="message" rows={2} defaultValue={s.message} /></label>
        </section>

        <section className="panel stack">
          <h3>Цена и созвон</h3>
          <div className="fgrid">
            <label className="field"><span>Сумма, ₽</span><input name="price" type="number" min={0} defaultValue={s.price || ''} /></label>
            <label className="field"><span>За сколько занятий</span><input name="priceLessons" type="number" min={1} defaultValue={s.priceLessons} /></label>
            <label className="field"><span>Пояснение (видит ученик)</span><input name="priceNote" type="text" defaultValue={s.priceNote} placeholder="Например, абонемент на месяц" /></label>
          </div>
          <div className="fgrid">
            <label className="field"><span>Где созваниваетесь</span><select name="callMode" defaultValue={s.callMode}>
              <option value="default">{ws?.callUrl ? 'Общая ссылка из настроек' : 'Общая ссылка (не задана)'}</option>
              <option value="link">Своя ссылка для ученика</option>
              <option value="discord">Discord</option>
              <option value="none">Без ссылки</option>
            </select></label>
            <label className="field"><span>Ссылка (своя или приглашение в Discord)</span><input name="callUrl" type="url" defaultValue={s.callUrl} placeholder="https://" /></label>
          </div>
          <label className="field"><span>Подсказка для Discord (ник, сервер, канал)</span><input name="callNote" type="text" defaultValue={s.callNote} /></label>
        </section>

        <section className="panel stack">
          <h3>Личные заметки</h3>
          <label className="field"><span>Видите только вы</span><textarea name="privateNote" rows={3} defaultValue={s.privateNote} /></label>
        </section>
      </ActionForm>
      </> : null}
    </div>
  );
}

async function LessonsTab({ studentId, price, priceLessons, active }: { studentId: string; price: number; priceLessons: number; active: boolean }) {
  const [lessons, bal, pays, notices] = await Promise.all([
    studentLessons(studentId), balanceOf(studentId),
    sql<{ id: string; day: Date; lessons: number; amount: number; note: string }[]>`SELECT id, day, lessons, amount, note FROM payments WHERE student_id = ${studentId} ORDER BY day DESC, created_at DESC LIMIT 100`,
    sql<{ id: string; amount: number; comment: string; createdAt: Date }[]>`SELECT id, amount, comment, created_at FROM pay_notices WHERE student_id = ${studentId} AND status = 'pending' ORDER BY created_at`,
  ]);
  const next = upcoming(lessons);
  const past = lessons.filter(l => !next.includes(l));
  return (
    <div className="stack">
      <div className="grid">
        <div className="panel"><div className="label">Баланс</div><div className="big" style={{ marginTop: 4, color: bal.left < 0 ? 'var(--danger)' : undefined }}>{bal.left}</div><div className="small muted">оплачено {bal.paid} · списано {bal.used}</div></div>
        <div className="panel"><div className="label">Впереди</div><div className="big" style={{ marginTop: 4 }}>{next.length}</div><div className="small muted">{next[0] ? `ближайшее ${fmtDay(next[0].day)}, ${next[0].time}` : 'занятий нет'}</div></div>
      </div>

      {notices.map(n => (
        <div key={n.id} className="panel item attn">
          <div>Ученик сообщает об оплате <b>{rub(n.amount)}</b> · <span className="small muted">{fmtWhen(n.createdAt)}</span>{n.comment ? <div className="small muted pre">{n.comment}</div> : null}</div>
          <form action={decidePayNotice} className="row" style={{ gap: 6 }}>
            <input type="hidden" name="id" value={n.id} />
            <label className="row small" style={{ gap: 6 }}>зачесть <input className="mini" type="number" name="lessons" min={0} max={200} defaultValue={price ? Math.max(1, Math.round((n.amount / price) * priceLessons)) : 1} /> зан.</label>
            <button className="btn pri sm" name="decision" value="ok">Деньги пришли</button>
            <button className="btn ghost sm danger" name="decision" value="no">Не нашёл</button>
          </form>
        </div>
      ))}

      {active ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <section className="panel stack">
            <h3>Поставить урок</h3>
            <ActionForm action={addLessons} submit="Добавить" pending="Добавляем…">
              <input type="hidden" name="studentId" value={studentId} />
              <div className="fgrid">
                <label className="field"><span>Дата</span><input type="date" name="day" defaultValue={todayMsk()} required /></label>
                <label className="field"><span>Время</span><input type="time" name="time" defaultValue="18:00" required /></label>
                <label className="field"><span>Минут</span><select name="dur" defaultValue="60">{[30, 45, 60, 90, 120].map(d => <option key={d}>{d}</option>)}</select></label>
              </div>
              <label className="field"><span>Повторять каждую неделю</span><select name="repeat" defaultValue="1">
                <option value="1">Не повторять</option>{[4, 8, 12, 16, 26].map(n => <option key={n} value={n}>{n} {plural(n, 'неделю', 'недели', 'недель')}</option>)}
              </select></label>
            </ActionForm>
          </section>
          <section className="panel stack">
            <h3>Записать оплату</h3>
            <ActionForm action={addPayment} submit="Записать" pending="…">
              <input type="hidden" name="studentId" value={studentId} />
              <div className="fgrid">
                <label className="field"><span>Сумма, ₽</span><input type="number" name="amount" min={0} defaultValue={price || ''} /></label>
                <label className="field"><span>Занятий</span><input type="number" name="lessons" min={1} max={200} defaultValue={priceLessons || 1} required /></label>
                <label className="field"><span>Дата</span><input type="date" name="day" defaultValue={todayMsk()} /></label>
              </div>
              <label className="field"><span>Комментарий</span><input type="text" name="note" maxLength={200} /></label>
            </ActionForm>
          </section>
        </div>
      ) : null}

      <section className="panel stack">
        <h3>Занятия</h3>
        {lessons.length ? <div className="tbl-wrap"><table>
          <thead><tr><th>Когда</th><th>Тема</th><th>Статус</th><th></th></tr></thead>
          <tbody>{[...next, ...past].map(l => (
            <tr key={l.id}>
              <td className="num"><Link href={`/app/calendar?week=${l.day instanceof Date ? l.day.toISOString().slice(0, 10) : l.day}&ev=${l.id}`}>{fmtDay(l.day)}, {l.time}–{timeEnd(l.time, l.dur)}</Link></td>
              <td className="small">{l.topic || <span className="muted">—</span>}</td>
              <td><span className={'chip ' + LESSON_STATUS[l.status][1]}>{LESSON_STATUS[l.status][0]}</span></td>
              <td>{l.status === 'plan' && !next.includes(l) ? (
                <form action={setLessonStatus} className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="btn sm" name="status" value="done">Проведён</button>
                  <button className="btn ghost sm" name="status" value="noshow">Пропуск</button>
                </form>) : null}</td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="muted">Занятий ещё не было.</p>}
      </section>

      <section className="panel stack">
        <h3>Оплаты</h3>
        {pays.length ? <div className="tbl-wrap"><table>
          <thead><tr><th>Дата</th><th>Сумма</th><th>Занятий</th><th>Комментарий</th><th></th></tr></thead>
          <tbody>{pays.map(p => (
            <tr key={p.id}><td className="num">{fmtDay(p.day, false)}</td><td className="num">{p.amount ? rub(p.amount) : '—'}</td><td className="num">+{p.lessons}</td><td className="small muted">{p.note}</td>
              <td><form action={deletePayment}><input type="hidden" name="id" value={p.id} /><Submit className="btn ghost sm danger" pending="…">Удалить</Submit></form></td></tr>
          ))}</tbody>
        </table></div> : <p className="muted">Оплат пока нет.</p>}
      </section>
    </div>
  );
}

async function HomeworkTab({ id, name }: { id: string; name: string }) {
  const list = await sql<HwRow[]>`SELECT * FROM homework WHERE student_id = ${id} ORDER BY created_at DESC`;
  const today = todayMsk();
  return <OwnerHomeworkView fixedStudent={id} active={[{ id, name }]} today={today}
    toCheck={list.filter(h => hwStatus(h, today) === 'sent')}
    waiting={list.filter(h => ['new', 'late', 'redo'].includes(hwStatus(h, today)))}
    done={list.filter(h => hwStatus(h, today) === 'checked')} />;
}

async function ProgressTab({ id }: { id: string }) {
  const [decks, kana, hw] = await Promise.all([
    sql<{ id: string; title: string; total: number; fresh: number; learned: number; due: number; lastIvl: number }[]>`
      SELECT d.id, d.title, count(c.id)::int AS total, count(c.id) FILTER (WHERE c.due IS NULL)::int AS fresh,
        count(c.id) FILTER (WHERE c.ivl >= 21)::int AS learned, count(c.id) FILTER (WHERE c.due <= now())::int AS due
      FROM decks d LEFT JOIN cards c ON c.deck_id = d.id WHERE d.student_id = ${id} GROUP BY d.id ORDER BY d.created_at`,
    sql<{ rightCount: number; wrongCount: number; bestStreak: number; weak: Record<string, number>; updatedAt: Date }[]>`SELECT * FROM kana_progress WHERE student_id = ${id}`,
    sql<{ grade: string | null; reviewedAt: Date | null; answeredAt: Date | null }[]>`SELECT grade, reviewed_at, answered_at FROM homework WHERE student_id = ${id}`,
  ]);
  const k = kana[0];
  const weak = k ? Object.entries(k.weak).sort((a, b) => b[1] - a[1]).slice(0, 16) : [];
  const grades = hw.filter(h => h.grade && /^[2-5]$/.test(h.grade)).map(h => Number(h.grade));
  const avg = grades.length ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1).replace('.', ',') : '—';
  return (
    <div className="stack">
      <div className="grid">
        <div className="panel"><div className="label">Заданий сдано</div><div className="big" style={{ marginTop: 4 }}>{hw.filter(h => h.answeredAt).length}<span className="muted" style={{ fontSize: '1rem' }}> / {hw.length}</span></div><div className="small muted">средняя оценка {avg}</div></div>
        <div className="panel"><div className="label">Карточек выучено</div><div className="big" style={{ marginTop: 4 }}>{decks.reduce((a, d) => a + d.learned, 0)}</div><div className="small muted">из {decks.reduce((a, d) => a + d.total, 0)} · интервал от {ivlLabel(21)}</div></div>
        <div className="panel"><div className="label">Кана</div><div className="big" style={{ marginTop: 4 }}>{k ? Math.round((k.rightCount / Math.max(1, k.rightCount + k.wrongCount)) * 100) + '%' : '—'}</div><div className="small muted">{k ? `верно ${k.rightCount} из ${k.rightCount + k.wrongCount} · рекорд ${k.bestStreak}` : 'ещё не занимался'}</div></div>
      </div>
      <section className="panel stack">
        <h3>Колоды карточек</h3>
        {decks.length ? <div className="tbl-wrap"><table>
          <thead><tr><th>Колода</th><th>Всего</th><th>Новых</th><th>Выучено</th><th>Ждут повторения</th></tr></thead>
          <tbody>{decks.map(d => <tr key={d.id}><td>{d.title}</td><td className="num">{d.total}</td><td className="num">{d.fresh}</td><td className="num">{d.learned}</td><td className="num">{d.due ? <span className="chip c-warn">{d.due}</span> : 0}</td></tr>)}</tbody>
        </table></div> : <p className="muted">Ученик ещё не завёл колоды.</p>}
      </section>
      {weak.length ? <section className="panel stack"><h3>Трудные знаки каны</h3><div className="weak">{weak.map(([c, n]) => <span key={c} lang="ja">{c}<small>×{n}</small></span>)}</div>{k ? <p className="small muted">Последняя тренировка: {fmtWhen(k.updatedAt)}</p> : null}</section> : null}
    </div>
  );
}
