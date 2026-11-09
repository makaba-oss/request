import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listStudents, studentByUser, listWaitingAccounts } from '@/lib/students';
import { getWorkspace, goalsOf, fio, FORMATS, START_LEVELS } from '@/lib/workspace';
import { ActionForm, Submit } from '@/components/forms';
import { CallButton } from '@/components/CallBlock';
import { studentLessons, balanceOf, balances, upcoming, callInfo } from '@/lib/schedule';
import { fmtDay, rub, plural, todayMsk } from '@/lib/dates';
import { sql } from '@/lib/db';
import { registerStudent, acceptStudent, rejectStudent, setArchived, createAccount, resetPassword, deleteAccount } from './actions';

export const metadata = { title: 'Кабинет' };

const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }) : '';

export default async function AppHome() {
  const user = await requireUser();
  if (user.role === 'owner') return <OwnerHome workspaceId={user.workspaceId!} />;

  const ws = await getWorkspace();
  const me = await studentByUser(user.id);
  if (!me) return <RegisterForm goals={goalsOf(ws)} />;
  if (me.status === 'pending') {
    return (
      <div className="panel stack" style={{ maxWidth: 600 }}>
        <h2>Заявка отправлена</h2>
        <p>{me.firstName}, преподаватель посмотрит вашу анкету и откроет кабинет. Загляните сюда чуть позже.</p>
        {ws?.contact ? <p className="small muted">Связь с преподавателем: <span style={{ userSelect: 'all' }}>{ws.contact}</span></p> : null}
      </div>
    );
  }
  if (me.status === 'archived') {
    return <div className="empty"><strong>Кабинет сейчас закрыт</strong>Чтобы продолжить занятия, напишите преподавателю{ws?.contact ? `: ${ws.contact}` : ''}.</div>;
  }
  return <StudentHome me={me} ws={ws} />;
}

async function StudentHome({ me, ws }: { me: NonNullable<Awaited<ReturnType<typeof studentByUser>>>; ws: Awaited<ReturnType<typeof getWorkspace>> }) {
  const [lessons, bal] = await Promise.all([studentLessons(me.id), balanceOf(me.id)]);
  const next = upcoming(lessons);
  const n = next[0];
  const call = n ? callInfo(ws, me, n) : null;
  return (
    <div className="stack">
      <div>
        <div className="muted">Здравствуйте,</div>
        <h2 style={{ fontSize: '1.5rem' }}>{me.firstName}</h2>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <span className="chip c-ai">{FORMATS[me.format][0]}</span>
          {me.level ? <span className="chip c-mute">{me.level}</span> : null}
          {me.book ? <span className="small muted">{me.book}</span> : null}
        </div>
      </div>
      {n ? (
        <div className="call">
          <div className="label" style={{ color: 'inherit', opacity: .8 }}>Ближайшее занятие</div>
          <div className="big">{fmtDay(n.day)}, {n.time}</div>
          <div className="muted">{n.dur} мин{n.topic ? ' · ' + n.topic : ''}</div>
          <div className="row"><CallButton info={call} /><Link href="/app/lessons" className="btn ghost sm" style={{ color: 'inherit' }}>Все занятия</Link></div>
        </div>
      ) : (
        <div className="empty"><strong>Занятий пока нет в расписании</strong>{me.format === 'one' ? <Link href="/app/lessons">Выбрать свободное время →</Link> : 'Преподаватель скоро составит расписание.'}</div>
      )}
      {me.message ? <div className="note"><div className="label" style={{ marginBottom: 4 }}>От преподавателя</div><p className="pre">{me.message}</p></div> : null}
      <div className="grid">
        <div className="panel"><div className="label">Оплачено занятий</div><div className="big" style={{ marginTop: 4, color: bal.left < 0 ? 'var(--danger)' : undefined }}>{bal.left}</div><div className="small muted">{bal.left < 0 ? 'нужно доплатить' : bal.left === 0 ? 'пора оплатить следующие' : 'осталось'} · <Link href="/app/pay">оплата</Link></div></div>
        <div className="panel"><div className="label">Стоимость</div><div className="big" style={{ marginTop: 4 }}>{me.price ? rub(me.price) : '—'}</div><div className="small muted">{me.price ? `за ${me.priceLessons} ${plural(me.priceLessons, 'занятие', 'занятия', 'занятий')}${me.priceNote ? ' · ' + me.priceNote : ''}` : 'преподаватель ещё не указал'}</div></div>
        <div className="panel"><div className="label">Впереди</div><div className="big" style={{ marginTop: 4 }}>{next.length}</div><div className="small muted">{plural(next.length, 'занятие', 'занятия', 'занятий')} в расписании</div></div>
      </div>
    </div>
  );
}

function RegisterForm({ goals }: { goals: string[] }) {
  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <ActionForm action={registerStudent} submit="Отправить анкету" pending="Отправляем…">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Регистрация</h2>
          <p className="muted" style={{ marginTop: 6 }}>Заполните анкету один раз — после этого откроется ваш кабинет.</p>
        </div>
        <div className="fgrid">
          <label className="field"><span>Фамилия</span><input name="lastName" type="text" required maxLength={60} autoComplete="family-name" /></label>
          <label className="field"><span>Имя</span><input name="firstName" type="text" required maxLength={60} autoComplete="given-name" /></label>
          <label className="field"><span>Отчество</span><input name="middleName" type="text" maxLength={60} placeholder="если есть" /></label>
        </div>
        <label className="field"><span>Как с вами связаться</span><input name="contact" type="text" maxLength={120} placeholder="Telegram @username или телефон" /></label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted" style={{ marginBottom: 6, fontWeight: 500 }}>Зачем вы изучаете японский? Можно выбрать несколько</legend>
          <div className="choices">{goals.map(g => <label key={g} className="gchip"><input type="checkbox" name="goal" value={g} />{g}</label>)}</div>
        </fieldset>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted" style={{ marginBottom: 6, fontWeight: 500 }}>Ваш уровень сейчас</legend>
          <div className="choices">{START_LEVELS.map((l, i) => <label key={l} className="gchip"><input type="radio" name="startLevel" value={l} defaultChecked={i === 0} />{l}</label>)}</div>
        </fieldset>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted" style={{ marginBottom: 6, fontWeight: 500 }}>Формат занятий</legend>
          <div className="fcards">{(Object.entries(FORMATS) as [string, readonly [string, string]][]).map(([k, [l, d]], i) => (
            <label key={k} className="fcard"><input type="radio" name="format" value={k} defaultChecked={i === 0} /><b>{l}</b><span className="small muted">{d}</span></label>
          ))}</div>
        </fieldset>
        <label className="field"><span>Расскажите о себе (необязательно)</span><textarea name="about" rows={3} maxLength={1000} placeholder="Что уже изучали, когда удобно заниматься" /></label>
        <label className="row small" style={{ alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" name="consent" value="1" required style={{ marginTop: 3 }} />
          <span>Я согласен(на) на обработку персональных данных в соответствии с <a href="/privacy" target="_blank">политикой конфиденциальности</a></span>
        </label>
      </ActionForm>
    </div>
  );
}

async function OwnerHome({ workspaceId }: { workspaceId: string }) {
  const [all, waiting, bal, nexts] = await Promise.all([listStudents(workspaceId), listWaitingAccounts(workspaceId), balances(workspaceId),
    sql<{ studentId: string; day: Date; time: string }[]>`SELECT DISTINCT ON (student_id) student_id, day, time FROM lessons
      WHERE workspace_id = ${workspaceId} AND status = 'plan' AND day >= ${todayMsk()} ORDER BY student_id, day, time`]);
  const nextOf = Object.fromEntries(nexts.map(n => [n.studentId, n]));
  const pending = all.filter(s => s.status === 'pending');
  const active = all.filter(s => s.status === 'active');
  const archived = all.filter(s => s.status === 'archived');
  return (
    <div className="stack">
      <section className="panel stack">
        <div><h2>Добавить ученика</h2><p className="small muted" style={{ marginTop: 4 }}>Сайт придумает пароль. Отправьте ученику логин и пароль — при первом входе он заполнит анкету.</p></div>
        <ActionForm action={createAccount} submit="Создать доступ" pending="Создаём…">
          <div className="fgrid">
            <label className="field"><span>Логин (латиницей)</span><input name="login" type="text" required autoCapitalize="none" spellCheck={false} placeholder="anna.smirnova" /></label>
            <label className="field"><span>Кто это (видите только вы)</span><input name="label" type="text" maxLength={80} placeholder="Анна, сестра Димы" /></label>
          </div>
        </ActionForm>
      </section>

      {waiting.length ? (
        <section className="panel stack">
          <div className="row between"><h2>Ждут первого входа</h2><span className="small muted">Доступ выдан, анкета ещё не заполнена</span></div>
          {waiting.map(w => (
            <div key={w.id} className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, gap: 8 }}>
              <div className="row between">
                <div><strong className="cred">{w.email}</strong>{w.label ? <span className="muted"> · {w.label}</span> : null}<div className="small muted">создан {fmtDate(w.createdAt)}{w.lastLoginAt ? ' · уже заходил(а)' : ' · ещё не заходил(а)'}</div></div>
                <form action={deleteAccount}><input type="hidden" name="userId" value={w.id} /><Submit className="btn ghost sm danger" pending="…">Удалить доступ</Submit></form>
              </div>
              <ActionForm action={resetPassword} submit="Выдать новый пароль" pending="…" submitClass="btn sm" className="stack"><input type="hidden" name="userId" value={w.id} /></ActionForm>
            </div>
          ))}
        </section>
      ) : null}

      {pending.length ? (
        <section className="panel stack">
          <div className="row between"><h2>Заявки</h2><span className="small muted">Заполнили регистрацию и ждут вашего решения</span></div>
          {pending.map(s => (
            <div key={s.id} className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, gap: 8 }}>
              <div className="row between">
                <div><strong>{fio(s)}</strong><div className="small muted">{s.email} · {fmtDate(s.createdAt)}{s.contact ? ' · ' + s.contact : ''}</div></div>
                <div className="row">
                  <form action={acceptStudent}><input type="hidden" name="id" value={s.id} /><Submit className="btn pri sm" pending="…">Принять</Submit></form>
                  <form action={rejectStudent}><input type="hidden" name="id" value={s.id} /><Submit className="btn ghost sm danger" pending="…">Отклонить</Submit></form>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className={'chip ' + (s.format === 'sub' ? 'c-ai' : 'c-mute')}>{FORMATS[s.format][0]}</span>
                {s.startLevel ? <span className="chip c-mute">{s.startLevel}</span> : null}
                {s.goals.map(g => <span key={g} className="chip c-good">{g}</span>)}
              </div>
              {s.about ? <p className="small pre">{s.about}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      {active.length ? (
        <section className="panel stack">
          <h2>Ученики <span className="muted num" style={{ fontWeight: 500 }}>{active.length}</span></h2>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Ученик</th><th>Формат</th><th>Уровень</th><th>Следующий урок</th><th>Баланс</th><th>Цена</th></tr></thead>
            <tbody>{active.map(s => (
              <tr key={s.id}>
                <td><Link href={`/app/students/${s.id}`}>{fio(s)}</Link></td>
                <td><span className={'chip ' + (s.format === 'sub' ? 'c-ai' : 'c-mute')}>{s.format === 'sub' ? 'абонемент' : 'разовые'}</span></td>
                <td>{s.level || '—'}</td>
                <td className="num small">{nextOf[s.id] ? `${fmtDay(nextOf[s.id].day)}, ${nextOf[s.id].time}` : <span className="muted">—</span>}</td>
                <td className="num">{bal[s.id] ? <span className={'chip ' + (bal[s.id].left < 0 ? 'c-bad' : bal[s.id].left === 0 ? 'c-warn' : 'c-good')}>{bal[s.id].left}</span> : '—'}</td>
                <td className="num">{s.price ? s.price.toLocaleString('ru-RU') + ' ₽' : <span className="muted">не задана</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ) : pending.length ? null : (
        <div className="empty"><strong>Пока нет учеников</strong>Создайте доступ выше. Когда ученик войдёт и заполнит анкету, он появится здесь.</div>
      )}

      {archived.length ? (
        <details className="panel"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Архив · {archived.length}</summary>
          <div className="stack" style={{ marginTop: 12 }}>{archived.map(s => (
            <form key={s.id} action={setArchived} className="row between">
              <span>{fio(s)}</span><input type="hidden" name="id" value={s.id} /><input type="hidden" name="archived" value="0" />
              <Submit className="btn sm" pending="…">Вернуть</Submit>
            </form>
          ))}</div>
        </details>
      ) : null}
    </div>
  );
}
