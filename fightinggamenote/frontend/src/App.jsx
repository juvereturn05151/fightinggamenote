import { Routes, Route, Link } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Feed from './pages/Feed.jsx';
import NoteDetail from './pages/NoteDetail.jsx';
import CreateNote from './pages/CreateNote.jsx';
import MyNotes from './pages/MyNotes.jsx';
import Auth from './pages/Auth.jsx';

export default function App() {
  const { isAuthenticated, loading, signOut, user } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          FightingGameNote
        </Link>
        <nav>
          <Link to="/">Public Feed</Link>
          {!loading && !isAuthenticated && <Link to="/auth">Sign in</Link>}
          {!loading && isAuthenticated && (
            <>
              <Link to="/my-notes">My Notes</Link>
              <Link to="/notes/new">New note</Link>
              <span className="nav-email" title={user.email}>{user.email}</span>
              <button className="text-button" type="button" onClick={signOut}>
                Sign out
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/my-notes" element={<MyNotes />} />
          <Route path="/notes/new" element={<CreateNote />} />
          <Route path="/notes/:id" element={<NoteDetail />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </main>
    </div>
  );
}
