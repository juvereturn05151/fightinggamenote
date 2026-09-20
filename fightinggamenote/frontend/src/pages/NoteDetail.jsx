import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth, SignedIn, SignedOut } from '@clerk/clerk-react';
import { api } from '../api.js';

export default function NoteDetail() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [note, setNote] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    api.getNote(id).then(setNote);
    refreshComments();
  }, [id]);

  function refreshComments() {
    api.listComments('note', id).then(setComments);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await api.createComment(
      { commentable_type: 'note', commentable_id: id, body: commentBody },
      getToken
    );
    setCommentBody('');
    refreshComments();
  }

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
      <p className="note-body">{note.body}</p>

      {/* Video player + "what I got wrong" callout go here once Phase 2
          (video upload) lands — see docs/ROADMAP.md */}

      <div className="comments">
        <h3>Comments · {comments.length}</h3>

        {topLevel.map((c) => (
          <div key={c.id} className="comment">
            <p>
              <strong>{c.username}</strong> {c.body}
            </p>
            {repliesFor(c.id).map((r) => (
              <div key={r.id} className="comment reply">
                <p>
                  <strong>{r.username}</strong> {r.body}
                </p>
              </div>
            ))}
          </div>
        ))}

        <SignedIn>
          <form onSubmit={submitComment} className="comment-form">
            <input
              type="text"
              placeholder="Add a comment"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button type="submit">Post</button>
          </form>
        </SignedIn>
        <SignedOut>
          <p className="subtitle">Sign in to comment.</p>
        </SignedOut>
      </div>
    </div>
  );
}
