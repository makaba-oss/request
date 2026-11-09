import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { currentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { uploadDir } from '@/lib/files';

export const dynamic = 'force-dynamic';

/** Открыть PDF из библиотеки: только вошедшим преподавателю и ученикам. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response('Войдите в кабинет', { status: 401 });
  const [f] = await sql<{ title: string; filename: string; workspaceId: string }[]>`SELECT title, filename, workspace_id FROM library_files WHERE id = ${params.id}`;
  if (!f) return new Response('Файл не найден', { status: 404 });
  if (user.workspaceId && user.workspaceId !== f.workspaceId) return new Response('Нет доступа', { status: 403 });
  let buf: Buffer;
  try { buf = await readFile(path.join(uploadDir(), path.basename(f.filename))); } catch { return new Response('Файл не найден', { status: 404 }); }
  const name = encodeURIComponent(f.title.replace(/[\\/:*?"<>|]+/g, ' ') + '.pdf');
  const dl = new URL(req.url).searchParams.has('download');
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf', 'Content-Length': String(buf.length),
      'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`,
      'Cache-Control': 'private, max-age=3600', 'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
