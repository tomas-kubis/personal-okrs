import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';
import { useObjectives } from '../hooks/useObjectives';
import { useKeyResults } from '../hooks/useKeyResults';
import { usePeriods } from '../hooks/usePeriods';
import { useCheckIns } from '../hooks/useCheckIns';
import { useUser } from '../hooks/useUser';
import { getCurrentDate } from '../utils/dateOverride';
import { getPeriodContext } from '../utils/quarterUtils';
import { clearReflectionDraft } from '../utils/reflectionDraft';
import { calculateWeekStatus } from '../utils/statusCalculation';
import KRReviewCarousel from '../components/KRReviewCarousel';
import ReflectionWithHistory from '../components/ReflectionWithHistory';
import UpdateProgressModal from '../components/UpdateProgressModal';
import KeyResultForm from '../components/KeyResultForm';
import type { KeyResult, Objective, KeyResultStatus } from '../types';


type ModalState =
  | { type: 'none' }
  | { type: 'kr-update'; keyResultId: string }
  | { type: 'kr-edit'; keyResultId: string }
  | { type: 'edit-reflection'; checkInId: string };

export default function CheckIn() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeObjectives } = useObjectives();
  const { keyResults, addWeeklyProgress, updateKeyResult } = useKeyResults();
  const { activePeriod } = usePeriods();
  const { checkIns, createCheckIn, updateCheckIn } = useCheckIns();

  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatDidntGoWell, setWhatDidntGoWell] = useState('');
  const [whatWillIChange, setWhatWillIChange] = useState('');
  const [mobileSection, setMobileSection] = useState<'progress' | 'reflection'>('progress');
  const [progressExpanded, setProgressExpanded] = useState(true);
  const [reflectionExpanded, setReflectionExpanded] = useState(true);
  const [editingCheckInId, setEditingCheckInId] = useState<string | null>(null);
  const [editWhatWentWell, setEditWhatWentWell] = useState('');
  const [editWhatDidntGoWell, setEditWhatDidntGoWell] = useState('');
  const [editWhatWillIChange, setEditWhatWillIChange] = useState('');

  // Get period context - SINGLE SOURCE OF TRUTH for period dates and current week
  const period = getPeriodContext(activePeriod);
  const {
    startDate: periodStartDate,
    endDate: periodEndDate,
    totalWeeks,
    currentWeek,
    name: periodName,
  } = period;

  const currentDate = getCurrentDate();
  const weekStartDateObj = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekStartDate = weekStartDateObj.toISOString().split('T')[0];

  // Check if this week's check-in is already completed
  const thisWeekCheckIn = checkIns.find(ci => ci.week_start_date === weekStartDate);
  const isCompleted = !!thisWeekCheckIn;

  // Get completed weeks - map check-ins to week numbers using period context
  const completedWeeks = new Set(
    checkIns.map(ci => {
      const ciDate = new Date(ci.week_start_date);
      // Use the same period dates for consistency
      const weeksSinceStart = Math.floor((ciDate.getTime() - periodStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return Math.min(Math.max(weeksSinceStart + 1, 1), totalWeeks);
    })
  );

  // Get previous check-ins (including current week if completed)
  // If current week is completed, show it in Previous Weeks
  const previousCheckIns = checkIns
    .filter(ci => {
      // Always include weeks other than current week
      if (ci.week_start_date !== weekStartDate) return true;
      // Include current week only if it's completed
      return isCompleted;
    })
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

  // Combine KRs with their objectives
  const krsWithObjectives = keyResults
    .map(kr => {
      const objective = activeObjectives.find(obj => obj.id === kr.objective_id);
      return objective ? { ...kr, objective } : null;
    })
    .filter((kr): kr is KeyResult & { objective: Objective } => kr !== null);

  // Note: Draft saving is handled by ReflectionWithHistory component

  const handleUpdateProgress = async (newValue: number, statusOverride?: KeyResultStatus, statusOverrideReason?: string) => {
    if (modalState.type === 'kr-update') {
      const kr = krsWithObjectives.find(k => k.id === modalState.keyResultId);
      if (!kr) return;

      // Calculate status: use override if provided, otherwise calculate automatically
      let finalStatus: KeyResultStatus;
      if (statusOverride !== undefined) {
        finalStatus = statusOverride;
      } else {
        // Calculate status based on current week and new value
        finalStatus = calculateWeekStatus(kr, currentWeek, newValue, periodStartDate, periodEndDate);
      }

      // Add weekly progress with status
      try {
        await addWeeklyProgress(modalState.keyResultId, {
          week_start_date: weekStartDate,
          value: newValue,
          status: finalStatus,
        });

        if (statusOverride !== undefined || kr.status_override !== undefined) {
          await updateKeyResult(modalState.keyResultId, {
            status_override: statusOverride,
            status_override_reason: statusOverrideReason,
          });
        }
      } catch (err) {
        console.error('Failed to update progress:', err);
        alert(err instanceof Error ? err.message : 'Failed to update progress');
      }
    }
    setModalState({ type: 'none' });
  };

  const handleSaveKeyResult = async (data: {
    description: string;
    target_value: number;
    unit: string;
    weekly_targets?: number[];
    target_mode?: 'linear' | 'manual';
    reason_for_change?: string;
  }) => {
    if (modalState.type === 'kr-edit') {
      try {
        await updateKeyResult(modalState.keyResultId, {
          description: data.description,
          target_value: data.target_value,
          unit: data.unit,
          ...(data.weekly_targets && { weekly_targets: data.weekly_targets }),
          ...(data.target_mode && { target_mode: data.target_mode }),
        });
        setModalState({ type: 'none' });
      } catch (err) {
        console.error('Failed to update key result:', err);
        alert(err instanceof Error ? err.message : 'Failed to update key result');
      }
    }
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const validateReflection = (): string | null => {
    // Basic validation - just check that fields are not empty
    if (!whatWentWell.trim()) return 'Please fill in "What went well"';
    if (!whatDidntGoWell.trim()) return 'Please fill in "What didn\'t go well"';
    if (!whatWillIChange.trim()) return 'Please fill in "What will I change"';

    return null;
  };

  const handleCompleteCheckIn = async () => {
    const error = validateReflection();
    if (error) {
      alert(error);
      return;
    }

    // Create check-in record
    const now = new Date().toISOString();
    try {
      await createCheckIn({
        week_start_date: weekStartDate,
        progress_updates: krsWithObjectives.map(kr => ({
          key_result_id: kr.id,
          value: kr.weekly_progress.find(wp => wp.week_start_date === weekStartDate)?.value || 0,
        })),
        reflection: {
          what_went_well: whatWentWell,
          what_didnt_go_well: whatDidntGoWell,
          what_will_i_change: whatWillIChange,
          completed_at: now,
        },
      });

      if (currentUser) {
        clearReflectionDraft(currentUser.id, weekStartDate);
      }

      alert('Check-in completed successfully!');
      navigate('/');
    } catch (err) {
      console.error('Failed to complete check-in:', err);
      alert(err instanceof Error ? err.message : 'Failed to complete check-in');
    }
  };

  const handleEditCheckIn = (checkInId: string) => {
    const checkIn = checkIns.find(ci => ci.id === checkInId);
    if (!checkIn || !checkIn.reflection) {
      alert('Unable to edit this check-in. Reflection data is missing.');
      return;
    }

    setEditingCheckInId(checkInId);
    setEditWhatWentWell(checkIn.reflection.what_went_well || '');
    setEditWhatDidntGoWell(checkIn.reflection.what_didnt_go_well || '');
    setEditWhatWillIChange(checkIn.reflection.what_will_i_change || '');
    setModalState({ type: 'edit-reflection', checkInId });
  };

  const handleSaveEditedReflection = async () => {
    if (!editingCheckInId) return;

    const error = validateEditedReflection();
    if (error) {
      alert(error);
      return;
    }

    try {
      const originalCheckIn = checkIns.find(ci => ci.id === editingCheckInId);
      const completedAt = originalCheckIn?.completed_at ||
                         originalCheckIn?.reflection?.completed_at ||
                         new Date().toISOString();

      await updateCheckIn(editingCheckInId, {
        reflection: {
          what_went_well: editWhatWentWell,
          what_didnt_go_well: editWhatDidntGoWell,
          what_will_i_change: editWhatWillIChange,
          completed_at: completedAt,
        },
      });

      setModalState({ type: 'none' });
      setEditingCheckInId(null);
      alert('Reflection updated successfully!');
    } catch (err) {
      console.error('Failed to update reflection:', err);
      alert(err instanceof Error ? err.message : 'Failed to update reflection');
    }
  };

  const validateEditedReflection = (): string | null => {
    // Basic validation - just check that fields are not empty
    if (!editWhatWentWell.trim()) return 'Please fill in "What went well"';
    if (!editWhatDidntGoWell.trim()) return 'Please fill in "What didn\'t go well"';
    if (!editWhatWillIChange.trim()) return 'Please fill in "What will I change"';

    return null;
  };

  const currentKR = (modalState.type === 'kr-update' || modalState.type === 'kr-edit')
    ? krsWithObjectives.find(kr => kr.id === modalState.keyResultId)
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Check-in
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                <span>{periodName}</span>
                <span>•</span>
                <span>{format(periodStartDate, 'MMM d')} - {format(periodEndDate, 'MMM d, yyyy')}</span>
                <span>•</span>
                <span>Week {currentWeek} of {totalWeeks}</span>
                <span>•</span>
                <span>Week of {format(weekStartDateObj, 'MMM d')}</span>
                {totalWeeks > 0 && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <div className="flex items-center gap-0.5 mt-1 sm:mt-0">
                      {Array.from({ length: totalWeeks }, (_, i) => {
                        const weekNum = i + 1;
                        const isCurrent = weekNum === currentWeek;
                        const isPast = weekNum < currentWeek;
                        const hasCheckIn = completedWeeks.has(weekNum);
                        return (
                          <div
                            key={weekNum}
                            className={`w-3 h-3 ${
                              isPast
                                ? 'bg-gray-700 dark:bg-gray-600'
                                : isCurrent
                                ? 'border-2 border-dashed border-gray-500 dark:border-gray-400'
                                : 'border border-gray-300 dark:border-gray-600'
                            }`}
                            title={`Week ${weekNum}${isPast ? ' (Past)' : isCurrent ? ' (Current)' : ' (Future)'}${hasCheckIn ? ' ✓' : ''}`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Banner */}
      {isCompleted && (
        <div className="bg-success-50 dark:bg-success-900/20 border-b border-success-200 dark:border-success-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-success-800 dark:text-success-200">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">This week's check-in is complete!</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile: Tabs */}
        <div className="lg:hidden mb-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setMobileSection('progress')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mobileSection === 'progress'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Progress Review
          </button>
          <button
            onClick={() => setMobileSection('reflection')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mobileSection === 'reflection'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Reflection
          </button>
        </div>

        {/* Desktop: Two Column Layout / Mobile: Collapsible Sections */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Progress Review Section */}
          <div className={mobileSection === 'progress' ? 'block' : 'hidden lg:block'}>
            <div className="mb-4">
              <button
                onClick={() => setProgressExpanded(!progressExpanded)}
                className="lg:hidden flex items-center justify-between w-full text-left font-semibold text-gray-900 dark:text-white"
              >
                <span>Progress Review</span>
                {progressExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              <h2 className="hidden lg:block text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Progress Review
              </h2>
            </div>
            {(progressExpanded || window.innerWidth >= 1024) && (
              <KRReviewCarousel
                keyResults={krsWithObjectives}
                currentWeek={currentWeek}
                onUpdateProgress={(krId) => setModalState({ type: 'kr-update', keyResultId: krId })}
              />
            )}
          </div>

          {/* Reflection Section */}
          <div className={mobileSection === 'reflection' ? 'block' : 'hidden lg:block'}>
            <div className="mb-4">
              <button
                onClick={() => setReflectionExpanded(!reflectionExpanded)}
                className="lg:hidden flex items-center justify-between w-full text-left font-semibold text-gray-900 dark:text-white"
              >
                <span>Reflection</span>
                {reflectionExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              <h2 className="hidden lg:block text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Weekly Reflection
              </h2>
            </div>
            {(reflectionExpanded || window.innerWidth >= 1024) && (
              <ReflectionWithHistory
                what_went_well={whatWentWell}
                what_didnt_go_well={whatDidntGoWell}
                what_will_i_change={whatWillIChange}
                onWhatWentWellChange={setWhatWentWell}
                onWhatDidntGoWellChange={setWhatDidntGoWell}
                onWhatWillIChangeChange={setWhatWillIChange}
                previousCheckIns={previousCheckIns}
                onEditCheckIn={handleEditCheckIn}
                userId={currentUser?.id}
                week_start_date={weekStartDate}
              />
            )}
          </div>
        </div>

        {/* Complete Check-in Button */}
        {!isCompleted && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleCompleteCheckIn}
              className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors font-medium shadow-lg text-lg"
            >
              Complete Check-in
            </button>
          </div>
        )}
      </div>

      {/* Update Progress Modal */}
      {currentKR && (
        <UpdateProgressModal
          keyResult={currentKR}
          periodName={currentKR.objective.period}
          isOpen={modalState.type === 'kr-update'}
          onClose={() => setModalState({ type: 'none' })}
          onUpdate={handleUpdateProgress}
          onOpenEdit={() => {
            if (modalState.type === 'kr-update') {
              setModalState({ type: 'kr-edit', keyResultId: modalState.keyResultId });
            }
          }}
        />
      )}

      {/* Edit Reflection Modal */}
      {modalState.type === 'edit-reflection' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit Reflection
              </h2>
              <button
                onClick={() => setModalState({ type: 'none' })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* What Went Well */}
              <div>
                <label htmlFor="edit-went-well" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What went well this week?
                </label>
                <textarea
                  id="edit-went-well"
                  value={editWhatWentWell}
                  onChange={(e) => setEditWhatWentWell(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                />
                <div className="mt-1 text-xs text-gray-500">
                  {countWords(editWhatWentWell)} words (minimum 20)
                </div>
              </div>

              {/* What Didn't Go Well */}
              <div>
                <label htmlFor="edit-didnt-go-well" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What didn't go well this week?
                </label>
                <textarea
                  id="edit-didnt-go-well"
                  value={editWhatDidntGoWell}
                  onChange={(e) => setEditWhatDidntGoWell(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                />
                <div className="mt-1 text-xs text-gray-500">
                  {countWords(editWhatDidntGoWell)} words (minimum 20)
                </div>
              </div>

              {/* What Will I Change */}
              <div>
                <label htmlFor="edit-will-change" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What am I going to change for next week?
                </label>
                <textarea
                  id="edit-will-change"
                  value={editWhatWillIChange}
                  onChange={(e) => setEditWhatWillIChange(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                />
                <div className="mt-1 text-xs text-gray-500">
                  {countWords(editWhatWillIChange)} words (minimum 20)
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setModalState({ type: 'none' })}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedReflection}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Key Result Modal */}
      {modalState.type === 'kr-edit' && currentKR && (
        <KeyResultForm
          keyResult={currentKR}
          objectiveId={currentKR.objective_id}
          isOpen={true}
          onClose={() => setModalState({ type: 'none' })}
          onSave={handleSaveKeyResult}
        />
      )}
    </div>
  );
}
