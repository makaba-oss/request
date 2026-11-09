-- Вход по логину и паролю, которые выдаёт преподаватель.
-- Колонка email теперь хранит логин: это может быть почта или любое короткое имя.
ALTER TABLE users
  ADD COLUMN password_hash  text,
  ADD COLUMN label          text NOT NULL DEFAULT '',
  ADD COLUMN failed_logins  integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_until   timestamptz;
