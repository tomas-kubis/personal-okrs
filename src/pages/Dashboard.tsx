import { useState } from 'react';
import { Plus, Target, Loader2 } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { useObjectives } from '../hooks/useObjectives';
import { useKeyResults } from '../hooks/useKeyResults';
import { usePeriods } from '../hooks/usePeriods';
import { useCheckIns } from '../hooks/useCheckIns';
import { useToast } from '../components/ToastContainer';
import { getCurrentDate } from '../utils/dateOverride';
import { getPeriodContext, calculateCurrentWeek } from '../utils/quarterUtils';
import ObjectiveCard from '../components/ObjectiveCard';
import ObjectiveForm from '../components/ObjectiveForm';
import KeyResultForm from '../components/KeyResultForm';
import UpdateProgressModal from '../components/UpdateProgressModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import type { Objective, KeyResult, KeyResultStatus } from '../types';

type ModalState =
  | { type: 'none' }
  | { type: 'objective-create' }
  | { type: 'objective-edit'; objectiveId: string }
  | { type: 'kr-create'; objectiveId: string }
  | { type: 'kr-edit'; keyResultId: string }
  | { type: 'kr-update'; keyResultId: string };

type DeleteModalState =
  | { type: 'none' }
  | { type: 'objective'; objectiveId: string; objectiveTitle: string; krCount: number }
  | { type: 'kr'; keyResultId: string; krDescription: string };

export default function Dashboard() {
  const { activeObjectives, loading: objectivesLoading, createObjective, updateObjective, deleteObjective } = useObjectives();
  const { keyResults, loading: keyResultsLoading, createKeyResult, updateKeyResult, addWeeklyProgress, deleteKeyResult } = useKeyResults();
  const { activePeriod } = usePeriods();
  const { checkIns } = useCheckIns();
  const { showToast } = useToast();
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({ type: 'none' });

  const loading = objectivesLoading || keyResultsLoading;

  // Get period info from active period
  const currentDate = getCurrentDate();
  const period = getPeriodContext(activePeriod);
  const {
    name: periodName,
    startDate: periodStartDate,
    endDate: periodEndDate,
    totalWeeks,
    currentWeek,
  } = period;
  const weekStartDateObj = startOfWeek(currentDate, { weekStartsOn: 1 });

  // Get completed weeks - map check-ins to week numbers
  const completedWeeks = new Set(
    checkIns.map(ci => {
      const ciDate = new Date(ci.week_start_date);
      return activePeriod ? calculateCurrentWeek(periodStartDate, periodEndDate, ciDate) : 0;
    })
  );

  // Group key results by objective
  const getKeyResultsForObjective = (objectiveId: string) => {
    return keyResults.filter(kr => kr.objective_id === objectiveId);
  };

  // Helper to find objective or key result
  const findObjective = (id: string): Objective | undefined => {
    return activeObjectives.find(obj => obj.id === id);
  };

  const findKeyResult = (id: string): KeyResult | undefined => {
    return keyResults.find(kr => kr.id === id);
  };

  // Handlers
  const handleCreateObjective = () => {
    setModalState({ type: 'objective-create' });
  };

  const handleEditObjective = (objectiveId: string) => {
    setModalState({ type: 'objective-edit', objectiveId });
  };

  const handleClickKR = (keyResultId: string) => {
    setModalState({ type: 'kr-update', keyResultId });
  };

  const handleAddKR = (objectiveId: string) => {
    setModalState({ type: 'kr-create', objectiveId });
  };

  const handleOpenKREdit = (keyResultId: string) => {
    setModalState({ type: 'kr-edit', keyResultId });
  };

  const closeModal = () => {
    setModalState({ type: 'none' });
  };

  // Delete handlers
  const handleDeleteObjective = (objectiveId: string) => {
    const objective = findObjective(objectiveId);
    if (!objective) return;

    const krCount = getKeyResultsForObjective(objectiveId).length;
    setDeleteModalState({
      type: 'objective',
      objectiveId,
      objectiveTitle: objective.title,
      krCount,
    });
  };

  const handleDeleteKeyResult = (keyResultId: string) => {
    const kr = findKeyResult(keyResultId);
    if (!kr) return;

    setDeleteModalState({
      type: 'kr',
      keyResultId,
      krDescription: kr.description,
    });
  };

  const confirmDelete = async () => {
    try {
      if (deleteModalState.type === 'objective') {
        await deleteObjective(deleteModalState.objectiveId);
        showToast('success', 'Objective deleted');
      } else if (deleteModalState.type === 'kr') {
        await deleteKeyResult(deleteModalState.keyResultId);
        showToast('success', 'Key result deleted');
      }
      setDeleteModalState({ type: 'none' });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Form submission handlers
  const handleSaveObjective = async (data: {
    title: string;
    description: string;
    period: string;
    reasonForChange?: string;
  }) => {
    try {
      if (modalState.type === 'objective-create') {
        await createObjective({
          title: data.title,
          description: data.description,
          period: data.period,
        });
        showToast('success', 'Objective created');
      } else if (modalState.type === 'objective-edit') {
        await updateObjective(modalState.objectiveId, {
          title: data.title,
          description: data.description,
          period: data.period,
        });
        showToast('success', 'Objective updated');
      }
      closeModal();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save objective');
    }
  };

  const handleSaveKeyResult = async (data: {
    description: string;
    target_value: number;
    unit: string;
    weekly_targets?: number[];
    target_mode?: 'linear' | 'manual';
    reason_for_change?: string;
  }) => {
    try {
      if (modalState.type === 'kr-create') {
        await createKeyResult({
          objective_id: modalState.objectiveId,
          description: data.description,
          target_value: data.target_value,
          unit: data.unit,
          ...(data.weekly_targets && { weekly_targets: data.weekly_targets }),
          ...(data.target_mode && { target_mode: data.target_mode }),
        });
        showToast('success', 'Key result created');
      } else if (modalState.type === 'kr-edit') {
        await updateKeyResult(modalState.keyResultId, {
          description: data.description,
          target_value: data.target_value,
          unit: data.unit,
          ...(data.weekly_targets && { weekly_targets: data.weekly_targets }),
          ...(data.target_mode && { target_mode: data.target_mode }),
        });
        showToast('success', 'Key result updated');
      }
      closeModal();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save key result');
    }
  };

  const handleUpdateProgress = async (newValue: number, statusOverride?: KeyResultStatus, statusOverrideReason?: string) => {
    if (modalState.type === 'kr-update') {
      const kr = findKeyResult(modalState.keyResultId);
      if (!kr) return;

      const now = getCurrentDate();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      weekStart.setHours(0, 0, 0, 0);

      try {
        await addWeeklyProgress(modalState.keyResultId, {
          week_start_date: weekStart.toISOString().split('T')[0],
          value: newValue,
        });

        if (statusOverride !== undefined || kr.status_override !== undefined) {
          await updateKeyResult(modalState.keyResultId, {
            status_override: statusOverride,
            status_override_reason: statusOverrideReason,
          });
        }
        showToast('success', 'Progress updated');
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to update progress');
      }
    }
    closeModal();
  };

  // Get current objective/keyResult for modals
  const currentObjective = modalState.type === 'objective-edit'
    ? findObjective(modalState.objectiveId)
    : undefined;

  const currentKeyResult = modalState.type === 'kr-edit' || modalState.type === 'kr-update'
    ? findKeyResult(modalState.keyResultId)
    : undefined;

  const krFormObjectiveId = modalState.type === 'kr-create'
    ? modalState.objectiveId
    : modalState.type === 'kr-edit' && currentKeyResult
    ? currentKeyResult.objective_id
    : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Dashboard
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

            {/* Desktop: New Objective Button */}
            <button
              onClick={handleCreateObjective}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors font-medium shadow-sm"
            >
              <Plus className="h-5 w-5" />
              New Objective
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          // Loading State
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading objectives...</span>
          </div>
        ) : activeObjectives.length === 0 ? (
          // Empty State
          <div className="text-center py-12">
            <Target className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No objectives yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Create your first OKR to start tracking your progress toward your goals!
            </p>
            <button
              onClick={handleCreateObjective}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors font-medium shadow-sm"
            >
              <Plus className="h-5 w-5" />
              Create Your First Objective
            </button>
          </div>
        ) : (
          // Objectives Grid
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {activeObjectives.map(objective => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                keyResults={getKeyResultsForObjective(objective.id)}
                onEdit={handleEditObjective}
                onDelete={handleDeleteObjective}
                onClickKR={handleClickKR}
                onDeleteKR={handleDeleteKeyResult}
                onAddKR={handleAddKR}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile: Floating Action Button */}
      <button
        onClick={handleCreateObjective}
        className="sm:hidden fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-all flex items-center justify-center z-20"
        aria-label="Create new objective"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Modals */}
      <ObjectiveForm
        objective={currentObjective}
        isOpen={modalState.type === 'objective-create' || modalState.type === 'objective-edit'}
        onClose={closeModal}
        onSave={handleSaveObjective}
      />

      <KeyResultForm
        keyResult={currentKeyResult}
        objectiveId={krFormObjectiveId}
        isOpen={modalState.type === 'kr-create' || modalState.type === 'kr-edit'}
        onClose={closeModal}
        onSave={handleSaveKeyResult}
      />

      {currentKeyResult && (
        <UpdateProgressModal
          keyResult={currentKeyResult}
          periodName={activeObjectives.find(obj => obj.id === currentKeyResult.objective_id)?.period || periodName}
          isOpen={modalState.type === 'kr-update'}
          onClose={closeModal}
          onUpdate={handleUpdateProgress}
          onOpenEdit={() => handleOpenKREdit(currentKeyResult.id)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.type !== 'none'}
        onClose={() => setDeleteModalState({ type: 'none' })}
        onConfirm={confirmDelete}
        title={deleteModalState.type === 'objective' ? 'Delete Objective' : 'Delete Key Result'}
        message={
          deleteModalState.type === 'objective'
            ? `Delete '${deleteModalState.objectiveTitle}'? This will also delete ${deleteModalState.krCount} key result(s). This cannot be undone.`
            : deleteModalState.type === 'kr'
            ? `Delete '${deleteModalState.krDescription}'? This cannot be undone.`
            : ''
        }
        itemName={
          deleteModalState.type === 'objective'
            ? deleteModalState.objectiveTitle
            : deleteModalState.type === 'kr'
            ? deleteModalState.krDescription
            : ''
        }
        requireConfirmation={deleteModalState.type === 'objective'}
      />
    </div>
  );
}
