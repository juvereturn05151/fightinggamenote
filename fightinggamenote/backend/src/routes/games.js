import { Router } from 'express';
import { pool } from '../db/pool.js';

export const router = Router();

// GET /games — list all games
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, slug FROM games ORDER BY name'
  );
  res.json(rows);
});

// GET /games/:slug/characters — characters for one game
router.get('/:slug/characters', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT characters.id, characters.name, characters.slug
     FROM characters
     JOIN games ON games.id = characters.game_id
     WHERE games.slug = $1
     ORDER BY characters.name`,
    [req.params.slug]
  );
  res.json(rows);
});
