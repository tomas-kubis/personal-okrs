import type { KeyResultStatus } from '../types';

interface Milestone {
  label: string;
  position: number; // 0-100
}

interface ProgressBarProps {
  value: number;
  max: number;
  status: KeyResultStatus;
  showPercentage?: boolean;
  milestones?: Milestone[];
  className?: string;
}

export default function ProgressBar({
  value,
  max,
  status: _status,
  showPercentage = true,
  milestones = [],
  className = '',
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        {/* Progress bar background */}
        <div className="h-3 rounded-full bg-gray-300 dark:bg-gray-700 overflow-hidden relative">
          {/* Progress bar fill - always blue */}
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />

          {/* Milestone markers */}
          {milestones.map((milestone, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-600"
              style={{ left: `${milestone.position}%` }}
              title={milestone.label}
            >
              {/* Small label above marker */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {milestone.label}
              </div>
            </div>
          ))}
        </div>

        {/* Percentage label */}
        {showPercentage && (
          <div className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
            {percentage.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}
