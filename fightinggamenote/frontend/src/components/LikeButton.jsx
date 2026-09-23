export default function LikeButton({
  count = 0,
  liked = false,
  isSignedIn,
  isOwner,
  busy,
  onToggle,
  error,
}) {
  const disabled = !isSignedIn || isOwner || busy;
  const title = !isSignedIn
    ? 'Sign in to like'
    : isOwner
      ? 'You cannot like your own content'
      : undefined;

  return (
    <div className="like-control">
      <button
        type="button"
        className={liked ? 'like-button liked' : 'like-button'}
        aria-pressed={liked}
        disabled={disabled}
        title={title}
        onClick={onToggle}
      >
        {busy ? 'Saving…' : liked ? 'Unlike' : 'Like'} · {count}
      </button>
      {error && <span className="like-error">{error}</span>}
    </div>
  );
}
