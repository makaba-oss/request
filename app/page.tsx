import Link from 'next/link';
import { Mark, Wordmark } from '@/components/Brand';
import { getWorkspace } from '@/lib/workspace';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Icon = ({ d }: { d: string }) => (
  <div className="lp-ic"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: d }} /></div>
);

export default async function Home() {
  const [ws, user] = await Promise.all([getWorkspace(), currentUser()]);
  const who = [ws?.teacher, ws?.school].filter(Boolean).join(' · ');
  const enter = user ? '/app' : '/login';
  return (
    <>
      <header className="lp-nav">
        <Link href="/" className="brand"><Mark /><div><Wordmark />{who ? <div className="sub">{who}</div> : null}</div></Link>
        <Link className="btn" href={enter}>{user ? 'Мой кабинет' : 'Войти'}</Link>
      </header>

      <section className="lp-hero">
        <div>
          <span className="lp-pill"><i />Онлайн-занятия японским</span>
          <h1>Японский язык — занятия, задания и оплата <span>в одном кабинете</span></h1>
          <p className="lp-lead">Выбирайте удобное время, получайте задания и материалы после урока, следите за прогрессом и оплатой — всё в личном кабинете ученика.</p>
          <div className="row">
            <Link className="btn pri" href={enter} style={{ minHeight: 50, padding: '0 24px', fontSize: '1rem' }}>Записаться на занятие</Link>
            <Link className="btn" href={enter} style={{ minHeight: 50, padding: '0 24px', fontSize: '1rem' }}>Войти в кабинет</Link>
          </div>
          <div className="row muted small" style={{ gap: 22, marginTop: 26 }}>
            <span>Занятия по видеосвязи</span><span>Работает с телефона</span><span>Материалы всегда под рукой</span>
          </div>
        </div>
        <div className="lp-mock" aria-hidden="true">
          <div className="row between" style={{ marginBottom: 12 }}><strong className="wm" style={{ fontSize: '1rem' }}>Свободное время</strong><span className="chip c-good">окна на неделе</span></div>
          <div className="lp-week">
            <div><div className="label">пн</div><div className="lp-ev s"><b>10:00</b>свободно</div><div className="lp-ev s"><b>15:00</b>свободно</div></div>
            <div><div className="label">вт</div><div className="lp-ev"><b>18:00</b>ваш урок</div></div>
            <div><div className="label">ср</div><div className="lp-ev s"><b>10:00</b>свободно</div></div>
            <div><div className="label">чт</div><div className="lp-ev w"><b>14:00</b>ваша запись</div></div>
            <div><div className="label">пт</div><div className="lp-ev s"><b>12:00</b>свободно</div></div>
          </div>
          <div className="lp-kpi">
            <div><div className="label">Следующее занятие</div><div className="big" style={{ fontSize: '1.2rem', marginTop: 4 }}>вт, 18:00</div></div>
            <div><div className="label">Оплачено занятий</div><div className="big" style={{ fontSize: '1.2rem', marginTop: 4 }}>8</div></div>
          </div>
        </div>
      </section>

      {ws && (ws.aboutText || ws.hasPhoto) ? (
        <section className="lp-sec" id="about">
          <h2>Обо мне</h2>
          <div className="about">
            {ws.hasPhoto ? <img className="about-photo" src={`/api/photo?v=${ws.photoAt ? new Date(ws.photoAt).getTime() : 0}`} alt={ws.teacher || 'Преподаватель'} /> : null}
            <div className="stack" style={{ gap: 16 }}>
              {ws.aboutTitle ? <h3 className="wm" style={{ fontSize: 'clamp(1.2rem, 2.4vw, 1.6rem)', lineHeight: 1.25 }}>{ws.aboutTitle}</h3> : null}
              {ws.aboutText ? <p className="pre" style={{ fontSize: '1.05rem', lineHeight: 1.6 }}>{ws.aboutText}</p> : null}
              {ws.aboutPoints.length ? <ul className="about-points">{ws.aboutPoints.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
              <div><Link className="btn pri" href={enter}>Записаться на занятие</Link></div>
            </div>
          </div>
          {ws.reviews.length ? (
            <div className="reviews">
              {ws.reviews.map((r, i) => (
                <figure key={i} className="panel review">
                  <blockquote className="pre">{r.text}</blockquote>
                  {r.name ? <figcaption>{r.name}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="lp-sec">
        <h2>Как это устроено</h2>
        <div className="lp-feat">
          <div className="panel"><Icon d='<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' /><h3 className="wm" style={{ fontSize: '1rem', marginBottom: 6 }}>Календарь</h3><p className="muted">Видите свои занятия на неделю вперёд. На разовых — сами выбираете свободное время, а у ближайшего урока есть кнопка «Подключиться».</p></div>
          <div className="panel"><Icon d='<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18M7 15h3"/>' /><h3 className="wm" style={{ fontSize: '1rem', marginBottom: 6 }}>Оплата</h3><p className="muted">Стоимость, реквизиты для перевода и остаток оплаченных занятий всегда перед глазами. После перевода — одна кнопка «Я оплатил».</p></div>
        </div>
      </section>

      <section className="lp-sec">
        <h2>Форматы занятий</h2>
        <div className="lp-feat">
          <div className="panel stack" style={{ gap: 8 }}><div className="label">Разовые занятия</div><h3 className="wm" style={{ fontSize: '1rem' }}>Когда удобно вам</h3><p className="muted">Выбираете свободное время в календаре и платите за каждое занятие. Подходит, если график плавающий.</p></div>
          <div className="panel stack" style={{ gap: 8 }}><div className="label">Абонемент</div><h3 className="wm" style={{ fontSize: '1rem' }}>Постоянное расписание</h3><p className="muted">Фиксированные дни и время, оплата пакетом занятий. Подходит для регулярной подготовки, например к JLPT.</p></div>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>Стоимость занятий — по договорённости с преподавателем.</p>
      </section>

      <footer className="lp-foot"><span>© {new Date().getFullYear()} ReQuest</span><Link href="/privacy" className="muted">Политика конфиденциальности</Link></footer>
    </>
  );
}
