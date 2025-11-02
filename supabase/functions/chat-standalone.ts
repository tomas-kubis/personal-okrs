// Standalone Chat Edge Function (for Supabase Dashboard)
// Copy this entire file into the Supabase Dashboard Edge Function editor

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== CRYPTO UTILITIES (INLINED) =====
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const binaryString = String.fromCharCode(...bytes);
  return btoa(binaryString);
}

async function importKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) throw new Error('ENCRYPTION_KEY not set');
  const keyData = base64ToBytes(keyString);
  return await crypto.subtle.importKey('raw', keyData, { name: ALGORITHM }, false, ['encrypt', 'decrypt']);
}

async function decrypt(ciphertext: string): Promise<string> {
  const key = await importKey();
  const combined = base64ToBytes(ciphertext);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertextBytes = combined.slice(IV_LENGTH);
  const plaintextBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertextBytes);
  return new TextDecoder().decode(plaintextBuffer);
}

// ===== LLM PROVIDER TYPES =====
type ProviderName = 'openai' | 'anthropic' | 'cohere' | 'huggingface' | 'openrouter';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface SendToLLMParams {
  providerName: ProviderName;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ===== LLM PROVIDER ADAPTER (INLINED) =====
async function sendToLLM(params: SendToLLMParams): Promise<LLMResponse> {
  const { providerName } = params;
  switch (providerName) {
    case 'openai':
      return await sendToOpenAI(params);
    case 'anthropic':
      return await sendToAnthropic(params);
    case 'huggingface':
      return await sendToHuggingFace(params);
    case 'cohere':
      return await sendToCohere(params);
    case 'openrouter':
      return await sendToOpenRouter(params);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

async function sendToOpenAI(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, maxTokens = 2000, temperature = 0.7 } = params;
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function sendToAnthropic(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, maxTokens = 2000, temperature = 0.7 } = params;
  const url = 'https://api.anthropic.com/v1/messages';

  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: any = {
    model,
    messages: conversationMessages,
    max_tokens: maxTokens,
    temperature,
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  return {
    content,
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
    } : undefined,
  };
}

async function sendToHuggingFace(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, maxTokens = 2000, temperature = 0.7 } = params;
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const prompt = messages.map((m) => {
    if (m.role === 'system') return m.content;
    if (m.role === 'user') return `User: ${m.content}`;
    if (m.role === 'assistant') return `Assistant: ${m.content}`;
    return m.content;
  }).join('\n\n') + '\n\nAssistant:';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  let content = '';
  if (Array.isArray(data)) {
    content = data[0]?.generated_text || '';
  } else if (data.generated_text) {
    content = data.generated_text;
  } else {
    content = JSON.stringify(data);
  }

  return { content };
}

async function sendToCohere(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, maxTokens = 2000, temperature = 0.7 } = params;
  const url = 'https://api.cohere.ai/v1/chat';

  const lastMessage = messages[messages.length - 1];
  const chatHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      message: lastMessage.content,
      chat_history: chatHistory,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cohere API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.text || '',
    usage: data.meta ? {
      promptTokens: data.meta.billed_units?.input_tokens,
      completionTokens: data.meta.billed_units?.output_tokens,
      totalTokens: (data.meta.billed_units?.input_tokens || 0) + (data.meta.billed_units?.output_tokens || 0),
    } : undefined,
  };
}

async function sendToOpenRouter(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, maxTokens = 2000, temperature = 0.7 } = params;
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://personal-okrs.app',
      'X-Title': 'Personal OKRs Coach',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

// ===== CHAT HANDLER TYPES =====
interface ChatRequest {
  sessionId?: string;
  message?: {
    content: string;
  };
  providerId?: string;
  periodId?: string;
  stream?: boolean;
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
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

async function createNewSession(supabaseClient: any, userId: string, periodId?: string) {
  try {
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

    const { data: provider } = await supabaseClient
      .from('ai_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'No AI provider configured. Please add a provider in Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    if (sessionError) throw sessionError;

    return new Response(JSON.stringify({ session }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

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
      JSON.stringify({ error: 'No AI provider configured. Please add a provider in Settings.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

  if (existingMessages.length === 0) {
    let contextInfo = '';
    if (session.context_data?.periodName) {
      contextInfo = `\n\nContext: The user is working on "${session.context_data.periodName}".`;
    }
    messages.push({ role: 'system', content: coachPrompt + contextInfo });
  } else {
    for (const msg of existingMessages) {
      if (msg.role !== 'system') {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
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
    const llmResponse = await sendToLLM({
      providerName: provider.provider_name,
      model: provider.model_name,
      apiKey,
      messages,
      stream: false,
      maxTokens: 1000,
      temperature: 0.7,
    });

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

    const updatedMessages = [...existingMessages, userMessage, assistantMessage];

    const { error: updateError } = await supabaseClient
      .from('coaching_sessions')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        messages: updatedMessages,
        usage: llmResponse.usage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('LLM error:', error);
    return new Response(
      JSON.stringify({ error: `AI provider error: ${error.message}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
