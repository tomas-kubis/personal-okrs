import { Circle, Trash2 } from 'lucide-react';
import type { KeyResult } from '../types';
import ProgressBar from './ProgressBar';
import { getCurrentProgress, getStatusColor, calculateWeekStatus } from '../utils/statusCalculation';
import { getPeriodContext } from '../utils/quarterUtils';
import { usePeriods } from '../hooks/usePeriods';

interface KeyResultItemProps {
  keyResult: KeyResult;
  periodName: string;
  onClick?: (keyResultId: string) => void;
  onDelete?: (keyResultId: string) => void;
}

export default function KeyResultItem({ keyResult, periodName, onClick, onDelete }: KeyResultItemProps) {
  const currentValue = getCurrentProgress(keyResult);

  // Use period context - SINGLE SOURCE OF TRUTH (same as CheckIn and Carousel)
  const { activePeriod } = usePeriods();
  const period = getPeriodContext(activePeriod);
  const { startDate: periodStartDate, endDate: periodEndDate, currentWeek } = period;

  // Calculate status using the same logic as CheckIn page
  const effectiveStatus = calculateWeekStatus(keyResult, currentWeek, currentValue, periodStartDate, periodEndDate);
  const statusColor = getStatusColor(effectiveStatus);

  // Get last 4 weeks for sparkline
  const getSparklineData = () => {
    const weeklyProgress = keyResult.weekly_progress || (keyResult as any).weeklyProgress || [];
    const sorted = [...weeklyProgress]
      .sort((a: any, b: any) => new Date(a.recorded_at || a.recordedAt).getTime() - new Date(b.recorded_at || b.recordedAt).getTime())
      .slice(-4);

    if (sorted.length === 0) return [];

    const targetValue = keyResult.target_value || (keyResult as any).targetValue;
    const max = Math.max(...sorted.map((w: any) => w.value), targetValue);
    return sorted.map((w: any) => ({
      value: w.value,
      height: max > 0 ? (w.value / max) * 100 : 0,
    }));
  };

  const sparklineData = getSparklineData();

  // Calculate milestone positions based on weekly targets or linear division
  const targetValue = keyResult.target_value || (keyResult as any).targetValue;
  const weeklyTargets = keyResult.weekly_targets || (keyResult as any).weeklyTargets;
  const weeksPerMonth = Math.floor((periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7) / 3);

  const milestones = weeklyTargets && weeklyTargets.length > 0 ? [
    { label: 'M1', position: (weeklyTargets[Math.min(weeksPerMonth - 1, weeklyTargets.length - 1)] / targetValue) * 100 },
    { label: 'M2', position: (weeklyTargets[Math.min(weeksPerMonth * 2 - 1, weeklyTargets.length - 1)] / targetValue) * 100 },
    { label: 'M3', position: (weeklyTargets[weeklyTargets.length - 1] / targetValue) * 100 },
  ] : [
    { label: 'M1', position: 33.33 },
    { label: 'M2', position: 66.67 },
    { label: 'M3', position: 100 },
  ];

  return (
    <div
      className="ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 py-3 -mx-2 px-2 rounded-lg group"
      title={periodName}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          onClick={() => onClick?.(keyResult.id)}
          className="flex-1 min-w-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -m-2 p-2 rounded-lg transition-all active:scale-[0.99]"
        >
          {/* KR Description and Status */}
          <div className="flex items-center gap-2 mb-2">
            <Circle
              className={`h-4 w-4 ${statusColor} fill-current flex-shrink-0`}
              aria-label={`Status: ${effectiveStatus}`}
            />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {keyResult.description}
            </p>
          </div>

          {/* Current / Target */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {currentValue.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              / {targetValue.toLocaleString()} {keyResult.unit}
            </span>
          </div>

          {/* Progress Bar with Milestones */}
          <div className="mb-2">
            <ProgressBar
              value={currentValue}
              max={targetValue}
              status={effectiveStatus}
              showPercentage={false}
              milestones={milestones}
            />
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Mini Sparkline */}
            {sparklineData.length > 0 && (
              <div className="flex items-end gap-0.5 h-4">
                {sparklineData.map((point, index) => (
                  <div
                    key={index}
                    className="w-1.5 rounded-t bg-blue-200 dark:bg-blue-900/40"
                    style={{ height: `${Math.max(point.height, 10)}%` }}
                    title={`Week ${index + 1}: ${point.value}`}
                  />
                ))}
              </div>
            )}

            {/* Progress percentage */}
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {((currentValue / targetValue) * 100).toFixed(0)}% complete
            </span>
          </div>
        </div>

        {/* Delete Button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(keyResult.id);
            }}
            className="opacity-0 group-hover:opacity-100 lg:opacity-100 p-2 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 transition-all flex-shrink-0"
            aria-label="Delete key result"
          >
            <Trash2 className="h-4 w-4 text-error-600 dark:text-error-400" />
          </button>
        )}
      </div>
    </div>
  );
}
