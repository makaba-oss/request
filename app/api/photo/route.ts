import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [row] = await sql<{ photo: Buffer | null; photoType: string }[]>`
    SELECT photo, photo_type FROM workspaces WHERE photo IS NOT NULL ORDER BY created_at LIMIT 1`;
  if (!row?.photo) return new Response('Нет фото', { status: 404 });
  return new Response(new Uint8Array(row.photo), {
    headers: { 'Content-Type': row.photoType || 'image/jpeg', 'Cache-Control': 'public, max-age=300' },
  });
}
