import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Auth() {
  const {
    user,
    isAuthenticated,
    loading,
    signIn,
    signUp,
    signOut,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorDescription = params.get('error_description');
    if (errorDescription) {
      setStatus({ kind: 'error', text: errorDescription });
      return;
    }

    if (params.get('confirmed') === 'true') {
      setStatus({
        kind: 'success',
        text: 'Email confirmed. You can now sign in.',
      });
    }
  }, [location.search]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    try {
      if (mode === 'signup') {
        const { data, error } = await signUp(email, password);
        if (error) throw error;
        setStatus({
          kind: 'success',
          text: data.session
            ? 'Account created. You are signed in.'
            : 'Account created. Check your email and follow the confirmation link before signing in.',
        });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate(location.state?.from ?? '/');
      }
    } catch (error) {
      const needsConfirmation =
        error.code === 'email_not_confirmed' ||
        /email.*not.*confirm/i.test(error.message);
      setStatus({
        kind: 'error',
        text: needsConfirmation
          ? 'Confirm your email before signing in.'
          : error.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setStatus(null);
    const { error } = await signOut();
    setBusy(false);
    setStatus({
      kind: error ? 'error' : 'success',
      text: error ? error.message : 'You are signed out.',
    });
  }

  if (loading) return <p className="page-message">Loading session…</p>;

  if (isAuthenticated) {
    return (
      <section className="auth-page card">
        <h1>Your account</h1>
        <p>
          Signed in as <strong>{user.email}</strong>
        </p>
        {status && (
          <p className={`auth-status ${status.kind}`} role="status">
            {status.text}
          </p>
        )}
        <div className="auth-actions">
          <Link to="/my-notes">View My Notes</Link>
          <button type="button" onClick={handleSignOut} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page card">
      <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
        {status && (
          <p className={`auth-status ${status.kind}`} role="status">
            {status.text}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy
            ? mode === 'signin'
              ? 'Signing in…'
              : 'Creating account…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Sign up'}
        </button>
      </form>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setStatus(null);
        }}
      >
        {mode === 'signin'
          ? 'Need an account? Sign up'
          : 'Already have an account? Sign in'}
      </button>
    </section>
  );
}
