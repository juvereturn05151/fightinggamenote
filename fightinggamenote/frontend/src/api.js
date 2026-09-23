const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// getToken is Clerk's session token getter, passed in from the calling
// component via useAuth(). Pass null for unauthenticated GETs.
async function request(path, { method = 'GET', body, getToken } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (getToken) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

async function uploadVideo(noteId, file, getToken) {
  const token = await getToken();
  const formData = new FormData();
  formData.append('video', file);

  const res = await fetch(`${API_URL}/notes/${noteId}/videos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Video upload failed');
  }

  return res.json();
}

async function getLegacyVideoBlob(videoId, getToken) {
  const token = await getToken();
  const res = await fetch(`${API_URL}/videos/${videoId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Video playback failed');
  }

  return res.blob();
}

export const api = {
  listGames: () => request('/games'),
  listCharacters: (gameSlug) => request(`/games/${gameSlug}/characters`),

  listNotes: ({ game, character } = {}, getToken) => {
    const params = new URLSearchParams();
    if (game) params.set('game', game);
    if (character) params.set('character', character);
    const qs = params.toString();
    return request(`/notes${qs ? `?${qs}` : ''}`, { getToken });
  },
  getNote: (id, getToken) => request(`/notes/${id}`, { getToken }),
  listMyNotes: (getToken) => request('/notes/mine', { getToken }),
  createNote: (note, getToken) =>
    request('/notes', { method: 'POST', body: note, getToken }),
  updateNoteVisibility: (noteId, visibility, getToken) =>
    request(`/notes/${noteId}`, {
      method: 'PATCH',
      body: { visibility },
      getToken,
    }),

  listComments: (type, id, getToken) =>
    request(`/comments?type=${type}&id=${id}`, { getToken }),
  createComment: (comment, getToken) =>
    request('/comments', { method: 'POST', body: comment, getToken }),
  likeNote: (noteId, getToken) =>
    request(`/notes/${noteId}/like`, { method: 'POST', getToken }),
  unlikeNote: (noteId, getToken) =>
    request(`/notes/${noteId}/like`, { method: 'DELETE', getToken }),
  likeComment: (commentId, getToken) =>
    request(`/comments/${commentId}/like`, { method: 'POST', getToken }),
  unlikeComment: (commentId, getToken) =>
    request(`/comments/${commentId}/like`, { method: 'DELETE', getToken }),
  getMyReputation: (getToken) => request('/reputation/me', { getToken }),
  uploadVideo,
  attachYouTubeVideo: (noteId, youtubeUrl, getToken) =>
    request(`/notes/${noteId}/youtube-videos`, {
      method: 'POST',
      body: { youtube_url: youtubeUrl },
      getToken,
    }),
  listVideos: (noteId, getToken) =>
    request(`/notes/${noteId}/videos`, { getToken }),
  getLegacyVideoBlob,
};
