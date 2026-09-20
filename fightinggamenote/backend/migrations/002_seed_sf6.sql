-- Minimal seed data so note creation isn't blocked during Phase 1 dev.
-- This is a starter set, not a claim of completeness — expand/replace
-- with the actual current roster from the game's official source when
-- you're ready to seed for real.

INSERT INTO games (name, slug) VALUES ('Street Fighter 6', 'sf6');

INSERT INTO characters (game_id, name, slug)
SELECT id, c.name, c.slug
FROM games, (VALUES
  ('Ken', 'ken'),
  ('Ryu', 'ryu'),
  ('Chun-Li', 'chun-li'),
  ('Luke', 'luke')
) AS c(name, slug)
WHERE games.slug = 'sf6';
