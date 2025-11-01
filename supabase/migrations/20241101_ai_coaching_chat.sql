-- Migration: AI Coaching Chat
-- Description: Add ai_providers table and extend coaching_sessions for multi-provider LLM support
-- Date: 2024-11-01

-- =====================================================
-- 1. Create ai_providers table
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('openai', 'anthropic', 'cohere', 'huggingface', 'openrouter')),
  model_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,  -- Stores encrypted API key
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,

  -- Ensure only one default provider per user
  CONSTRAINT unique_default_per_user UNIQUE NULLS NOT DISTINCT (user_id, is_default)
    DEFERRABLE INITIALLY DEFERRED
);

-- Index for quick lookups
CREATE INDEX idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX idx_ai_providers_default ON ai_providers(user_id, is_default) WHERE is_default = true;

-- RLS policies for ai_providers
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own providers
CREATE POLICY "Users can view their own AI providers"
  ON ai_providers FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own providers
CREATE POLICY "Users can insert their own AI providers"
  ON ai_providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own providers
CREATE POLICY "Users can update their own AI providers"
  ON ai_providers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own providers
CREATE POLICY "Users can delete their own AI providers"
  ON ai_providers FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. Extend coaching_sessions table (backward compatible)
-- =====================================================
-- Add new optional columns to coaching_sessions
ALTER TABLE coaching_sessions
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS check_in_id UUID REFERENCES weekly_check_ins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_used TEXT,
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  ADD COLUMN IF NOT EXISTS context_summary TEXT,
  ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_period_id ON coaching_sessions(period_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_check_in_id ON coaching_sessions(check_in_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(status);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_created ON coaching_sessions(user_id, created_at DESC);

-- =====================================================
-- 3. Create coach_prompts table (optional - for multiple saved prompts)
-- =====================================================
CREATE TABLE IF NOT EXISTS coach_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,

  -- Ensure only one default prompt per user
  CONSTRAINT unique_default_prompt_per_user UNIQUE NULLS NOT DISTINCT (user_id, is_default)
    DEFERRABLE INITIALLY DEFERRED
);

-- Index for quick lookups
CREATE INDEX idx_coach_prompts_user_id ON coach_prompts(user_id);
CREATE INDEX idx_coach_prompts_default ON coach_prompts(user_id, is_default) WHERE is_default = true;

-- RLS policies for coach_prompts
ALTER TABLE coach_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coach prompts"
  ON coach_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coach prompts"
  ON coach_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach prompts"
  ON coach_prompts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coach prompts"
  ON coach_prompts FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. Update triggers for updated_at timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for ai_providers
DROP TRIGGER IF EXISTS update_ai_providers_updated_at ON ai_providers;
CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add triggers for coach_prompts
DROP TRIGGER IF EXISTS update_coach_prompts_updated_at ON coach_prompts;
CREATE TRIGGER update_coach_prompts_updated_at
  BEFORE UPDATE ON coach_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add triggers for coaching_sessions if not exists
DROP TRIGGER IF EXISTS update_coaching_sessions_updated_at ON coaching_sessions;
CREATE TRIGGER update_coaching_sessions_updated_at
  BEFORE UPDATE ON coaching_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. Insert default coach prompt (if using coach_prompts table)
-- =====================================================
-- This is optional; you can also store in app_settings.preferences.coach_prompt
-- Uncomment if you want to seed a default prompt
-- INSERT INTO coach_prompts (user_id, name, prompt_text, is_default)
-- SELECT
--   id as user_id,
--   'Default Coach' as name,
--   'You are a supportive and insightful executive coach...' as prompt_text,
--   true as is_default
-- FROM auth.users
-- ON CONFLICT DO NOTHING;
