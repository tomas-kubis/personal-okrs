-- Rollback Script for AI Coaching Chat Migration
-- Run this to remove all changes made by the AI coaching chat feature

-- =====================================================
-- WARNING: This will delete all AI coaching data
-- =====================================================

-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS coach_prompts CASCADE;
DROP TABLE IF EXISTS ai_providers CASCADE;

-- Remove columns from coaching_sessions
ALTER TABLE coaching_sessions
  DROP COLUMN IF EXISTS period_id,
  DROP COLUMN IF EXISTS check_in_id,
  DROP COLUMN IF EXISTS provider_used,
  DROP COLUMN IF EXISTS model_used,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS context_summary,
  DROP COLUMN IF EXISTS context_data,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

-- Drop triggers
DROP TRIGGER IF EXISTS update_ai_providers_updated_at ON ai_providers;
DROP TRIGGER IF EXISTS update_coach_prompts_updated_at ON coach_prompts;
DROP TRIGGER IF EXISTS update_coaching_sessions_updated_at ON coaching_sessions;

-- Note: We keep the update_updated_at_column function as it might be used elsewhere
-- If you want to remove it completely:
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_ai_providers_user_id;
DROP INDEX IF EXISTS idx_ai_providers_default;
DROP INDEX IF EXISTS idx_coach_prompts_user_id;
DROP INDEX IF EXISTS idx_coach_prompts_default;
DROP INDEX IF EXISTS idx_coaching_sessions_period_id;
DROP INDEX IF EXISTS idx_coaching_sessions_check_in_id;
DROP INDEX IF EXISTS idx_coaching_sessions_status;
DROP INDEX IF EXISTS idx_coaching_sessions_user_created;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Rollback completed. AI coaching chat tables and columns removed.';
END
$$;
