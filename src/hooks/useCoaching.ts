import { useState, useCallback } from 'react';
import type { CoachingSession, CoachingMessage } from '../types';
import { useCheckIns } from './useCheckIns';

export function useCoaching() {
  const { currentWeekCheckIn, updateCheckIn } = useCheckIns();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current coaching session (with backward compatibility)
  const currentSession = currentWeekCheckIn?.coaching_session || (currentWeekCheckIn as any)?.coachingSession;

  // Start a new coaching session
  const startSession = useCallback(async (): Promise<CoachingSession> => {
    try {
      if (!currentWeekCheckIn) {
        throw new Error('No check-in for current week');
      }

      const userId = currentWeekCheckIn.user_id || (currentWeekCheckIn as any).userId;
      const newSession: CoachingSession = {
        id: `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        messages: [],
        started_at: new Date().toISOString(),
      };

      await updateCheckIn(currentWeekCheckIn.id, { coaching_session: newSession });
      setError(null);
      return newSession;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start coaching session';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentWeekCheckIn, updateCheckIn]);

  // Add a message to the current session
  const addMessage = useCallback(async (
    content: string,
    role: 'user' | 'assistant' = 'user'
  ): Promise<void> => {
    try {
      if (!currentSession || !currentWeekCheckIn) {
        throw new Error('No active coaching session');
      }

      const newMessage: CoachingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: new Date().toISOString(),
      };

      const userId = currentWeekCheckIn.user_id || (currentWeekCheckIn as any).userId;
      const updatedSession: CoachingSession = {
        ...currentSession,
        user_id: userId,
        messages: [...currentSession.messages, newMessage],
      };

      await updateCheckIn(currentWeekCheckIn.id, { coaching_session: updatedSession });
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add message';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentSession, currentWeekCheckIn, updateCheckIn]);

  // Send a message and get AI response (placeholder - needs Claude API integration)
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    try {
      if (!currentWeekCheckIn) {
        throw new Error('No check-in for current week');
      }

      setLoading(true);
      setError(null);

      // Ensure session exists
      const session = currentSession || (await startSession());

      // Add user message
      const userMessage: CoachingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      const messagesWithUser = [...session.messages, userMessage];

      // TODO: Call Claude API here
      // For now, return a placeholder response
      const assistantMessage: CoachingMessage = {
        id: `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'This is a placeholder response. Integrate with Claude API to get actual coaching insights.',
        timestamp: new Date().toISOString(),
      };

      const userId = currentWeekCheckIn.user_id || (currentWeekCheckIn as any).userId;
      const updatedSession: CoachingSession = {
        ...session,
        user_id: userId,
        messages: [...messagesWithUser, assistantMessage],
      };

      await updateCheckIn(currentWeekCheckIn.id, { coaching_session: updatedSession });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [currentSession, currentWeekCheckIn, startSession, updateCheckIn]);

  // End the current session
  const endSession = useCallback(async (): Promise<void> => {
    try {
      if (!currentSession || !currentWeekCheckIn) {
        throw new Error('No active coaching session');
      }

      const userId = currentWeekCheckIn.user_id || (currentWeekCheckIn as any).userId;
      const updatedSession: CoachingSession = {
        ...currentSession,
        user_id: userId,
        completed_at: new Date().toISOString(),
      };

      await updateCheckIn(currentWeekCheckIn.id, { coaching_session: updatedSession });
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to end session';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentSession, currentWeekCheckIn, updateCheckIn]);

  // Clear the current session
  const clearSession = useCallback(async (): Promise<void> => {
    try {
      if (currentWeekCheckIn) {
        await updateCheckIn(currentWeekCheckIn.id, { coaching_session: undefined as unknown as CoachingSession });
      }
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear session';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentWeekCheckIn, updateCheckIn]);

  return {
    currentSession,
    loading,
    error,
    startSession,
    addMessage,
    sendMessage,
    endSession,
    clearSession,
    hasActiveSession: !!currentSession && !(currentSession.completed_at || (currentSession as any).completedAt),
  };
}
