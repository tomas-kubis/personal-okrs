import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

declare global {
  interface ImportMetaEnv {
    REACT_APP_SUPABASE_URL?: string;
    REACT_APP_SUPABASE_ANON_KEY?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  }
}

const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  if (typeof globalThis === 'undefined') return undefined;
  const processRef = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return processRef?.env;
};

export const normalizeEnvValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const lowerTrimmed = trimmed.toLowerCase();
  return lowerTrimmed === 'undefined' || lowerTrimmed === 'null' ? undefined : trimmed;
};

const getImportMetaEnv = (): Record<string, unknown> | undefined => {
  if (typeof import.meta === 'undefined') return undefined;
  return (import.meta.env ?? {}) as Record<string, unknown>;
};

const resolveEnv = (keys: readonly string[]): string | undefined => {
  const processEnv = getProcessEnv();
  const importMetaEnv = getImportMetaEnv();

  for (const key of keys) {
    const valueFromProcess = normalizeEnvValue(processEnv?.[key]);
    if (valueFromProcess) {
      return valueFromProcess;
    }

    const valueFromImportMeta = normalizeEnvValue(importMetaEnv?.[key]);
    if (valueFromImportMeta) {
      return valueFromImportMeta;
    }
  }

  return undefined;
};

const SUPABASE_URL_ENV_KEYS = ['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL'] as const;
const SUPABASE_ANON_KEY_ENV_KEYS = ['VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY'] as const;

const supabaseUrl = resolveEnv(SUPABASE_URL_ENV_KEYS);
const supabaseAnonKey = resolveEnv(SUPABASE_ANON_KEY_ENV_KEYS);

const isValidSupabaseUrl = (url: string): boolean =>
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)(\/|$)/.test(url);

const isLikelySupabaseAnonKey = (key: string): boolean => {
  const parts = key.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
};

const configIssues: string[] = [];

if (!supabaseUrl) {
  configIssues.push(
    `Supabase URL environment variable is missing. Provide one of: ${SUPABASE_URL_ENV_KEYS.join(', ')}.`,
  );
} else if (!isValidSupabaseUrl(supabaseUrl)) {
  configIssues.push('Supabase URL must look like https://<project-ref>.supabase.co (or supabase.in).');
}

if (!supabaseAnonKey) {
  configIssues.push(
    `Supabase anonymous key environment variable is missing. Provide one of: ${SUPABASE_ANON_KEY_ENV_KEYS.join(', ')}.`,
  );
} else if (!isLikelySupabaseAnonKey(supabaseAnonKey)) {
  configIssues.push('Supabase anonymous key must be the long "anon public" JWT copied from your Supabase project settings.');
}

export const supabaseConfigError = configIssues.length
  ? `${configIssues.join(' ')} Configure these values before building the app.`
  : null;

const createMissingConfigClient = (): SupabaseClient<Database> =>
  new Proxy({} as SupabaseClient<Database>, {
    get() {
      throw new Error(supabaseConfigError ?? 'Supabase configuration is incomplete.');
    },
  });

export const supabase = (supabaseConfigError
  ? createMissingConfigClient()
  : createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
    })) as SupabaseClient<Database>;
