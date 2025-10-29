import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Objective } from '../types';
import { usePeriods } from '../hooks/usePeriods';

interface ObjectiveFormProps {
  objective?: Objective; // If provided, we're editing
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    period: string;
    reasonForChange?: string;
  }) => void;
}

export default function ObjectiveForm({
  objective,
  isOpen,
  onClose,
  onSave,
}: ObjectiveFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [period, setPeriod] = useState('');
  const [reasonForChange, setReasonForChange] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const titleInputRef = useRef<HTMLInputElement>(null);
  const { periods, activePeriod } = usePeriods();

  const isEditMode = !!objective;

  // Get period options from actual periods in the database
  const periodOptions = periods.map(period => period.name);
  const defaultPeriodName = activePeriod?.name || periodOptions[0] || '';

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (objective) {
        setTitle(objective.title);
        setDescription(objective.description);
        setPeriod(objective.period || (objective as any).quarter || defaultPeriodName);
      } else {
        setTitle('');
        setDescription('');
        // Default to active period
        setPeriod(defaultPeriodName);
      }
      setReasonForChange('');
      setErrors({});

      // Auto-focus after modal animation
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen, objective, activePeriod, defaultPeriodName]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!period) {
      newErrors.period = 'Period is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      period,
      ...(isEditMode && reasonForChange.trim() && { reasonForChange: reasonForChange.trim() }),
    });

    onClose();
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
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
            {isEditMode ? 'Edit Objective' : 'Create New Objective'}
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
          {/* Title */}
          <div>
            <label htmlFor="objective-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-error-500">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="objective-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                errors.title
                  ? 'border-error-500 focus:ring-error-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., Improve physical fitness and health"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-error-500">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="objective-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="objective-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
              placeholder="Optional: Add more context about this objective"
            />
          </div>

          {/* Period */}
          <div>
            <label htmlFor="objective-period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Period <span className="text-error-500">*</span>
            </label>
            <select
              id="objective-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                errors.period
                  ? 'border-error-500 focus:ring-error-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {periodOptions.length === 0 ? (
                <option value="" disabled>
                  No periods available
                </option>
              ) : (
                periodOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))
              )}
            </select>
            {errors.period && (
              <p className="mt-1 text-sm text-error-500">{errors.period}</p>
            )}
          </div>

          {/* Reason for Change (Edit Mode Only) */}
          {isEditMode && (
            <div>
              <label htmlFor="reason-for-change" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Change
              </label>
              <textarea
                id="reason-for-change"
                value={reasonForChange}
                onChange={(e) => setReasonForChange(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                placeholder="Optional: Why are you making this change?"
              />
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
              {isEditMode ? 'Save Changes' : 'Create Objective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
