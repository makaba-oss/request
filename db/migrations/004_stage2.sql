-- Этап 2: расписание, запись и перенос, оплаты, задания, библиотека, карточки, кана.
-- Дата и время уроков хранятся по Москве: date + 'ЧЧ:ММ'.

CREATE TABLE lessons (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id    text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day           date NOT NULL,
  time          text NOT NULL,
  dur           integer NOT NULL DEFAULT 60,
  topic         text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'plan' CHECK (status IN ('plan', 'done', 'noshow', 'cancel')),
  call_url      text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_ws_day_idx ON lessons (workspace_id, day);
CREATE INDEX lessons_student_idx ON lessons (student_id, day);

CREATE TABLE slots (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  day           date NOT NULL,
  time          text NOT NULL,
  dur           integer NOT NULL DEFAULT 60,
  lesson_id     text REFERENCES lessons(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, day, time)
);
CREATE INDEX slots_ws_day_idx ON slots (workspace_id, day);

-- Запрос ученика: записаться на окно (book) или перенести урок на окно (move)
CREATE TABLE slot_requests (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id    text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  slot_id       text NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('book', 'move')),
  lesson_id     text REFERENCES lessons(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'no', 'cancel')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz
);
CREATE INDEX slot_requests_ws_idx ON slot_requests (workspace_id, status);
CREATE UNIQUE INDEX slot_requests_one_pending ON slot_requests (student_id, slot_id) WHERE status = 'pending';

CREATE TABLE payments (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id    text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day           date NOT NULL,
  lessons       integer NOT NULL DEFAULT 0,
  amount        integer NOT NULL DEFAULT 0,
  note          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_student_idx ON payments (student_id);

CREATE TABLE pay_notices (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id    text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount        integer NOT NULL DEFAULT 0,
  comment       text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'no')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pay_notices_ws_idx ON pay_notices (workspace_id, status);

CREATE TABLE homework (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_id    text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title         text NOT NULL,
  task          text NOT NULL DEFAULT '',
  link          text NOT NULL DEFAULT '',
  due           date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  answer        text,
  answer_link   text NOT NULL DEFAULT '',
  answered_at   timestamptz,
  grade         text,
  review        text NOT NULL DEFAULT '',
  reviewed_at   timestamptz
);
CREATE INDEX homework_student_idx ON homework (student_id, created_at DESC);

CREATE TABLE library_files (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         text NOT NULL,
  category      text NOT NULL DEFAULT 'Прочее',
  filename      text NOT NULL,
  size          integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE decks (
  id            text PRIMARY KEY,
  student_id    text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title         text NOT NULL,
  ready_id      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decks_student_idx ON decks (student_id);

CREATE TABLE cards (
  id            text PRIMARY KEY,
  deck_id       text NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front         text NOT NULL,
  back          text NOT NULL,
  pos           integer NOT NULL DEFAULT 0,
  reps          integer NOT NULL DEFAULT 0,
  ivl           integer NOT NULL DEFAULT 0,
  ef            real NOT NULL DEFAULT 2.5,
  lapses        integer NOT NULL DEFAULT 0,
  due           timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cards_deck_idx ON cards (deck_id, pos);

CREATE TABLE kana_progress (
  student_id    text PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  right_count   integer NOT NULL DEFAULT 0,
  wrong_count   integer NOT NULL DEFAULT 0,
  best_streak   integer NOT NULL DEFAULT 0,
  weak          jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
