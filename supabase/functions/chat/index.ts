/**
 * Chat Edge Function
 *
 * Handles AI coaching chat sessions with support for multiple LLM providers
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
 * Create a new coaching session with context
 */
async function createNewSession(supabaseClient: any, userId: string, periodId?: string) {
  try {
    // Build context summary (simplified version for Edge function)
    let contextSummary = 'New coaching session';
    const contextData: any = {};

    if (periodId) {
      const { data: period } = await supabaseClient
        .from('periods')
        .select('*')
        .eq('id', periodId)
        .eq('user_id', userId)
        .single();

      if (period) {
        contextData.periodId = period.id;
        contextData.periodName = period.name;
        contextSummary = `Coaching session for ${period.name}`;
      }
    }

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

    // Create session
    const { data: session, error: sessionError } = await supabaseClient
      .from('coaching_sessions')
      .insert({
        user_id: userId,
        messages: [],
        started_at: new Date().toISOString(),
        status: 'active',
        period_id: periodId || null,
        provider_used: provider.provider_name,
        model_used: provider.model_name,
        context_summary: contextSummary,
        context_data: contextData,
      })
      .select()
      .single();

    if (sessionError) {
      throw sessionError;
    }

    return new Response(JSON.stringify({ session }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating session:', error);
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

  // Add system message (only once at start)
  const existingMessages = (session.messages as any[]) || [];
  if (existingMessages.length === 0) {
    // Build context summary for system message
    let contextInfo = '';
    if (session.context_data?.periodName) {
      contextInfo = `\n\nContext: The user is working on "${session.context_data.periodName}".`;
    }

    messages.push({
      role: 'system',
      content: coachPrompt + contextInfo,
    });
  } else {
    // Include existing conversation
    for (const msg of existingMessages) {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
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
