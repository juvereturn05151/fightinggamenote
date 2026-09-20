import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../api.js';

export default function CreateNote() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [gameId, setGameId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.listGames().then(setGames);
  }, []);

  useEffect(() => {
    const game = games.find((g) => g.id === gameId);
    if (game) {
      api.listCharacters(game.slug).then(setCharacters);
    } else {
      setCharacters([]);
    }
    setCharacterId('');
  }, [gameId, games]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!gameId || !characterId || !title.trim() || !body.trim()) {
      setError('Game, character, title, and body are all required.');
      return;
    }

    setSubmitting(true);
    try {
      const { id } = await api.createNote(
        {
          game_id: gameId,
          character_id: characterId,
          title,
          body,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
        getToken
      );
      navigate(`/notes/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="create-note" onSubmit={handleSubmit}>
      <h2>New note</h2>

      <label>
        Game
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">Select a game</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Character
        <select
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          disabled={!gameId}
        >
          <option value="">Select a character</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label>
        Notes / combo
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>

      <label>
        Tags (comma-separated)
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Posting…' : 'Post note'}
      </button>
    </form>
  );
}
