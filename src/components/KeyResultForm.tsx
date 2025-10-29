import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KeyResult, TargetMode } from '../types';
import { usePeriods } from '../hooks/usePeriods';
import { calculateTotalWeeks, generateLinearWeeklyTargets } from '../utils/quarterUtils';

interface KeyResultFormProps {
  keyResult?: KeyResult; // If provided, we're editing
  objectiveId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    description: string;
    target_value: number;
    unit: string;
    weekly_targets?: number[];
    target_mode?: TargetMode;
    reason_for_change?: string;
  }) => void;
}

export default function KeyResultForm({
  keyResult,
  objectiveId: _objectiveId,
  isOpen,
  onClose,
  onSave,
}: KeyResultFormProps) {
  const { activePeriod } = usePeriods();
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('linear');
  const [weeklyTargets, setWeeklyTargets] = useState<number[]>([]);
  const [draggedWeekIndex, setDraggedWeekIndex] = useState<number | null>(null);
  const [reasonForChange, setReasonForChange] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTargetWarning, setShowTargetWarning] = useState(false);

  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const isEditMode = !!keyResult;

  // Calculate total weeks based on active period
  const totalWeeks = activePeriod
    ? calculateTotalWeeks(new Date(activePeriod.start_date || (activePeriod as any).startDate), new Date(activePeriod.end_date || (activePeriod as any).endDate))
    : 13;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (keyResult) {
        setDescription(keyResult.description);
        const targetVal = keyResult.target_value || (keyResult as any).targetValue;
        setTargetValue(targetVal.toString());
        setUnit(keyResult.unit);

        // Set target mode and weekly targets
        const mode = keyResult.target_mode || (keyResult as any).targetMode || 'linear';
        setTargetMode(mode);

        const weeklyTargetsData = keyResult.weekly_targets || (keyResult as any).weeklyTargets;
        if (mode === 'manual' && weeklyTargetsData && weeklyTargetsData.length === totalWeeks) {
          setWeeklyTargets(weeklyTargetsData);
        } else {
          setWeeklyTargets(generateLinearWeeklyTargets(targetVal, totalWeeks));
        }

      } else {
        setDescription('');
        setTargetValue('');
        setUnit('');
        setTargetMode('linear');
        setWeeklyTargets([]);
      }
      setReasonForChange('');
      setErrors({});
      setShowTargetWarning(false);

      // Auto-focus after modal animation
      setTimeout(() => descriptionInputRef.current?.focus(), 100);
    }
  }, [isOpen, keyResult, totalWeeks]);

  // Check if target value changed (show warning)
  useEffect(() => {
    if (isEditMode && targetValue && keyResult) {
      const newTarget = parseFloat(targetValue);
      const currentTarget = keyResult.target_value || (keyResult as any).targetValue;
      setShowTargetWarning(!isNaN(newTarget) && newTarget !== currentTarget);
    }
  }, [targetValue, isEditMode, keyResult]);

  // Update weekly targets when target value or mode changes
  useEffect(() => {
    const target = parseFloat(targetValue);
    if (!isNaN(target) && target > 0) {
      if (targetMode === 'linear') {
        const newTargets = generateLinearWeeklyTargets(target, totalWeeks);
        setWeeklyTargets(newTargets);
      } else if (weeklyTargets.length === 0) {
        // Initialize manual mode with linear targets
        const newTargets = generateLinearWeeklyTargets(target, totalWeeks);
        setWeeklyTargets(newTargets);
      } else {
        // Scale existing manual targets proportionally when target value changes
        const currentMax = Math.max(...weeklyTargets);
        if (currentMax > 0 && currentMax !== target) {
          const scale = target / currentMax;
          const newTargets = weeklyTargets.map(val => val * scale);
          setWeeklyTargets(newTargets);
        }
      }
    }
  }, [targetValue, targetMode, totalWeeks]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    const target = parseFloat(targetValue);
    if (!targetValue || isNaN(target) || target <= 0) {
      newErrors.targetValue = 'Target value must be a positive number';
    }

    if (!unit.trim()) {
      newErrors.unit = 'Unit is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const parsedTarget = parseFloat(targetValue);
    const safeTarget = isNaN(parsedTarget) ? 0 : parsedTarget;

    onSave({
      description: description.trim(),
      target_value: safeTarget,
      unit: unit.trim(),
      weekly_targets: targetMode === 'manual' ? weeklyTargets : undefined,
      target_mode: targetMode,
      ...(isEditMode && reasonForChange.trim() && { reason_for_change: reasonForChange.trim() }),
    });

    onClose();
  };

  // Handle dragging of dots in custom mode
  const handleDotDrag = (weekIndex: number, event: React.MouseEvent | React.TouchEvent) => {
    if (targetMode !== 'manual' || !chartRef.current) return;

    event.preventDefault();
    setDraggedWeekIndex(weekIndex);

    // Change cursor to 'grabbing' during drag
    document.body.style.cursor = 'grabbing';

    const chartRect = chartRef.current.getBoundingClientRect();
    const maxValue = parseFloat(targetValue) * 1.5; // Allow 50% overshoot
    const chartHeight = chartRect.height - 40; // Account for padding

    // Get initial mouse/touch position
    const initialClientY = 'touches' in event
      ? event.touches[0].clientY
      : event.clientY;

    // Get current value for this week
    const currentValue = weeklyTargets[weekIndex] || 0;

    // Calculate where the dot currently is on the chart
    const currentNormalizedY = currentValue / maxValue;
    const currentRelativeY = (1 - currentNormalizedY) * chartHeight + 20; // 20px top padding
    const currentClientY = chartRect.top + currentRelativeY;

    // Calculate initial offset (how far from the dot's center the user clicked)
    const initialOffset = initialClientY - currentClientY;

    const updateValue = (clientY: number) => {
      // Apply the offset so the dot doesn't jump
      const adjustedClientY = clientY - initialOffset;

      // Calculate the position relative to the chart
      const relativeY = adjustedClientY - chartRect.top;

      // Convert Y position to value (inverted because Y increases downward)
      const normalizedY = 1 - (relativeY - 20) / chartHeight; // 20px top padding
      let newValue = normalizedY * maxValue;

      // Constrain value
      newValue = Math.max(0, Math.min(maxValue, newValue));

      // Update the weekly target for this week
      setWeeklyTargets(prev => {
        const newTargets = [...prev];
        newTargets[weekIndex] = newValue;
        return newTargets;
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateValue(e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      setDraggedWeekIndex(null);
      // Restore cursor
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  const handleTargetChange = (value: string) => {
    setTargetValue(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 w-full sm:max-w-2xl sm:rounded-lg shadow-xl animate-slide-up sm:animate-none max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit Key Result' : 'Create New Key Result'}
          </h2>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Description */}
          <div>
            <label htmlFor="kr-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description <span className="text-error-500">*</span>
            </label>
            <input
              ref={descriptionInputRef}
              id="kr-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                errors.description
                  ? 'border-error-500 focus:ring-error-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., Exercise at the gym"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-error-500">{errors.description}</p>
            )}
          </div>

          {/* Target Value and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="kr-target" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Value <span className="text-error-500">*</span>
              </label>
              <input
                id="kr-target"
                type="number"
                step="0.1"
                min="0"
                value={targetValue}
                onChange={(e) => handleTargetChange(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                  errors.targetValue
                    ? 'border-error-500 focus:ring-error-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="12"
              />
              {errors.targetValue && (
                <p className="mt-1 text-sm text-error-500">{errors.targetValue}</p>
              )}
            </div>

            <div>
              <label htmlFor="kr-unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unit <span className="text-error-500">*</span>
              </label>
              <input
                id="kr-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                  errors.unit
                    ? 'border-error-500 focus:ring-error-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="times"
              />
              {errors.unit && (
                <p className="mt-1 text-sm text-error-500">{errors.unit}</p>
              )}
            </div>
          </div>

          {/* Target Change Warning */}
          {showTargetWarning && (
            <div className="flex gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-warning-600 dark:text-warning-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-warning-800 dark:text-warning-200">
                Changing the target value will affect progress calculations
              </p>
            </div>
          )}

          {/* Weekly Target Trajectory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Trajectory
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetMode('linear')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    targetMode === 'linear'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Linear Target
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('manual')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    targetMode === 'manual'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Custom Target
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {targetMode === 'linear'
                ? 'Even distribution across all weeks'
                : 'Drag dots to customize your weekly targets'}
            </p>

            {/* Chart */}
            {targetValue && !isNaN(parseFloat(targetValue)) && weeklyTargets.length > 0 && (
              <div
                ref={chartRef}
                className="h-64 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-900"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weeklyTargets.map((target, i) => ({
                      week: i + 1,
                      target: target,
                    }))}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis
                      dataKey="week"
                      label={{ value: 'Week', position: 'insideBottom', offset: -10, fill: '#6b7280' }}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, parseFloat(targetValue) * 1.5]}
                      label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [value.toFixed(1), 'Target']}
                      labelFormatter={(label) => `Week ${label}`}
                    />

                    {/* Target line */}
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#9ca3af"
                      strokeDasharray={targetMode === 'linear' ? "5 5" : "0"}
                      strokeWidth={2}
                      activeDot={false}
                      isAnimationActive={false}
                      dot={(props: any) => {
                        const { cx, cy, index } = props;
                        const isDragging = draggedWeekIndex === index;
                        const isInteractive = targetMode === 'manual';

                        return (
                          <g>
                            {/* Large draggable hit area - ALWAYS captures events */}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={25}
                              fill={isInteractive ? 'rgba(59, 130, 246, 0.05)' : 'transparent'}
                              stroke="transparent"
                              style={{
                                cursor: isInteractive ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                pointerEvents: isInteractive ? 'all' : 'none',
                              }}
                              onMouseDown={isInteractive ? (e) => handleDotDrag(index, e as any) : undefined}
                              onTouchStart={isInteractive ? (e) => handleDotDrag(index, e as any) : undefined}
                              onMouseEnter={(e) => e.stopPropagation()}
                              onMouseLeave={(e) => e.stopPropagation()}
                            />
                            {/* Visible dot - solid fill, no interaction */}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isDragging ? 7 : 6}
                              fill={isInteractive ? '#3b82f6' : '#9ca3af'}
                              stroke="#fff"
                              strokeWidth={2}
                              style={{
                                pointerEvents: 'none',
                              }}
                            />
                          </g>
                        );
                      }}
                      name="Target"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Show hint for custom mode */}
            {targetMode === 'manual' && weeklyTargets.length > 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                Tip: Click and drag the dots vertically to adjust targets for specific weeks
              </p>
            )}
          </div>

          {/* Reason for Change (Edit Mode Only) */}
          {isEditMode && (
            <div>
              <label htmlFor="kr-reason-for-change" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Change
              </label>
              <textarea
                id="kr-reason-for-change"
                value={reasonForChange}
                onChange={(e) => setReasonForChange(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                placeholder="Optional: Why are you making this change?"
              />
              {showTargetWarning && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Consider explaining why the target is changing
                </p>
              )}
            </div>
          )}

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
              {isEditMode ? 'Save Changes' : 'Create Key Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
