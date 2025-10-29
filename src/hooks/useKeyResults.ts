import { useState, useEffect, useCallback } from 'react';
import type { KeyResult, WeeklyProgress, KeyResultStatus } from '../types';
import type { Json, Database } from '../lib/supabase.types';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './useUser';

export function useKeyResults(objectiveId?: string) {
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useUser();

  type KeyResultViewRow = Database['public']['Views']['key_results_with_progress']['Row'];

  const parseWeeklyProgress = (value: Json | null): WeeklyProgress[] => {
    if (!Array.isArray(value)) return [];
    const result: WeeklyProgress[] = [];
    value.forEach((entry: any) => {
      const weekStart = entry.week_start_date || entry.weekStartDate;
      if (!weekStart) return;
      result.push({
        week_start_date: weekStart,
        value: typeof entry.value === 'number' ? entry.value : 0,
        status: entry.status as KeyResultStatus | undefined,
        recorded_at: entry.recorded_at || entry.recordedAt || new Date().toISOString(),
      });
    });
    return result;
  };

  const mapKeyResult = (row: KeyResultViewRow): KeyResult => ({
    id: row.id || '',
    user_id: row.user_id || currentUser?.id || '',
    objective_id: row.objective_id || '',
    description: row.description || '',
    target_value: row.target_value ?? 0,
    unit: row.unit || '',
    weekly_targets: row.weekly_targets ?? undefined,
    target_mode: row.target_mode ?? undefined,
    weekly_progress: parseWeeklyProgress(row.weekly_progress),
    status: (row.status || 'on-track') as KeyResultStatus,
    status_override: row.status_override ?? undefined,
    status_override_reason: row.status_override_reason ?? undefined,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || undefined,
  });

  // Load key results from storage
  const loadKeyResults = useCallback(async () => {
    if (!currentUser) {
      setKeyResults([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('key_results_with_progress')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (objectiveId) {
        query = query.eq('objective_id', objectiveId);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        throw queryError;
      }

      const mapped = (data ?? []).map(mapKeyResult);
      setKeyResults(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load key results');
      console.error('Error loading key results:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, objectiveId]);

  // Load on mount and when user/objectiveId changes
  useEffect(() => {
    loadKeyResults();
  }, [loadKeyResults]);

  // Create a new key result
  const createKeyResult = useCallback(async (
    keyResult: Omit<KeyResult, 'id' | 'user_id' | 'weekly_progress' | 'status' | 'created_at'>
  ): Promise<KeyResult> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const { data, error: insertError } = await supabase
        .from('key_results')
        .insert({
          user_id: currentUser.id,
          objective_id: keyResult.objective_id,
          description: keyResult.description,
          target_value: keyResult.target_value,
          unit: keyResult.unit,
          weekly_targets: keyResult.weekly_targets,
          target_mode: keyResult.target_mode,
          status: 'on-track',
        })
        .select()
        .single();

      if (insertError || !data) {
        throw insertError || new Error('Failed to create key result');
      }

      await loadKeyResults();
      setError(null);
      return mapKeyResult({ ...data, weekly_progress: [] } as KeyResultViewRow);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create key result';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, loadKeyResults]);

  // Update a key result
  const updateKeyResult = useCallback(async (
    id: string,
    updates: Partial<Omit<KeyResult, 'id' | 'user_id' | 'objective_id' | 'weekly_progress'>>
  ): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const { error: updateError } = await supabase
        .from('key_results')
        .update(updates)
        .eq('id', id)
        .eq('user_id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      await loadKeyResults();
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update key result';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, loadKeyResults]);

  // Add weekly progress
  const addWeeklyProgress = useCallback(async (
    keyResultId: string,
    progress: Omit<WeeklyProgress, 'recorded_at'>
  ): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const recorded_at = new Date().toISOString();

      const { data: existingProgress } = await supabase
        .from('kr_weekly_progress')
        .select('id')
        .eq('key_result_id', keyResultId)
        .eq('week_start_date', progress.week_start_date)
        .maybeSingle();

      if (existingProgress?.id) {
        await supabase
          .from('kr_weekly_progress')
          .update({
            value: progress.value,
            status: progress.status,
            recorded_at,
          })
          .eq('id', existingProgress.id)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('kr_weekly_progress')
          .insert({
            key_result_id: keyResultId,
            user_id: currentUser.id,
            week_start_date: progress.week_start_date,
            value: progress.value,
            status: progress.status,
            recorded_at,
          });
      }

      await loadKeyResults();
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add weekly progress';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, loadKeyResults]);

  // Delete a key result
  const deleteKeyResult = useCallback(async (id: string): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      await supabase
        .from('kr_weekly_progress')
        .delete()
        .eq('key_result_id', id);

      const { error: deleteError } = await supabase
        .from('key_results')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

      if (deleteError) {
        throw deleteError;
      }

      setKeyResults(prev => prev.filter(kr => kr.id !== id));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete key result';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser]);

  return {
    keyResults,
    loading,
    error,
    createKeyResult,
    updateKeyResult,
    addWeeklyProgress,
    deleteKeyResult,
    reload: loadKeyResults,
  };
}
