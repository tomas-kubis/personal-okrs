/**
 * Context Builder Service
 *
 * Builds context for AI coaching sessions from user's OKRs, check-ins, and historical data.
 * This context is used to provide the LLM with relevant information about the user's goals and progress.
 */

import { supabase } from '../lib/supabaseClient';
import type { SessionContext, Period, Objective, KeyResult, WeeklyCheckIn } from '../types';

export interface BuildContextOptions {
  userId: string;
  periodId?: string | null;
  includeRecentCheckIns?: number; // Number of recent check-ins to include
  includeObjectives?: boolean;
  includeRecentSessions?: number; // Number of recent coaching sessions to include
}

export interface ContextBuildResult {
  summary: string; // Markdown narrative
  data: SessionContext; // Structured JSON
}

/**
 * Build context for a coaching session
 */
export async function buildContext(options: BuildContextOptions): Promise<ContextBuildResult> {
  const {
    userId,
    periodId,
    includeRecentCheckIns = 3,
    includeObjectives = true,
    includeRecentSessions = 2,
  } = options;

  const context: SessionContext = {};
  const summaryParts: string[] = [];

  try {
    // 1. Get active period (or specified period)
    let period: Period | null = null;
    if (periodId) {
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('id', periodId)
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        period = data;
      }
    } else {
      // Get active period
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        period = data;
      }
    }

    if (period) {
      context.periodId = period.id;
      context.periodName = period.name;
      summaryParts.push(`## Current Period: ${period.name}\n`);
      summaryParts.push(`Period: ${new Date(period.start_date).toLocaleDateString()} - ${new Date(period.end_date).toLocaleDateString()}\n`);
    }

    // 2. Get objectives with key results (if requested)
    if (includeObjectives && period) {
      const { data: objectives, error: objError } = await supabase
        .from('objectives')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', period.id)
        .order('created_at', { ascending: true });

      if (!objError && objectives && objectives.length > 0) {
        // Get key results with progress for each objective
        const objectivesWithKRs = await Promise.all(
          objectives.map(async (obj) => {
            const { data: keyResults } = await supabase
              .from('key_results_with_progress')
              .select('*')
              .eq('objective_id', obj.id)
              .order('created_at', { ascending: true });

            // Calculate current progress from weekly_progress
            const krsWithProgress = (keyResults || []).map((kr) => {
              const weeklyProgress = (kr.weekly_progress as any[]) || [];
              const latestProgress = weeklyProgress.length > 0
                ? weeklyProgress[weeklyProgress.length - 1]?.value
                : 0;

              return {
                id: kr.id!,
                description: kr.description!,
                targetValue: kr.target_value!,
                unit: kr.unit!,
                currentProgress: latestProgress,
                status: kr.status || undefined,
              };
            });

            return {
              id: obj.id,
              title: obj.title,
              description: obj.description || undefined,
              keyResults: krsWithProgress,
            };
          })
        );

        context.objectives = objectivesWithKRs;

        // Add to summary
        summaryParts.push(`\n## Objectives & Key Results\n`);
        objectivesWithKRs.forEach((obj) => {
          summaryParts.push(`\n### ${obj.title}\n`);
          if (obj.description) {
            summaryParts.push(`${obj.description}\n`);
          }
          obj.keyResults?.forEach((kr) => {
            const progress = kr.currentProgress || 0;
            const percentage = kr.targetValue > 0
              ? Math.round((progress / kr.targetValue) * 100)
              : 0;
            const statusEmoji = kr.status === 'on-track' ? '✅' : kr.status === 'needs-attention' ? '⚠️' : '🔴';
            summaryParts.push(
              `- ${statusEmoji} **${kr.description}**: ${progress}/${kr.targetValue} ${kr.unit} (${percentage}%)\n`
            );
          });
        });
      }
    }

    // 3. Get recent check-ins (if requested)
    if (includeRecentCheckIns > 0 && period) {
      const { data: checkIns, error: checkInError } = await supabase
        .from('weekly_check_ins')
        .select('week_start_date, reflection, completed_at')
        .eq('user_id', userId)
        .eq('period_id', period.id)
        .order('week_start_date', { ascending: false })
        .limit(includeRecentCheckIns);

      if (!checkInError && checkIns && checkIns.length > 0) {
        context.recentCheckIns = checkIns.map((ci) => ({
          weekStartDate: ci.week_start_date,
          reflection: ci.reflection as any,
        }));

        summaryParts.push(`\n## Recent Check-Ins\n`);
        checkIns.forEach((ci) => {
          const weekDate = new Date(ci.week_start_date).toLocaleDateString();
          summaryParts.push(`\n### Week of ${weekDate}\n`);

          const reflection = ci.reflection as any;
          if (reflection) {
            if (reflection.what_went_well) {
              summaryParts.push(`**What went well:** ${reflection.what_went_well}\n\n`);
            }
            if (reflection.what_didnt_go_well) {
              summaryParts.push(`**What didn't go well:** ${reflection.what_didnt_go_well}\n\n`);
            }
            if (reflection.what_will_i_change) {
              summaryParts.push(`**What will I change:** ${reflection.what_will_i_change}\n\n`);
            }
          }
        });
      }
    }

    // 4. Get recent coaching sessions (for continuity)
    if (includeRecentSessions > 0) {
      const { data: recentSessions, error: sessionError } = await supabase
        .from('coaching_sessions')
        .select('id, started_at, context_summary')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(includeRecentSessions);

      if (!sessionError && recentSessions && recentSessions.length > 0) {
        context.recentSessions = recentSessions.map((s) => ({
          id: s.id,
          startedAt: s.started_at,
          contextSummary: s.context_summary || undefined,
        }));

        // Don't add to summary to keep it concise, but available in structured data
      }
    }

    const summary = summaryParts.join('');

    return {
      summary: summary || 'No context available yet. Start by setting your objectives!',
      data: context,
    };
  } catch (error) {
    console.error('Error building context:', error);
    return {
      summary: 'Error loading context. Please try again.',
      data: {},
    };
  }
}

/**
 * Build a concise summary for storing in coaching_session.context_summary
 */
export function buildConciseSummary(data: SessionContext): string {
  const parts: string[] = [];

  if (data.periodName) {
    parts.push(`Period: ${data.periodName}`);
  }

  if (data.objectives && data.objectives.length > 0) {
    parts.push(`${data.objectives.length} objective(s)`);
    const totalKRs = data.objectives.reduce(
      (sum, obj) => sum + (obj.keyResults?.length || 0),
      0
    );
    parts.push(`${totalKRs} key result(s)`);
  }

  if (data.recentCheckIns && data.recentCheckIns.length > 0) {
    parts.push(`${data.recentCheckIns.length} recent check-in(s)`);
  }

  return parts.join(' | ') || 'No context';
}

/**
 * Get default coach prompt from settings or return a default
 */
export async function getCoachPrompt(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('preferences')
      .eq('user_id', userId)
      .single();

    if (!error && data && data.preferences) {
      const prefs = data.preferences as any;
      if (prefs.coach_prompt) {
        return prefs.coach_prompt;
      }
    }
  } catch (error) {
    console.error('Error fetching coach prompt:', error);
  }

  // Return default prompt
  return getDefaultCoachPrompt();
}

/**
 * Get the default coach prompt
 */
export function getDefaultCoachPrompt(): string {
  return `You are a supportive and insightful executive coach helping professionals achieve their goals through effective OKRs (Objectives and Key Results).

Your role is to:
- Help users reflect on their progress and challenges
- Ask thought-provoking questions that encourage self-discovery
- Provide actionable advice and frameworks when appropriate
- Celebrate wins and help reframe setbacks as learning opportunities
- Guide users to set realistic yet ambitious goals
- Encourage accountability and consistent progress

Your coaching style should be:
- Warm and encouraging, yet direct when needed
- Focused on asking questions before giving advice
- Data-informed, referencing their OKRs and check-ins
- Action-oriented, helping them identify concrete next steps
- Growth-minded, emphasizing learning and iteration

Keep your responses concise and focused. Ask one question at a time. Use the context provided about their objectives, key results, and recent reflections to make your coaching relevant and personalized.`;
}
