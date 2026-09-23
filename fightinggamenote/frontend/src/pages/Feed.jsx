import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../api.js';
import LikeButton from '../components/LikeButton.jsx';

export default function Feed() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [games, setGames] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyNoteId, setBusyNoteId] = useState(null);
  const [likeErrors, setLikeErrors] = useState({});

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
    if (!isLoaded) return;
    setLoading(true);
    api
      .listNotes({
        game: selectedGame?.slug,
        character: selectedCharacter?.slug,
      }, getToken)
      .then(setNotes)
      .finally(() => setLoading(false));
  }, [getToken, isLoaded, selectedGame, selectedCharacter, userId]);

  async function toggleNoteLike(note) {
    if (!isSignedIn || note.is_owner || busyNoteId) return;
    setBusyNoteId(note.id);
    setLikeErrors((current) => ({ ...current, [note.id]: '' }));

    try {
      const result = note.liked_by_current_user
        ? await api.unlikeNote(note.id, getToken)
        : await api.likeNote(note.id, getToken);
      setNotes((currentNotes) =>
        currentNotes.map((currentNote) =>
          currentNote.id === note.id ? { ...currentNote, ...result } : currentNote
        )
      );
    } catch (error) {
      setLikeErrors((current) => ({
        ...current,
        [note.id]: error.message || 'Could not update like',
      }));
    } finally {
      setBusyNoteId(null);
    }
  }

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
        <h2>Public Feed</h2>
        {loading && <p>Loading…</p>}
        {!loading && notes.length === 0 && <p>No notes yet.</p>}
        {notes.map((note) => (
          <article key={note.id} className="card note-card">
            <Link to={`/notes/${note.id}`} className="card-link">
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
            <LikeButton
              count={note.like_count}
              liked={note.liked_by_current_user}
              isSignedIn={isSignedIn}
              isOwner={note.is_owner}
              busy={busyNoteId === note.id}
              error={likeErrors[note.id]}
              onToggle={() => toggleNoteLike(note)}
            />
          </article>
        ))}
      </section>
    </div>
  );
}
