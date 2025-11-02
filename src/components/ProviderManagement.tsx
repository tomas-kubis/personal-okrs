/**
 * Provider Management Component
 *
 * Manages AI provider configurations (BYOK - Bring Your Own Key)
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Loader2, TestTube, Key, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { ProviderName } from '../types';

interface Provider {
  id: string;
  providerName: ProviderName;
  modelName: string;
  isDefault: boolean;
  apiKeyMasked: string;
  createdAt: string;
  updatedAt?: string;
}

interface AddProviderForm {
  providerName: ProviderName;
  modelName: string;
  apiKey: string;
  isDefault: boolean;
}

export default function ProviderManagement() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState<AddProviderForm>({
    providerName: 'openai',
    modelName: 'gpt-4o-mini',
    apiKey: '',
    isDefault: false,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers?action=list`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers?action=add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        await loadProviders();
        setShowAddForm(false);
        setFormData({
          providerName: 'openai',
          modelName: 'gpt-4o-mini',
          apiKey: '',
          isDefault: false,
        });
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to add provider';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        // Check if it's a 404 (function not deployed)
        if (response.status === 404) {
          alert('⚠️ Edge Function not deployed!\n\nThe Supabase Edge Function needs to be deployed first.\n\nRun:\nsupabase functions deploy providers');
        } else {
          alert(`Failed to add provider: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Error adding provider:', error);
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('⚠️ Cannot reach Edge Function.\n\nMake sure:\n1. Edge Functions are deployed\n2. VITE_SUPABASE_URL is correct\n\nRun: supabase functions deploy providers');
      } else {
        alert('Failed to add provider: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers?action=delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id }),
        }
      );

      if (response.ok) {
        await loadProviders();
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers?action=set-default`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id }),
        }
      );

      if (response.ok) {
        await loadProviders();
      }
    } catch (error) {
      console.error('Error setting default provider:', error);
    }
  };

  const handleTestProvider = async (id: string) => {
    try {
      setTesting(id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers?action=test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id }),
        }
      );

      const result = await response.json();
      if (result.success) {
        alert(`✅ Test successful!\nResponse: ${result.response}`);
      } else {
        alert(`❌ Test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing provider:', error);
      alert('Failed to test provider');
    } finally {
      setTesting(null);
    }
  };

  const providerModels: Record<ProviderName, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    cohere: ['command-r-plus', 'command-r', 'command'],
    huggingface: ['meta-llama/Meta-Llama-3-8B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.2'],
    openrouter: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'meta-llama/llama-3-70b-instruct'],
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
      {providers.length === 0 && !showAddForm && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Key className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No AI providers configured</p>
          <p className="text-sm mt-1">Add a provider to start using the AI coach</p>
        </div>
      )}

      {providers.map((provider) => (
        <div
          key={provider.id}
          className={`p-4 rounded-lg border-2 ${
            provider.isDefault
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {provider.providerName}
                </span>
                {provider.isDefault && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Model: {provider.modelName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                API Key: {provider.apiKeyMasked}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTestProvider(provider.id)}
                disabled={testing === provider.id}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Test provider"
              >
                {testing === provider.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
              </button>
              {!provider.isDefault && (
                <button
                  onClick={() => handleSetDefault(provider.id)}
                  className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Set as default"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDeleteProvider(provider.id)}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete provider"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {showAddForm ? (
        <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white">Add AI Provider</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Provider
            </label>
            <select
              value={formData.providerName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  providerName: e.target.value as ProviderName,
                  modelName: providerModels[e.target.value as ProviderName][0],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="cohere">Cohere</option>
              <option value="huggingface">HuggingFace</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model
            </label>
            <select
              value={formData.modelName}
              onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {providerModels[formData.providerName].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your API key is encrypted and never exposed to the client
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Set as default provider
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddProvider}
              disabled={!formData.apiKey}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Add Provider
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Provider</span>
        </button>
      )}
    </div>
  );
}
