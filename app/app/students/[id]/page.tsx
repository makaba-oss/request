import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { getStudent } from '@/lib/students';
import { getWorkspace, goalsOf, fio, FORMATS, LEVELS } from '@/lib/workspace';
import { ActionForm, Submit } from '@/components/forms';
import { saveStudent, setArchived, resetPassword } from '../../actions';

export const metadata = { title: 'Ученик' };

export default async function StudentPage({ params }: { params: { id: string } }) {
  const owner = await requireOwner();
  const [s, ws] = await Promise.all([getStudent(owner.workspaceId, params.id), getWorkspace(owner.workspaceId)]);
  if (!s || s.status === 'pending') notFound();
  const goals = [...goalsOf(ws), ...s.goals.filter(g => !goalsOf(ws).includes(g))];
  return (
    <div className="stack">
      <div className="row between">
        <div><Link href="/app" className="btn ghost sm" style={{ paddingLeft: 0 }}>← Все ученики</Link><h2 style={{ fontSize: '1.4rem', marginTop: 4 }}>{fio(s)}</h2><div className="small muted">{s.email}</div></div>
        {s.status === 'active' ? (
          <form action={setArchived}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="archived" value="1" /><Submit className="btn ghost sm danger" pending="…">Убрать в архив</Submit></form>
        ) : <span className="chip c-mute">в архиве</span>}
      </div>

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
    </div>
  );
}
