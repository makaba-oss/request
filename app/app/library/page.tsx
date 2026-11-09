import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { LIB_CATEGORIES, fmtSize } from '@/lib/files';
import { fmtDay } from '@/lib/dates';
import { Submit } from '@/components/forms';
import { deleteLibraryFile, updateLibraryFile } from '../study-actions';

export const metadata = { title: 'Библиотека' };
type F = { id: string; title: string; category: string; size: number; createdAt: Date };

export default async function LibraryPage({ searchParams }: { searchParams: { q?: string; cat?: string; ok?: string; err?: string; edit?: string } }) {
  const user = await requireUser();
  const owner = user.role === 'owner';
  const all = await sql<F[]>`SELECT id, title, category, size, created_at FROM library_files WHERE workspace_id = ${user.workspaceId} ORDER BY category, title`;
  const q = (searchParams.q || '').trim().toLowerCase(), cat = searchParams.cat || '';
  const list = all.filter(f => (!cat || f.category === cat) && (!q || f.title.toLowerCase().includes(q)));
  const cats = LIB_CATEGORIES.filter(c => list.some(f => f.category === c));
  const counts = Object.fromEntries(LIB_CATEGORIES.map(c => [c, all.filter(f => f.category === c).length]));
  const link = (c: string) => `/app/library?${new URLSearchParams({ ...(q ? { q } : {}), ...(c ? { cat: c } : {}) })}`;
  return (
    <div className="stack">
      {owner ? (
        <section className="panel stack">
          <div><h2>Загрузить PDF</h2><p className="small muted" style={{ marginTop: 4 }}>До 30 МБ каждый, можно несколько сразу. Файлы видят только ваши ученики после входа.</p></div>
          <form action="/api/library" method="post" encType="multipart/form-data" className="stack">
            <div className="fgrid">
              <label className="field"><span>Файлы</span><input type="file" name="file" accept="application/pdf,.pdf" multiple required /></label>
              <label className="field"><span>Раздел</span><select name="category" defaultValue={cat || 'Грамматика'}>{LIB_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>Название (если файл один)</span><input type="text" name="title" maxLength={200} placeholder="Иначе возьмём имя файла" /></label>
            </div>
            {searchParams.err ? <div className="alert err">{searchParams.err}</div> : null}
            {searchParams.ok ? <div className="alert ok">Загружено файлов: {searchParams.ok}</div> : null}
            <div><Submit pending="Загружаем…">Загрузить</Submit></div>
          </form>
        </section>
      ) : null}

      <section className="stack">
        <form className="row" action="/app/library">
          {cat ? <input type="hidden" name="cat" value={cat} /> : null}
          <input type="text" name="q" defaultValue={searchParams.q} placeholder="Поиск по названию" aria-label="Поиск по названию" style={{ flex: '1 1 220px' }} />
          <button className="btn">Найти</button>
        </form>
        <div className="choices">
          <a href={link('')} className="gchip" aria-current={!cat ? 'true' : undefined} style={!cat ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : undefined}>Все · {all.length}</a>
          {LIB_CATEGORIES.filter(c => counts[c]).map(c => <a key={c} href={link(c)} className="gchip" style={cat === c ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : undefined}>{c} · {counts[c]}</a>)}
        </div>
      </section>

      {!all.length ? <div className="empty"><strong>Библиотека пока пустая</strong>{owner ? 'Загрузите первые PDF выше.' : 'Преподаватель скоро добавит материалы.'}</div>
        : !list.length ? <div className="empty"><strong>Ничего не нашлось</strong>Попробуйте другое слово.</div>
        : cats.map(c => (
          <section key={c} className="panel stack">
            <h3>{c}</h3>
            {list.filter(f => f.category === c).map(f => (
              <div key={f.id} className="item">
                {owner && searchParams.edit === f.id ? (
                  <form action={updateLibraryFile} className="row" style={{ flex: 1 }}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="text" name="title" defaultValue={f.title} required style={{ flex: '1 1 200px' }} aria-label="Название" />
                    <select name="category" defaultValue={f.category} className="mini" style={{ maxWidth: 180 }} aria-label="Раздел">{LIB_CATEGORIES.map(x => <option key={x}>{x}</option>)}</select>
                    <Submit className="btn sm pri" pending="…">Сохранить</Submit>
                  </form>
                ) : <>
                  <a href={`/api/library/${f.id}`} target="_blank" rel="noopener" className="pdf"><span className="pdf-ic" aria-hidden>PDF</span><span><b>{f.title}</b><span className="small muted"> · {fmtSize(f.size)} · {fmtDay(f.createdAt, false)}</span></span></a>
                  <div className="row" style={{ gap: 4 }}>
                    <a href={`/api/library/${f.id}?download`} className="btn ghost sm">Скачать</a>
                    {owner ? <>
                      <a href={`/app/library?edit=${f.id}${cat ? '&cat=' + encodeURIComponent(cat) : ''}`} className="btn ghost sm">Изменить</a>
                      <form action={deleteLibraryFile}><input type="hidden" name="id" value={f.id} /><Submit className="btn ghost sm danger" pending="…">Удалить</Submit></form>
                    </> : null}
                  </div>
                </>}
              </div>
            ))}
          </section>
        ))}
    </div>
  );
}
