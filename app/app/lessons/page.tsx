import Link from 'next/link';
import { requireStudent } from '@/lib/me';
import { getWorkspace } from '@/lib/workspace';
import { studentLessons, upcoming, freeSlots, myRequests, callInfo, LESSON_STATUS, type Slot } from '@/lib/schedule';
import { fmtDay, timeEnd, ymd } from '@/lib/dates';
import { ActionForm, Submit } from '@/components/forms';
import { CallButton } from '@/components/CallBlock';
import { requestSlot, cancelRequest } from '../schedule-actions';

export const metadata = { title: 'Занятия' };

export default async function LessonsPage({ searchParams }: { searchParams: { move?: string } }) {
  const me = await requireStudent();
  const [ws, lessons, free, reqs] = await Promise.all([getWorkspace(me.workspaceId), studentLessons(me.id), freeSlots(me.workspaceId, me.id), myRequests(me.id)]);
  const next = upcoming(lessons);
  const past = lessons.filter(l => !next.includes(l)).slice(0, 30);
  const moving = searchParams.move ? next.find(l => l.id === searchParams.move) : undefined;
  const pending = reqs.filter(r => r.status === 'pending');
  const movePending = new Set(pending.filter(r => r.kind === 'move').map(r => r.lessonId));

  return (
    <div className="stack">
      {reqs.length ? (
        <section className="panel stack attn">
          <h3>Ваши запросы</h3>
          {reqs.map(r => (
            <div key={r.id} className="item">
              <div>
                {r.kind === 'move' ? <>Перенос {r.fromDay ? <>с {fmtDay(r.fromDay)} {r.fromTime} </> : null}на <b>{fmtDay(r.day)} {r.time}</b></> : <>Запись на <b>{fmtDay(r.day)} {r.time}</b></>}
                <div className="small">{r.status === 'pending' ? <span className="chip c-warn">ждёт подтверждения</span> : <span className="chip c-bad">преподаватель отклонил — выберите другое время</span>}</div>
              </div>
              {r.status === 'pending' ? <form action={cancelRequest}><input type="hidden" name="id" value={r.id} /><Submit className="btn ghost sm" pending="…">Отозвать</Submit></form> : null}
            </div>
          ))}
        </section>
      ) : null}

      {moving ? (
        <section className="panel stack" id="pick">
          <div className="row between">
            <div><h2>Перенести занятие</h2><p className="small muted" style={{ marginTop: 4 }}>Сейчас: {fmtDay(moving.day)}, {moving.time}. Выберите новое время — преподаватель подтвердит.</p></div>
            <Link href="/app/lessons" className="btn ghost sm">Отмена</Link>
          </div>
          <SlotPicker slots={free} lessonId={moving.id} submit="Попросить перенос" />
        </section>
      ) : null}

      <section className="panel stack">
        <h2>Ближайшие занятия</h2>
        {next.length ? next.map((l, i) => (
          <div key={l.id} className="item">
            <div>
              <b className="num">{fmtDay(l.day)}, {l.time}–{timeEnd(l.time, l.dur)}</b>
              {l.topic ? <div className="small muted">{l.topic}</div> : null}
              {movePending.has(l.id) ? <div className="small"><span className="chip c-warn">перенос ждёт подтверждения</span></div> : null}
            </div>
            <div className="row" style={{ gap: 6 }}>
              {i === 0 ? <CallButton info={callInfo(ws, me, l)} className="btn pri sm" /> : null}
              <Link href={`/app/lessons?move=${l.id}#pick`} className="btn sm">Перенести</Link>
            </div>
          </div>
        )) : <p className="muted">{me.format === 'sub' ? 'Преподаватель ещё не поставил занятия в расписание.' : 'Выберите свободное время ниже.'}</p>}
      </section>

      {!moving ? (
        <section className="panel stack">
          <div><h2>{me.format === 'one' ? 'Записаться на занятие' : 'Дополнительное занятие'}</h2><p className="small muted" style={{ marginTop: 4 }}>Свободное время преподавателя. После вашей записи он подтвердит занятие.</p></div>
          <SlotPicker slots={free} submit="Записаться" />
        </section>
      ) : null}

      {past.length ? (
        <details className="panel"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Прошедшие занятия · {past.length}</summary>
          <div className="stack" style={{ marginTop: 12 }}>{past.map(l => (
            <div key={l.id} className="item"><span className="num">{fmtDay(l.day)}, {l.time}{l.topic ? <span className="muted"> · {l.topic}</span> : null}</span><span className={'chip ' + LESSON_STATUS[l.status][1]}>{LESSON_STATUS[l.status][0]}</span></div>
          ))}</div>
        </details>
      ) : null}
    </div>
  );
}

function SlotPicker({ slots, lessonId, submit }: { slots: Slot[]; lessonId?: string; submit: string }) {
  if (!slots.length) return <div className="empty"><strong>Свободного времени пока нет</strong>Напишите преподавателю — он откроет новые окна.</div>;
  const days = [...new Set(slots.map(s => ymd(s.day)))];
  return (
    <ActionForm action={requestSlot} submit={submit} pending="Отправляем…">
      {lessonId ? <input type="hidden" name="lessonId" value={lessonId} /> : null}
      {days.map(d => (
        <div key={d} className="day-group">
          <div className="label">{fmtDay(d)}</div>
          <div className="choices">{slots.filter(s => ymd(s.day) === d).map(s => (
            <label key={s.id} className="gchip num"><input type="radio" name="slotId" value={s.id} required />{s.time}–{timeEnd(s.time, s.dur)}</label>
          ))}</div>
        </div>
      ))}
    </ActionForm>
  );
}
