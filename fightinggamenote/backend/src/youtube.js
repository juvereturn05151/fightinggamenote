const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);

export function extractYouTubeVideoId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('YouTube replay URL is required');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid YouTube URL');
  }

  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error('Enter a valid YouTube URL');
  }

  const hostname = url.hostname.toLowerCase();
  let videoId = null;

  if (hostname === 'youtu.be') {
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 1) videoId = pathParts[0];
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v');
    } else if (
      pathParts.length === 2 &&
      ['shorts', 'embed'].includes(pathParts[0])
    ) {
      videoId = pathParts[1];
    }
  }

  if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) {
    throw new Error(
      'Use a YouTube watch, youtu.be, Shorts, or embed URL with a valid video ID'
    );
  }

  return videoId;
}
