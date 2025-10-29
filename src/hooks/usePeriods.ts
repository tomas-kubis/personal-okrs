import { useState, useEffect, useCallback } from 'react';
import type { Period } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './useUser';

export function usePeriods() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activePeriod, setActivePeriodState] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useUser();

  const loadPeriods = useCallback(async () => {
    if (!currentUser) {
      setPeriods([]);
      setActivePeriodState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('start_date', { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const periodList = data ?? [];
      setPeriods(periodList as Period[]);
      const active = periodList.find(period => period.is_active) || null;
      setActivePeriodState(active as Period | null);
      setError(null);
    } catch (err) {
      console.error('Failed to load periods:', err);
      setError(err instanceof Error ? err.message : 'Failed to load periods');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const createPeriod = useCallback(async (name: string, startDate: string, endDate: string): Promise<Period> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const shouldBeActive = periods.length === 0;
      const { data, error: insertError } = await supabase
        .from('periods')
        .insert({
          name,
          start_date: startDate,
          end_date: endDate,
          user_id: currentUser.id,
          is_active: shouldBeActive,
        })
        .select()
        .single();

      if (insertError || !data) {
        throw insertError || new Error('Failed to create period');
      }

      await loadPeriods();
      setError(null);
      return data as Period;
    } catch (err) {
      console.error('Failed to create period:', err);
      const message = err instanceof Error ? err.message : 'Failed to create period';
      setError(message);
      throw new Error(message);
    }
  }, [currentUser, loadPeriods, periods.length]);

  const setActivePeriod = useCallback(async (periodId: string): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      await supabase
        .from('periods')
        .update({ is_active: false })
        .eq('user_id', currentUser.id);

      const { error: activateError } = await supabase
        .from('periods')
        .update({ is_active: true })
        .eq('id', periodId)
        .eq('user_id', currentUser.id);

      if (activateError) {
        throw activateError;
      }

      await loadPeriods();
      setError(null);
    } catch (err) {
      console.error('Failed to set active period:', err);
      const message = err instanceof Error ? err.message : 'Failed to set active period';
      setError(message);
      throw new Error(message);
    }
  }, [currentUser, loadPeriods]);

  const deletePeriod = useCallback(async (periodId: string): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const { data: objectives } = await supabase
        .from('objectives')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('period_id', periodId)
        .limit(1);

      if (objectives && objectives.length > 0) {
        throw new Error('Cannot delete period with objectives. Delete objectives first.');
      }

      const { error: deleteError } = await supabase
        .from('periods')
        .delete()
        .eq('id', periodId)
        .eq('user_id', currentUser.id);

      if (deleteError) {
        throw deleteError;
      }

      await loadPeriods();
      setError(null);
    } catch (err) {
      console.error('Failed to delete period:', err);
      const message = err instanceof Error ? err.message : 'Failed to delete period';
      setError(message);
      throw new Error(message);
    }
  }, [currentUser, loadPeriods]);

  return {
    periods,
    activePeriod,
    loading,
    error,
    createPeriod,
    setActivePeriod,
    deletePeriod,
    refresh: loadPeriods,
  };
}
