-- Migration: Add RLS policies for weekly_check_ins and check_in_progress_updates
-- Description: Add proper Row Level Security policies to allow users to manage their own check-ins
-- Date: 2024-11-04

-- =====================================================
-- 1. Enable RLS on weekly_check_ins (if not already enabled)
-- =====================================================
ALTER TABLE weekly_check_ins ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. RLS Policies for weekly_check_ins
-- =====================================================

-- Users can view their own check-ins
DROP POLICY IF EXISTS "Users can view their own check-ins" ON weekly_check_ins;
CREATE POLICY "Users can view their own check-ins"
  ON weekly_check_ins FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own check-ins
DROP POLICY IF EXISTS "Users can insert their own check-ins" ON weekly_check_ins;
CREATE POLICY "Users can insert their own check-ins"
  ON weekly_check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own check-ins
DROP POLICY IF EXISTS "Users can update their own check-ins" ON weekly_check_ins;
CREATE POLICY "Users can update their own check-ins"
  ON weekly_check_ins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own check-ins
DROP POLICY IF EXISTS "Users can delete their own check-ins" ON weekly_check_ins;
CREATE POLICY "Users can delete their own check-ins"
  ON weekly_check_ins FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 3. Enable RLS on check_in_progress_updates (if not already enabled)
-- =====================================================
ALTER TABLE check_in_progress_updates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS Policies for check_in_progress_updates
-- =====================================================

-- Users can view their own progress updates
DROP POLICY IF EXISTS "Users can view their own progress updates" ON check_in_progress_updates;
CREATE POLICY "Users can view their own progress updates"
  ON check_in_progress_updates FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress updates
DROP POLICY IF EXISTS "Users can insert their own progress updates" ON check_in_progress_updates;
CREATE POLICY "Users can insert their own progress updates"
  ON check_in_progress_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress updates
DROP POLICY IF EXISTS "Users can update their own progress updates" ON check_in_progress_updates;
CREATE POLICY "Users can update their own progress updates"
  ON check_in_progress_updates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own progress updates
DROP POLICY IF EXISTS "Users can delete their own progress updates" ON check_in_progress_updates;
CREATE POLICY "Users can delete their own progress updates"
  ON check_in_progress_updates FOR DELETE
  USING (auth.uid() = user_id);
