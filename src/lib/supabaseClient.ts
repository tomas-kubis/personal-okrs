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

const resolveEnv = (keys: readonly string[]): string | undefined => {
  const processEnv = getProcessEnv();
  const importMetaEnv =
    typeof import.meta !== 'undefined' ? ((import.meta.env ?? {}) as Record<string, unknown>) : undefined;

  for (const key of keys) {
    const valueFromProcess = processEnv?.[key];
    if (typeof valueFromProcess === 'string' && valueFromProcess.length > 0) {
      return valueFromProcess;
    }

    const valueFromImportMeta = importMetaEnv?.[key];
    if (typeof valueFromImportMeta === 'string' && valueFromImportMeta.length > 0) {
      return valueFromImportMeta;
    }
  }

  return undefined;
};

const supabaseUrl = resolveEnv(['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL']);
const supabaseAnonKey = resolveEnv(['VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY']);

const missingConfigMessage =
  'Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building the app.';

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey ? missingConfigMessage : null;

const createMissingConfigClient = (): SupabaseClient<Database> =>
  new Proxy({} as SupabaseClient<Database>, {
    get() {
      throw new Error(supabaseConfigError ?? missingConfigMessage);
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
