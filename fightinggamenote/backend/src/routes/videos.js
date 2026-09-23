
import { Router } from 'express';
import { getAuth, requireAuth } from '@clerk/express';
import { pool } from '../db/pool.js';
import { syncUser } from '../middleware/auth.js';
import { upload, uploadDir } from '../middleware/upload.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { extractYouTubeVideoId } from '../youtube.js';

export const router = Router();

const VIDEO_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// Public-note metadata is available to everyone. Private-note metadata is
// available only to the signed-in note owner.
router.get('/notes/:noteId/videos', async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const { rows } = await pool.query(
      `SELECT
         videos.id,
         videos.note_id,
         videos.original_filename,
         videos.youtube_video_id,
         videos.created_at
       FROM videos
       JOIN notes ON notes.id = videos.note_id
       WHERE videos.note_id = $1
         AND (
           notes.visibility = 'public'
           OR EXISTS (
             SELECT 1
             FROM users note_owner
             WHERE note_owner.id = notes.user_id
               AND note_owner.clerk_user_id = $2
           )
         )
       ORDER BY videos.created_at ASC`,
      [req.params.noteId, clerkUserId ?? null]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Attach a YouTube replay to an existing note owned by the signed-in user.
// Only the validated canonical ID is persisted; no user-controlled embed URL
// or markup reaches the database.
router.post(
  '/notes/:noteId/youtube-videos',
  requireAuth(),
  syncUser,
  async (req, res, next) => {
    try {
      let youtubeVideoId;
      try {
        youtubeVideoId = extractYouTubeVideoId(req.body?.youtube_url);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const { rows } = await pool.query(
        `INSERT INTO videos (note_id, user_id, youtube_video_id, status)
         SELECT notes.id, notes.user_id, $3, 'ready'
         FROM notes
         WHERE notes.id = $1 AND notes.user_id = $2
         ON CONFLICT (note_id, youtube_video_id)
           WHERE youtube_video_id IS NOT NULL
         DO UPDATE SET youtube_video_id = EXCLUDED.youtube_video_id
         RETURNING id, note_id, youtube_video_id, created_at`,
        [req.params.noteId, req.dbUser.id, youtubeVideoId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Note not found, or not owned by you',
        });
      }

      return res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Serve a video belonging to a public note or to the signed-in owner of a
// private note. Private playback sends Clerk auth in a request header.
// Supports HTTP range requests so browsers can seek within videos.
router.get('/videos/:videoId/stream', async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    const { rows } = await pool.query(
      `SELECT videos.storage_key
       FROM videos
       JOIN notes ON notes.id = videos.note_id
       JOIN users note_owner ON note_owner.id = notes.user_id
       WHERE videos.id = $1
         AND (
           notes.visibility = 'public'
           OR note_owner.clerk_user_id = $2
         )`,
      [req.params.videoId, clerkUserId ?? null]
    );

    if (rows.length === 0 || !rows[0].storage_key) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const storageKey = rows[0].storage_key;
    const extension = path.extname(storageKey).toLowerCase();
    const contentType = VIDEO_TYPES[extension];

    // Storage keys must be server-generated filenames, not paths.
    const expectedFilename =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp4|webm)$/i;

    if (!expectedFilename.test(storageKey) || !contentType) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const filePath = path.join(uploadDir, storageKey);

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Video file not found' });
      }
      throw error;
    }

    if (!stat.isFile()) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const fileSize = stat.size;
    const rangeHeader = req.headers.range;

    res.set({
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    if (!rangeHeader) {
      res.set('Content-Length', String(fileSize));
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) next(error);
      });
    }

    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

    if (!rangeMatch || (!rangeMatch[1] && !rangeMatch[2])) {
      return res
        .status(416)
        .set('Content-Range', `bytes */${fileSize}`)
        .end();
    }

    let start;
    let end;

    if (!rangeMatch[1]) {
      // Suffix range: bytes=-500
      const suffixLength = Number(rangeMatch[2]);

      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        return res
          .status(416)
          .set('Content-Range', `bytes */${fileSize}`)
          .end();
      }

      start = Math.max(0, fileSize - suffixLength);
      end = fileSize - 1;
    } else {
      start = Number(rangeMatch[1]);
      end = rangeMatch[2] ? Number(rangeMatch[2]) : fileSize - 1;
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= fileSize ||
      end < start
    ) {
      return res
        .status(416)
        .set('Content-Range', `bytes */${fileSize}`)
        .end();
    }

    end = Math.min(end, fileSize - 1);

    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': String(end - start + 1),
    });

    // sendFile supports byte-range options.
    return res.sendFile(
      filePath,
      { acceptRanges: false, headers: {}, start, end },
      (error) => {
        if (error && !res.headersSent) next(error);
      }
    );
  } catch (error) {
    next(error);
  }
});

// Upload a video only to a note owned by the signed-in user.
router.post(
  '/notes/:noteId/videos',
  requireAuth(),
  syncUser,
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
        [req.params.noteId, req.dbUser.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Note not found, or not owned by you',
        });
      }

      upload.single('video')(req, res, next);
    } catch (error) {
      next(error);
    }
  },
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'Video file is required',
      });
    }

    let keepFile = false;

    try {
      const detectedType = await fileTypeFromFile(req.file.path);

      if (
        !['video/mp4', 'video/webm'].includes(detectedType?.mime) ||
        detectedType.mime !== req.file.mimetype
      ) {
        return res.status(400).json({
          error: 'Uploaded file is not a supported video',
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO videos (
          note_id,
          user_id,
          storage_key,
          original_filename
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id`,
        [
          req.params.noteId,
          req.dbUser.id,
          req.file.filename,
          req.file.originalname,
        ]
      );

      keepFile = true;

      return res.status(201).json({
        id: rows[0].id,
      });
    } catch (error) {
      next(error);
    } finally {
      if (!keepFile) {
        await fs.unlink(req.file.path).catch((cleanupError) => {
          console.error('Failed to delete uploaded video:', cleanupError);
        });
      }
    }
  }
);
