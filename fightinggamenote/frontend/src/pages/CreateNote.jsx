import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

export default function CreateNote() {
  const { getAccessToken, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [games, setGames] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [gameId, setGameId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [createdNoteId, setCreatedNoteId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.listGames().then(setGames);
  }, [isAuthenticated]);

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

    if (
      !createdNoteId &&
      (!gameId || !characterId || !title.trim() || !body.trim())
    ) {
      setError('Game, character, title, and body are all required.');
      return;
    }

    const normalizedYouTubeUrl = youtubeUrl.trim();
    if (normalizedYouTubeUrl && !isSupportedYouTubeUrl(normalizedYouTubeUrl)) {
      setError(
        'Enter a valid YouTube watch, youtu.be, Shorts, or embed URL.'
      );
      return;
    }

    setSubmitting(true);
    try {
      let noteId = createdNoteId;

      if (!noteId) {
        const createdNote = await api.createNote(
          {
            game_id: gameId,
            character_id: characterId,
            title,
            body,
            tags: tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            visibility,
          },
          getAccessToken
        );
        noteId = createdNote.id;
        setCreatedNoteId(noteId);
      }

      if (normalizedYouTubeUrl) {
        try {
          await api.attachYouTubeVideo(
            noteId,
            normalizedYouTubeUrl,
            getAccessToken
          );
        } catch (attachError) {
          setError(
            `Your note was created, but the YouTube replay was not attached: ${attachError.message}. You can correct the URL and retry without creating another note.`
          );
          return;
        }
      }

      navigate(`/notes/${noteId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="page-message">Loading session…</p>;

  if (!isAuthenticated) {
    return (
      <div className="page-message">
        <p>Sign in to create a note.</p>
        <Link to="/auth" state={{ from: location.pathname }}>
          Sign in
        </Link>
      </div>
    );
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
      <label>
        Visibility
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          disabled={submitting || Boolean(createdNoteId)}
        >
          <option value="private">Private — Only me</option>
          <option value="public">Public — Everyone can view and comment</option>
        </select>
      </label>
      <label>
        YouTube replay URL (optional)
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          disabled={submitting}
        />
      </label>
      <p className="form-help">
        Public or unlisted videos can be embedded when YouTube allows it.
        Unlisted is not private, and YouTube visibility is separate from this
        note&apos;s visibility.
      </p>
      {error && <p className="error">{error}</p>}

      {createdNoteId && (
        <p className="form-help">
          The note already exists. Submitting again retries only the video
          attachment.
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting
          ? createdNoteId
            ? 'Attaching…'
            : 'Posting…'
          : createdNoteId
            ? 'Retry video attachment'
            : 'Post note'}
      </button>
      {createdNoteId && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => navigate(`/notes/${createdNoteId}`)}
        >
          Continue without video
        </button>
      )}
    </form>
  );
}

function isSupportedYouTubeUrl(value) {
  try {
    const url = new URL(value);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return false;
    }

    const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
    const hostname = url.hostname.toLowerCase();
    const pathParts = url.pathname.split('/').filter(Boolean);
    let videoId = null;

    if (hostname === 'youtu.be' && pathParts.length === 1) {
      videoId = pathParts[0];
    } else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(hostname)
    ) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (
        pathParts.length === 2 &&
        ['shorts', 'embed'].includes(pathParts[0])
      ) {
        videoId = pathParts[1];
      }
    }

    return videoIdPattern.test(videoId ?? '');
  } catch {
    return false;
  }
}
