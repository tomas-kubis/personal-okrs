/**
 * Date Override Utility
 *
 * Provides a centralized way to override the current date for testing purposes.
 * All date-dependent calculations should use getCurrentDate() instead of new Date().
 */

const OVERRIDE_DATE_KEY = '@personal_okrs/testing/override_date';
const USE_REAL_DATE_KEY = '@personal_okrs/testing/use_real_date';

/**
 * Get the current date, respecting any testing override
 */
export function getCurrentDate(): Date {
  const useRealDate = localStorage.getItem(USE_REAL_DATE_KEY);

  // Default to using real date if not explicitly set to false
  if (useRealDate !== 'false') {
    return new Date();
  }

  const overrideDateStr = localStorage.getItem(OVERRIDE_DATE_KEY);
  if (overrideDateStr) {
    return new Date(overrideDateStr);
  }

  return new Date();
}

/**
 * Set an override date for testing
 */
export function setOverrideDate(date: Date): void {
  localStorage.setItem(OVERRIDE_DATE_KEY, date.toISOString());
  localStorage.setItem(USE_REAL_DATE_KEY, 'false');
}

/**
 * Clear the override and use real current date
 */
export function useRealDate(): void {
  localStorage.setItem(USE_REAL_DATE_KEY, 'true');
}

/**
 * Check if we're in testing mode with an override date
 */
export function isTestingMode(): boolean {
  return localStorage.getItem(USE_REAL_DATE_KEY) === 'false';
}

/**
 * Get the override date (if set)
 */
export function getOverrideDate(): Date | null {
  const overrideDateStr = localStorage.getItem(OVERRIDE_DATE_KEY);
  if (overrideDateStr && localStorage.getItem(USE_REAL_DATE_KEY) === 'false') {
    return new Date(overrideDateStr);
  }
  return null;
}
