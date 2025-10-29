import { format, startOfWeek, endOfWeek } from 'date-fns';

interface CheckInHeaderProps {
  periodName: string;
  currentWeek: number;
  completedWeeks: Set<number>;
  totalWeeks: number;
}

export default function CheckInHeader({ periodName, currentWeek, completedWeeks, totalWeeks }: CheckInHeaderProps) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const dateRange = `${format(weekStart, 'MMM d')}-${format(weekEnd, 'd, yyyy')}`;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Quarter and Week Info */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Weekly Check-in
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{periodName}</span>
            <span>•</span>
            <span>Week {currentWeek} of {totalWeeks}</span>
            <span>•</span>
            <span>{dateRange}</span>
          </div>
        </div>

        {/* Week Tracker */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {Array.from({ length: totalWeeks }, (_, i) => {
            const weekNum = i + 1;
            const isCompleted = completedWeeks.has(weekNum);
            const isCurrent = weekNum === currentWeek;

            return (
              <div
                key={weekNum}
                className={`
                  flex-1 h-6 sm:h-8 rounded
                  transition-all duration-200
                  ${
                    isCompleted
                      ? 'bg-gray-700 dark:bg-gray-600'
                      : isCurrent
                      ? 'border-2 border-dashed border-gray-500 dark:border-gray-400 bg-transparent'
                      : 'border border-gray-300 dark:border-gray-600 bg-transparent'
                  }
                `}
                title={`Week ${weekNum}${isCompleted ? ' (Completed)' : isCurrent ? ' (Current)' : ''}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-700 dark:bg-gray-600 rounded" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-dashed border-gray-500 dark:border-gray-400 rounded" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-gray-300 dark:border-gray-600 rounded" />
            <span>Upcoming</span>
          </div>
        </div>
      </div>
    </div>
  );
}
