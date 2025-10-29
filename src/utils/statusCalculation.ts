import type { KeyResult, KeyResultStatus } from '../types';
import { getWeeklyTargets, calculateTotalWeeks } from './quarterUtils';

/**
 * Get the current progress value for a key result
 */
export function getCurrentProgress(keyResult: KeyResult): number {
  // Support both new snake_case and old camelCase field names during migration
  const weeklyProgress = keyResult.weekly_progress || (keyResult as any).weeklyProgress || [];

  if (weeklyProgress.length === 0) {
    return 0;
  }

  // Sort by date and get the most recent value
  const sorted = [...weeklyProgress].sort((a: any, b: any) => {
    const aRecorded = a.recorded_at || a.recordedAt;
    const bRecorded = b.recorded_at || b.recordedAt;
    return new Date(bRecorded).getTime() - new Date(aRecorded).getTime();
  });

  return sorted[0].value;
}

/**
 * Get status color for display
 */
export function getStatusColor(status: KeyResultStatus): string {
  const colors = {
    'on-track': 'text-success-500',
    'needs-attention': 'text-warning-500',
    'behind': 'text-error-500',
  };
  return colors[status];
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: KeyResultStatus): string {
  const labels = {
    'on-track': 'On Track',
    'needs-attention': 'Needs Attention',
    'behind': 'Behind',
  };
  return labels[status];
}

/**
 * SINGLE SOURCE OF TRUTH for status calculation
 *
 * Calculate status for a specific week based on actual vs expected progress
 * Used consistently across Dashboard, CheckIn, Carousel, and Modal
 */
export function calculateWeekStatus(
  keyResult: KeyResult,
  weekNumber: number,
  actualValue: number,
  periodStartDate: Date,
  periodEndDate: Date
): KeyResultStatus {
  const totalWeeks = calculateTotalWeeks(periodStartDate, periodEndDate);
  const weeklyTargets = getWeeklyTargets(keyResult, totalWeeks);

  // Calculate how far behind in terms of weeks
  // Find which week's target our actual value corresponds to
  let equivalentWeek = 0;
  for (let w = 0; w < weeklyTargets.length; w++) {
    if (weeklyTargets[w] <= actualValue) {
      equivalentWeek = w + 1;
    } else {
      break;
    }
  }
  const weeksBehind = weekNumber - equivalentWeek;

  // Status based on weeks behind:
  // - On track (green): within 1 week of expected progress
  // - Needs attention (orange): 1-2 weeks behind
  // - Behind (red): 2+ weeks behind
  if (weeksBehind < 1) return 'on-track';
  if (weeksBehind < 2) return 'needs-attention';
  return 'behind';
}
