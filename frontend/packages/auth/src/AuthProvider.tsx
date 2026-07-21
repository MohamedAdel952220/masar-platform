import { getSupabaseClient } from '@masar/api-client';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_CLAIMS, readClaims, type MasarClaims } from './claims';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  claims: MasarClaims;
  /** Ends the session. Callers must also clear the query cache (see §13). */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session container — Phase 1 foundation only.
 *
 * This provider owns session *state* (restore on load, react to auth events,
 * expose claims). It deliberately implements NO authentication flow: no login,
 * signup, OTP, MFA enrolment, or password-reset logic lives here. Those arrive
 * in Phase 3 per the roadmap.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const claims = session?.user ? readClaims(session.user.app_metadata) : EMPTY_CLAIMS;
    return {
      status,
      session,
      claims,
      signOut: async () => {
        await getSupabaseClient().auth.signOut();
      },
    };
  }, [status, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
