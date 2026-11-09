import Link from 'next/link';
import { requireOwner } from '@/lib/auth';
import { sql } from '@/lib/db';
import { listStudents } from '@/lib/students';
import { fio } from '@/lib/workspace';
import { lessonsInRange, slotsInRange, pendingRequests, LESSON_STATUS, type LessonRow } from '@/lib/schedule';
import { addDays, mondayOf, todayMsk, isDate, ymd, fmtDay, timeEnd, WD, rub, plural, isPast } from '@/lib/dates';
import { ActionForm, Submit } from '@/components/forms';
import { addLessons, addSlots, updateLesson, deleteLesson, deleteSlot, decideRequest, decidePayNotice, setLessonStatus } from '../schedule-actions';

export const metadata = { title: 'Календарь' };
const DURS = [30, 45, 60, 90, 120];

export default async function CalendarPage({ searchParams }: { searchParams: { week?: string; ev?: string } }) {
  const owner = await requireOwner();
  const ws = owner.workspaceId!;
  const today = todayMsk();
  const mon = mondayOf(isDate(searchParams.week) ? searchParams.week : today);
  const sun = addDays(mon, 6);
  const [lessons, slots, requests, students, notices, unmarked] = await Promise.all([
    lessonsInRange(ws, mon, sun),
    slotsInRange(ws, mon, sun),
    pendingRequests(ws),
    listStudents(ws),
    sql<{ id: string; studentId: string; amount: number; comment: string; createdAt: Date; lastName: string; firstName: string; price: number; priceLessons: number }[]>`
      SELECT n.id, n.student_id, n.amount, n.comment, n.created_at, s.last_name, s.first_name, s.price, s.price_lessons
      FROM pay_notices n JOIN students s ON s.id = n.student_id WHERE n.workspace_id = ${ws} AND n.status = 'pending' ORDER BY n.created_at`,
    sql<LessonRow[]>`
      SELECT l.*, s.last_name, s.first_name, s.format FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.workspace_id = ${ws} AND l.status = 'plan' AND l.day BETWEEN ${addDays(today, -60)} AND ${today} ORDER BY l.day, l.time`,
  ]);
  const past = unmarked.filter(l => isPast(l.day, timeEnd(l.time, l.dur)));
  const active = students.filter(s => s.status === 'active');
  const reqSlots = new Set(requests.map(r => r.slotId));
  const ev = searchParams.ev ? (await sql<LessonRow[]>`
      SELECT l.*, s.last_name, s.first_name, s.format FROM lessons l JOIN students s ON s.id = l.student_id
      WHERE l.id = ${searchParams.ev} AND l.workspace_id = ${ws}`)[0] : undefined;
  const q = (w: string) => `/app/calendar?week=${w}`;

  return (
    <div className="stack">
      {requests.length || notices.length || past.length ? (
        <section className="panel stack attn">
          <h2>Нужно ваше решение</h2>
          {requests.map(r => (
            <div key={r.id} className="item">
              <div>
                <strong>{r.lastName} {r.firstName}</strong>{' '}
                {r.kind === 'move'
                  ? <>просит перенести урок {r.fromDay ? <>с <b>{fmtDay(r.fromDay)} {r.fromTime}</b> </> : null}на <b>{fmtDay(r.day)} {r.time}</b></>
                  : <>хочет записаться на <b>{fmtDay(r.day)} {r.time}</b></>}
              </div>
              <form action={decideRequest} className="row" style={{ gap: 6 }}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn pri sm" name="decision" value="ok">Подтвердить</button>
                <button className="btn ghost sm danger" name="decision" value="no">Отклонить</button>
              </form>
            </div>
          ))}
          {notices.map(n => {
            const guess = n.price ? Math.max(1, Math.round((n.amount / n.price) * n.priceLessons)) : 1;
            return (
              <div key={n.id} className="item">
                <div>
                  <strong>{n.lastName} {n.firstName}</strong> сообщает об оплате <b>{rub(n.amount)}</b>
                  {n.comment ? <div className="small muted pre">{n.comment}</div> : null}
                </div>
                <form action={decidePayNotice} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="id" value={n.id} />
                  <label className="row small" style={{ gap: 6 }}>зачесть <input className="mini" type="number" name="lessons" min={0} max={200} defaultValue={guess} /> зан.</label>
                  <button className="btn pri sm" name="decision" value="ok">Деньги пришли</button>
                  <button className="btn ghost sm danger" name="decision" value="no">Не нашёл</button>
                </form>
              </div>
            );
          })}
          {past.length ? (
            <details open={past.length <= 5}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Отметьте прошедшие уроки · {past.length}</summary>
              <div className="stack" style={{ marginTop: 10 }}>
                {past.map(l => (
                  <div key={l.id} className="item">
                    <div><b className="num">{fmtDay(l.day)} {l.time}</b> · {l.lastName} {l.firstName}{l.topic ? <span className="muted"> · {l.topic}</span> : null}</div>
                    <form action={setLessonStatus} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="btn sm" name="status" value="done">Проведён</button>
                      <button className="btn ghost sm" name="status" value="noshow">Пропуск</button>
                      <button className="btn ghost sm" name="status" value="cancel">Отменён</button>
                    </form>
                  </div>
                ))}
                <p className="small muted">«Проведён» и «Пропуск» списывают занятие с баланса ученика, «Отменён» — нет.</p>
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {ev ? <LessonEditor ev={ev} back={q(mon)} /> : null}

      <section className="stack">
        <div className="row between">
          <h2>{fmtDay(mon, false)} — {fmtDay(sun, false)}</h2>
          <div className="row" style={{ gap: 4 }}>
            <Link className="btn sm" href={q(addDays(mon, -7))} aria-label="Предыдущая неделя">←</Link>
            {mon !== mondayOf(today) ? <Link className="btn sm" href={q(today)}>Сегодня</Link> : null}
            <Link className="btn sm" href={q(addDays(mon, 7))} aria-label="Следующая неделя">→</Link>
          </div>
        </div>
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(mon, i);
            const ls = lessons.filter(l => ymd(l.day) === d);
            const ss = slots.filter(s => ymd(s.day) === d && !s.lessonId);
            const items = [...ls.map(l => ({ t: l.time, l })), ...ss.map(s => ({ t: s.time, s }))].sort((a, b) => a.t.localeCompare(b.t));
            return (
              <div key={d} className={'wday' + (d === today ? ' today' : '')}>
                <h4>{WD[(i + 1) % 7]} {Number(d.slice(8))}</h4>
                {items.map(x => 'l' in x && x.l ? (
                  <Link key={x.l.id} href={`${q(mon)}&ev=${x.l.id}`} className={'ev ' + x.l.status} aria-current={ev?.id === x.l.id ? 'true' : undefined} scroll={false}>
                    <b>{x.l.time}–{timeEnd(x.l.time, x.l.dur)}</b>{x.l.lastName} {x.l.firstName[0]}.{x.l.topic ? <span className="muted"> · {x.l.topic}</span> : null}
                  </Link>
                ) : 's' in x && x.s ? (
                  <div key={x.s.id} className={'ev slot' + (reqSlots.has(x.s.id) ? ' req' : '')}>
                    <span><b>{x.s.time}</b>{reqSlots.has(x.s.id) ? 'запрос' : 'свободно'}</span>
                    {!reqSlots.has(x.s.id) ? <form action={deleteSlot}><input type="hidden" name="id" value={x.s.id} /><button className="xbtn" aria-label={`Закрыть окно ${x.s.time}`}>×</button></form> : null}
                  </div>
                ) : null)}
              </div>
            );
          })}
        </div>
        <p className="small muted">Пунктиром — свободные окна: их видят ученики и могут записаться или перенести урок. Нажмите на урок, чтобы изменить его.</p>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <section className="panel stack">
          <h3>Поставить урок</h3>
          {active.length ? (
            <ActionForm action={addLessons} submit="Добавить" pending="Добавляем…">
              <label className="field"><span>Ученик</span><select name="studentId" required>{active.map(s => <option key={s.id} value={s.id}>{fio(s)}</option>)}</select></label>
              <div className="fgrid">
                <label className="field"><span>Дата</span><input type="date" name="day" defaultValue={today} required /></label>
                <label className="field"><span>Время</span><input type="time" name="time" defaultValue="18:00" required /></label>
                <label className="field"><span>Минут</span><select name="dur" defaultValue="60">{DURS.map(d => <option key={d}>{d}</option>)}</select></label>
              </div>
              <div className="fgrid">
                <label className="field"><span>Повторять каждую неделю</span><select name="repeat" defaultValue="1">
                  <option value="1">Не повторять</option>{[4, 8, 12, 16, 26].map(n => <option key={n} value={n}>{n} {plural(n, 'неделю', 'недели', 'недель')}</option>)}
                </select></label>
                <label className="field"><span>Тема (необязательно)</span><input type="text" name="topic" maxLength={200} /></label>
              </div>
            </ActionForm>
          ) : <p className="muted">Сначала примите хотя бы одного ученика.</p>}
        </section>
        <section className="panel stack">
          <div><h3>Открыть свободные окна</h3><p className="small muted" style={{ marginTop: 4 }}>Для записи на разовые занятия и переносов.</p></div>
          <ActionForm action={addSlots} submit="Открыть" pending="Открываем…">
            <div className="fgrid">
              <label className="field"><span>Дата</span><input type="date" name="day" defaultValue={today} required /></label>
              <label className="field"><span>Минут</span><select name="dur" defaultValue="60">{DURS.map(d => <option key={d}>{d}</option>)}</select></label>
            </div>
            <label className="field"><span>Время через запятую</span><input type="text" name="times" placeholder="10:00, 12:00, 18:30" required /></label>
            <label className="field"><span>Повторять каждую неделю</span><select name="repeat" defaultValue="1">
              <option value="1">Не повторять</option>{[2, 4, 8, 12].map(n => <option key={n} value={n}>{n} {plural(n, 'неделю', 'недели', 'недель')}</option>)}
            </select></label>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}

function LessonEditor({ ev, back }: { ev: LessonRow; back: string }) {
  return (
    <section className="panel stack" id="lesson">
      <div className="row between">
        <div><h3>{ev.lastName} {ev.firstName}</h3><div className="small muted">{fmtDay(ev.day)} · {ev.time}–{timeEnd(ev.time, ev.dur)} · <span className={'chip ' + LESSON_STATUS[ev.status][1]}>{LESSON_STATUS[ev.status][0]}</span></div></div>
        <div className="row" style={{ gap: 4 }}>
          <Link href={`/app/students/${ev.studentId}?tab=lessons`} className="btn ghost sm">Профиль ученика</Link>
          <Link href={back} className="btn ghost sm" scroll={false}>Закрыть</Link>
        </div>
      </div>
      <ActionForm action={updateLesson} submit="Сохранить">
        <input type="hidden" name="id" value={ev.id} />
        <div className="fgrid">
          <label className="field"><span>Дата</span><input type="date" name="day" defaultValue={ymd(ev.day)} required /></label>
          <label className="field"><span>Время</span><input type="time" name="time" defaultValue={ev.time} required /></label>
          <label className="field"><span>Минут</span><select name="dur" defaultValue={String(ev.dur)}>{DURS.map(d => <option key={d}>{d}</option>)}</select></label>
          <label className="field"><span>Статус</span><select name="status" defaultValue={ev.status}>{Object.entries(LESSON_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <div className="fgrid">
          <label className="field"><span>Тема</span><input type="text" name="topic" defaultValue={ev.topic} maxLength={200} /></label>
          <label className="field"><span>Ссылка только на этот урок</span><input type="url" name="callUrl" defaultValue={ev.callUrl} placeholder="https://" /></label>
        </div>
      </ActionForm>
      <form action={deleteLesson}><input type="hidden" name="id" value={ev.id} /><Submit className="btn ghost sm danger" pending="…">Удалить урок</Submit></form>
    </section>
  );
}
