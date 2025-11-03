import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, format } from 'date-fns';
import type { WeeklyCheckIn, ProgressUpdate, CoachingSession, CoachingMessage, Reflection } from '../types';
import type { Database, Json } from '../lib/supabase.types';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './useUser';
import { usePeriods } from './usePeriods';

export function useCheckIns() {
  const [checkIns, setCheckIns] = useState<WeeklyCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useUser();
  const { activePeriod } = usePeriods();

type CheckInRow = Database['public']['Tables']['weekly_check_ins']['Row'];
type ProgressUpdateRow = Database['public']['Tables']['check_in_progress_updates']['Row'];
type CoachingSessionRow = Database['public']['Tables']['coaching_sessions']['Row'];

const toJson = (value: unknown): Json => value as unknown as Json;

  const mapProgressUpdates = (rows?: ProgressUpdateRow[] | null): ProgressUpdate[] => {
    if (!rows) return [];
    return rows.map(row => ({
      key_result_id: row.key_result_id,
      value: row.value,
      notes: row.notes ?? undefined,
    }));
  };

  const mapCoachingSession = (row?: CoachingSessionRow | null): CoachingSession | undefined => {
    if (!row) return undefined;
    return {
      id: row.id,
      user_id: row.user_id,
      messages: ((row.messages || []) as unknown as CoachingMessage[]),
      started_at: row.started_at,
      completed_at: row.completed_at ?? undefined,
    };
  };

  const mapCheckIn = (
    row: CheckInRow & {
      progress_updates?: ProgressUpdateRow[] | null;
      coaching_session?: CoachingSessionRow | null;
    }
  ): WeeklyCheckIn => ({
    id: row.id,
    user_id: row.user_id,
    period_id: row.period_id,
    week_start_date: row.week_start_date,
    progress_updates: mapProgressUpdates(row.progress_updates),
    reflection: row.reflection as unknown as WeeklyCheckIn['reflection'],
    coaching_session: mapCoachingSession(row.coaching_session),
    completed_at: row.completed_at,
    created_at: row.created_at,
  });

  // Load check-ins from storage
  const loadCheckIns = useCallback(async () => {
    if (!currentUser || !activePeriod) {
      setCheckIns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('weekly_check_ins')
        .select(`
          *,
          progress_updates:check_in_progress_updates (
            id,
            key_result_id,
            value,
            notes
          ),
          coaching_session:coaching_sessions (*)
        `)
        .eq('user_id', currentUser.id)
        .eq('period_id', activePeriod.id)
        .order('week_start_date', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      const mapped = (data ?? []).map(row => mapCheckIn(row as any));
      setCheckIns(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load check-ins');
      console.error('Error loading check-ins:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, activePeriod]);

  // Load on mount and when user/quarter changes
  useEffect(() => {
    loadCheckIns();
  }, [loadCheckIns]);

  // Get week start date (Monday) for a given date
  const getWeekStartDate = useCallback((date: Date = new Date()): string => {
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  }, []);

  // Get current week's check-in
  const getCurrentWeekCheckIn = useCallback((): WeeklyCheckIn | undefined => {
    const currentWeekStart = getWeekStartDate();
    return checkIns.find(ci => {
      return ci.week_start_date === currentWeekStart;
    });
  }, [checkIns, getWeekStartDate]);

  // Create a new check-in
  const createCheckIn = useCallback(async (
    checkIn: Omit<WeeklyCheckIn, 'id' | 'user_id' | 'period_id' | 'created_at' | 'completed_at'>
  ): Promise<WeeklyCheckIn> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      if (!activePeriod) {
        throw new Error('No active period');
      }

      const now = new Date().toISOString();
      const { data: inserted, error: insertError } = await supabase
        .from('weekly_check_ins')
        .insert({
          user_id: currentUser.id,
          period_id: activePeriod.id,
          week_start_date: checkIn.week_start_date,
          reflection: toJson(checkIn.reflection),
          completed_at: now,
        })
        .select()
        .single();

      if (insertError || !inserted) {
        throw insertError || new Error('Failed to create check-in');
      }

      if (checkIn.progress_updates?.length) {
        const { error: progressError } = await supabase.from('check_in_progress_updates').insert(
          checkIn.progress_updates.map(pu => ({
            check_in_id: inserted.id,
            key_result_id: pu.key_result_id,
            user_id: currentUser.id,
            value: pu.value,
            notes: pu.notes ?? null,
          }))
        );

        if (progressError) {
          throw new Error(`Failed to save progress updates: ${progressError.message}`);
        }
      }

      const { data: fullRow, error: fetchError } = await supabase
        .from('weekly_check_ins')
        .select(`
          *,
          progress_updates:check_in_progress_updates (
            id,
            key_result_id,
            value,
            notes
          ),
          coaching_session:coaching_sessions (*)
        `)
        .eq('id', inserted.id)
        .single();

      if (fetchError || !fullRow) {
        throw fetchError || new Error('Failed to load created check-in');
      }

      const mapped = mapCheckIn(fullRow as any);
      setCheckIns(prev => [mapped, ...prev]);
      setError(null);
      return mapped;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create check-in';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, activePeriod]);

  // Update an existing check-in
  const updateCheckIn = useCallback(async (
    checkInId: string,
    updates: Partial<Pick<WeeklyCheckIn, 'reflection' | 'progress_updates' | 'coaching_session'>>
  ): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No current user');
      }

      const payload: Partial<CheckInRow> = {};

      if (updates.reflection) {
        payload.reflection = toJson(updates.reflection as Reflection);
      }

      if ('coaching_session' in updates) {
        if (updates.coaching_session) {
          const session = updates.coaching_session;
          await supabase
            .from('coaching_sessions')
            .upsert({
              id: session.id,
              user_id: currentUser.id,
              messages: toJson(session.messages),
              started_at: session.started_at,
              completed_at: session.completed_at ?? null,
            });
          payload.coaching_session_id = session.id;
        } else {
          payload.coaching_session_id = null;
        }
      }

      if (Object.keys(payload).length > 0) {
        const { error: updateError } = await supabase
          .from('weekly_check_ins')
          .update(payload)
          .eq('id', checkInId)
          .eq('user_id', currentUser.id);

        if (updateError) {
          throw updateError;
        }
      }

      if (updates.progress_updates) {
        await supabase
          .from('check_in_progress_updates')
          .delete()
          .eq('check_in_id', checkInId);

        if (updates.progress_updates.length) {
          await supabase
            .from('check_in_progress_updates')
            .insert(
              updates.progress_updates.map(pu => ({
                check_in_id: checkInId,
                key_result_id: pu.key_result_id,
                user_id: currentUser.id,
                value: pu.value,
                notes: pu.notes ?? null,
              }))
            );
        }
      }

      await loadCheckIns();
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update check-in';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, loadCheckIns]);

  return {
    checkIns,
    loading,
    error,
    currentWeekCheckIn: getCurrentWeekCheckIn(),
    createCheckIn,
    updateCheckIn,
    getWeekStartDate,
    reload: loadCheckIns,
  };
}
