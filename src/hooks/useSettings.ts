import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, UserPreferences } from '../types';
import type { Database, Json } from '../lib/supabase.types';
import { supabase } from '../lib/supabaseClient';
import { useUser } from './useUser';

type AppSettingsRow = Database['public']['Tables']['app_settings']['Row'];

const defaultPreferences: UserPreferences = {
  check_in_day: 1,
  check_in_time: '09:00',
  notifications: false,
  dark_mode: 'system',
  coaching_style: 'balanced',
};

const mapSettings = (row: AppSettingsRow): AppSettings => ({
  user_id: row.user_id,
  user_name: row.user_name || '',
  email: row.email || '',
  timezone: row.timezone,
  api_key: row.api_key_encrypted ?? undefined,
  preferences: (row.preferences as unknown as UserPreferences) ?? defaultPreferences,
});

const prefsToJson = (prefs: UserPreferences): Json => prefs as unknown as Json;

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useUser();

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    if (!currentUser) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(mapSettings(data));
      } else {
        const payload: AppSettingsRow = {
          user_id: currentUser.id,
          user_name: currentUser.name,
          email: currentUser.email || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          preferences: prefsToJson(defaultPreferences),
          api_key_encrypted: null,
          created_at: new Date().toISOString(),
          updated_at: null,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('app_settings')
          .insert(payload)
          .select()
          .single();

        if (insertError || !inserted) {
          throw insertError || new Error('Failed to initialize settings');
        }

        setSettings(mapSettings(inserted));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Load on mount and when user changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update entire settings
  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>): Promise<void> => {
    try {
      if (!currentUser || !settings) {
        throw new Error('No current user or settings');
      }

      const mergedPreferences = newSettings.preferences ?? settings.preferences;

      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          user_name: newSettings.user_name ?? settings.user_name,
          email: newSettings.email ?? settings.email,
          timezone: newSettings.timezone ?? settings.timezone,
          preferences: prefsToJson(mergedPreferences),
        })
        .eq('user_id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      setSettings(prev => (prev ? { ...prev, ...newSettings, preferences: mergedPreferences } : prev));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, settings]);

  // Update preferences only
  const updatePreferences = useCallback(async (newPreferences: Partial<UserPreferences>): Promise<void> => {
    try {
      if (!currentUser || !settings) {
        throw new Error('No current user or settings');
      }

      const merged = {
        ...settings.preferences,
        ...newPreferences,
      };

      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ preferences: prefsToJson(merged) })
        .eq('user_id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      setSettings(prev => (prev ? { ...prev, preferences: merged } : prev));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update preferences';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, settings]);

  // Update API key (would need encryption in production)
  const updateApiKey = useCallback(async (apiKey: string): Promise<void> => {
    try {
      if (!currentUser || !settings) {
        throw new Error('No current user or settings');
      }

      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ api_key_encrypted: apiKey || null })
        .eq('user_id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      setSettings(prev => (prev ? { ...prev, api_key: apiKey } : prev));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update API key';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, settings]);

  // Update user profile
  const updateProfile = useCallback(async (profile: { user_name?: string; email?: string }): Promise<void> => {
    try {
      if (!currentUser || !settings) {
        throw new Error('No current user or settings');
      }

      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          user_name: profile.user_name ?? settings.user_name,
          email: profile.email ?? settings.email,
        })
        .eq('user_id', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      setSettings(prev => (prev ? { ...prev, ...profile } : prev));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentUser, settings]);

  // Toggle dark mode
  const toggleDarkMode = useCallback((): void => {
    if (!settings) return;

    const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const darkMode = settings.preferences.dark_mode || (settings.preferences as any).darkMode;
    const currentIndex = modes.indexOf(darkMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    updatePreferences({ dark_mode: modes[nextIndex] });
  }, [settings, updatePreferences]);

  // Get effective dark mode (resolve 'system' to actual value)
  const getEffectiveDarkMode = useCallback((): 'light' | 'dark' => {
    if (!settings) return 'light';

    const darkMode = settings.preferences.dark_mode || (settings.preferences as any).darkMode;
    if (darkMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return darkMode;
  }, [settings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    updatePreferences,
    updateApiKey,
    updateProfile,
    toggleDarkMode,
    getEffectiveDarkMode,
    reload: loadSettings,
  };
}
