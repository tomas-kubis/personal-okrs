import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  MessageSquare,
  Clock,
  Settings,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS } from '../lib/constants';
import { useState } from 'react';
import { useUser } from '../hooks/useUser';
import { usePeriods } from '../hooks/usePeriods';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './ToastContainer';

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  calendar: Calendar,
  'message-square': MessageSquare,
  clock: Clock,
  settings: Settings,
};

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { currentUser } = useUser();
  const { activePeriod } = usePeriods();
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            {/* App Title */}
            <div className="flex flex-shrink-0 items-center px-4">
              <h1 className="text-xl font-bold text-primary dark:text-primary-400">
                Personal OKRs
              </h1>
            </div>

            {/* User and Period Info */}
            {(currentUser || activePeriod) && (
              <div className="mt-4 mx-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                {currentUser && (
                  <div className="flex items-center gap-2 mb-2">
                    <UserIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {currentUser.name}
                      </p>
                      {currentUser.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {currentUser.email}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {currentUser && (
                  <button
                    onClick={async () => {
                      try {
                        setSigningOut(true);
                        const { error } = await supabase.auth.signOut();
                        if (error) throw error;
                        showToast('success', 'Signed out');
                      } catch (err) {
                        console.error('Sign out failed', err);
                        showToast('error', err instanceof Error ? err.message : 'Failed to sign out');
                      } finally {
                        setSigningOut(false);
                      }
                    }}
                    disabled={signingOut}
                    className="mt-2 w-full text-xs text-left px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60"
                  >
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                )}
                {activePeriod && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {activePeriod.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <nav className="mt-4 flex-1 space-y-1 px-2">
              {NAV_ITEMS.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`
                      group flex items-center px-3 py-3 text-sm font-medium rounded-lg
                      transition-colors duration-150
                      ${
                        active
                          ? 'bg-primary text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <Icon
                      className={`
                        mr-3 h-5 w-5 flex-shrink-0
                        ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'}
                      `}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <nav className="flex justify-around">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`
                  flex flex-col items-center justify-center px-3 py-2 text-xs font-medium
                  min-w-0 flex-1
                  ${active ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}
                `}
              >
                <Icon className="h-6 w-6 mb-1" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
