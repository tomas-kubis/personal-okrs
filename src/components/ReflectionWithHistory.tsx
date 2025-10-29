import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import type { WeeklyCheckIn } from '../types';

interface ReflectionWithHistoryProps {
  what_went_well: string;
  what_didnt_go_well: string;
  what_will_i_change: string;
  onWhatWentWellChange: (value: string) => void;
  onWhatDidntGoWellChange: (value: string) => void;
  onWhatWillIChangeChange: (value: string) => void;
  previousCheckIns: WeeklyCheckIn[];
  onEditCheckIn?: (checkInId: string) => void;
  userId?: string;
  week_start_date?: string;
}

export default function ReflectionWithHistory({
  what_went_well,
  what_didnt_go_well,
  what_will_i_change,
  onWhatWentWellChange,
  onWhatDidntGoWellChange,
  onWhatWillIChangeChange,
  previousCheckIns,
  onEditCheckIn,
  userId,
  week_start_date,
}: ReflectionWithHistoryProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  // Debounce timers for auto-save
  const wellTimerRef = useRef<number | null>(null);
  const didntTimerRef = useRef<number | null>(null);
  const changeTimerRef = useRef<number | null>(null);

  // Get draft key for localStorage
  const getDraftKey = () => {
    if (!userId || !week_start_date) return null;
    return `@personal_okrs/reflection_draft_${userId}_${week_start_date}`;
  };

  // Load draft from localStorage on mount
  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey) return;

    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.whatWentWell) onWhatWentWellChange(parsed.whatWentWell);
        if (parsed.whatDidntGoWell) onWhatDidntGoWellChange(parsed.whatDidntGoWell);
        if (parsed.whatWillIChange) onWhatWillIChangeChange(parsed.whatWillIChange);
      }
    } catch (err) {
      console.error('Failed to load reflection draft:', err);
    }
  }, [userId, week_start_date]);

  // Auto-save with debouncing
  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey) return;

    // Clear existing timer
    if (wellTimerRef.current !== null) window.clearTimeout(wellTimerRef.current);

    // Set new timer
    wellTimerRef.current = window.setTimeout(() => {
      try {
        const existing = localStorage.getItem(draftKey);
        const draft = existing ? JSON.parse(existing) : {};
        draft.whatWentWell = what_went_well;
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (err) {
        console.error('Failed to save reflection draft:', err);
      }
    }, 500);

    return () => {
      if (wellTimerRef.current !== null) window.clearTimeout(wellTimerRef.current);
    };
  }, [what_went_well, userId, week_start_date]);

  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey) return;

    if (didntTimerRef.current !== null) window.clearTimeout(didntTimerRef.current);

    didntTimerRef.current = window.setTimeout(() => {
      try {
        const existing = localStorage.getItem(draftKey);
        const draft = existing ? JSON.parse(existing) : {};
        draft.whatDidntGoWell = what_didnt_go_well;
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (err) {
        console.error('Failed to save reflection draft:', err);
      }
    }, 500);

    return () => {
      if (didntTimerRef.current !== null) window.clearTimeout(didntTimerRef.current);
    };
  }, [what_didnt_go_well, userId, week_start_date]);

  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey) return;

    if (changeTimerRef.current !== null) window.clearTimeout(changeTimerRef.current);

    changeTimerRef.current = window.setTimeout(() => {
      try {
        const existing = localStorage.getItem(draftKey);
        const draft = existing ? JSON.parse(existing) : {};
        draft.whatWillIChange = what_will_i_change;
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (err) {
        console.error('Failed to save reflection draft:', err);
      }
    }, 500);

    return () => {
      if (changeTimerRef.current !== null) window.clearTimeout(changeTimerRef.current);
    };
  }, [what_will_i_change, userId, week_start_date]);

  const getWeekDateRange = (week_start_date: string): string => {
    const start = new Date(week_start_date);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return `${format(start, 'MMM d')}-${format(end, 'd')}`;
  };

  const getWeekNumber = (week_start_date: string): number => {
    // This is a simplified version - ideally calculate based on the active period
    const start = new Date(week_start_date);
    const weekOfYear = Math.ceil((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekOfYear % 13 || 13;
  };

  // Expose a function to clear the draft (will be called after successful check-in)
  // Note: This is stored in localStorage, so parent component needs to call clearReflectionDraft utility
  // We don't export this from the component itself

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'current'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Previous Weeks {previousCheckIns.length > 0 && `(${previousCheckIns.length})`}
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'current' ? (
          <div className="space-y-6">
            {/* What Went Well */}
            <div>
              <label htmlFor="went-well" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What went well this week?
              </label>
              <textarea
                id="went-well"
                value={what_went_well}
                onChange={(e) => onWhatWentWellChange(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                placeholder="Celebrate your wins... What progress did you make? What worked well?"
              />
            </div>

            {/* What Didn't Go Well */}
            <div>
              <label htmlFor="didnt-go-well" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What didn't go well this week?
              </label>
              <textarea
                id="didnt-go-well"
                value={what_didnt_go_well}
                onChange={(e) => onWhatDidntGoWellChange(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                placeholder="Be honest... What challenges did you face? What could have gone better?"
              />
            </div>

            {/* What Will I Change */}
            <div>
              <label htmlFor="will-change" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What am I going to change for next week?
              </label>
              <textarea
                id="will-change"
                value={what_will_i_change}
                onChange={(e) => onWhatWillIChangeChange(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
                placeholder="Commit to action... What will you do differently? What adjustments will you make?"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {previousCheckIns.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No previous check-ins yet</p>
                <p className="text-sm mt-1">Complete this week's check-in to start building your history</p>
              </div>
            ) : (
              previousCheckIns.map((checkIn) => {
                const isExpanded = expandedWeek === checkIn.id;
                const weekStartDate = checkIn.week_start_date || (checkIn as any).weekStartDate;
                const weekNum = getWeekNumber(weekStartDate);
                const dateRange = getWeekDateRange(weekStartDate);

                // Safety check for reflection
                if (!checkIn.reflection) {
                  return null;
                }

                const reflection = checkIn.reflection;
                const whatWentWell = reflection.what_went_well || (reflection as any).whatWentWell;
                const whatDidntGoWell = reflection.what_didnt_go_well || (reflection as any).whatDidntGoWell;
                const whatWillIChange = reflection.what_will_i_change || (reflection as any).whatWillIChange;

                // Preview text (first 100 characters)
                const preview = whatWentWell.substring(0, 100);

                return (
                  <div
                    key={checkIn.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() => setExpandedWeek(isExpanded ? null : checkIn.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
                    >
                      <div className="text-left flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Week {weekNum} • {dateRange}
                        </div>
                        {!isExpanded && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {preview}{preview.length >= 100 && '...'}
                          </div>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                      )}
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            What went well
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {whatWentWell}
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            What didn't go well
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {whatDidntGoWell}
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            What I changed
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {whatWillIChange}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {checkIn.completed_at || (checkIn as any).completedAt ? (
                              <>Completed {format(new Date(checkIn.completed_at || (checkIn as any).completedAt), 'MMM d, yyyy • h:mm a')}</>
                            ) : (reflection.completed_at || (reflection as any).completedAt) ? (
                              <>Completed {format(new Date(reflection.completed_at || (reflection as any).completedAt), 'MMM d, yyyy • h:mm a')}</>
                            ) : (
                              <>Completed (date unavailable)</>
                            )}
                          </div>
                          {onEditCheckIn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditCheckIn(checkIn.id);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded transition-colors"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
