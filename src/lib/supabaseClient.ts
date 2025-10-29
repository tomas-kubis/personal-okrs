import { createClient } from '@supabase/supabase-js';
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
  for (const key of keys) {
    const valueFromProcess = processEnv?.[key];
    if (valueFromProcess) return valueFromProcess;
    if (typeof import.meta !== 'undefined') {
      const valueFromImportMeta = import.meta.env?.[key];
      if (valueFromImportMeta) return valueFromImportMeta;
    }
  }
  return undefined;
};

const supabaseUrl = resolveEnv(['REACT_APP_SUPABASE_URL', 'VITE_SUPABASE_URL']);
const supabaseAnonKey = resolveEnv(['REACT_APP_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are missing. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});
