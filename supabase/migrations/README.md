# Database Migrations

## Applying Migrations

To apply these migrations to your Supabase database, you have two options:

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're in the project root
cd /home/user/personal-okrs

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Apply all pending migrations
npx supabase db push
```

### Option 2: Manual Application via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `supabase/migrations/20241104_add_checkin_rls_policies.sql`
4. Copy the entire content
5. Paste into the SQL Editor
6. Click **Run** to execute the migration

## Recent Migrations

### 20241104_add_checkin_rls_policies.sql
**Purpose:** Fix check-in save issue by adding RLS policies

This migration adds Row Level Security (RLS) policies for the `weekly_check_ins` and `check_in_progress_updates` tables. Without these policies, users cannot insert, update, or delete their check-ins.

**What it does:**
- Enables RLS on both tables
- Adds SELECT, INSERT, UPDATE, DELETE policies allowing users to manage their own check-ins
- Ensures users can only access their own data (enforced by `auth.uid() = user_id` check)

### 20241101_ai_coaching_chat.sql
**Purpose:** Add AI coaching chat functionality

Adds tables and columns for multi-provider LLM support in coaching sessions.
