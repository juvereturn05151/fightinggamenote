import { Router } from 'express';
import { getAuth, requireAuth } from '@clerk/express';
import { pool } from '../db/pool.js';
import { syncUser } from '../middleware/auth.js';
import {
  DEFAULT_NOTE_VISIBILITY,
  isNoteVisibility,
} from '../noteVisibility.js';

export const router = Router();

const noteSelect = (extraFields = '') => `
  SELECT
    notes.id, notes.title, notes.body, notes.tags, notes.visibility,
    notes.created_at, notes.updated_at,
    users.id AS user_id, users.username, users.avatar_url,
    games.id AS game_id, games.name AS game_name, games.slug AS game_slug,
    characters.id AS character_id, characters.name AS character_name
    ${extraFields}
  FROM notes
  JOIN users ON users.id = notes.user_id
  JOIN games ON games.id = notes.game_id
  JOIN characters ON characters.id = notes.character_id
`;

// GET /notes?game=sf6&character=ken — list, filterable
router.get('/', async (req, res) => {
  const { game, character } = req.query;
  const { userId: clerkUserId } = getAuth(req);
  const conditions = ["notes.visibility = 'public'"];
  const params = [clerkUserId ?? null];

  if (game) {
    params.push(game);
    conditions.push(`games.slug = $${params.length}`);
  }
  if (character) {
    params.push(character);
    conditions.push(`characters.slug = $${params.length}`);
  }

  const { rows } = await pool.query(
    `${noteSelect(`,
      (SELECT count(*)::int FROM note_likes WHERE note_id = notes.id) AS like_count,
      EXISTS (
        SELECT 1
        FROM note_likes
        JOIN users liking_user ON liking_user.id = note_likes.user_id
        WHERE note_likes.note_id = notes.id
          AND liking_user.clerk_user_id = $1
      ) AS liked_by_current_user,
      COALESCE(users.clerk_user_id = $1, FALSE) AS is_owner
    `)} WHERE ${conditions.join(' AND ')} ORDER BY notes.created_at DESC`,
    params
  );
  res.json(rows);
});

// GET /notes/mine — every note owned by the signed-in user.
router.get('/mine', requireAuth(), syncUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${noteSelect(`,
        TRUE AS is_owner,
        FALSE AS liked_by_current_user,
        (SELECT count(*)::int FROM note_likes WHERE note_id = notes.id) AS like_count
      `)}
       WHERE notes.user_id = $1
       ORDER BY notes.created_at DESC`,
      [req.dbUser.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /notes/:id — single note
router.get('/:id', async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  const { rows } = await pool.query(
    `${noteSelect(`,
      COALESCE(users.clerk_user_id = $2, FALSE) AS is_owner,
      (SELECT count(*)::int FROM note_likes WHERE note_id = notes.id) AS like_count,
      EXISTS (
        SELECT 1
        FROM note_likes
        JOIN users liking_user ON liking_user.id = note_likes.user_id
        WHERE note_likes.note_id = notes.id
          AND liking_user.clerk_user_id = $2
      ) AS liked_by_current_user
    `)}
     WHERE notes.id = $1
       AND (
         notes.visibility = 'public'
         OR users.clerk_user_id = $2
       )`,
    [req.params.id, clerkUserId ?? null]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /notes — create
router.post('/', requireAuth(), syncUser, async (req, res) => {
  const { game_id, character_id, title, body, tags, visibility } = req.body;
  const normalizedVisibility = visibility ?? DEFAULT_NOTE_VISIBILITY;

  if (!game_id || !character_id || !title || !body) {
    return res.status(400).json({
      error: 'game_id, character_id, title, and body are required',
    });
  }

  if (!isNoteVisibility(normalizedVisibility)) {
    return res.status(400).json({
      error: 'visibility must be private or public',
    });
  }

  // Guard: character must actually belong to the given game (see
  // migrations/001_init.sql comment — not enforceable as a plain FK).
  const { rows: charRows } = await pool.query(
    'SELECT 1 FROM characters WHERE id = $1 AND game_id = $2',
    [character_id, game_id]
  );
  if (charRows.length === 0) {
    return res
      .status(400)
      .json({ error: 'character_id does not belong to game_id' });
  }

  const { rows } = await pool.query(
    `INSERT INTO notes (user_id, game_id, character_id, title, body, tags, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7::note_visibility)
     RETURNING id, visibility`,
    [
      req.dbUser.id,
      game_id,
      character_id,
      title,
      body,
      tags ?? [],
      normalizedVisibility,
    ]
  );
  res.status(201).json(rows[0]);
});

// PATCH /notes/:id — update (author only)
router.patch('/:id', requireAuth(), syncUser, async (req, res) => {
  const { title, body, tags, visibility } = req.body;

  if (visibility !== undefined && !isNoteVisibility(visibility)) {
    return res.status(400).json({
      error: 'visibility must be private or public',
    });
  }

  const { rows } = await pool.query(
    `UPDATE notes
     SET title = COALESCE($1, title),
         body = COALESCE($2, body),
         tags = COALESCE($3, tags),
         visibility = COALESCE($4, visibility),
         updated_at = now()
     WHERE id = $5 AND user_id = $6
     RETURNING id, visibility`,
    [title, body, tags, visibility, req.params.id, req.dbUser.id]
  );

  if (rows.length === 0) {
    return res
      .status(404)
      .json({ error: 'Not found, or not owned by you' });
  }
  res.json(rows[0]);
});

// DELETE /notes/:id — author only
router.delete('/:id', requireAuth(), syncUser, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2',
    [req.params.id, req.dbUser.id]
  );
  if (rowCount === 0) {
    return res
      .status(404)
      .json({ error: 'Not found, or not owned by you' });
  }
  res.status(204).send();
});
