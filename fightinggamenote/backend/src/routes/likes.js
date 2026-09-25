import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuthenticatedUser } from '../middleware/auth.js';

export const router = Router();

const NOTE_LIKE_POINTS = 10;
const COMMENT_LIKE_POINTS = 5;

router.post(
  '/notes/:noteId/like',
  requireAuthenticatedUser,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: notes } = await client.query(
        `SELECT id, user_id
         FROM notes
         WHERE id = $1 AND visibility = 'public'
         FOR UPDATE`,
        [req.params.noteId]
      );

      if (notes.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Post not found' });
      }

      if (notes[0].user_id === req.dbUser.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot like your own post' });
      }

      await client.query(
        `INSERT INTO note_likes (user_id, note_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.dbUser.id, req.params.noteId]
      );

      const award = await client.query(
        `INSERT INTO reputation_awards (
           recipient_user_id, awarder_user_id, award_type, item_id, points
         )
         VALUES ($1, $2, 'note_like', $3, $4)
         ON CONFLICT (awarder_user_id, award_type, item_id) DO NOTHING
         RETURNING id`,
        [notes[0].user_id, req.dbUser.id, req.params.noteId, NOTE_LIKE_POINTS]
      );

      const { rows: counts } = await client.query(
        'SELECT count(*)::int AS like_count FROM note_likes WHERE note_id = $1',
        [req.params.noteId]
      );

      await client.query('COMMIT');
      return res.json({
        liked_by_current_user: true,
        like_count: counts[0].like_count,
        reputation_awarded: award.rowCount === 1,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

router.delete(
  '/notes/:noteId/like',
  requireAuthenticatedUser,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: notes } = await client.query(
        `SELECT id, user_id
         FROM notes
         WHERE id = $1 AND visibility = 'public'
         FOR UPDATE`,
        [req.params.noteId]
      );

      if (notes.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Post not found' });
      }

      if (notes[0].user_id === req.dbUser.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot like your own post' });
      }

      await client.query(
        'DELETE FROM note_likes WHERE user_id = $1 AND note_id = $2',
        [req.dbUser.id, req.params.noteId]
      );
      const { rows: counts } = await client.query(
        'SELECT count(*)::int AS like_count FROM note_likes WHERE note_id = $1',
        [req.params.noteId]
      );

      await client.query('COMMIT');
      return res.json({
        liked_by_current_user: false,
        like_count: counts[0].like_count,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

router.post(
  '/comments/:commentId/like',
  requireAuthenticatedUser,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: comments } = await client.query(
        `SELECT comments.id, comments.user_id
         FROM comments
         JOIN notes
           ON comments.commentable_type = 'note'
          AND notes.id = comments.commentable_id
         WHERE comments.id = $1 AND notes.visibility = 'public'
         FOR UPDATE OF comments, notes`,
        [req.params.commentId]
      );

      if (comments.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comments[0].user_id === req.dbUser.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot like your own comment' });
      }

      await client.query(
        `INSERT INTO comment_likes (user_id, comment_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.dbUser.id, req.params.commentId]
      );

      const award = await client.query(
        `INSERT INTO reputation_awards (
           recipient_user_id, awarder_user_id, award_type, item_id, points
         )
         VALUES ($1, $2, 'comment_like', $3, $4)
         ON CONFLICT (awarder_user_id, award_type, item_id) DO NOTHING
         RETURNING id`,
        [
          comments[0].user_id,
          req.dbUser.id,
          req.params.commentId,
          COMMENT_LIKE_POINTS,
        ]
      );

      const { rows: counts } = await client.query(
        `SELECT count(*)::int AS like_count
         FROM comment_likes
         WHERE comment_id = $1`,
        [req.params.commentId]
      );

      await client.query('COMMIT');
      return res.json({
        liked_by_current_user: true,
        like_count: counts[0].like_count,
        reputation_awarded: award.rowCount === 1,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

router.delete(
  '/comments/:commentId/like',
  requireAuthenticatedUser,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: comments } = await client.query(
        `SELECT comments.id, comments.user_id
         FROM comments
         JOIN notes
           ON comments.commentable_type = 'note'
          AND notes.id = comments.commentable_id
         WHERE comments.id = $1 AND notes.visibility = 'public'
         FOR UPDATE OF comments, notes`,
        [req.params.commentId]
      );

      if (comments.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comments[0].user_id === req.dbUser.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot like your own comment' });
      }

      await client.query(
        'DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
        [req.dbUser.id, req.params.commentId]
      );
      const { rows: counts } = await client.query(
        `SELECT count(*)::int AS like_count
         FROM comment_likes
         WHERE comment_id = $1`,
        [req.params.commentId]
      );

      await client.query('COMMIT');
      return res.json({
        liked_by_current_user: false,
        like_count: counts[0].like_count,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

router.get(
  '/reputation/me',
  requireAuthenticatedUser,
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           COALESCE(sum(points), 0)::int AS total,
           COALESCE(sum(points) FILTER (WHERE award_type = 'note_like'), 0)::int
             AS from_note_likes,
           COALESCE(sum(points) FILTER (WHERE award_type = 'comment_like'), 0)::int
             AS from_comment_likes
         FROM reputation_awards
         WHERE recipient_user_id = $1`,
        [req.dbUser.id]
      );
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);
