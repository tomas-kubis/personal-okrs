/**
 * Utility functions for managing reflection drafts in localStorage
 */

export function clearReflectionDraft(userId: string, weekStartDate: string): void {
  const draftKey = `@personal_okrs/reflection_draft_${userId}_${weekStartDate}`;
  try {
    localStorage.removeItem(draftKey);
  } catch (err) {
    console.error('Failed to clear reflection draft:', err);
  }
}
