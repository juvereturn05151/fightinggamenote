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

export const api = {
  listGames: () => request('/games'),
  listCharacters: (gameSlug) => request(`/games/${gameSlug}/characters`),

  listNotes: ({ game, character } = {}) => {
    const params = new URLSearchParams();
    if (game) params.set('game', game);
    if (character) params.set('character', character);
    const qs = params.toString();
    return request(`/notes${qs ? `?${qs}` : ''}`);
  },
  getNote: (id) => request(`/notes/${id}`),
  createNote: (note, getToken) =>
    request('/notes', { method: 'POST', body: note, getToken }),

  listComments: (type, id) => request(`/comments?type=${type}&id=${id}`),
  createComment: (comment, getToken) =>
    request('/comments', { method: 'POST', body: comment, getToken }),
  uploadVideo,
};
