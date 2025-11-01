/**
 * LLM Provider Adapter
 *
 * Unified interface for multiple LLM providers (OpenAI, Anthropic, HuggingFace, etc.)
 * Supports streaming and non-streaming responses
 */

export type ProviderName = 'openai' | 'anthropic' | 'cohere' | 'huggingface' | 'openrouter';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SendToLLMParams {
  providerName: ProviderName;
  model: string;
  apiKey: string; // plaintext (only inside Edge function)
  messages: ChatMessage[];
  stream?: boolean;
  onChunk?: (delta: string) => void; // called per token/chunk if stream=true
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Main entry point - sends messages to the specified LLM provider
 */
export async function sendToLLM(params: SendToLLMParams): Promise<LLMResponse> {
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

/**
 * OpenAI provider
 * Docs: https://platform.openai.com/docs/api-reference/chat
 */
async function sendToOpenAI(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, stream, onChunk, maxTokens = 2000, temperature = 0.7 } = params;

  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: stream || false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  // Handle streaming
  if (stream && onChunk) {
    let fullContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }

  // Handle non-streaming
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

/**
 * Anthropic provider
 * Docs: https://docs.anthropic.com/claude/reference/messages_post
 */
async function sendToAnthropic(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, stream, onChunk, maxTokens = 2000, temperature = 0.7 } = params;

  const url = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // Anthropic requires system message to be separate
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: any = {
    model,
    messages: conversationMessages,
    max_tokens: maxTokens,
    temperature,
    stream: stream || false,
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  // Handle streaming
  if (stream && onChunk) {
    let fullContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta?.text;
                if (delta) {
                  fullContent += delta;
                  onChunk(delta);
                }
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }

  // Handle non-streaming
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

/**
 * HuggingFace provider
 * Docs: https://huggingface.co/docs/api-inference/detailed_parameters
 * Note: Most HF models don't support streaming, so we treat as non-stream
 */
async function sendToHuggingFace(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, maxTokens = 2000, temperature = 0.7 } = params;

  const url = `https://api-inference.huggingface.co/models/${model}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Convert messages to a single prompt (HF Inference API doesn't support chat format universally)
  const prompt = messages.map((m) => {
    if (m.role === 'system') return m.content;
    if (m.role === 'user') return `User: ${m.content}`;
    if (m.role === 'assistant') return `Assistant: ${m.content}`;
    return m.content;
  }).join('\n\n') + '\n\nAssistant:';

  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: maxTokens,
      temperature,
      return_full_text: false,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // HF returns different formats depending on the model
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

/**
 * Cohere provider
 * Docs: https://docs.cohere.com/reference/chat
 */
async function sendToCohere(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, stream, onChunk, maxTokens = 2000, temperature = 0.7 } = params;

  const url = 'https://api.cohere.ai/v1/chat';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Cohere uses a different format - last message is the query, previous are chat_history
  const lastMessage = messages[messages.length - 1];
  const chatHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));

  const body = {
    model,
    message: lastMessage.content,
    chat_history: chatHistory,
    max_tokens: maxTokens,
    temperature,
    stream: stream || false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cohere API error: ${response.status} - ${error}`);
  }

  // Handle streaming
  if (stream && onChunk) {
    let fullContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.event_type === 'text-generation') {
              const delta = parsed.text;
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
            }
          } catch (e) {
            // Skip invalid JSON
            console.warn('Failed to parse chunk:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }

  // Handle non-streaming
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

/**
 * OpenRouter provider (uses OpenAI-compatible API)
 * Docs: https://openrouter.ai/docs
 */
async function sendToOpenRouter(params: SendToLLMParams): Promise<LLMResponse> {
  const { apiKey, model, messages, stream, onChunk, maxTokens = 2000, temperature = 0.7 } = params;

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://personal-okrs.app', // Replace with your actual domain
    'X-Title': 'Personal OKRs Coach',
  };

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: stream || false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  // OpenRouter uses OpenAI format, so we can reuse the same logic
  if (stream && onChunk) {
    let fullContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
            } catch (e) {
              console.warn('Failed to parse SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
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
