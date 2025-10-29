import { useState, useEffect, useRef } from 'react';
import { X, Settings, Circle } from 'lucide-react';
import type { KeyResult } from '../types';
import ProgressBar from './ProgressBar';
import { getCurrentProgress, getStatusLabel, getStatusColor, calculateWeekStatus } from '../utils/statusCalculation';
import { getPeriodContext } from '../utils/quarterUtils';
import { usePeriods } from '../hooks/usePeriods';

interface UpdateProgressModalProps {
  keyResult: KeyResult;
  periodName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (newValue: number) => void;
  onOpenEdit: () => void;
}

export default function UpdateProgressModal({
  keyResult,
  periodName,
  isOpen,
  onClose,
  onUpdate,
  onOpenEdit,
}: UpdateProgressModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get period context - SINGLE SOURCE OF TRUTH (same as CheckIn and Carousel)
  const { activePeriod } = usePeriods();
  const period = getPeriodContext(activePeriod);
  const { startDate: periodStartDate, endDate: periodEndDate, totalWeeks, currentWeek } = period;

  // Get the current progress value (most recent entry)
  const currentValue = getCurrentProgress(keyResult);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setValue(currentValue.toString());
      // Auto-focus after modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, currentValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      onUpdate(numValue);
      onClose();
    }
  };

  const handleCancel = () => {
    setValue(currentValue.toString());
    onClose();
  };

  const previewValue = parseFloat(value) || 0;

  // Calculate what the automatic status would be using the same logic as weekly dots
  const displayStatus = calculateWeekStatus(keyResult, currentWeek, previewValue, periodStartDate, periodEndDate);

  // Calculate milestone positions based on weekly targets or linear division
  const targetValue = keyResult.target_value || (keyResult as any).targetValue;
  const weeklyTargets = keyResult.weekly_targets || (keyResult as any).weeklyTargets;
  const weeksPerMonth = Math.floor(totalWeeks / 3);

  const milestones = weeklyTargets && weeklyTargets.length > 0 ? [
    { label: 'M1', position: (weeklyTargets[Math.min(weeksPerMonth - 1, weeklyTargets.length - 1)] / targetValue) * 100 },
    { label: 'M2', position: (weeklyTargets[Math.min(weeksPerMonth * 2 - 1, weeklyTargets.length - 1)] / targetValue) * 100 },
    { label: 'M3', position: (weeklyTargets[weeklyTargets.length - 1] / targetValue) * 100 },
  ] : [
    { label: 'M1', position: 33.33 },
    { label: 'M2', position: 66.67 },
    { label: 'M3', position: 100 },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 w-full sm:max-w-lg sm:rounded-lg shadow-xl animate-slide-up sm:animate-none max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Update Progress
            </h2>
            {periodName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {periodName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Settings/Edit Button */}
            <button
              onClick={() => {
                onClose();
                onOpenEdit();
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Edit key result"
            >
              <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            {/* Close Button */}
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* KR Description */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              {keyResult.description}
            </p>
          </div>

          {/* Progress Input */}
          <div>
            <label htmlFor="progress-value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Progress
            </label>
            <div className="flex items-baseline gap-3">
              <input
                ref={inputRef}
                id="progress-value"
                type="number"
                step="0.1"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-4xl font-bold w-32 px-3 py-2 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:border-primary focus:outline-none transition-colors"
              />
              <div className="text-gray-600 dark:text-gray-400">
                <span className="text-sm">of </span>
                <span className="text-lg font-semibold">{targetValue}</span>
                <span className="text-sm ml-1">{keyResult.unit}</span>
              </div>
            </div>
          </div>

          {/* Status Display (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
              <Circle className={`h-4 w-4 ${getStatusColor(displayStatus)} fill-current`} />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {getStatusLabel(displayStatus)}
              </span>
              <span className="text-xs text-gray-500 ml-1">(Auto-calculated)</span>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Progress Preview
            </label>
            <ProgressBar
              value={previewValue}
              max={targetValue}
              status={displayStatus}
              showPercentage={true}
              milestones={milestones}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors font-medium shadow-sm"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
