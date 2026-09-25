import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSupabaseClient } from '../supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('Could not restore Supabase session', error);
      setSession(data.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }, []);

  const signIn = useCallback((email, password) => {
    return getSupabaseClient().auth.signInWithPassword({ email, password });
  }, []);

  const signUp = useCallback((email, password) => {
    return getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
  }, []);

  const signOut = useCallback(() => getSupabaseClient().auth.signOut(), []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      loading,
      getAccessToken,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, getAccessToken, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
