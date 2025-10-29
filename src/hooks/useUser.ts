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
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }

        if (!data.user) {
          if (isMounted) {
            setCurrentUser(null);
            setUsers([]);
            setError('Please sign in to continue.');
          }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (isMounted) {
          const mappedUser = buildUser(data.user, profile ?? undefined);
          setCurrentUser(mappedUser);
          setUsers([mappedUser]);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
        if (isMounted) {
          setCurrentUser(null);
          setUsers([]);
          setError(err instanceof Error ? err.message : 'Failed to load user data');
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
