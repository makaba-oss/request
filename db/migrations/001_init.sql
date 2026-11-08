-- ReQuest: начальная схема.
-- Всё привязано к workspace (кабинет репетитора). Сейчас он один,
-- но так платформу можно будет открыть для других репетиторов без переделки.

CREATE TABLE workspaces (
  id          text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  school      text NOT NULL DEFAULT '',
  teacher     text NOT NULL DEFAULT '',
  contact     text NOT NULL DEFAULT '',
  requisites  text NOT NULL DEFAULT '',
  call_url    text NOT NULL DEFAULT '',
  goals       text[] NOT NULL DEFAULT '{}',
  lesson_min  integer NOT NULL DEFAULT 60
);

CREATE TABLE users (
  id            text PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('owner', 'student')),
  workspace_id  text REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE login_codes (
  id          text PRIMARY KEY,
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email_idx ON login_codes (email, created_at DESC);

CREATE TABLE sessions (
  id          text PRIMARY KEY,
  token_hash  text NOT NULL UNIQUE,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE students (
  id             text PRIMARY KEY,
  user_id        text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  workspace_id   text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'archived')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  accepted_at    timestamptz,
  -- анкета ученика
  last_name      text NOT NULL,
  first_name     text NOT NULL,
  middle_name    text NOT NULL DEFAULT '',
  contact        text NOT NULL DEFAULT '',
  goals          text[] NOT NULL DEFAULT '{}',
  start_level    text NOT NULL DEFAULT '',
  format         text NOT NULL DEFAULT 'one' CHECK (format IN ('one', 'sub')),
  about          text NOT NULL DEFAULT '',
  -- заполняет репетитор
  level          text NOT NULL DEFAULT '',
  book           text NOT NULL DEFAULT '',
  message        text NOT NULL DEFAULT '',
  price          integer NOT NULL DEFAULT 0,
  price_lessons  integer NOT NULL DEFAULT 1,
  price_note     text NOT NULL DEFAULT '',
  call_mode      text NOT NULL DEFAULT 'default' CHECK (call_mode IN ('default', 'link', 'discord', 'none')),
  call_url       text NOT NULL DEFAULT '',
  call_note      text NOT NULL DEFAULT '',
  private_note   text NOT NULL DEFAULT ''
);
CREATE INDEX students_ws_status_idx ON students (workspace_id, status);
