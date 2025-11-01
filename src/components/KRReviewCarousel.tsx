import { useState } from 'react';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { KeyResult, Objective } from '../types';
import { getCurrentProgress, getStatusColor } from '../utils/statusCalculation';
import { getPeriodContext, getWeeklyTargets, calculateCurrentWeek } from '../utils/quarterUtils';
import { usePeriods } from '../hooks/usePeriods';

interface KRReviewCarouselProps {
  keyResults: Array<KeyResult & { objective: Objective }>;
  currentWeek: number;
  onUpdateProgress: (keyResultId: string) => void;
}

export default function KRReviewCarousel({ keyResults, currentWeek, onUpdateProgress }: KRReviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { activePeriod } = usePeriods();

  if (keyResults.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No key results to review</p>
      </div>
    );
  }

  const kr = keyResults[currentIndex];
  const currentValue = getCurrentProgress(kr);
  const targetValue = kr.target_value || (kr as any).targetValue || 0;
  const completionPct = targetValue > 0 ? ((currentValue / targetValue) * 100).toFixed(0) : '0';

  // Get period context - SINGLE SOURCE OF TRUTH
  const period = getPeriodContext(activePeriod);
  const { startDate: periodStartDate, endDate: periodEndDate, totalWeeks } = period;

  // Get weekly targets (custom or linear)
  const weeklyTargets = getWeeklyTargets(kr, totalWeeks);

  // Create a map of week number to progress entry (keeping the most recent for each week)
  const weekProgressMap = new Map<number, { value: number; recordedAt: string; status?: 'on-track' | 'needs-attention' | 'behind' }>();

  // Support both new snake_case and old camelCase field names during migration
  const weeklyProgress = kr.weekly_progress || (kr as any).weeklyProgress || [];

  weeklyProgress.forEach((wp: any) => {
    const weekStartDate = wp.week_start_date || wp.weekStartDate;
    const recordedAt = wp.recorded_at || wp.recordedAt;
    const status = wp.status; // May be undefined for old data
    const weekDate = new Date(weekStartDate);
    let weekNum = calculateCurrentWeek(periodStartDate, periodEndDate, weekDate);

    // If progress entry is before period start (weekNum = 0), treat it as week 1
    // This handles old progress entries when period dates changed
    if (weekNum === 0) {
      weekNum = 1;
    }

    // Only keep the most recent entry for each week (by recordedAt timestamp)
    const existing = weekProgressMap.get(weekNum);
    if (!existing || new Date(recordedAt).getTime() > new Date(existing.recordedAt).getTime()) {
      weekProgressMap.set(weekNum, { value: wp.value, recordedAt, status });
    }
  });

  // Build chart data: weeks 1-totalWeeks with actual and target values
  const chartData = Array.from({ length: totalWeeks }, (_, i) => {
    const week = i + 1;
    const expectedValue = weeklyTargets[i];
    const weekStartDate = new Date(periodStartDate);
    weekStartDate.setDate(periodStartDate.getDate() + i * 7);
    weekStartDate.setHours(0, 0, 0, 0);

    // Determine the value to plot for this week
    let actualValue: number | null = null;
    let weekStatus: 'on-track' | 'needs-attention' | 'behind' | null = null;

    const latestEntry = weekProgressMap.get(week);

    if (latestEntry) {
      actualValue = typeof latestEntry.value === 'number' ? latestEntry.value : 0;
      weekStatus = latestEntry.status ?? null;
    } else if (week <= currentWeek) {
      // Carry forward last value strictly before this week
      let lastValue: number | null = null;
      let lastStatus: 'on-track' | 'needs-attention' | 'behind' | null = null;
      for (let w = week - 1; w >= 1; w--) {
        if (weekProgressMap.has(w)) {
          const entry = weekProgressMap.get(w)!;
          lastValue = entry.value;
          lastStatus = entry.status ?? null;
          break;
        }
      }
      actualValue = lastValue !== null ? lastValue : 0;
      weekStatus = lastStatus;
    }

    if (week <= currentWeek && actualValue !== null && !weekStatus) {
      // Derive status when not stored
      let equivalentWeek = 0;
      for (let w = 0; w < totalWeeks; w++) {
        if (weeklyTargets[w] <= actualValue) {
          equivalentWeek = w + 1;
        } else {
          break;
        }
      }
      const weeksBehind = week - equivalentWeek;
      if (weeksBehind < 1) weekStatus = 'on-track';
      else if (weeksBehind < 2) weekStatus = 'needs-attention';
      else weekStatus = 'behind';
    }

    return {
      week,
      actual: actualValue,
      expected: expectedValue,
      status: weekStatus,
    };
  });

  const maxActualValue = chartData.reduce((max, entry) => Math.max(max, entry.actual ?? 0), 0);
  const yAxisMax = Math.max(targetValue, maxActualValue);
  const yAxisDomain: [number, number] = [0, yAxisMax > 0 ? yAxisMax * 1.1 : 10];

  // Get the status for the current week to display in the header
  const currentWeekData = chartData.find(d => d.week === currentWeek);
  const effectiveStatus = currentWeekData?.status || 'on-track';

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : keyResults.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < keyResults.length - 1 ? prev + 1 : 0));
  };

  const statusColor = getStatusColor(effectiveStatus);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Progress Indicator */}
      <div className="text-center mb-4 text-sm text-gray-600 dark:text-gray-400">
        KR {currentIndex + 1} of {keyResults.length}
      </div>

      {/* Objective Context */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {kr.objective.title}
      </div>

      {/* KR Description */}
      <div className="flex items-start gap-2 mb-4">
        <Circle className={`h-4 w-4 ${statusColor} fill-current flex-shrink-0 mt-1`} />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {kr.description}
        </h3>
      </div>

      {/* Current Progress */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {currentValue.toLocaleString()}
          </span>
          <span className="text-lg text-gray-600 dark:text-gray-400">
            / {targetValue.toLocaleString()} {kr.unit}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {completionPct}% complete
        </div>
      </div>

      {/* Week Status Dots */}
      <div className="flex justify-center gap-2 mb-4">
        {chartData.map((data) => (
          <div
            key={data.week}
            className={`w-3 h-3 rounded-full ${
              data.status === 'on-track'
                ? 'bg-success-500'
                : data.status === 'needs-attention'
                ? 'bg-warning-500'
                : data.status === 'behind'
                ? 'bg-error-500'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            title={`Week ${data.week}${data.status ? `: ${data.status}` : ''}`}
          />
        ))}
      </div>

      {/* Line Chart */}
      <div className="mb-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis
              dataKey="week"
              label={{ value: 'Week', position: 'insideBottom', offset: -5 }}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis
              label={{ value: kr.unit, angle: -90, position: 'insideLeft' }}
              tick={{ fill: '#6b7280' }}
              domain={yAxisDomain}
              tickFormatter={(value: number) => {
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(1)}k`;
                }
                return Number.isInteger(value) ? value.toString() : value.toFixed(1);
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem'
              }}
            />

            {/* Monthly target markers */}
            <ReferenceLine x={4} stroke="#9ca3af" strokeDasharray="3 3" />
            <ReferenceLine x={8} stroke="#9ca3af" strokeDasharray="3 3" />
            <ReferenceLine x={13} stroke="#9ca3af" strokeDasharray="3 3" />

            {/* Expected progress line (dotted) */}
            <Line
              type="monotone"
              dataKey="expected"
              stroke="#9ca3af"
              strokeDasharray="5 5"
              dot={false}
              name="Expected"
            />

            {/* Actual progress line (solid) */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: '#2563eb', r: 4 }}
              connectNulls={false}
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Update Progress Button */}
      <button
        onClick={() => onUpdateProgress(kr.id)}
        className="w-full mb-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-500 transition-colors font-medium shadow-sm"
      >
        Update Progress
      </button>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          disabled={keyResults.length <= 1}
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex gap-2">
          {keyResults.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? 'bg-primary'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Go to KR ${index + 1}`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          disabled={keyResults.length <= 1}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
