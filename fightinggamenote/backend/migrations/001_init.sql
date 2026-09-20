-- Initial schema. Mirrors docs/SCHEMA.md — keep both in sync.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL, -- Clerk's user id, source of truth for auth
  username      text UNIQUE NOT NULL,
  email         text UNIQUE NOT NULL,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL
);

CREATE TABLE characters (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name    text NOT NULL,
  slug    text NOT NULL,
  UNIQUE (game_id, slug)
);

CREATE TYPE note_visibility AS ENUM ('public', 'private');

CREATE TABLE notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id       uuid NOT NULL REFERENCES games(id),
  character_id  uuid NOT NULL REFERENCES characters(id),
  title         text NOT NULL,
  body          text NOT NULL,
  tags          text[] NOT NULL DEFAULT '{}',
  visibility    note_visibility NOT NULL DEFAULT 'public',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Guard: character_id must belong to game_id. Postgres can't express this
-- as a simple FK, so enforce it in application code (see routes/notes.js)
-- and revisit with a trigger if this ever gets violated in practice.

CREATE INDEX idx_notes_game_character ON notes (game_id, character_id);
CREATE INDEX idx_notes_user ON notes (user_id);

CREATE TYPE video_status AS ENUM ('uploading', 'processing', 'ready', 'failed');

CREATE TABLE videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id       uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  s3_key        text,
  cdn_url       text,
  duration_sec  integer,
  thumbnail_url text,
  status        video_status NOT NULL DEFAULT 'uploading',
  mistake_note  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_note ON videos (note_id);

CREATE TYPE commentable_type AS ENUM ('note', 'video');

CREATE TABLE comments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commentable_type   commentable_type NOT NULL,
  commentable_id     uuid NOT NULL, -- polymorphic; not FK-enforced, see docs/SCHEMA.md
  parent_comment_id  uuid REFERENCES comments(id) ON DELETE CASCADE,
  body               text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_commentable ON comments (commentable_type, commentable_id);
CREATE INDEX idx_comments_parent ON comments (parent_comment_id);

CREATE TYPE report_commentable_type AS ENUM ('note', 'video', 'comment');
CREATE TYPE report_status AS ENUM ('open', 'reviewed', 'dismissed');

CREATE TABLE reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commentable_type  report_commentable_type NOT NULL,
  commentable_id    uuid NOT NULL,
  reason            text NOT NULL,
  status            report_status NOT NULL DEFAULT 'open',
  created_at        timestamptz NOT NULL DEFAULT now()
);
