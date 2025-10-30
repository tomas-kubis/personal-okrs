import type { ReactNode } from 'react';

interface ConfigurationErrorProps {
  title?: string;
  message: string;
  children?: ReactNode;
}

export function ConfigurationError({ title = 'Configuration required', message, children }: ConfigurationErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-900/40 dark:bg-gray-800">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400">{title}</h1>
          <p className="text-base text-gray-700 dark:text-gray-300">{message}</p>
        </div>
        <div className="space-y-4 text-left text-sm text-gray-600 dark:text-gray-300">
          <p>
            Add the following variables to your deployment pipeline or a local <code>.env</code> file before running
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">npm run build</code>
            :
          </p>
          <pre className="overflow-x-auto rounded-xl bg-gray-100 p-4 font-mono text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-100">
            VITE_SUPABASE_URL=&lt;your-supabase-url&gt;
            {'\n'}VITE_SUPABASE_ANON_KEY=&lt;your-anon-key&gt;
          </pre>
          <p>
            The Supabase anonymous key is safe to expose in client-side code. If you are using GitHub Pages, define these values as
            repository secrets and map them to the build step in your workflow.
          </p>
          <p>
            Double-check that the Supabase URL matches the format <code>https://&lt;project-ref&gt;.supabase.co</code> (or
            <code>supabase.in</code>) and that the anonymous key is copied exactly from the <strong>anon public</strong> entry in the
            Supabase dashboard.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
