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
import MyNotes from './pages/MyNotes.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          FightingGameNote
        </Link>
        <nav>
          <Link to="/">Public Feed</Link>
          <SignedOut>
            <SignInButton mode="modal" />
          </SignedOut>
          <SignedIn>
            <Link to="/my-notes">My Notes</Link>
            <Link to="/notes/new">New note</Link>
            <UserButton />
          </SignedIn>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/my-notes" element={<MyNotes />} />
          <Route path="/notes/new" element={<CreateNote />} />
          <Route path="/notes/:id" element={<NoteDetail />} />
        </Routes>
      </main>
    </div>
  );
}
