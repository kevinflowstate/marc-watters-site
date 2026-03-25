-- Audit fixes: atomic credit deduction + checkin duplicate prevention
-- Run this against the Supabase SQL editor

-- 1. Atomic credit deduction function (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_ai_credits(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_credits INT;
BEGIN
  UPDATE client_profiles
  SET ai_credits = GREATEST(0, ai_credits - p_amount)
  WHERE user_id = p_user_id
  RETURNING ai_credits INTO v_new_credits;

  RETURN COALESCE(v_new_credits, 0);
END;
$$;

-- 2. Prevent duplicate check-ins for the same week
ALTER TABLE checkins
  ADD CONSTRAINT checkins_client_week_unique
  UNIQUE (client_id, week_number);

-- 3. Tighten ai_usage INSERT policy (only own records)
DROP POLICY IF EXISTS "Users can insert own usage" ON ai_usage;
CREATE POLICY "Users can insert own usage" ON ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Add unique constraint for content_progress upsert (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_progress_client_content_unique'
  ) THEN
    ALTER TABLE content_progress
      ADD CONSTRAINT content_progress_client_content_unique
      UNIQUE (client_id, content_id);
  END IF;
END $$;
