import 'server-only';
import { sql } from './db';

export type Student = {
  id: string; userId: string; workspaceId: string; status: 'pending' | 'active' | 'archived';
  createdAt: Date; acceptedAt: Date | null;
  lastName: string; firstName: string; middleName: string; contact: string; goals: string[];
  startLevel: string; format: 'one' | 'sub'; about: string;
  level: string; book: string; message: string; price: number; priceLessons: number; priceNote: string;
  callMode: 'default' | 'link' | 'discord' | 'none'; callUrl: string; callNote: string; privateNote: string;
  email?: string;
};

/** Публичные поля для ученика: без личных заметок репетитора. */
export type StudentView = Omit<Student, 'privateNote'>;

export async function studentByUser(userId: string): Promise<StudentView | null> {
  const [s] = await sql<Student[]>`SELECT * FROM students WHERE user_id = ${userId}`;
  if (!s) return null;
  const { privateNote: _hidden, ...pub } = s;
  return pub;
}

export async function listStudents(workspaceId: string): Promise<Student[]> {
  return sql<Student[]>`
    SELECT s.*, u.email FROM students s JOIN users u ON u.id = s.user_id
    WHERE s.workspace_id = ${workspaceId}
    ORDER BY s.status = 'pending' DESC, s.last_name, s.first_name`;
}

export async function getStudent(workspaceId: string, id: string): Promise<Student | null> {
  const [s] = await sql<Student[]>`
    SELECT s.*, u.email FROM students s JOIN users u ON u.id = s.user_id
    WHERE s.workspace_id = ${workspaceId} AND s.id = ${id}`;
  return s ?? null;
}
