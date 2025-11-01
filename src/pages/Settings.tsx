import { useState, useEffect } from 'react';
import { User, Calendar, Trash2, Plus, Check, TestTube, Bot, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useUser } from '../hooks/useUser';
import { usePeriods } from '../hooks/usePeriods';
import CreatePeriodModal from '../components/CreatePeriodModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import ProviderManagement from '../components/ProviderManagement';
import CoachPromptEditor from '../components/CoachPromptEditor';
import { isTestingMode, getOverrideDate, setOverrideDate, useRealDate, getCurrentDate } from '../utils/dateOverride';
import { supabase } from '../lib/supabaseClient';

type DeleteModalState =
  | { type: 'none' }
  | { type: 'period'; periodId: string; periodName: string };

export default function Settings() {
  const { currentUser, users, switchUser } = useUser();
  const { periods, activePeriod, createPeriod, setActivePeriod, deletePeriod } = usePeriods();

  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({ type: 'none' });
  const [isClearingData, setIsClearingData] = useState(false);

  // Date override state
  const [testingModeEnabled, setTestingModeEnabled] = useState(isTestingMode());
  const [overrideDateValue, setOverrideDateValue] = useState(() => {
    const overrideDate = getOverrideDate();
    return overrideDate ? format(overrideDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  });

  // Update testing mode when toggled
  useEffect(() => {
    if (testingModeEnabled) {
      setOverrideDate(new Date(overrideDateValue));
    } else {
      useRealDate();
    }
    // Force refresh by triggering a state update
    window.dispatchEvent(new Event('storage'));
  }, [testingModeEnabled, overrideDateValue]);

  const handleSwitchUser = (userId: string) => {
    if (currentUser?.id === userId) return;
    try {
      switchUser(userId);
    } catch (err) {
      console.error('Failed to switch user:', err);
      alert(err instanceof Error ? err.message : 'Failed to switch user');
    }
  };

  const handleCreatePeriod = async (name: string, startDate: string, endDate: string) => {
    try {
      await createPeriod(name, startDate, endDate);
      setShowCreatePeriod(false);
    } catch (err) {
      console.error('Failed to create period:', err);
      alert(err instanceof Error ? err.message : 'Failed to create period');
    }
  };

  const handleDeletePeriod = async () => {
    if (deleteModalState.type === 'period') {
      try {
        await deletePeriod(deleteModalState.periodId);
        setDeleteModalState({ type: 'none' });
      } catch (err) {
        console.error('Failed to delete period:', err);
        alert(err instanceof Error ? err.message : 'Failed to delete period');
      }
    }
  };

  const handleClearAllData = async () => {
    if (!currentUser || !activePeriod) {
      alert('No user or period selected');
      return;
    }

    const confirmMessage = `Are you sure you want to clear all data for ${currentUser.name} in ${activePeriod.name}?\n\nThis will permanently delete:\n- All objectives\n- All key results\n- All check-ins\n- All coaching sessions\n\nThis action cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsClearingData(true);
      const userId = currentUser.id;
      const periodId = activePeriod.id;

      const { data: objectives } = await supabase
        .from('objectives')
        .select('id')
        .eq('user_id', userId)
        .eq('period_id', periodId);
      const objectiveIds = (objectives ?? []).map(obj => obj.id);

      let keyResultIds: string[] = [];
      if (objectiveIds.length > 0) {
        const { data: keyResults } = await supabase
          .from('key_results')
          .select('id')
          .eq('user_id', userId)
          .in('objective_id', objectiveIds);
        keyResultIds = (keyResults ?? []).map(kr => kr.id);
      }

      if (keyResultIds.length > 0) {
        await supabase
          .from('kr_weekly_progress')
          .delete()
          .in('key_result_id', keyResultIds);
        await supabase
          .from('key_results')
          .delete()
          .in('id', keyResultIds);
      }

      if (objectiveIds.length > 0) {
        await supabase
          .from('objectives')
          .delete()
          .in('id', objectiveIds);
      }

      const { data: checkInRows } = await supabase
        .from('weekly_check_ins')
        .select('id, coaching_session_id')
        .eq('user_id', userId)
        .eq('period_id', periodId);

      const checkInIds = (checkInRows ?? []).map(ci => ci.id);
      const coachingSessionIds = (checkInRows ?? [])
        .map(ci => ci.coaching_session_id)
        .filter((id): id is string => Boolean(id));

      if (checkInIds.length > 0) {
        await supabase
          .from('check_in_progress_updates')
          .delete()
          .in('check_in_id', checkInIds);
        await supabase
          .from('weekly_check_ins')
          .delete()
          .in('id', checkInIds);
      }

      if (coachingSessionIds.length > 0) {
        await supabase
          .from('coaching_sessions')
          .delete()
          .in('id', coachingSessionIds);
      }

      alert('Successfully cleared all data for this period.');
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear data:', err);
      alert(err instanceof Error ? err.message : 'Failed to clear data');
    } finally {
      setIsClearingData(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage users, periods, and application data
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* User Selection Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current User
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Switch between different user profiles
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-3">
            {users.map((user) => {
              const isActive = currentUser?.id === user.id;

              return (
                <button
                  key={user.id}
                  onClick={() => !isActive && handleSwitchUser(user.id)}
                  disabled={isActive}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </div>
                    {user.email && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Quarter Management Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Period Management
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Manage your OKR periods
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreatePeriod(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Period</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            {periods.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No periods created yet</p>
                <p className="text-sm mt-1">Create your first period to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {periods.map((period) => {
                  const isActive = activePeriod?.id === period.id;
                  const start = format(new Date(period.start_date || (period as any).startDate), 'MMM d, yyyy');
                  const end = format(new Date(period.end_date || (period as any).endDate), 'MMM d, yyyy');

                  return (
                    <div
                      key={period.id}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {period.name}
                          </div>
                          {isActive && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded">
                              Active Period
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {start} - {end}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <button
                            onClick={() => setActivePeriod(period.id)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setDeleteModalState({
                              type: 'period',
                              periodId: period.id,
                              periodName: period.name,
                            })
                          }
                          className="p-2 text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors"
                          title="Delete period"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* AI Providers Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI Providers
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage your AI provider API keys (Bring Your Own Key)
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <ProviderManagement />
          </div>
        </section>

        {/* Coach Prompt Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Coach Prompt
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize how your AI coach behaves and responds
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <CoachPromptEditor />
          </div>
        </section>

        {/* Testing Mode Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TestTube className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Time Travel (Testing Mode)
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Override the current date for testing purposes
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Enable Testing Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  Enable Time Travel
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {testingModeEnabled
                    ? `Using override date: ${format(getCurrentDate(), 'MMM d, yyyy')}`
                    : 'Using real current date'}
                </div>
              </div>
              <button
                onClick={() => setTestingModeEnabled(!testingModeEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  testingModeEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    testingModeEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Date Picker */}
            {testingModeEnabled && (
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <label htmlFor="override-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Override Date
                </label>
                <input
                  type="date"
                  id="override-date"
                  value={overrideDateValue}
                  onChange={(e) => setOverrideDateValue(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  All date calculations will use this date instead of the current date. This affects status calculations, week numbers, and check-in availability.
                </p>
              </div>
            )}

            {/* Info Banner */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Time travel mode allows you to simulate different dates to test how the application behaves at different points in a period. This is useful for testing status calculations, check-in availability, and other time-dependent features.
              </p>
            </div>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-100 dark:bg-warning-900/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-warning-600 dark:text-warning-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Data Management
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Clear application data
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
              <div className="mb-3">
                <div className="font-medium text-error-900 dark:text-error-100 mb-2">
                  Clear Current User & Period Data
                </div>
                <p className="text-sm text-error-800 dark:text-error-200">
                  This will permanently delete all data for <strong>{currentUser?.name || 'current user'}</strong> in <strong>{activePeriod?.name || 'active period'}</strong>:
                </p>
                <ul className="text-sm text-error-800 dark:text-error-200 mt-2 ml-4 list-disc space-y-1">
                  <li>All objectives and key results</li>
                  <li>All weekly check-ins and reflections</li>
                  <li>All coaching sessions</li>
                  <li>All progress data and history</li>
                </ul>
                <p className="text-sm text-error-800 dark:text-error-200 mt-2 font-medium">
                  ⚠️ This action cannot be undone!
                </p>
              </div>
              <button
                onClick={handleClearAllData}
                disabled={!currentUser || !activePeriod || isClearingData}
                className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isClearingData ? 'Clearing data...' : `Clear All Data for ${activePeriod?.name || 'Active Period'}`}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      <CreatePeriodModal
        isOpen={showCreatePeriod}
        onClose={() => setShowCreatePeriod(false)}
        onCreate={handleCreatePeriod}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalState.type === 'period'}
        onClose={() => setDeleteModalState({ type: 'none' })}
        onConfirm={handleDeletePeriod}
        title="Delete Period"
        message="Are you sure you want to delete this period? This will only work if there are no objectives associated with it."
        itemName={deleteModalState.type === 'period' ? deleteModalState.periodName : ''}
        requireConfirmation={true}
      />
    </div>
  );
}
