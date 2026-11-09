import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { currentUser } from '@/lib/auth';
import { sql, newId } from '@/lib/db';
import { clip } from '@/lib/workspace';
import { uploadDir, LIB_CATEGORIES, MAX_PDF } from '@/lib/files';

export const dynamic = 'force-dynamic';

/** Загрузка PDF в библиотеку (только преподаватель). Форма отправляется обычным POST. */
export async function POST(req: Request) {
  const back = (q: string) => new Response(null, { status: 303, headers: { Location: '/app/library?' + q } });
  const user = await currentUser();
  if (!user || user.role !== 'owner' || !user.workspaceId) return new Response('Нет доступа', { status: 403 });
  let fd: FormData;
  try { fd = await req.formData(); } catch { return back('err=' + encodeURIComponent('Не удалось получить файл')); }
  const files = fd.getAll('file').filter((f): f is File => typeof f === 'object' && 'arrayBuffer' in f && f.size > 0);
  if (!files.length) return back('err=' + encodeURIComponent('Выберите PDF-файл'));
  const category = LIB_CATEGORIES.includes(String(fd.get('category'))) ? String(fd.get('category')) : 'Прочее';
  const given = clip(fd.get('title'), 200);
  await mkdir(uploadDir(), { recursive: true });
  let n = 0;
  for (const f of files.slice(0, 20)) {
    if (f.size > MAX_PDF) return back('err=' + encodeURIComponent(`«${f.name}» больше 30 МБ`));
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return back('err=' + encodeURIComponent(`«${f.name}» — не PDF`));
    const id = newId(), filename = id + '.pdf';
    await writeFile(path.join(uploadDir(), filename), buf);
    const title = (files.length === 1 && given) || clip(f.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), 200) || 'Без названия';
    await sql`INSERT INTO library_files (id, workspace_id, title, category, filename, size) VALUES (${id}, ${user.workspaceId}, ${title}, ${category}, ${filename}, ${buf.length})`;
    n++;
  }
  return back('ok=' + n);
}
