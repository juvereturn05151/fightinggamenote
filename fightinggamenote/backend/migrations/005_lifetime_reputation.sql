CREATE TABLE note_likes (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id    uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, note_id)
);

CREATE INDEX idx_note_likes_note ON note_likes (note_id);

CREATE TABLE comment_likes (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX idx_comment_likes_comment ON comment_likes (comment_id);

CREATE TYPE reputation_award_type AS ENUM ('note_like', 'comment_like');

CREATE TABLE reputation_awards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  awarder_user_id   uuid NOT NULL,
  award_type        reputation_award_type NOT NULL,
  item_id           uuid NOT NULL,
  points            smallint NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (awarder_user_id, award_type, item_id),
  CHECK (recipient_user_id <> awarder_user_id),
  CHECK (
    (award_type = 'note_like' AND points = 10)
    OR (award_type = 'comment_like' AND points = 5)
  )
);

CREATE INDEX idx_reputation_awards_recipient
ON reputation_awards (recipient_user_id);
