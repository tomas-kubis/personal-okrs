import { useState, useEffect, useCallback } from 'react';
import type { Objective } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './useUser';
import { usePeriods } from './usePeriods';

export function useObjectives() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useUser();
  const { activePeriod } = usePeriods();

  // Load objectives from storage
  const loadObjectives = useCallback(async () => {
    if (!currentUser) {
      setObjectives([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('objectives')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (activePeriod) {
        query = query.eq('period_id', activePeriod.id);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        throw queryError;
      }

      setObjectives((data ?? []) as Objective[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objectives');
      console.error('Error loading objectives:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activePeriod]);

  // Load on mount and when user/quarter changes
  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  // Create a new objective
  const createObjective = useCallback(async (
    objective: Omit<Objective, 'id' | 'user_id' | 'period_id' | 'created_at'>
  ): Promise<Objective> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      if (!activePeriod) {
        throw new Error('No active period');
      }

      const { data, error: insertError } = await supabase
        .from('objectives')
        .insert({
          user_id: currentUser.id,
          title: objective.title,
          description: objective.description,
          period: activePeriod.name,
          period_id: activePeriod.id,
        })
        .select()
        .single();

      if (insertError || !data) {
        throw insertError || new Error('Failed to create objective');
      }

      const createdObjective = data as Objective;
      setObjectives(prev => [...prev, createdObjective]);
      setError(null);
      return createdObjective;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create objective';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, activePeriod]);

  // Update an objective
  const updateObjective = useCallback(async (
    id: string,
    updates: Partial<Omit<Objective, 'id' | 'user_id' | 'period_id' | 'created_at'>>
  ): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const { error: updateError } = await supabase
        .from('objectives')
        .update(updates)
        .eq('id', id)
        .eq('user_id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      await loadObjectives();
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update objective';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, loadObjectives]);

  // Delete an objective (and its key results)
  const deleteObjective = useCallback(async (id: string): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const { data: keyResults } = await supabase
        .from('key_results')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('objective_id', id);

      const keyResultIds = (keyResults ?? []).map(kr => kr.id);

      if (keyResultIds.length > 0) {
        await supabase
          .from('kr_weekly_progress')
          .delete()
          .in('key_result_id', keyResultIds);

        await supabase
          .from('key_results')
          .delete()
          .in('id', keyResultIds)
          .eq('user_id', currentUser.id);
      }

      const { error: deleteError } = await supabase
        .from('objectives')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

      if (deleteError) {
        throw deleteError;
      }

      setObjectives(prev => prev.filter(obj => obj.id !== id));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete objective';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser]);

  // Get active objectives (all objectives are active in new schema, no archived field)
  const activeObjectives = objectives;

  return {
    objectives,
    activeObjectives,
    loading,
    error,
    createObjective,
    updateObjective,
    deleteObjective,
    reload: loadObjectives,
  };
}
