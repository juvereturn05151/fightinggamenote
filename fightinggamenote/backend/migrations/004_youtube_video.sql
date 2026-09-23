-- YouTube is the primary storage provider for new replay attachments.
-- Legacy local-storage columns remain nullable and unchanged.
ALTER TABLE videos
ADD COLUMN youtube_video_id text
CHECK (
  youtube_video_id IS NULL
  OR youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
);

CREATE UNIQUE INDEX idx_videos_note_youtube
ON videos (note_id, youtube_video_id)
WHERE youtube_video_id IS NOT NULL;
