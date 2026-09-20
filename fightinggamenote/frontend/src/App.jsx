import { Routes, Route, Link } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/clerk-react';
import Feed from './pages/Feed.jsx';
import NoteDetail from './pages/NoteDetail.jsx';
import CreateNote from './pages/CreateNote.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          FightingGameNote
        </Link>
        <nav>
          <SignedOut>
            <SignInButton mode="modal" />
          </SignedOut>
          <SignedIn>
            <Link to="/notes/new">New note</Link>
            <UserButton />
          </SignedIn>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/notes/new" element={<CreateNote />} />
          <Route path="/notes/:id" element={<NoteDetail />} />
        </Routes>
      </main>
    </div>
  );
}
