import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Sentry } from "@/lib/sentry";

export function useAuth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        if (session?.user) {
          Sentry.setUser({ id: session.user.id, email: session.user.email ?? undefined });
        } else {
          Sentry.setUser(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        Sentry.setUser({ id: session.user.id, email: session.user.email ?? undefined });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear all cached data to prevent data leakage between users
    queryClient.clear();
    Sentry.setUser(null);
    await supabase.auth.signOut();
  };

  const isEmailVerified = !!user?.email_confirmed_at || user?.app_metadata?.provider === 'google';

  return {
    user,
    session,
    isLoading,
    signOut,
    isAuthenticated: !!user,
    isEmailVerified
  };
}
