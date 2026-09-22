INSERT INTO games (name, slug) VALUES ('Street Fighter 6', 'sf6');

INSERT INTO characters (game_id, name, slug)
SELECT id, c.name, c.slug
FROM games, (VALUES
  -- Base roster
  ('Ryu', 'ryu'),
  ('Luke', 'luke'),
  ('Jamie', 'jamie'),
  ('Chun-Li', 'chun-li'),
  ('Guile', 'guile'),
  ('Kimberly', 'kimberly'),
  ('Juri', 'juri'),
  ('Ken', 'ken'),
  ('E. Honda', 'e-honda'),
  ('Dhalsim', 'dhalsim'),
  ('Blanka', 'blanka'),
  ('Manon', 'manon'),
  ('Marisa', 'marisa'),
  ('Lily', 'lily'),
  ('JP', 'jp'),
  ('Dee Jay', 'dee-jay'),
  ('Cammy', 'cammy'),
  ('Zangief', 'zangief'),
  -- Year 1 DLC
  ('Rashid', 'rashid'),
  ('A.K.I.', 'aki'),
  ('Ed', 'ed'),
  ('Akuma', 'akuma'),
  -- Year 2 DLC
  ('M. Bison', 'm-bison'),
  ('Terry Bogard', 'terry-bogard'),
  ('Mai Shiranui', 'mai-shiranui'),
  ('Elena', 'elena'),
  -- Year 3 DLC
  ('Sagat', 'sagat'),
  ('C. Viper', 'c-viper'),
  ('Alex', 'alex'),
  ('Ingrid', 'ingrid'),
  -- Year 4 DLC (Yasmine released; Arjun/Tifa/Bosch not yet released — see note above)
  ('Yasmine', 'yasmine'),
  ('Arjun', 'arjun'),
  ('Tifa', 'tifa'),
  ('Bosch', 'bosch')
) AS c(name, slug)
WHERE games.slug = 'sf6';