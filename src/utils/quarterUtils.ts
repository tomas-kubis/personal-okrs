import { differenceInWeeks, differenceInCalendarDays, startOfWeek } from 'date-fns';
import type { KeyResult, Period } from '../types';
import { getCurrentDate } from './dateOverride';

/**
 * Calculate the total number of weeks in a period
 * based on actual calendar dates
 */
export function calculateTotalWeeks(startDate: Date, endDate: Date): number {
  const days = differenceInCalendarDays(endDate, startDate) + 1; // Include both start and end day
  return Math.ceil(days / 7);
}

/**
 * Generate linear weekly targets for a key result
 * Evenly distributes the target value across all weeks
 */
export function generateLinearWeeklyTargets(targetValue: number, totalWeeks: number): number[] {
  const perWeek = targetValue / totalWeeks;
  return Array.from({ length: totalWeeks }, (_, i) => (i + 1) * perWeek);
}

/**
 * Get weekly targets for a key result
 * Returns existing custom targets or generates linear targets
 */
export function getWeeklyTargets(keyResult: KeyResult, totalWeeks: number): number[] {
  // If custom weekly targets exist and match the total weeks, use them
  if (keyResult.weekly_targets && keyResult.weekly_targets.length === totalWeeks) {
    return keyResult.weekly_targets;
  }

  // Fallback for old data with weeklyTargets (camelCase)
  if ('weeklyTargets' in keyResult && (keyResult as any).weeklyTargets?.length === totalWeeks) {
    return (keyResult as any).weeklyTargets;
  }

  // Get target value with backward compatibility for both snake_case and camelCase
  const targetValue = keyResult.target_value ?? (keyResult as any).targetValue ?? 0;

  // Otherwise, generate linear targets
  return generateLinearWeeklyTargets(targetValue, totalWeeks);
}

/**
 * Calculate which week we're in within a period (1-based)
 * Returns 0 if before period start
 * Returns total weeks if after period end
 */
export function calculateCurrentWeek(
  startDate: Date,
  endDate: Date,
  currentDate: Date
): number {
  // Before period starts
  if (currentDate < startDate) {
    return 0;
  }

  // After period ends
  if (currentDate > endDate) {
    return calculateTotalWeeks(startDate, endDate);
  }

  // Within period - calculate based on Monday-to-Monday weeks
  // Get the Monday of the week containing the period start date
  const periodFirstMonday = startOfWeek(startDate, { weekStartsOn: 1 });

  // Get the Monday of the week containing the current date
  const currentMonday = startOfWeek(currentDate, { weekStartsOn: 1 });

  // Calculate the difference in weeks between the two Mondays
  const weeksSinceStart = differenceInWeeks(currentMonday, periodFirstMonday);

  return Math.min(weeksSinceStart + 1, calculateTotalWeeks(startDate, endDate));
}

/**
 * Get period status based on current date
 */
export function getPeriodStatus(
  startDate: Date,
  endDate: Date,
  currentDate: Date
): 'not-started' | 'active' | 'completed' {
  if (currentDate < startDate) {
    return 'not-started';
  }
  if (currentDate > endDate) {
    return 'completed';
  }
  return 'active';
}

/**
 * SINGLE SOURCE OF TRUTH for period context
 *
 * This function provides all period-related calculations based on the active period.
 * Use this everywhere to ensure consistency across the application.
 *
 * @param activePeriod - The currently active period from usePeriods()
 * @returns Period context with dates, weeks, and current week number
 */
export interface PeriodContext {
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  currentWeek: number;
  name: string;
}

export function getPeriodContext(activePeriod: Period | null): PeriodContext {
  const currentDate = getCurrentDate(); // Use date override if enabled

  if (!activePeriod) {
    // Fallback when no active period
    return {
      startDate: currentDate,
      endDate: currentDate,
      totalWeeks: 0,
      currentWeek: 0,
      name: '',
    };
  }

  // Support both new snake_case and old camelCase field names during migration
  const startDate = new Date(activePeriod.start_date || (activePeriod as any).startDate);
  const endDate = new Date(activePeriod.end_date || (activePeriod as any).endDate);
  const totalWeeks = calculateTotalWeeks(startDate, endDate);
  const currentWeek = calculateCurrentWeek(startDate, endDate, currentDate);

  return {
    startDate,
    endDate,
    totalWeeks,
    currentWeek,
    name: activePeriod.name,
  };
}
