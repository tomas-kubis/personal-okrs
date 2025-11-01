import { useState, useEffect } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../types';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/supabase.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const buildUser = (authUser: SupabaseAuthUser, profile?: ProfileRow | null): User => {
  const metadataName = (authUser.user_metadata?.name as string) || (authUser.user_metadata?.full_name as string);
  return {
    id: authUser.id,
    name: profile?.name || metadataName || authUser.email || 'User',
    email: profile?.email || authUser.email || undefined,
    created_at: authUser.created_at,
  };
};

export function useUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        const authUser = sessionData.session?.user;
        if (!authUser) {
          if (isMounted) {
            setCurrentUser(null);
            setUsers([]);
            setError(null);
          }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (isMounted) {
          const mappedUser = buildUser(authUser, profile ?? undefined);
          setCurrentUser(mappedUser);
          setUsers([mappedUser]);
          setError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load user data';
        if (message !== 'Auth session missing!') {
          console.error('Failed to load user data:', err);
        }
        if (isMounted) {
          setCurrentUser(null);
          setUsers([]);
          setError(message === 'Auth session missing!' ? null : message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        setCurrentUser(null);
        setUsers([]);
      } else {
        loadUser();
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  const switchUser = (userId: string): void => {
    if (currentUser?.id === userId) return;
    throw new Error('Switching users is managed via Supabase Auth. Please sign out and sign back in instead.');
  };

  return {
    currentUser,
    users,
    loading,
    error,
    switchUser,
  };
}
