# AI Coaching Chat - Setup Guide

This guide will help you set up and use the AI Coaching Chat feature in your Personal OKRs application.

## Overview

The AI Coaching Chat system provides:
- ✅ Multi-provider LLM support (OpenAI, Anthropic, Cohere, HuggingFace, OpenRouter)
- ✅ BYOK (Bring Your Own Key) - secure encrypted API key storage
- ✅ Customizable coach prompts
- ✅ Context-aware coaching based on your OKRs and check-ins
- ✅ Persistent chat sessions
- ✅ Future-proof architecture for tools and workflows

---

## 1. Database Setup

### Run the Migration

Apply the database migration to add the necessary tables and columns:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration manually via Supabase Dashboard
# Navigate to SQL Editor and run: supabase/migrations/20241101_ai_coaching_chat.sql
```

This migration adds:
- `ai_providers` table - stores encrypted API keys
- Extended `coaching_sessions` table - adds provider metadata and context
- `coach_prompts` table (optional) - for multiple saved prompts
- Proper RLS policies for security

---

## 2. Environment Setup

### Generate Encryption Key

The system uses AES-GCM encryption to protect API keys. Generate a secure encryption key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using OpenSSL
openssl rand -base64 32
```

### Set Environment Variables

Add these environment variables to your Supabase Edge Functions:

1. **Via Supabase Dashboard:**
   - Go to Project Settings → Edge Functions → Secrets
   - Add: `ENCRYPTION_KEY` = `<your-generated-key>`

2. **Via Supabase CLI:**
   ```bash
   supabase secrets set ENCRYPTION_KEY=<your-generated-key>
   ```

---

## 3. Deploy Edge Functions

Deploy the Edge Functions to Supabase:

```bash
# Deploy all functions
supabase functions deploy chat
supabase functions deploy providers

# Or deploy individually
supabase functions deploy chat
supabase functions deploy providers
```

### Verify Deployment

Test the functions are working:

```bash
# Test providers endpoint (requires auth token)
curl -X GET \
  'https://<your-project>.supabase.co/functions/v1/providers?action=list' \
  -H 'Authorization: Bearer <your-jwt-token>'
```

---

## 4. Add Your First AI Provider

### Via Settings UI

1. **Navigate to Settings**
   - Open the app and go to Settings page

2. **Add AI Provider**
   - Scroll to "AI Providers" section
   - Click "Add Provider"
   - Select provider (e.g., OpenAI)
   - Select model (e.g., gpt-4o-mini)
   - Enter your API key
   - Check "Set as default provider"
   - Click "Add Provider"

3. **Test Provider**
   - Click the test icon (test tube) next to your provider
   - You should see "✅ Test successful!"

### Supported Providers

| Provider | Models | Get API Key |
|----------|--------|-------------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo | https://platform.openai.com/api-keys |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus, claude-3-sonnet, claude-3-haiku | https://console.anthropic.com/settings/keys |
| **Cohere** | command-r-plus, command-r, command | https://dashboard.cohere.com/api-keys |
| **HuggingFace** | meta-llama/Meta-Llama-3-8B-Instruct, mistralai/Mistral-7B-Instruct-v0.2 | https://huggingface.co/settings/tokens |
| **OpenRouter** | openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3-70b-instruct | https://openrouter.ai/keys |

---

## 5. Customize Coach Prompt (Optional)

The default coach prompt is supportive and OKR-focused, but you can customize it:

1. **Navigate to Settings → Coach Prompt**
2. **Edit the prompt** to match your preferred coaching style
3. **Click "Save Prompt"**

### Example Prompts

**Data-Driven Coach:**
```
You are a metrics-focused executive coach. Always reference specific numbers from the user's OKRs. Ask quantitative questions and push for measurable outcomes. Be direct and challenge assumptions with data.
```

**Supportive Coach:**
```
You are a warm, empathetic coach who celebrates progress and helps reframe setbacks. Focus on the user's strengths and growth mindset. Ask open-ended questions that encourage reflection and self-discovery.
```

**Action-Oriented Coach:**
```
You are a results-driven coach focused on concrete next steps. Every response should end with a specific, actionable recommendation. Keep responses brief and tactical.
```

---

## 6. Start Coaching

1. **Navigate to Coach page**
2. **Start typing** your message
3. **Press Enter** to send

The AI coach will have context about:
- Your current period/quarter
- Your objectives and key results
- Your recent check-ins and reflections
- Your progress trends

---

## 7. API Key Security

### How It Works

1. **Client Side:** API keys are never exposed to the browser
2. **Edge Function:** Keys are decrypted only in Supabase Edge Functions
3. **Encryption:** AES-GCM 256-bit encryption
4. **Storage:** Keys stored as base64 ciphertext in database
5. **RLS:** Row-level security ensures users only see their own providers

### Best Practices

- ✅ Use API keys with minimal permissions
- ✅ Set spending limits on provider dashboards
- ✅ Rotate keys periodically
- ✅ Use different keys for development and production
- ❌ Never commit API keys to git
- ❌ Never share your encryption key

---

## 8. Troubleshooting

### "No AI provider configured"

**Solution:** Add a provider in Settings → AI Providers

### "Failed to encrypt data"

**Possible causes:**
- `ENCRYPTION_KEY` environment variable not set
- Invalid encryption key format

**Solution:**
1. Regenerate encryption key: `openssl rand -base64 32`
2. Set in Supabase: `supabase secrets set ENCRYPTION_KEY=<key>`
3. Redeploy functions: `supabase functions deploy chat providers`

### "AI provider error: 401 Unauthorized"

**Possible causes:**
- Invalid API key
- API key expired or revoked

**Solution:**
1. Go to Settings → AI Providers
2. Delete the provider
3. Create a new provider with a fresh API key
4. Test the connection

### "Error loading context"

**Possible causes:**
- Missing or invalid period
- No objectives created yet

**Solution:**
1. Create a period in Settings if none exists
2. Set it as active
3. Add at least one objective with key results

---

## 9. Cost Management

### Typical Token Usage

- **Context per session:** ~500-1000 tokens (objectives, key results, check-ins)
- **Average message:** ~100-200 tokens
- **Coach response:** ~200-400 tokens
- **Full conversation (10 exchanges):** ~3000-6000 tokens

### Estimated Costs (as of 2024)

| Provider | Model | Cost per 1M tokens (input/output) | Estimated $/conversation |
|----------|-------|-----------------------------------|--------------------------|
| OpenAI | gpt-4o-mini | $0.15 / $0.60 | $0.002-$0.004 |
| OpenAI | gpt-4o | $2.50 / $10.00 | $0.03-$0.06 |
| Anthropic | claude-3-haiku | $0.25 / $1.25 | $0.004-$0.008 |
| Anthropic | claude-3-5-sonnet | $3.00 / $15.00 | $0.04-$0.09 |

### Tips to Reduce Costs

1. **Use cheaper models** for casual conversations (gpt-4o-mini, claude-haiku)
2. **Limit context** - the system only includes recent check-ins
3. **Keep messages concise** - shorter messages = fewer tokens
4. **Set provider spending limits** in provider dashboards

---

## 10. Future Enhancements

The system is designed to support future features without breaking changes:

### Planned Features

- **🔧 Tools & Function Calling**
  - Query your OKRs mid-conversation
  - Update progress directly from chat
  - Search past reflections

- **🔄 Workflows**
  - Multi-step coaching programs
  - Automated check-in reminders
  - Goal-setting wizards

- **📊 Analytics**
  - Track coaching engagement
  - Measure impact on goal achievement
  - Personalized insights

- **🌐 Streaming**
  - Real-time response streaming (currently disabled for MVP)
  - Faster perceived response times

---

## 11. Development Notes

### Architecture

```
┌─────────────┐
│   Client    │
│  (React)    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│     Supabase Edge Functions         │
│  ┌──────────┐    ┌──────────────┐  │
│  │   chat   │    │  providers   │  │
│  └────┬─────┘    └──────┬───────┘  │
│       │                 │           │
│       ▼                 ▼           │
│  ┌─────────────────────────────┐   │
│  │   llm-provider.ts           │   │
│  │  (OpenAI, Anthropic, etc.)  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Supabase   │
│  Database   │
└─────────────┘
```

### Key Design Decisions

1. **Edge Functions over Client-Side:** API keys never exposed to browser
2. **Provider Adapter Pattern:** Easy to add new LLM providers
3. **Encrypted Storage:** AES-GCM for API key security
4. **Future-Proof Types:** Tool and Workflow interfaces ready for expansion
5. **Context Builder:** Standalone service for reusability

### Testing

```bash
# Run the app locally
npm run dev

# Test Edge Functions locally (requires Supabase CLI)
supabase functions serve chat
supabase functions serve providers

# Test provider encryption
# See: supabase/functions/_shared/crypto.ts
```

---

## 12. Support & Feedback

If you encounter issues:

1. Check the browser console for errors
2. Check Supabase Edge Function logs
3. Verify environment variables are set
4. Test provider connections in Settings

For questions or feature requests, please open an issue on GitHub.

---

## Quick Start Checklist

- [ ] Run database migration
- [ ] Generate and set `ENCRYPTION_KEY`
- [ ] Deploy Edge Functions (`chat` and `providers`)
- [ ] Add at least one AI provider in Settings
- [ ] Test provider connection
- [ ] (Optional) Customize coach prompt
- [ ] Start coaching!

Enjoy your AI-powered coaching experience! 🎯🤖
