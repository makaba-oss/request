import { requireOwner } from '@/lib/auth';
import { getWorkspace, goalsOf } from '@/lib/workspace';
import { ActionForm } from '@/components/forms';
import { saveSettings } from '../actions';

export const metadata = { title: 'Настройки' };

export default async function SettingsPage() {
  const owner = await requireOwner();
  const ws = await getWorkspace(owner.workspaceId);
  if (!ws) return null;
  return (
    <div style={{ maxWidth: 720 }}>
      <ActionForm action={saveSettings} submit="Сохранить настройки">
        <section className="panel stack">
          <h2>Школа</h2>
          <div className="fgrid">
            <label className="field"><span>Название (под логотипом)</span><input name="school" type="text" defaultValue={ws.school} placeholder="Например, Японский язык" /></label>
            <label className="field"><span>Ваше имя</span><input name="teacher" type="text" defaultValue={ws.teacher} /></label>
          </div>
          <label className="field"><span>Как с вами связаться (видят ученики)</span><input name="contact" type="text" defaultValue={ws.contact} placeholder="Telegram @username" /></label>
          <label className="field"><span>Постоянная ссылка на звонок (Zoom, Meet, Телемост, Telegram)</span><input name="callUrl" type="url" defaultValue={ws.callUrl} placeholder="https://" /></label>
          <label className="field"><span>Длительность урока по умолчанию</span>
            <select name="lessonMin" defaultValue={String(ws.lessonMin)}>{[30, 45, 60, 90].map(m => <option key={m} value={m}>{m} мин</option>)}</select>
          </label>
        </section>
        <section className="panel stack">
          <h2>Реквизиты для оплаты</h2>
          <p className="small muted">Ученики видят их в своём кабинете рядом с ценой.</p>
          <label className="field"><span>Реквизиты</span><textarea name="requisites" rows={5} defaultValue={ws.requisites} placeholder={'СБП по номеру: +7 900 000-00-00 (Т-Банк)\nПолучатель: Иван И.'} /></label>
        </section>
        <section className="panel stack">
          <h2>Цели в анкете</h2>
          <p className="small muted">Одна цель на строку. Ученик выбирает одну или несколько при регистрации.</p>
          <label className="field"><span>Список целей</span><textarea name="goals" rows={8} defaultValue={goalsOf(ws).join('\n')} /></label>
        </section>
      </ActionForm>
    </div>
  );
}
