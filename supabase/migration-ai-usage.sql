-- AI Usage Tracking & Credit System

-- Add credits column to client_profiles (in pence, default 0)
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 0;

-- AI usage log table
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  actual_cost_pence NUMERIC(10,2) NOT NULL DEFAULT 0,
  billed_cost_pence NUMERIC(10,2) NOT NULL DEFAULT 0,
  markup_multiplier NUMERIC(4,2) NOT NULL DEFAULT 2.0,
  endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);

-- RLS
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Clients can read their own usage
CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (API routes use admin client)
CREATE POLICY "Service role can insert AI usage" ON ai_usage
  FOR INSERT WITH CHECK (true);

-- Anon/authenticated cannot insert directly
-- (inserts happen via service role in API routes)
