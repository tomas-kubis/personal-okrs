-- Check Current Schema
-- Run this to see what AI coaching tables/columns currently exist

-- Check if ai_providers table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'ai_providers'
) AS ai_providers_exists;

-- Check if coach_prompts table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'coach_prompts'
) AS coach_prompts_exists;

-- Check columns in coaching_sessions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'coaching_sessions'
ORDER BY ordinal_position;

-- List all indexes on coaching_sessions
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'coaching_sessions'
  AND schemaname = 'public';

-- Count existing data (if tables exist)
SELECT
  'ai_providers' as table_name,
  COUNT(*) as row_count
FROM ai_providers
WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'ai_providers'
)
UNION ALL
SELECT
  'coach_prompts' as table_name,
  COUNT(*) as row_count
FROM coach_prompts
WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'coach_prompts'
);
