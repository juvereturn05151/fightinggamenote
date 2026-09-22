
import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { pool } from '../db/pool.js';
import { syncUser } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import fs from 'node:fs/promises';
import { fileTypeFromFile } from 'file-type';

export const router = Router();

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