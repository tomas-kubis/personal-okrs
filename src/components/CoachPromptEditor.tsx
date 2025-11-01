/**
 * Coach Prompt Editor Component
 *
 * Allows users to customize the system instruction for the AI coach
 */

import { useState, useEffect } from 'react';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getDefaultCoachPrompt } from '../services/contextBuilder';

export default function CoachPromptEditor() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('app_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      if (!error && data && data.preferences) {
        const prefs = data.preferences as any;
        setPrompt(prefs.coach_prompt || getDefaultCoachPrompt());
      } else {
        setPrompt(getDefaultCoachPrompt());
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
      setPrompt(getDefaultCoachPrompt());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current settings
      const { data: currentSettings } = await supabase
        .from('app_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const currentPrefs = (currentSettings?.preferences as any) || {};

      // Update preferences with new coach prompt
      const { error } = await supabase
        .from('app_settings')
        .update({
          preferences: {
            ...currentPrefs,
            coach_prompt: prompt,
          },
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setHasChanges(false);
      alert('Coach prompt saved successfully!');
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Failed to save coach prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset to default coach prompt? Any custom changes will be lost.')) {
      setPrompt(getDefaultCoachPrompt());
      setHasChanges(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="coach-prompt"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Coach System Instruction
        </label>
        <textarea
          id="coach-prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setHasChanges(true);
          }}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="Enter the system instruction for your AI coach..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          This instruction defines how the AI coach behaves, its tone, and coaching approach.
          The prompt will be prepended to every coaching conversation.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg
                   hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Prompt</span>
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600
                   rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                   transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset to Default</span>
        </button>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Tip:</strong> You can customize the coaching style to be more supportive, challenging,
          data-driven, or action-oriented. Experiment with different prompts to find what works best for you.
        </p>
      </div>
    </div>
  );
}
