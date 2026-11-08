-- Блок «Обо мне» на главной странице
ALTER TABLE workspaces
  ADD COLUMN about_title  text NOT NULL DEFAULT '',
  ADD COLUMN about_text   text NOT NULL DEFAULT '',
  ADD COLUMN about_points text[] NOT NULL DEFAULT '{}',
  ADD COLUMN reviews      jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN photo        bytea,
  ADD COLUMN photo_type   text NOT NULL DEFAULT '',
  ADD COLUMN photo_at     timestamptz;
