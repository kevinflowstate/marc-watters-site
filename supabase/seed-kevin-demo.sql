-- Seed Kevin Harkin as a demo client (Week 2 in the program)
-- UUID: 66666666-6666-6666-6666-666666666666
-- Client Profile: ffffffff-ffff-ffff-ffff-ffffffffffff

-- ============================================
-- AUTH USER
-- ============================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kevin.flowstate@gmail.com', crypt('demo-pass-123', gen_salt('bf')), NOW(), NOW() - INTERVAL '14 days', NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USER RECORD
-- ============================================

-- Wait for trigger to create user, then update
UPDATE public.users SET
  full_name = 'Kevin Harkin',
  role = 'client',
  created_at = NOW() - INTERVAL '14 days'
WHERE id = '66666666-6666-6666-6666-666666666666'::uuid;

-- If trigger didn't fire, insert manually
INSERT INTO public.users (id, email, role, full_name, created_at)
VALUES ('66666666-6666-6666-6666-666666666666', 'kevin.flowstate@gmail.com', 'client', 'Kevin Harkin', NOW() - INTERVAL '14 days')
ON CONFLICT (id) DO UPDATE SET full_name = 'Kevin Harkin', role = 'client';

-- ============================================
-- CLIENT PROFILE
-- ============================================

-- Try update first (trigger may have created it)
UPDATE public.client_profiles SET
  id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  phone = '07412 993 201',
  business_name = 'Harkin Construction',
  business_type = 'General Construction',
  goals = 'Stop doing everything myself. Build a 5-man team, hit 40k/month, and get proper systems in place so I can actually take a day off. Currently running 2 vans but I''m on every job.',
  start_date = (CURRENT_DATE - INTERVAL '14 days')::DATE,
  status = 'green',
  last_login = NOW() - INTERVAL '1 day',
  last_checkin = NOW() - INTERVAL '3 days',
  created_at = NOW() - INTERVAL '14 days'
WHERE user_id = '66666666-6666-6666-6666-666666666666'::uuid;

-- If no profile exists, insert it
INSERT INTO public.client_profiles (id, user_id, phone, business_name, business_type, goals, start_date, status, last_login, last_checkin, created_at)
SELECT
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  '66666666-6666-6666-6666-666666666666'::uuid,
  '07412 993 201',
  'Harkin Construction',
  'General Construction',
  'Stop doing everything myself. Build a 5-man team, hit 40k/month, and get proper systems in place so I can actually take a day off. Currently running 2 vans but I''m on every job.',
  (CURRENT_DATE - INTERVAL '14 days')::DATE,
  'green',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '14 days'
WHERE NOT EXISTS (SELECT 1 FROM public.client_profiles WHERE user_id = '66666666-6666-6666-6666-666666666666'::uuid);

-- ============================================
-- ASSIGN TRAINING MODULES (Week 2 = Module 1 in progress, Module 2 locked)
-- ============================================

INSERT INTO public.client_modules (client_id, module_id, status, started_at) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000001', 'in_progress', NOW() - INTERVAL '12 days'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000002', 'locked', NULL),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000003', 'locked', NULL),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000004', 'locked', NULL),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '10000000-0000-0000-0000-000000000005', 'locked', NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- CONTENT PROGRESS (watched 2 of 4 videos in Module 1)
-- ============================================

INSERT INTO public.content_progress (client_id, content_id, completed, completed_at) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '20000000-0000-0000-0001-000000000001', true, NOW() - INTERVAL '11 days'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '20000000-0000-0000-0001-000000000002', true, NOW() - INTERVAL '8 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- CHECK-INS (2 weeks of check-ins)
-- ============================================

INSERT INTO public.checkins (client_id, week_number, mood, wins, challenges, questions, responses, admin_reply, replied_at, created_at) VALUES
(
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  1,
  'good',
  'Got my spreadsheet set up for tracking job costs. Went through all my jobs from the last 3 months and realised I''m undercharging on smaller jobs by about 15%. Big eye opener.',
  'Finding it hard to carve out time for the coursework. Still on every job site and by the time I get home I''m wrecked.',
  'Should I be including my own wages in job costings or just treat it as profit?',
  '{"wins": "Got my spreadsheet set up for tracking job costs. Went through all my jobs from the last 3 months and realised I''m undercharging on smaller jobs by about 15%. Big eye opener.", "challenges": "Finding it hard to carve out time for the coursework. Still on every job site and by the time I get home I''m wrecked.", "questions": "Should I be including my own wages in job costings or just treat it as profit?"}'::jsonb,
  'Great first week Kevin. The 15% undercharge on smaller jobs is a really common one - good that you''ve spotted it early. On your question: yes, always include your own wages as a cost. If you''re paying yourself nothing, you''re subsidising the business. Pick a realistic day rate for yourself and cost it into every job. We''ll go through this properly on the next call.',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '11 days'
),
(
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  2,
  'great',
  'Repriced 3 upcoming quotes using the new job costing method. Added about 12% to each one and won 2 out of 3. Also blocked out Friday afternoons for business work - already feels different having that protected time.',
  'One of my lads called in sick twice this week. Starting to think he''s not the right fit but not sure how to handle it. Don''t want to be a bad boss but I can''t carry passengers.',
  'Can we talk through the team accountability stuff on the next call? I know it''s Module 3 but it feels relevant now.',
  '{"wins": "Repriced 3 upcoming quotes using the new job costing method. Added about 12% to each one and won 2 out of 3. Also blocked out Friday afternoons for business work - already feels different having that protected time.", "challenges": "One of my lads called in sick twice this week. Starting to think he''s not the right fit but not sure how to handle it. Don''t want to be a bad boss but I can''t carry passengers.", "questions": "Can we talk through the team accountability stuff on the next call? I know it''s Module 3 but it feels relevant now."}'::jsonb,
  NULL,
  NULL,
  NOW() - INTERVAL '3 days'
);

-- ============================================
-- BUSINESS PLAN
-- ============================================

INSERT INTO public.business_plans (id, client_id, summary, status, created_at) VALUES
  ('b0000000-0000-0000-0000-000000000006', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
   'Kevin runs Harkin Construction - 2 vans, general construction. He''s on every job, quoting everything himself, and working 60+ hours. Goal: build a 5-man team, hit 40k/month, and get systems in place so the business runs without him on every site. First priority is getting his numbers right and pricing properly, then building a pipeline that doesn''t rely on word of mouth alone.',
   'active', NOW() - INTERVAL '13 days');

-- Phase 1: Foundations (Weeks 1-4)
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('c0000000-0000-0000-0006-000000000001', 'b0000000-0000-0000-0000-000000000006',
   'Foundations (Weeks 1-4)',
   'Get the financial basics locked in. Know your numbers, cost your jobs properly, and set monthly targets. This is the groundwork for everything else.',
   0);

INSERT INTO public.business_plan_items (phase_id, title, completed, completed_at, order_index) VALUES
  ('c0000000-0000-0000-0006-000000000001', 'Complete job costing spreadsheet for all active jobs', true, NOW() - INTERVAL '11 days', 0),
  ('c0000000-0000-0000-0006-000000000001', 'Review last 3 months of jobs - identify underpriced work', true, NOW() - INTERVAL '10 days', 1),
  ('c0000000-0000-0000-0006-000000000001', 'Set your own day rate and include in all future quotes', true, NOW() - INTERVAL '5 days', 2),
  ('c0000000-0000-0000-0006-000000000001', 'Build rolling cash flow forecast (next 8 weeks)', false, NULL, 3),
  ('c0000000-0000-0000-0006-000000000001', 'Set monthly revenue and profit targets', false, NULL, 4),
  ('c0000000-0000-0000-0006-000000000001', 'Complete Financial Foundations module', false, NULL, 5);

-- Phase 2: Pipeline & Growth (Weeks 5-8)
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('c0000000-0000-0000-0006-000000000002', 'b0000000-0000-0000-0000-000000000006',
   'Pipeline & Growth (Weeks 5-8)',
   'Build a system for winning consistent work. Stop relying on the phone ringing. Get quoting dialled in and build a referral engine.',
   1);

INSERT INTO public.business_plan_items (phase_id, title, completed, completed_at, order_index) VALUES
  ('c0000000-0000-0000-0006-000000000002', 'Audit where current work comes from (referral, repeat, online, other)', false, NULL, 0),
  ('c0000000-0000-0000-0006-000000000002', 'Set up quoting template with proper margins built in', false, NULL, 1),
  ('c0000000-0000-0000-0006-000000000002', 'Implement 48-hour quote follow-up system', false, NULL, 2),
  ('c0000000-0000-0000-0006-000000000002', 'Set up and optimise Google Business Profile', false, NULL, 3),
  ('c0000000-0000-0000-0006-000000000002', 'Ask 5 past clients for Google reviews', false, NULL, 4),
  ('c0000000-0000-0000-0006-000000000002', 'Complete Pipeline & Sales module', false, NULL, 5);

-- Phase 3: Team & Systems (Weeks 9-12)
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('c0000000-0000-0000-0006-000000000003', 'b0000000-0000-0000-0000-000000000006',
   'Team & Systems (Weeks 9-12)',
   'Start building the team and systems to get Kevin off the tools. First hire, clear roles, accountability structure.',
   2);

INSERT INTO public.business_plan_items (phase_id, title, completed, completed_at, order_index) VALUES
  ('c0000000-0000-0000-0006-000000000003', 'Write job description for first dedicated hire', false, NULL, 0),
  ('c0000000-0000-0000-0006-000000000003', 'Set up simple project tracker (jobs, stages, who''s on what)', false, NULL, 1),
  ('c0000000-0000-0000-0006-000000000003', 'Create daily check-in process for team', false, NULL, 2),
  ('c0000000-0000-0000-0006-000000000003', 'Build standard operating procedures for top 3 job types', false, NULL, 3),
  ('c0000000-0000-0000-0006-000000000003', 'Complete Building Your Team + Systems modules', false, NULL, 4);

-- ============================================
-- NOTIFICATIONS
-- ============================================

INSERT INTO public.notifications (user_id, title, message, read, link, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Welcome to the Program', 'Your portal is set up and ready. Start with the Financial Foundations module and submit your first check-in when you''re ready.', true, '/portal/training', NOW() - INTERVAL '14 days'),
  ('66666666-6666-6666-6666-666666666666', 'Marc replied to your check-in', 'Marc has responded to your Week 1 check-in. Click to view his feedback.', true, '/portal/checkin', NOW() - INTERVAL '10 days'),
  ('66666666-6666-6666-6666-666666666666', 'New training content available', 'Job Costing: How to Price Every Job for Profit has been added to your Financial Foundations module.', false, '/portal/training/10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days');
