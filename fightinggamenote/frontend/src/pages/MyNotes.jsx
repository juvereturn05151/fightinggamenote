import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

export default function MyNotes() {
  const { getAccessToken, isAuthenticated, loading: authLoading, user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reputation, setReputation] = useState({
    total: 0,
    from_note_likes: 0,
    from_comment_likes: 0,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    Promise.all([
      api.listMyNotes(getAccessToken),
      api.getMyReputation(getAccessToken),
    ])
      .then(([myNotes, reputationTotals]) => {
        setNotes(myNotes);
        setReputation(reputationTotals);
      })
      .catch((requestError) => {
        setError(requestError.message || 'Could not load your notes');
      })
      .finally(() => setLoading(false));
  }, [authLoading, getAccessToken, isAuthenticated, user?.id]);

  if (authLoading || loading) return <p className="page-message">Loading…</p>;

  if (!isAuthenticated) {
    return (
      <div className="page-message">
        <p>Sign in to view your notes.</p>
        <Link to="/auth" state={{ from: '/my-notes' }}>Sign in</Link>
      </div>
    );
  }

  return (
    <section className="my-notes">
      <div className="page-heading">
        <div>
          <h2>My Notes</h2>
          <p className="subtitle">Private and public notes you created.</p>
        </div>
        <Link to="/notes/new">Create note</Link>
      </div>

      <div className="reputation-summary">
        <div>
          <strong>{reputation.total}</strong>
          <span>Lifetime reputation</span>
        </div>
        <div>
          <strong>{reputation.from_note_likes}</strong>
          <span>From post likes</span>
        </div>
        <div>
          <strong>{reputation.from_comment_likes}</strong>
          <span>From comment likes</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && notes.length === 0 && <p>You have not created any notes yet.</p>}

      <div className="my-notes-list">
        {notes.map((note) => (
          <Link to={`/notes/${note.id}`} key={note.id} className="card note-card">
            <div className="card-header card-header-spread">
              <div>
                <p className="username">{note.game_name} · {note.character_name}</p>
                <p className="subtitle">{new Date(note.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`visibility-badge ${note.visibility}`}>
                {note.visibility === 'private' ? 'Private' : 'Public'}
              </span>
            </div>
            <p className="note-title">{note.title}</p>
            <p className="note-body">{note.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
