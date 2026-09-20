import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { pool } from '../db/pool.js';
import { syncUser } from '../middleware/auth.js';

export const router = Router();

// GET /comments?type=note&id=<uuid> — flat list, client threads by parent_comment_id
router.get('/', async (req, res) => {
  const { type, id } = req.query;
  if (!type || !id || !['note', 'video'].includes(type)) {
    return res
      .status(400)
      .json({ error: 'type (note|video) and id are required' });
  }

  const { rows } = await pool.query(
    `SELECT comments.id, comments.body, comments.parent_comment_id,
            comments.created_at,
            users.id AS user_id, users.username, users.avatar_url
     FROM comments
     JOIN users ON users.id = comments.user_id
     WHERE comments.commentable_type = $1 AND comments.commentable_id = $2
     ORDER BY comments.created_at ASC`,
    [type, id]
  );
  res.json(rows);
});

// POST /comments — create (optionally a reply via parent_comment_id)
router.post('/', requireAuth(), syncUser, async (req, res) => {
  const { commentable_type, commentable_id, parent_comment_id, body } =
    req.body;

  if (
    !['note', 'video'].includes(commentable_type) ||
    !commentable_id ||
    !body
  ) {
    return res.status(400).json({
      error: 'commentable_type (note|video), commentable_id, and body are required',
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO comments (user_id, commentable_type, commentable_id, parent_comment_id, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [
      req.dbUser.id,
      commentable_type,
      commentable_id,
      parent_comment_id ?? null,
      body,
    ]
  );
  res.status(201).json(rows[0]);
});

// DELETE /comments/:id — author only
router.delete('/:id', requireAuth(), syncUser, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM comments WHERE id = $1 AND user_id = $2',
    [req.params.id, req.dbUser.id]
  );
  if (rowCount === 0) {
    return res
      .status(404)
      .json({ error: 'Not found, or not owned by you' });
  }
  res.status(204).send();
});
