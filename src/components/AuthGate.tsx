import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { supabase, supabaseEnvDebugSummary } from '../lib/supabaseClient';
import { useUser } from '../hooks/useUser';
import { ConfigurationError } from './ConfigurationError';

const isInvalidApiKeyMessage = (message: string | null | undefined): boolean =>
  typeof message === 'string' && message.toLowerCase().includes('invalid api key');

const invalidApiKeyHelpText =
  'Supabase rejected the provided anonymous key. Confirm that VITE_SUPABASE_ANON_KEY (or REACT_APP_SUPABASE_ANON_KEY) contains the exact "anon public" key from your Supabase project settings.';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { currentUser, loading, error } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (isInvalidApiKeyMessage(error)) {
      setConfigError(invalidApiKeyHelpText);
    }
  }, [error]);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setAuthError('Email and password are required');
      return;
    }

    try {
      setSubmitting(true);
      setAuthError(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const message = signInError.message;
        if (isInvalidApiKeyMessage(message)) {
          setConfigError(invalidApiKeyHelpText);
        }
        setAuthError(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      if (isInvalidApiKeyMessage(message)) {
        setConfigError(invalidApiKeyHelpText);
      }
      setAuthError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (configError) {
    return (
      <ConfigurationError
        title="Supabase configuration error"
        message={configError}
        details={
          <div className="text-left text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-700 dark:text-gray-200">Resolved configuration values:</p>
            <ul className="mt-2 space-y-1">
              {supabaseEnvDebugSummary.map(entry => (
                <li
                  key={entry.label}
                  className="rounded-lg bg-gray-100 p-3 font-mono text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                >
                  <div>{entry.label}:</div>
                  <div className="mt-1">
                    {entry.value ? (
                      <>
                        <div>
                          {entry.sensitive
                            ? `Preview: ${entry.maskedValue ?? 'value provided'}`
                            : `Value: ${entry.value}`}
                        </div>
                        {entry.sensitive && (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Verify the full value directly in your deployment settings; it is hidden here to avoid exposing
                            secrets in the UI.
                          </div>
                        )}
                      </>
                    ) : (
                      'not provided'
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Source: {entry.source}</div>
                </li>
              ))}
            </ul>
          </div>
        }
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sign in to Personal OKRs</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Use your Supabase email and password to continue
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
