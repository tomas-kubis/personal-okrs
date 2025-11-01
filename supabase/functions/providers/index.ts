/**
 * Providers Edge Function
 *
 * Manages AI provider configurations (CRUD operations)
 * Handles API key encryption/decryption and provider testing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encrypt, decrypt } from '../_shared/crypto.ts';
import { sendToLLM, type ProviderName } from '../_shared/llm-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'list':
        return await listProviders(supabaseClient, userId);
      case 'add':
        return await addProvider(supabaseClient, userId, req);
      case 'update':
        return await updateProvider(supabaseClient, userId, req);
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
    console.error('Providers function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * List all providers for the user (without exposing plaintext keys)
 */
async function listProviders(supabaseClient: any, userId: string) {
  const { data, error } = await supabaseClient
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  // Mask API keys (show only last 4 chars)
  const providers = (data || []).map((p: any) => ({
    id: p.id,
    providerName: p.provider_name,
    modelName: p.model_name,
    isDefault: p.is_default,
    apiKeyMasked: `***${p.api_key_encrypted.slice(-4)}`,
    metadata: p.metadata,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return new Response(JSON.stringify({ providers }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Add a new provider
 */
async function addProvider(supabaseClient: any, userId: string, req: Request) {
  const body = await req.json();
  const { providerName, modelName, apiKey, isDefault, metadata } = body;

  if (!providerName || !modelName || !apiKey) {
    return new Response(
      JSON.stringify({ error: 'providerName, modelName, and apiKey are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Encrypt API key
  const encryptedKey = await encrypt(apiKey);

  // If this is the first provider or isDefault is true, clear other defaults
  if (isDefault) {
    await supabaseClient
      .from('ai_providers')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  const { data, error } = await supabaseClient
    .from('ai_providers')
    .insert({
      user_id: userId,
      provider_name: providerName,
      model_name: modelName,
      api_key_encrypted: encryptedKey,
      is_default: isDefault || false,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      provider: {
        id: data.id,
        providerName: data.provider_name,
        modelName: data.model_name,
        isDefault: data.is_default,
        createdAt: data.created_at,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Update an existing provider
 */
async function updateProvider(supabaseClient: any, userId: string, req: Request) {
  const body = await req.json();
  const { id, providerName, modelName, apiKey, metadata } = body;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Provider ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const updates: any = {};

  if (providerName) updates.provider_name = providerName;
  if (modelName) updates.model_name = modelName;
  if (metadata) updates.metadata = metadata;

  // If updating API key, encrypt it
  if (apiKey) {
    updates.api_key_encrypted = await encrypt(apiKey);
  }

  const { data, error } = await supabaseClient
    .from('ai_providers')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      provider: {
        id: data.id,
        providerName: data.provider_name,
        modelName: data.model_name,
        isDefault: data.is_default,
        updatedAt: data.updated_at,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Delete a provider
 */
async function deleteProvider(supabaseClient: any, userId: string, req: Request) {
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Provider ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabaseClient
    .from('ai_providers')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Set a provider as default
 */
async function setDefaultProvider(supabaseClient: any, userId: string, req: Request) {
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Provider ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Clear all defaults first
  await supabaseClient
    .from('ai_providers')
    .update({ is_default: false })
    .eq('user_id', userId);

  // Set the new default
  const { data, error } = await supabaseClient
    .from('ai_providers')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return new Response(JSON.stringify({ provider: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Test a provider with a simple query
 */
async function testProvider(supabaseClient: any, userId: string, req: Request) {
  const body = await req.json();
  const { id, providerName, modelName, apiKey } = body;

  let testApiKey: string;
  let testProviderName: ProviderName;
  let testModelName: string;

  // If ID is provided, fetch from database
  if (id) {
    const { data, error } = await supabaseClient
      .from('ai_providers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Provider not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    testApiKey = await decrypt(data.api_key_encrypted);
    testProviderName = data.provider_name;
    testModelName = data.model_name;
  } else if (providerName && modelName && apiKey) {
    // Test with provided credentials (without saving)
    testApiKey = apiKey;
    testProviderName = providerName;
    testModelName = modelName;
  } else {
    return new Response(
      JSON.stringify({ error: 'Either ID or (providerName, modelName, apiKey) required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const response = await sendToLLM({
      providerName: testProviderName,
      model: testModelName,
      apiKey: testApiKey,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello! Connection successful." in exactly those words.',
        },
      ],
      stream: false,
      maxTokens: 50,
    });

    return new Response(
      JSON.stringify({
        success: true,
        response: response.content,
        usage: response.usage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 200, // Return 200 with success: false for client to handle
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
