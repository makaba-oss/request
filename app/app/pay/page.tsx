import { requireStudent } from '@/lib/me';
import { sql } from '@/lib/db';
import { getWorkspace } from '@/lib/workspace';
import { balanceOf } from '@/lib/schedule';
import { fmtDay, fmtWhen, rub, plural } from '@/lib/dates';
import { ActionForm } from '@/components/forms';
import { CopyButton } from '@/components/CopyButton';
import { sendPayNotice } from '../schedule-actions';

export const metadata = { title: 'Оплата' };

export default async function PayPage() {
  const me = await requireStudent();
  const [ws, bal, pays, notices] = await Promise.all([
    getWorkspace(me.workspaceId), balanceOf(me.id),
    sql<{ id: string; day: Date; lessons: number; amount: number; note: string }[]>`SELECT id, day, lessons, amount, note FROM payments WHERE student_id = ${me.id} ORDER BY day DESC, created_at DESC LIMIT 50`,
    sql<{ id: string; amount: number; createdAt: Date; status: string }[]>`SELECT id, amount, created_at, status FROM pay_notices WHERE student_id = ${me.id} AND (status = 'pending' OR created_at > now() - interval '14 days') ORDER BY created_at DESC`,
  ]);
  return (
    <div className="stack">
      <div className="grid">
        <div className="panel"><div className="label">Оплачено занятий</div><div className="big" style={{ marginTop: 4, color: bal.left < 0 ? 'var(--danger)' : undefined }}>{bal.left}</div><div className="small muted">оплачено {bal.paid}, прошло {bal.used}</div></div>
        <div className="panel"><div className="label">Стоимость</div><div className="big" style={{ marginTop: 4 }}>{me.price ? rub(me.price) : '—'}</div><div className="small muted">{me.price ? `за ${me.priceLessons} ${plural(me.priceLessons, 'занятие', 'занятия', 'занятий')}${me.priceNote ? ' · ' + me.priceNote : ''}` : 'преподаватель ещё не указал'}</div></div>
      </div>

      <section className="panel stack">
        <div className="row between"><h2>Реквизиты</h2>{ws?.requisites ? <CopyButton text={ws.requisites} /> : null}</div>
        {ws?.requisites ? <p className="pre" style={{ background: 'var(--sunk)', borderRadius: 8, padding: '12px 14px', userSelect: 'all' }}>{ws.requisites}</p> : <p className="muted">Преподаватель ещё не добавил реквизиты.</p>}
      </section>

      <section className="panel stack">
        <div><h2>Я оплатил(а)</h2><p className="small muted" style={{ marginTop: 4 }}>После перевода сообщите преподавателю — он проверит и зачтёт занятия.</p></div>
        <ActionForm action={sendPayNotice} submit="Сообщить об оплате" pending="Отправляем…">
          <div className="fgrid">
            <label className="field"><span>Сумма, ₽</span><input type="number" name="amount" min={1} defaultValue={me.price || ''} required /></label>
            <label className="field"><span>Комментарий (необязательно)</span><input type="text" name="comment" maxLength={300} placeholder="Например, перевёл с карты мамы" /></label>
          </div>
        </ActionForm>
        {notices.length ? <div className="stack" style={{ gap: 8 }}>{notices.map(n => (
          <div key={n.id} className="item small"><span>{fmtWhen(n.createdAt)} · {rub(n.amount)}</span>
            <span className={'chip ' + (n.status === 'pending' ? 'c-warn' : n.status === 'ok' ? 'c-good' : 'c-bad')}>{n.status === 'pending' ? 'ждёт проверки' : n.status === 'ok' ? 'зачтено' : 'не найдено — напишите преподавателю'}</span></div>
        ))}</div> : null}
      </section>

      {pays.length ? (
        <section className="panel stack">
          <h2>История оплат</h2>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Дата</th><th>Сумма</th><th>Занятий</th><th>Комментарий</th></tr></thead>
            <tbody>{pays.map(p => <tr key={p.id}><td className="num">{fmtDay(p.day, false)}</td><td className="num">{p.amount ? rub(p.amount) : '—'}</td><td className="num">+{p.lessons}</td><td className="small muted">{p.note}</td></tr>)}</tbody>
          </table></div>
        </section>
      ) : null}
    </div>
  );
}
