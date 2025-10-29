import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit, Circle, Plus, Trash2 } from 'lucide-react';
import type { Objective, KeyResult } from '../types';
import KeyResultItem from './KeyResultItem';
import { getCurrentProgress, getStatusColor, calculateWeekStatus } from '../utils/statusCalculation';
import { getPeriodContext } from '../utils/quarterUtils';
import { usePeriods } from '../hooks/usePeriods';

interface ObjectiveCardProps {
  objective: Objective;
  keyResults: KeyResult[];
  onEdit?: (objectiveId: string) => void;
  onDelete?: (objectiveId: string) => void;
  onClickKR?: (keyResultId: string) => void;
  onDeleteKR?: (keyResultId: string) => void;
  onAddKR?: (objectiveId: string) => void;
}

export default function ObjectiveCard({
  objective,
  keyResults,
  onEdit,
  onDelete,
  onClickKR,
  onDeleteKR,
  onAddKR,
}: ObjectiveCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use period context - SINGLE SOURCE OF TRUTH (same as CheckIn, Carousel, Modal)
  const { activePeriod } = usePeriods();
  const period = getPeriodContext(activePeriod);
  const { startDate: periodStartDate, endDate: periodEndDate, currentWeek } = period;

  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (keyResults.length === 0) return 0;

    const totalProgress = keyResults.reduce((sum, kr) => {
      const current = getCurrentProgress(kr);
      const targetValue = kr.target_value || (kr as any).targetValue;
      const progress = targetValue > 0 ? (current / targetValue) * 100 : 0;
      return sum + progress;
    }, 0);

    return totalProgress / keyResults.length;
  };

  const overallProgress = calculateOverallProgress();

  // Calculate status for each KR using the same logic as weekly dots
  const effectiveStatuses = keyResults.map(kr => {
    const currentValue = getCurrentProgress(kr);
    return calculateWeekStatus(kr, currentWeek, currentValue, periodStartDate, periodEndDate);
  });

  // Objective status = worst KR status
  const overallStatus = effectiveStatuses.includes('behind') ? 'behind'
    : effectiveStatuses.includes('needs-attention') ? 'needs-attention'
    : 'on-track';

  const statusColor = getStatusColor(overallStatus);

  // Count statuses
  const statusCounts = {
    'on-track': effectiveStatuses.filter(s => s === 'on-track').length,
    'needs-attention': effectiveStatuses.filter(s => s === 'needs-attention').length,
    'behind': effectiveStatuses.filter(s => s === 'behind').length,
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-gray-700">
      {/* Card Header */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title and Status Dot */}
            <div className="flex items-center gap-2 mb-2">
              <Circle className={`h-4 w-4 ${statusColor} fill-current flex-shrink-0`} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {objective.title}
              </h3>
            </div>

            {/* Description */}
            {objective.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                {objective.description}
              </p>
            )}

            {/* Overall Progress Circle */}
            <div className="flex items-center gap-4 mb-3">
              <div className="relative w-16 h-16">
                {/* Background circle */}
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  {/* Progress circle - always blue */}
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - overallProgress / 100)}`}
                    className="text-blue-600 dark:text-blue-500 transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Percentage text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {overallProgress.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="text-sm">
                <p className="text-gray-900 dark:text-white font-semibold mb-1">
                  {keyResults.length} Key Result{keyResults.length !== 1 ? 's' : ''}
                </p>
                {statusCounts['on-track'] > 0 && (
                  <p className="text-success-600 dark:text-success-400">
                    {statusCounts['on-track']} on track
                  </p>
                )}
                {statusCounts['needs-attention'] > 0 && (
                  <p className="text-warning-600 dark:text-warning-400">
                    {statusCounts['needs-attention']} need{statusCounts['needs-attention'] === 1 ? 's' : ''} attention
                  </p>
                )}
                {statusCounts['behind'] > 0 && (
                  <p className="text-error-600 dark:text-error-400">
                    {statusCounts['behind']} behind
                  </p>
                )}
              </div>
            </div>

            {/* Expand/Collapse Button or Add KR Button */}
            {keyResults.length > 0 ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse Key Results
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand Key Results
                  </>
                )}
              </button>
            ) : onAddKR ? (
              <button
                onClick={() => onAddKR(objective.id)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Key Result
              </button>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(objective.id)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Edit objective"
              >
                <Edit className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(objective.id)}
                className="p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                aria-label="Delete objective"
              >
                <Trash2 className="h-5 w-5 text-error-600 dark:text-error-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Key Results Section */}
      {isExpanded && keyResults.length > 0 && (
        <div className="p-5">
          <div className="space-y-1">
            {keyResults.map((kr) => (
              <KeyResultItem
                key={kr.id}
                keyResult={kr}
                periodName={objective.period || (objective as any).quarter}
                onClick={onClickKR}
                onDelete={onDeleteKR}
              />
            ))}
          </div>

          {/* Add Key Result Button */}
          {onAddKR && (
            <button
              onClick={() => onAddKR(objective.id)}
              className="mt-4 flex items-center gap-2 text-sm text-primary hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Key Result
            </button>
          )}
        </div>
      )}

      {/* Empty State for No KRs */}
      {isExpanded && keyResults.length === 0 && (
        <div className="p-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p className="mb-3">No key results yet. Add your first key result to track progress.</p>
          {onAddKR && (
            <button
              onClick={() => onAddKR(objective.id)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Key Result
            </button>
          )}
        </div>
      )}
    </div>
  );
}
