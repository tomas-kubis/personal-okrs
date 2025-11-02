/**
 * Chat Edge Function v2.0
 *
 * Handles AI coaching chat sessions with support for multiple LLM providers
 * Features: Context-aware coaching, session persistence, progress tracking
 *
 * Version: 2024-11-02 - Full context building with comprehensive logging
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decrypt } from '../_shared/crypto.ts';
import { sendToLLM, type ChatMessage } from '../_shared/llm-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  sessionId?: string;
  message?: {
    content: string;
  };
  providerId?: string;
  periodId?: string;
  stream?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const body: ChatRequest = await req.json();
    const { sessionId, message, providerId, periodId, stream = false } = body;

    // Case 1: Create new session (no sessionId, no message)
    if (!sessionId && !message) {
      return await createNewSession(supabaseClient, userId, periodId);
    }

    // Case 2: Send message to existing or new session
    if (message && message.content) {
      return await sendMessage(supabaseClient, userId, {
        sessionId,
        message: message.content,
        providerId,
        periodId,
        stream,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Build comprehensive context for coaching session
 */
async function buildSessionContext(supabaseClient: any, userId: string, periodId?: string) {
  const context: any = {};
  const summaryParts: string[] = [];

  try {
    console.log('[Context Builder] Starting context build for user:', userId, 'periodId:', periodId);

    // 1. Get period info
    let period: any = null;
    if (periodId) {
      const { data, error } = await supabaseClient
        .from('periods')
        .select('*')
        .eq('id', periodId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[Context Builder] Error fetching period by ID:', error);
      }
      period = data;
    } else {
      const { data, error } = await supabaseClient
        .from('periods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[Context Builder] Error fetching active period:', error);
      }
      period = data;
    }

    console.log('[Context Builder] Found period:', period ? period.name : 'none');

    if (period) {
      context.periodId = period.id;
      context.periodName = period.name;
      summaryParts.push(`Working on: ${period.name} (${new Date(period.start_date).toLocaleDateString()} - ${new Date(period.end_date).toLocaleDateString()})`);
    } else {
      summaryParts.push('No active period set. Please create a period first.');
      return {
        summary: summaryParts.join('\n'),
        data: context,
      };
    }

    // 2. Get objectives with key results and progress history
    const { data: objectives, error: objError } = await supabaseClient
      .from('objectives')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', period.id)
      .order('created_at', { ascending: true });

    if (objError) {
      console.error('[Context Builder] Error fetching objectives:', objError);
    }

    console.log('[Context Builder] Found objectives:', objectives ? objectives.length : 0);

    if (objectives && objectives.length > 0) {
      const objectivesWithKRs = await Promise.all(
        objectives.map(async (obj: any) => {
          const { data: keyResults, error: krError } = await supabaseClient
            .from('key_results_with_progress')
            .select('*')
            .eq('objective_id', obj.id)
            .order('created_at', { ascending: true });

          if (krError) {
            console.error('[Context Builder] Error fetching key results for objective', obj.id, ':', krError);
          }

          const krsWithProgress = (keyResults || []).map((kr: any) => {
            const weeklyProgress = (kr.weekly_progress as any[]) || [];
            const latestProgress = weeklyProgress.length > 0
              ? weeklyProgress[weeklyProgress.length - 1]?.value
              : 0;

            // Calculate progress trend (last 4 weeks)
            const recentWeeks = weeklyProgress.slice(-4);
            const trend = recentWeeks.length >= 2
              ? recentWeeks[recentWeeks.length - 1]?.value - recentWeeks[0]?.value
              : 0;

            return {
              description: kr.description,
              targetValue: kr.target_value,
              unit: kr.unit,
              currentProgress: latestProgress,
              status: kr.status,
              progressHistory: recentWeeks,
              trend: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
            };
          });

          return {
            title: obj.title,
            description: obj.description,
            keyResults: krsWithProgress,
          };
        })
      );

      context.objectives = objectivesWithKRs;

      // Add detailed objective status to summary
      summaryParts.push('\n\nCurrent Objectives:');
      objectivesWithKRs.forEach((obj: any) => {
        summaryParts.push(`\n- ${obj.title}${obj.description ? ': ' + obj.description : ''}`);
        obj.keyResults?.forEach((kr: any) => {
          const progress = kr.currentProgress || 0;
          const percentage = kr.targetValue > 0 ? Math.round((progress / kr.targetValue) * 100) : 0;
          const trendEmoji = kr.trend === 'improving' ? '📈' : kr.trend === 'declining' ? '📉' : '➡️';
          summaryParts.push(`  ${trendEmoji} ${kr.description}: ${progress}/${kr.targetValue} ${kr.unit} (${percentage}%) - ${kr.status || 'not set'}`);
        });
      });

      console.log('[Context Builder] Built objective context for', objectivesWithKRs.length, 'objectives');
    } else {
      summaryParts.push('\n\nNo objectives set yet. Create objectives to track your progress.');
    }

    // 3. Get recent check-ins with reflections
    const { data: checkIns, error: checkInError } = await supabaseClient
      .from('weekly_check_ins')
      .select('week_start_date, reflection, completed_at')
      .eq('user_id', userId)
      .eq('period_id', period.id)
      .order('week_start_date', { ascending: false })
      .limit(3);

    if (checkInError) {
      console.error('[Context Builder] Error fetching check-ins:', checkInError);
    }

    console.log('[Context Builder] Found check-ins:', checkIns ? checkIns.length : 0);

    if (checkIns && checkIns.length > 0) {
      context.recentCheckIns = checkIns;

      summaryParts.push('\n\nRecent Reflections:');
      checkIns.forEach((ci: any) => {
        const weekDate = new Date(ci.week_start_date).toLocaleDateString();
        const reflection = ci.reflection as any;
        if (reflection) {
          summaryParts.push(`\nWeek of ${weekDate}:`);
          if (reflection.what_went_well) summaryParts.push(`  ✅ ${reflection.what_went_well}`);
          if (reflection.what_didnt_go_well) summaryParts.push(`  ⚠️ ${reflection.what_didnt_go_well}`);
          if (reflection.what_will_i_change) summaryParts.push(`  🔄 ${reflection.what_will_i_change}`);
        }
      });
    }

    // 4. Get previous coaching conversations
    const { data: recentSessions, error: sessionsError } = await supabaseClient
      .from('coaching_sessions')
      .select('id, started_at, messages')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(2);

    if (sessionsError) {
      console.error('[Context Builder] Error fetching previous sessions:', sessionsError);
    }

    console.log('[Context Builder] Found previous sessions:', recentSessions ? recentSessions.length : 0);

    if (recentSessions && recentSessions.length > 0) {
      const previousConversations: string[] = [];
      recentSessions.forEach((s: any) => {
        const messages = s.messages as any[];
        if (messages && messages.length > 0) {
          const date = new Date(s.started_at).toLocaleDateString();
          const userMessages = messages.filter((m: any) => m.role === 'user').slice(0, 2);
          if (userMessages.length > 0) {
            previousConversations.push(`${date}: ${userMessages.map((m: any) => m.content).join('; ')}`);
          }
        }
      });

      if (previousConversations.length > 0) {
        context.previousChats = previousConversations;
        summaryParts.push('\n\nPrevious coaching topics:');
        previousConversations.forEach((conv: string) => {
          summaryParts.push(`- ${conv}`);
        });
      }
    }

    const finalSummary = summaryParts.join('\n');
    console.log('[Context Builder] Final summary length:', finalSummary.length, 'characters');
    console.log('[Context Builder] Summary preview:', finalSummary.substring(0, 200));

    return {
      summary: finalSummary,
      data: context,
    };
  } catch (error) {
    console.error('[Context Builder] Unexpected error building context:', error);
    return {
      summary: 'Error building context. Please try again.',
      data: {},
    };
  }
}

/**
 * Create a new coaching session with full context
 */
async function createNewSession(supabaseClient: any, userId: string, periodId?: string) {
  try {
    console.log('[Create Session] Starting session creation for user:', userId, 'periodId:', periodId);

    // Build comprehensive context
    const contextResult = await buildSessionContext(supabaseClient, userId, periodId);

    console.log('[Create Session] Context result summary length:', contextResult.summary.length);
    console.log('[Create Session] Context result summary:', contextResult.summary);
    console.log('[Create Session] Context result data:', JSON.stringify(contextResult.data));

    // Get default provider
    const { data: provider } = await supabaseClient
      .from('ai_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({
          error: 'No AI provider configured. Please add a provider in Settings.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Create Session] Using provider:', provider.provider_name, provider.model_name);

    // Create session with full context
    const { data: session, error: sessionError } = await supabaseClient
      .from('coaching_sessions')
      .insert({
        user_id: userId,
        messages: [],
        started_at: new Date().toISOString(),
        status: 'active',
        period_id: contextResult.data.periodId || null,
        provider_used: provider.provider_name,
        model_used: provider.model_name,
        context_summary: contextResult.summary,
        context_data: contextResult.data,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[Create Session] Error inserting session:', sessionError);
      throw sessionError;
    }

    console.log('[Create Session] Session created successfully:', session.id);
    console.log('[Create Session] Session context_summary from DB:', session.context_summary);

    return new Response(JSON.stringify({ session }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Create Session] Error creating session:', error);
    throw error;
  }
}

/**
 * Send a message and get AI response
 */
async function sendMessage(
  supabaseClient: any,
  userId: string,
  options: {
    sessionId?: string;
    message: string;
    providerId?: string;
    periodId?: string;
    stream: boolean;
  }
) {
  const { sessionId, message, providerId, periodId, stream } = options;

  // Get or create session
  let session: any;
  if (sessionId) {
    const { data } = await supabaseClient
      .from('coaching_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    session = data;
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    // Create new session
    const response = await createNewSession(supabaseClient, userId, periodId);
    const result = await response.json();
    session = result.session;
  }

  // Get provider
  let provider: any;
  if (providerId) {
    const { data } = await supabaseClient
      .from('ai_providers')
      .select('*')
      .eq('id', providerId)
      .eq('user_id', userId)
      .single();
    provider = data;
  } else {
    const { data } = await supabaseClient
      .from('ai_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();
    provider = data;
  }

  if (!provider) {
    return new Response(
      JSON.stringify({
        error: 'No AI provider configured. Please add a provider in Settings.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Decrypt API key
  const apiKey = await decrypt(provider.api_key_encrypted);

  // Get coach prompt from settings
  const { data: settings } = await supabaseClient
    .from('app_settings')
    .select('preferences')
    .eq('user_id', userId)
    .single();

  let coachPrompt = getDefaultCoachPrompt();
  if (settings?.preferences?.coach_prompt) {
    coachPrompt = settings.preferences.coach_prompt;
  }

  // Build messages array
  const messages: ChatMessage[] = [];
  const existingMessages = (session.messages as any[]) || [];

  // ALWAYS include system message with context (for both new and resumed sessions)
  // If session doesn't have context_summary (old session), rebuild it now
  let contextInfo = '';
  if (session.context_summary) {
    contextInfo = `\n\n## User Context\n${session.context_summary}`;
  } else {
    // Rebuild context for old sessions
    const contextResult = await buildSessionContext(supabaseClient, userId, session.period_id);
    contextInfo = `\n\n## User Context\n${contextResult.summary}`;

    // Update session with context for future messages
    await supabaseClient
      .from('coaching_sessions')
      .update({
        context_summary: contextResult.summary,
        context_data: contextResult.data,
      })
      .eq('id', session.id);
  }

  messages.push({
    role: 'system',
    content: coachPrompt + contextInfo,
  });

  // Include existing conversation history (skip old system messages to avoid duplicates)
  for (const msg of existingMessages) {
    if (msg.role !== 'system') {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // Add user message
  const userMessageId = crypto.randomUUID();
  const userMessage = {
    id: userMessageId,
    role: 'user' as const,
    content: message,
    timestamp: new Date().toISOString(),
  };
  messages.push(userMessage);

  try {
    // Call LLM
    const llmResponse = await sendToLLM({
      providerName: provider.provider_name,
      model: provider.model_name,
      apiKey,
      messages,
      stream: false, // For MVP, disable streaming for simplicity
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Create assistant message
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: llmResponse.content,
      timestamp: new Date().toISOString(),
      meta: {
        tokensUsed: llmResponse.usage?.totalTokens,
        model: provider.model_name,
      },
    };

    // Update session with new messages
    const updatedMessages = [...existingMessages, userMessage, assistantMessage];

    const { error: updateError } = await supabaseClient
      .from('coaching_sessions')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        messages: updatedMessages,
        usage: llmResponse.usage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('LLM error:', error);
    return new Response(
      JSON.stringify({
        error: `AI provider error: ${error.message}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

function getDefaultCoachPrompt(): string {
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

Keep your responses concise and focused. Ask one question at a time.`;
}
