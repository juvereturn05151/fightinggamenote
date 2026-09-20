import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Feed() {
  const [games, setGames] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGames().then(setGames);
  }, []);

  useEffect(() => {
    if (selectedGame) {
      api.listCharacters(selectedGame.slug).then(setCharacters);
    } else {
      setCharacters([]);
    }
    setSelectedCharacter(null);
  }, [selectedGame]);

  useEffect(() => {
    setLoading(true);
    api
      .listNotes({
        game: selectedGame?.slug,
        character: selectedCharacter?.slug,
      })
      .then(setNotes)
      .finally(() => setLoading(false));
  }, [selectedGame, selectedCharacter]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h3>Games</h3>
        <ul className="nav-list">
          <li>
            <button
              className={!selectedGame ? 'active' : ''}
              onClick={() => setSelectedGame(null)}
            >
              All games
            </button>
          </li>
          {games.map((g) => (
            <li key={g.id}>
              <button
                className={selectedGame?.id === g.id ? 'active' : ''}
                onClick={() => setSelectedGame(g)}
              >
                {g.name}
              </button>
              {selectedGame?.id === g.id && characters.length > 0 && (
                <ul className="nav-list nested">
                  {characters.map((c) => (
                    <li key={c.id}>
                      <button
                        className={
                          selectedCharacter?.id === c.id ? 'active' : ''
                        }
                        onClick={() => setSelectedCharacter(c)}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <section className="feed">
        {loading && <p>Loading…</p>}
        {!loading && notes.length === 0 && <p>No notes yet.</p>}
        {notes.map((note) => (
          <Link to={`/notes/${note.id}`} key={note.id} className="card note-card">
            <div className="card-header">
              <span className="avatar">{note.username.slice(0, 2).toUpperCase()}</span>
              <div>
                <p className="username">{note.username}</p>
                <p className="subtitle">
                  {note.game_name} · {note.character_name}
                </p>
              </div>
            </div>
            <p className="note-title">{note.title}</p>
            <p className="note-body">{note.body}</p>
            {note.tags?.length > 0 && (
              <div className="tags">
                {note.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
