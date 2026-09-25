export default function LikeButton({
  count = 0,
  liked = false,
  isAuthenticated,
  isOwner,
  busy,
  onToggle,
  error,
}) {
  const disabled = !isAuthenticated || isOwner || busy;
  const title = !isAuthenticated
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
