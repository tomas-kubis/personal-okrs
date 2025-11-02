// Standalone Providers Edge Function (for Supabase Dashboard)
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

async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plaintextBytes);
  const ciphertext = new Uint8Array(ciphertextBuffer);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return bytesToBase64(combined);
}

async function decrypt(ciphertext: string): Promise<string> {
  const key = await importKey();
  const combined = base64ToBytes(ciphertext);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertextBytes = combined.slice(IV_LENGTH);
  const plaintextBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertextBytes);
  return new TextDecoder().decode(plaintextBuffer);
}

// ===== LLM PROVIDER (SIMPLIFIED - OpenAI only for testing) =====
async function sendToLLM(params: { providerName: string; model: string; apiKey: string; messages: any[] }): Promise<any> {
  const { apiKey, model, messages } = params;
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 50 }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || '' };
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
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'list':
        return await listProviders(supabaseClient, userId);
      case 'add':
        return await addProvider(supabaseClient, userId, req);
      case 'delete':
        return await deleteProvider(supabaseClient, userId, req);
      case 'set-default':
        return await setDefaultProvider(supabaseClient, userId, req);
      case 'test':
        return await testProvider(supabaseClient, userId, req);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function listProviders(supabaseClient: any, userId: string) {
  const { data, error } = await supabaseClient
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const providers = (data || []).map((p: any) => ({
    id: p.id,
    providerName: p.provider_name,
    modelName: p.model_name,
    isDefault: p.is_default,
    apiKeyMasked: `***${p.api_key_encrypted.slice(-4)}`,
    createdAt: p.created_at,
  }));

  return new Response(JSON.stringify({ providers }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function addProvider(supabaseClient: any, userId: string, req: Request) {
  const body = await req.json();
  const { providerName, modelName, apiKey, isDefault } = body;

  if (!providerName || !modelName || !apiKey) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const encryptedKey = await encrypt(apiKey);

  if (isDefault) {
    await supabaseClient.from('ai_providers').update({ is_default: false }).eq('user_id', userId);
  }

  const { data, error } = await supabaseClient
    .from('ai_providers')
    .insert({
      user_id: userId,
      provider_name: providerName,
      model_name: modelName,
      api_key_encrypted: encryptedKey,
      is_default: isDefault || false,
    })
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({ provider: { id: data.id, providerName: data.provider_name, modelName: data.model_name } }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function deleteProvider(supabaseClient: any, userId: string, req: Request) {
  const { id } = await req.json();
  const { error } = await supabaseClient.from('ai_providers').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function setDefaultProvider(supabaseClient: any, userId: string, req: Request) {
  const { id } = await req.json();
  await supabaseClient.from('ai_providers').update({ is_default: false }).eq('user_id', userId);
  const { data, error } = await supabaseClient.from('ai_providers').update({ is_default: true }).eq('id', id).eq('user_id', userId).select().single();
  if (error) throw error;
  return new Response(JSON.stringify({ provider: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function testProvider(supabaseClient: any, userId: string, req: Request) {
  const { id } = await req.json();
  const { data, error } = await supabaseClient.from('ai_providers').select('*').eq('id', id).eq('user_id', userId).single();
  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Provider not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const apiKey = await decrypt(data.api_key_encrypted);
    const response = await sendToLLM({
      providerName: data.provider_name,
      model: data.model_name,
      apiKey,
      messages: [{ role: 'user', content: 'Say "Hello! Connection successful."' }],
    });
    return new Response(JSON.stringify({ success: true, response: response.content }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
