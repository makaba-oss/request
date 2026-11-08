import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listStudents, studentByUser } from '@/lib/students';
import { getWorkspace, goalsOf, fio, FORMATS, START_LEVELS } from '@/lib/workspace';
import { ActionForm, Submit } from '@/components/forms';
import { registerStudent, acceptStudent, rejectStudent, setArchived } from './actions';

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
        <p>{me.firstName}, преподаватель посмотрит вашу анкету и откроет кабинет. Мы пришлём письмо на почту.</p>
        {ws?.contact ? <p className="small muted">Связь с преподавателем: <span style={{ userSelect: 'all' }}>{ws.contact}</span></p> : null}
      </div>
    );
  }
  if (me.status === 'archived') {
    return <div className="empty"><strong>Кабинет сейчас закрыт</strong>Чтобы продолжить занятия, напишите преподавателю{ws?.contact ? `: ${ws.contact}` : ''}.</div>;
  }
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
      {me.message ? <div className="note"><div className="label" style={{ marginBottom: 4 }}>От преподавателя</div><p className="pre">{me.message}</p></div> : null}
      <div className="grid">
        <div className="panel"><div className="label">Стоимость</div><div className="big" style={{ marginTop: 4 }}>{me.price ? me.price.toLocaleString('ru-RU') + ' ₽' : '—'}</div><div className="small muted">{me.price ? `за ${me.priceLessons} ${me.priceLessons === 1 ? 'занятие' : 'занятий'}${me.priceNote ? ' · ' + me.priceNote : ''}` : 'преподаватель ещё не указал'}</div></div>
        <div className="panel"><div className="label">Расписание</div><p className="muted" style={{ marginTop: 6 }}>Календарь занятий появится на следующем этапе.</p></div>
      </div>
      {ws?.requisites ? <div className="panel stack"><h3>Реквизиты для оплаты</h3><p className="pre" style={{ background: 'var(--sunk)', borderRadius: 8, padding: '12px 14px' }}>{ws.requisites}</p></div> : null}
    </div>
  );
}

function RegisterForm({ goals }: { goals: string[] }) {
  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <ActionForm action={registerStudent} submit="Отправить анкету" pending="Отправляем…">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Регистрация</h2>
          <p className="muted" style={{ marginTop: 6 }}>Заполните анкету — преподаватель посмотрит её и откроет ваш кабинет.</p>
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
      </ActionForm>
    </div>
  );
}

async function OwnerHome({ workspaceId }: { workspaceId: string }) {
  const all = await listStudents(workspaceId);
  const pending = all.filter(s => s.status === 'pending');
  const active = all.filter(s => s.status === 'active');
  const archived = all.filter(s => s.status === 'archived');
  return (
    <div className="stack">
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
            <thead><tr><th>Ученик</th><th>Формат</th><th>Уровень</th><th>Цена</th><th>Связь</th></tr></thead>
            <tbody>{active.map(s => (
              <tr key={s.id}>
                <td><Link href={`/app/students/${s.id}`}>{fio(s)}</Link></td>
                <td><span className={'chip ' + (s.format === 'sub' ? 'c-ai' : 'c-mute')}>{s.format === 'sub' ? 'абонемент' : 'разовые'}</span></td>
                <td>{s.level || '—'}</td>
                <td className="num">{s.price ? s.price.toLocaleString('ru-RU') + ' ₽' : <span className="muted">не задана</span>}</td>
                <td className="small muted">{s.contact || '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      ) : pending.length ? null : (
        <div className="empty"><strong>Пока нет учеников</strong>Отправьте ученикам ссылку на сайт — после регистрации они появятся в «Заявках».</div>
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
