-- Migration V8: Add optional PDF URL to business plans
-- Run this in the Supabase Dashboard SQL Editor

ALTER TABLE public.business_plans
ADD COLUMN IF NOT EXISTS pdf_url TEXT;
