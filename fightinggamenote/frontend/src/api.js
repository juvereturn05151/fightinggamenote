const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Pass getAccessToken for authenticated or personalized requests. Public
// endpoints remain usable without it.
async function request(path, { method = 'GET', body, getAccessToken } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error ?? 'Request failed');
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function uploadVideo(noteId, file, getAccessToken) {
  const token = await getAccessToken();
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

async function getLegacyVideoBlob(videoId, getAccessToken) {
  const token = await getAccessToken();
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

  listNotes: ({ game, character } = {}, getAccessToken) => {
    const params = new URLSearchParams();
    if (game) params.set('game', game);
    if (character) params.set('character', character);
    const qs = params.toString();
    return request(`/notes${qs ? `?${qs}` : ''}`, { getAccessToken });
  },
  getNote: (id, getAccessToken) =>
    request(`/notes/${id}`, { getAccessToken }),
  listMyNotes: (getAccessToken) =>
    request('/notes/mine', { getAccessToken }),
  createNote: (note, getAccessToken) =>
    request('/notes', { method: 'POST', body: note, getAccessToken }),
  updateNoteVisibility: (noteId, visibility, getAccessToken) =>
    request(`/notes/${noteId}`, {
      method: 'PATCH',
      body: { visibility },
      getAccessToken,
    }),

  listComments: (type, id, getAccessToken) =>
    request(`/comments?type=${type}&id=${id}`, { getAccessToken }),
  createComment: (comment, getAccessToken) =>
    request('/comments', { method: 'POST', body: comment, getAccessToken }),
  likeNote: (noteId, getAccessToken) =>
    request(`/notes/${noteId}/like`, { method: 'POST', getAccessToken }),
  unlikeNote: (noteId, getAccessToken) =>
    request(`/notes/${noteId}/like`, { method: 'DELETE', getAccessToken }),
  likeComment: (commentId, getAccessToken) =>
    request(`/comments/${commentId}/like`, { method: 'POST', getAccessToken }),
  unlikeComment: (commentId, getAccessToken) =>
    request(`/comments/${commentId}/like`, { method: 'DELETE', getAccessToken }),
  getMyReputation: (getAccessToken) =>
    request('/reputation/me', { getAccessToken }),
  uploadVideo,
  attachYouTubeVideo: (noteId, youtubeUrl, getAccessToken) =>
    request(`/notes/${noteId}/youtube-videos`, {
      method: 'POST',
      body: { youtube_url: youtubeUrl },
      getAccessToken,
    }),
  listVideos: (noteId, getAccessToken) =>
    request(`/notes/${noteId}/videos`, { getAccessToken }),
  getLegacyVideoBlob,
};
