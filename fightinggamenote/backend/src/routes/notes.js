import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { pool } from '../db/pool.js';
import { syncUser } from '../middleware/auth.js';

export const router = Router();

const NOTE_SELECT = `
  SELECT
    notes.id, notes.title, notes.body, notes.tags, notes.visibility,
    notes.created_at, notes.updated_at,
    users.id AS user_id, users.username, users.avatar_url,
    games.id AS game_id, games.name AS game_name, games.slug AS game_slug,
    characters.id AS character_id, characters.name AS character_name
  FROM notes
  JOIN users ON users.id = notes.user_id
  JOIN games ON games.id = notes.game_id
  JOIN characters ON characters.id = notes.character_id
`;

// GET /notes?game=sf6&character=ken — list, filterable
router.get('/', async (req, res) => {
  const { game, character } = req.query;
  const conditions = ["notes.visibility = 'public'"];
  const params = [];

  if (game) {
    params.push(game);
    conditions.push(`games.slug = $${params.length}`);
  }
  if (character) {
    params.push(character);
    conditions.push(`characters.slug = $${params.length}`);
  }

  const { rows } = await pool.query(
    `${NOTE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY notes.created_at DESC`,
    params
  );
  res.json(rows);
});

// GET /notes/:id — single note
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`${NOTE_SELECT} WHERE notes.id = $1`, [
    req.params.id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /notes — create
router.post('/', requireAuth(), syncUser, async (req, res) => {
  const { game_id, character_id, title, body, tags, visibility } = req.body;

  if (!game_id || !character_id || !title || !body) {
    return res.status(400).json({
      error: 'game_id, character_id, title, and body are required',
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
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'public')::note_visibility)
     RETURNING id`,
    [
      req.dbUser.id,
      game_id,
      character_id,
      title,
      body,
      tags ?? [],
      visibility,
    ]
  );
  res.status(201).json({ id: rows[0].id });
});

// PATCH /notes/:id — update (author only)
router.patch('/:id', requireAuth(), syncUser, async (req, res) => {
  const { title, body, tags, visibility } = req.body;

  const { rows } = await pool.query(
    `UPDATE notes
     SET title = COALESCE($1, title),
         body = COALESCE($2, body),
         tags = COALESCE($3, tags),
         visibility = COALESCE($4, visibility),
         updated_at = now()
     WHERE id = $5 AND user_id = $6
     RETURNING id`,
    [title, body, tags, visibility, req.params.id, req.dbUser.id]
  );

  if (rows.length === 0) {
    return res
      .status(404)
      .json({ error: 'Not found, or not owned by you' });
  }
  res.json({ id: rows[0].id });
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