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

interface EnvCandidate {
  label: string;
  read: () => string | undefined;
}

interface ResolvedEnvValue {
  value?: string;
  source?: string;
}

interface EnvDebugEntry {
  label: string;
  value: string | null;
  source: string;
  maskedValue: string | null;
  sensitive: boolean;
}

const getImportMetaEnv = () => {
  if (typeof import.meta === 'undefined') return undefined;
  return import.meta.env as ImportMetaEnv;
};

const importMetaReaders: Record<string, (env: ImportMetaEnv) => string | undefined> = {
  VITE_SUPABASE_URL: env => env.VITE_SUPABASE_URL,
  REACT_APP_SUPABASE_URL: env => env.REACT_APP_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: env => env.VITE_SUPABASE_ANON_KEY,
  REACT_APP_SUPABASE_ANON_KEY: env => env.REACT_APP_SUPABASE_ANON_KEY,
};

const buildCandidates = (
  names: readonly string[],
): readonly EnvCandidate[] => {
  const processEnv = getProcessEnv();
  const importMetaEnv = getImportMetaEnv();

  return names.flatMap(name => {
    const readers: EnvCandidate[] = [
      {
        label: `process.env.${name}`,
        read: () => normalizeEnvValue(processEnv?.[name]),
      },
    ];

    if (importMetaEnv && importMetaReaders[name]) {
      const readFromImportMeta = importMetaReaders[name];
      readers.push({
        label: `import.meta.env.${name}`,
        // Access with direct property references so Vite includes the keys in the runtime env object
        read: () => normalizeEnvValue(readFromImportMeta(importMetaEnv)),
      });
    }

    return readers;
  });
};

const resolveEnv = (candidates: readonly EnvCandidate[]): ResolvedEnvValue => {
  for (const candidate of candidates) {
    const value = candidate.read();
    if (value) {
      return { value, source: candidate.label };
    }
  }

  return {};
};

const SUPABASE_URL_ENV_KEYS = ['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL'] as const;
const SUPABASE_ANON_KEY_ENV_KEYS = ['VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY'] as const;

export const supabaseUrlResolution = resolveEnv(buildCandidates(SUPABASE_URL_ENV_KEYS));
export const supabaseAnonKeyResolution = resolveEnv(buildCandidates(SUPABASE_ANON_KEY_ENV_KEYS));

const supabaseUrl = supabaseUrlResolution.value;
const supabaseAnonKey = supabaseAnonKeyResolution.value;

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

const maskValue = (value: string | undefined): string | null => {
  if (!value) return null;
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

export const supabaseEnvDebugSummary: EnvDebugEntry[] = [
  {
    label: 'Supabase URL',
    value: supabaseUrl ?? null,
    source: supabaseUrlResolution.source ?? 'not resolved',
    maskedValue: maskValue(supabaseUrl ?? undefined),
    sensitive: false,
  },
  {
    label: 'Supabase anon key',
    value: supabaseAnonKey ?? null,
    source: supabaseAnonKeyResolution.source ?? 'not resolved',
    maskedValue: maskValue(supabaseAnonKey ?? undefined),
    sensitive: true,
  },
];

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
