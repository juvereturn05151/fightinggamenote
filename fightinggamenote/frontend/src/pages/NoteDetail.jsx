import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';
import LikeButton from '../components/LikeButton.jsx';

export default function NoteDetail() {
  const { id } = useParams();
  const { getAccessToken, isAuthenticated, loading: authLoading, user } = useAuth();
  const [note, setNote] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [videos, setVideos] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [visibilityError, setVisibilityError] = useState('');
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [busyLikeKey, setBusyLikeKey] = useState('');
  const [likeErrors, setLikeErrors] = useState({});

  useEffect(() => {
    if (authLoading) return;
    setLoadError('');
    api.getNote(id, isAuthenticated ? getAccessToken : undefined).then(setNote).catch((error) => {
      setLoadError(error.message || 'Could not load note');
    });
    refreshComments();
  }, [authLoading, getAccessToken, id, isAuthenticated, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    api.listVideos(id, isAuthenticated ? getAccessToken : undefined).then(setVideos).catch((error) => {
      setLoadError(error.message || 'Could not load videos');
    });
  }, [authLoading, getAccessToken, id, isAuthenticated, user?.id]);

  function refreshComments() {
    api.listComments(
      'note',
      id,
      isAuthenticated ? getAccessToken : undefined
    ).then(setComments).catch((error) => {
      setLoadError(error.message || 'Could not load comments');
    });
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await api.createComment(
      { commentable_type: 'note', commentable_id: id, body: commentBody },
      getAccessToken
    );
    setCommentBody('');
    refreshComments();
  }

  async function changeVisibility(e) {
    const visibility = e.target.value;
    const previousVisibility = note.visibility;
    setVisibilityError('');
    setSavingVisibility(true);
    setNote((currentNote) => ({ ...currentNote, visibility }));

    try {
      const updatedNote = await api.updateNoteVisibility(
        id,
        visibility,
        getAccessToken
      );
      setNote((currentNote) => ({
        ...currentNote,
        visibility: updatedNote.visibility,
      }));
    } catch (error) {
      setNote((currentNote) => ({
        ...currentNote,
        visibility: previousVisibility,
      }));
      setVisibilityError(error.message || 'Could not change visibility');
    } finally {
      setSavingVisibility(false);
    }
  }

  async function toggleNoteLike() {
    if (!isAuthenticated || note.is_owner || busyLikeKey) return;
    const key = `note:${note.id}`;
    setBusyLikeKey(key);
    setLikeErrors((current) => ({ ...current, [key]: '' }));

    try {
      const result = note.liked_by_current_user
        ? await api.unlikeNote(note.id, getAccessToken)
        : await api.likeNote(note.id, getAccessToken);
      setNote((currentNote) => ({ ...currentNote, ...result }));
    } catch (error) {
      setLikeErrors((current) => ({
        ...current,
        [key]: error.message || 'Could not update like',
      }));
    } finally {
      setBusyLikeKey('');
    }
  }

  async function toggleCommentLike(comment) {
    if (!isAuthenticated || comment.is_owner || busyLikeKey) return;
    const key = `comment:${comment.id}`;
    setBusyLikeKey(key);
    setLikeErrors((current) => ({ ...current, [key]: '' }));

    try {
      const result = comment.liked_by_current_user
        ? await api.unlikeComment(comment.id, getAccessToken)
        : await api.likeComment(comment.id, getAccessToken);
      setComments((currentComments) =>
        currentComments.map((currentComment) =>
          currentComment.id === comment.id
            ? { ...currentComment, ...result }
            : currentComment
        )
      );
    } catch (error) {
      setLikeErrors((current) => ({
        ...current,
        [key]: error.message || 'Could not update like',
      }));
    } finally {
      setBusyLikeKey('');
    }
  }

  function renderComment(comment, isReply = false) {
    const key = `comment:${comment.id}`;
    return (
      <div key={comment.id} className={isReply ? 'comment reply' : 'comment'}>
        <p>
          <strong>{comment.username}</strong> {comment.body}
        </p>
        {note.visibility === 'public' && (
          <LikeButton
            count={comment.like_count}
            liked={comment.liked_by_current_user}
            isAuthenticated={isAuthenticated}
            isOwner={comment.is_owner}
            busy={busyLikeKey === key}
            error={likeErrors[key]}
            onToggle={() => toggleCommentLike(comment)}
          />
        )}
        {!isReply && repliesFor(comment.id).map((reply) => renderComment(reply, true))}
      </div>
    );
  }

  if (loadError && !note) return <p className="error">{loadError}</p>;
  if (!note) return <p>Loading…</p>;

  // Flat list -> one level of nesting, matching the current UI decision
  // (schema supports deeper nesting via parent_comment_id if needed later)
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesFor = (parentId) =>
    comments.filter((c) => c.parent_comment_id === parentId);

  return (
    <div className="note-detail">
      <div className="card-header">
        <span className="avatar">{note.username.slice(0, 2).toUpperCase()}</span>
        <div>
          <p className="username">{note.username}</p>
          <p className="subtitle">
            {note.game_name} · {note.character_name}
          </p>
        </div>
      </div>

      <h2>{note.title}</h2>
      <div className="visibility-row">
        <span className={`visibility-badge ${note.visibility}`}>
          {note.visibility === 'private' ? 'Private' : 'Public'}
        </span>
        {note.is_owner && (
          <label className="visibility-control">
            Visibility
            <select
              value={note.visibility}
              onChange={changeVisibility}
              disabled={savingVisibility}
            >
              <option value="private">Private — Only me</option>
              <option value="public">Public — Everyone</option>
            </select>
          </label>
        )}
      </div>
      {visibilityError && <p className="error">{visibilityError}</p>}
      <p className="note-body">{note.body}</p>
      {note.visibility === 'public' && (
        <LikeButton
          count={note.like_count}
          liked={note.liked_by_current_user}
          isAuthenticated={isAuthenticated}
          isOwner={note.is_owner}
          busy={busyLikeKey === `note:${note.id}`}
          error={likeErrors[`note:${note.id}`]}
          onToggle={toggleNoteLike}
        />
      )}

      <div className="note-videos">
        {videos.map((video) => (
          <div key={video.id} className="note-video">
            {video.youtube_video_id ? (
              <div className="video-embed">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.youtube_video_id}`}
                  title="YouTube replay"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <>
                {video.original_filename && <p>{video.original_filename}</p>}
                <LegacyVideoPlayer
                  videoId={video.id}
                  isPrivate={note.visibility === 'private'}
                  getAccessToken={getAccessToken}
                />
              </>
            )}

          </div>
        ))}
      </div>

      <div className="comments">
        <h3>Comments · {comments.length}</h3>

        {topLevel.map((comment) => renderComment(comment))}

        {isAuthenticated ? (
          <form onSubmit={submitComment} className="comment-form">
            <input
              type="text"
              placeholder="Add a comment"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button type="submit">Post</button>
          </form>
        ) : (
          <p className="subtitle"><Link to="/auth">Sign in</Link> to comment.</p>
        )}
      </div>
    </div>
  );
}

function LegacyVideoPlayer({ videoId, isPrivate, getAccessToken }) {
  const publicUrl = `${
    import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  }/videos/${videoId}/stream`;
  const [privateUrl, setPrivateUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPrivate) {
      setPrivateUrl('');
      setError('');
      return undefined;
    }

    let objectUrl;
    let cancelled = false;
    setError('');

    api
      .getLegacyVideoBlob(videoId, getAccessToken)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPrivateUrl(objectUrl);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || 'Could not load video');
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getAccessToken, isPrivate, videoId]);

  if (error) return <p className="error">{error}</p>;
  if (isPrivate && !privateUrl) return <p className="subtitle">Loading video…</p>;

  return <video controls width="100%" src={isPrivate ? privateUrl : publicUrl} />;
}
