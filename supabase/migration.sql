-- Marc Watters Client Portal - Database Schema
-- Run this in the Supabase Dashboard SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client profiles
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT,
  business_name TEXT,
  business_type TEXT,
  goals TEXT,
  start_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'amber', 'red')),
  notes TEXT,
  last_login TIMESTAMPTZ,
  last_checkin TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training modules
CREATE TABLE IF NOT EXISTS public.training_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module content (lessons within modules)
CREATE TABLE IF NOT EXISTS public.module_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('video', 'pdf', 'text', 'checklist')),
  content_url TEXT,
  content_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client module assignments (tracks which modules each client has access to)
CREATE TABLE IF NOT EXISTS public.client_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(client_id, module_id)
);

-- Content progress (tracks individual lesson completion)
CREATE TABLE IF NOT EXISTS public.content_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.module_content(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(client_id, content_id)
);

-- Weekly check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'struggling')),
  wins TEXT,
  challenges TEXT,
  questions TEXT,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  client_reply TEXT,
  client_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON public.client_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_status ON public.client_profiles(status);
CREATE INDEX IF NOT EXISTS idx_module_content_module_id ON public.module_content(module_id);
CREATE INDEX IF NOT EXISTS idx_client_modules_client_id ON public.client_modules(client_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_client_id ON public.content_progress(client_id);
CREATE INDEX IF NOT EXISTS idx_checkins_client_id ON public.checkins(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users: can read own record, admins can read all
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Client profiles: clients see own, admins see all
CREATE POLICY "Clients can view own profile" ON public.client_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all client profiles" ON public.client_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Training modules: published visible to all authenticated, admins manage all
CREATE POLICY "Authenticated users can view published modules" ON public.training_modules
  FOR SELECT USING (is_published = true AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all modules" ON public.training_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Module content: visible if parent module is published
CREATE POLICY "Users can view content of published modules" ON public.module_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_modules
      WHERE id = module_id AND is_published = true
    ) AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can manage all content" ON public.module_content
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Client modules: clients see own, admins manage all
CREATE POLICY "Clients can view own module assignments" ON public.client_modules
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can update own module status" ON public.client_modules
  FOR UPDATE USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all module assignments" ON public.client_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Content progress: clients manage own, admins see all
CREATE POLICY "Clients can manage own progress" ON public.content_progress
  FOR ALL USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all progress" ON public.content_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Check-ins: clients manage own, admins manage all
CREATE POLICY "Clients can manage own checkins" ON public.checkins
  FOR ALL USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all checkins" ON public.checkins
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Notifications: users see own
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all notifications" ON public.notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- FUNCTION: Auto-create user record on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Auto-create client profile for new clients
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'client' THEN
    INSERT INTO public.client_profiles (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();

-- ============================================
-- CALENDAR EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  event_time TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none',
  recurrence_day INTEGER,
  link TEXT,
  link_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read events" ON public.calendar_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access" ON public.calendar_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
