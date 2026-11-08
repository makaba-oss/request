import { requireOwner } from '@/lib/auth';
import { getWorkspace, goalsOf } from '@/lib/workspace';
import { ActionForm } from '@/components/forms';
import { saveSettings, saveAbout } from '../actions';

export const metadata = { title: 'Настройки' };

export default async function SettingsPage() {
  const owner = await requireOwner();
  const ws = await getWorkspace(owner.workspaceId);
  if (!ws) return null;
  const reviewsText = ws.reviews.map(r => (r.name ? r.name + '\n' : '') + r.text).join('\n\n');
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <ActionForm action={saveAbout} submit="Сохранить блок «Обо мне»">
        <section className="panel stack">
          <div><h2>Обо мне — на главной странице</h2><p className="small muted" style={{ marginTop: 4 }}>Блок появится на главной, как только заполните текст или загрузите фото.</p></div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
            {ws.hasPhoto
              ? <img src={`/api/photo?v=${ws.photoAt ? new Date(ws.photoAt).getTime() : 0}`} alt="Ваше фото" width={96} height={96} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 16 }} />
              : <div className="empty small" style={{ width: 96, height: 96, padding: 8, display: 'grid', placeItems: 'center' }}>нет фото</div>}
            <div className="stack" style={{ flex: 1, minWidth: 220, gap: 8 }}>
              <label className="field"><span>Фото (JPG, PNG или WebP, до 3 МБ)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
              {ws.hasPhoto ? <label className="row small muted" style={{ gap: 6 }}><input type="checkbox" name="removePhoto" value="1" />Убрать фото</label> : null}
            </div>
          </div>
          <label className="field"><span>Заголовок</span><input name="aboutTitle" type="text" defaultValue={ws.aboutTitle} maxLength={120} placeholder="Например: Привет! Я Макар, преподаю японский" /></label>
          <label className="field"><span>О себе</span><textarea name="aboutText" rows={5} defaultValue={ws.aboutText} maxLength={3000} placeholder="Как вы пришли к японскому, как строите занятия, кому подходите" /></label>
          <label className="field"><span>Коротко о главном — по одному пункту на строку</span><textarea name="aboutPoints" rows={4} defaultValue={ws.aboutPoints.join('\n')} placeholder={'Преподаю с 2020 года\nСдал JLPT N2\nЗанятия по Minna no Nihongo и Genki'} /></label>
          <label className="field"><span>Отзывы учеников — каждый отзыв через пустую строку, первая строка — имя</span>
            <textarea name="reviews" rows={7} defaultValue={reviewsText} placeholder={'Анна\nЗа полгода с нуля дошли до N5, занятия всегда в радость.\n\nДмитрий\nПодготовил к поездке в Японию — понимал меню и вывески!'} />
          </label>
        </section>
      </ActionForm>
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
