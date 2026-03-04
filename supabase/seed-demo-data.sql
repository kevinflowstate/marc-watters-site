-- Seed Demo Data for Marc Watters Admin Dashboard
-- Run this AFTER migration-v2.sql in the Supabase SQL Editor
--
-- Creates 5 demo clients (users + client_profiles) with:
-- - Training modules + content
-- - Business plans, phases, items
-- - Check-ins with replies
-- - Internal notes
--
-- These are placeholder users (no Supabase Auth accounts) - they can't log in.
-- The admin views them in the dashboard. Real clients get added later via auth.

-- ============================================
-- FIXED UUIDs
-- ============================================
-- Users
-- user-1: Ryan O'Neill       = 11111111-1111-1111-1111-111111111111
-- user-2: Paul Thompson      = 22222222-2222-2222-2222-222222222222
-- user-3: Sean Murphy        = 33333333-3333-3333-3333-333333333333
-- user-4: James McConnell    = 44444444-4444-4444-4444-444444444444
-- user-5: David Kelly        = 55555555-5555-5555-5555-555555555555
--
-- Client profiles
-- cp-1 = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- cp-2 = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- cp-3 = cccccccc-cccc-cccc-cccc-cccccccccccc
-- cp-4 = dddddddd-dddd-dddd-dddd-dddddddddddd
-- cp-5 = eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee

-- ============================================
-- AUTH USERS (must exist first - public.users references auth.users)
-- ============================================

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ryan@oneillroofing.co.uk', crypt('demo-password-not-real', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'paul@thompsonelectrical.com', crypt('demo-password-not-real', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sean@murphyfitouts.ie', crypt('demo-password-not-real', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', ''),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james@mcconnellbuilds.co.uk', crypt('demo-password-not-real', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', ''),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david@kellywoodworks.co.uk', crypt('demo-password-not-real', gen_salt('bf')), NOW(), NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- The auth.users insert triggers auto-creation of public.users + client_profiles.
-- Now UPDATE them with full data.

-- ============================================
-- UPDATE USERS with proper names
-- ============================================

UPDATE public.users SET full_name = 'Ryan O''Neill', created_at = NOW() - INTERVAL '21 days' WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;
UPDATE public.users SET full_name = 'Paul Thompson', created_at = NOW() - INTERVAL '28 days' WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;
UPDATE public.users SET full_name = 'Sean Murphy', created_at = NOW() - INTERVAL '42 days' WHERE id = '33333333-3333-3333-3333-333333333333'::uuid;
UPDATE public.users SET full_name = 'James McConnell', created_at = NOW() - INTERVAL '56 days' WHERE id = '44444444-4444-4444-4444-444444444444'::uuid;
UPDATE public.users SET full_name = 'David Kelly', created_at = NOW() - INTERVAL '35 days' WHERE id = '55555555-5555-5555-5555-555555555555'::uuid;

-- ============================================
-- UPDATE CLIENT PROFILES with full business data
-- ============================================

UPDATE public.client_profiles SET
  id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  phone = '07412 889 103', business_name = 'O''Neill Roofing', business_type = 'Roofing Contractor',
  goals = 'Get off the tools, build a team of 4 roofers, hit 30k/month revenue consistently. Stop quoting every job himself.',
  start_date = (CURRENT_DATE - INTERVAL '21 days')::DATE, status = 'green',
  last_login = NOW() - INTERVAL '12 days', last_checkin = NOW() - INTERVAL '18 days', created_at = NOW() - INTERVAL '21 days'
WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid;

UPDATE public.client_profiles SET
  id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  phone = '07891 443 298', business_name = 'Thompson Electrical', business_type = 'Electrical Contractor',
  goals = 'Stop working 60-hour weeks, hire an apprentice, get cash flow predictable. Currently doing residential and small commercial.',
  start_date = (CURRENT_DATE - INTERVAL '28 days')::DATE, status = 'green',
  last_login = NOW() - INTERVAL '10 days', last_checkin = NOW() - INTERVAL '16 days', created_at = NOW() - INTERVAL '28 days'
WHERE user_id = '22222222-2222-2222-2222-222222222222'::uuid;

UPDATE public.client_profiles SET
  id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  phone = '083 412 7791', business_name = 'Murphy Commercial Fit-Outs', business_type = 'Commercial Fit-Outs',
  goals = 'Scale from 3-man team to 8. Win bigger contracts (50k+). Get proper project management in place so jobs don''t overrun.',
  start_date = (CURRENT_DATE - INTERVAL '42 days')::DATE, status = 'green',
  last_login = NOW() - INTERVAL '4 days', last_checkin = NOW() - INTERVAL '9 days', created_at = NOW() - INTERVAL '42 days'
WHERE user_id = '33333333-3333-3333-3333-333333333333'::uuid;

UPDATE public.client_profiles SET
  id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  phone = '07723 551 882', business_name = 'McConnell Residential Builds', business_type = 'Residential Construction',
  goals = 'Build to 50k/month consistent revenue, step back from tools within 6 months, win at least 2 extension jobs per month through referrals.',
  start_date = (CURRENT_DATE - INTERVAL '56 days')::DATE, status = 'green',
  last_login = NOW(), last_checkin = NOW() - INTERVAL '2 days', created_at = NOW() - INTERVAL '56 days'
WHERE user_id = '44444444-4444-4444-4444-444444444444'::uuid;

UPDATE public.client_profiles SET
  id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  phone = '07549 201 445', business_name = 'Kelly Woodworks', business_type = 'Joinery & Carpentry',
  goals = 'Transition from subcontracting to direct-to-client work. Build a workshop-based business doing kitchens, fitted furniture, and bespoke joinery.',
  start_date = (CURRENT_DATE - INTERVAL '35 days')::DATE, status = 'green',
  last_login = NOW() - INTERVAL '1 day', last_checkin = NOW() - INTERVAL '3 days', created_at = NOW() - INTERVAL '35 days'
WHERE user_id = '55555555-5555-5555-5555-555555555555'::uuid;

-- ============================================
-- TRAINING MODULES
-- ============================================

INSERT INTO public.training_modules (id, title, description, order_index, thumbnail_url, is_published, created_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Financial Foundations',
   'Know your numbers. Understand your margins, cost your jobs properly, manage cash flow, and build a business that''s actually profitable - not just busy.',
   0, '/images/modules/financial.jpg', true, NOW()),

  ('10000000-0000-0000-0000-000000000002', 'Pipeline & Sales',
   'Build a consistent pipeline of quality work. Stop relying on word of mouth alone. Learn to quote properly, follow up systematically, and win more of the right jobs.',
   1, '/images/modules/pipeline.jpg', true, NOW()),

  ('10000000-0000-0000-0000-000000000003', 'Building Your Team',
   'Hire the right people, set clear expectations, and build a team that takes ownership. Stop being the only one who cares about the work.',
   2, '/images/modules/team.jpg', true, NOW()),

  ('10000000-0000-0000-0000-000000000004', 'Systems & Operations',
   'Build operational structure so jobs run smoother, communication is clear, and nothing falls through the cracks. The systems that let you step back from the tools.',
   3, '/images/modules/systems.jpg', true, NOW()),

  ('10000000-0000-0000-0000-000000000005', 'Time Management & Productivity',
   'Stop working 60-hour weeks. Learn to plan your time, delegate effectively, and focus on the work that actually moves the business forward.',
   4, '/images/modules/time.jpg', true, NOW()),

  ('10000000-0000-0000-0000-000000000006', 'Standards & Quality Control',
   'Build a reputation that wins work. Quality control checklists, client communication systems, and delivery standards that set you apart from every other trade business.',
   5, '/images/modules/quality.jpg', false, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MODULE CONTENT (lessons)
-- ============================================

-- Module 1: Financial Foundations
INSERT INTO public.module_content (id, module_id, title, content_type, content_url, content_text, order_index, duration_minutes) VALUES
  ('20000000-0000-0000-0001-000000000001', '10000000-0000-0000-0000-000000000001',
   'Why Most Construction Businesses Don''t Know Their Real Profit', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Most construction business owners confuse turnover with profit. In this session, we break down the difference between revenue, gross profit, and net profit - and why knowing these numbers changes every decision you make.',
   0, 18),

  ('20000000-0000-0000-0001-000000000002', '10000000-0000-0000-0000-000000000001',
   'Job Costing: How to Price Every Job for Profit', 'video',
   'https://player.vimeo.com/video/1121582501?h=ad5f727774',
   'The pricing session that changes everything. We go through a real job costing example step by step - materials, labour, overheads, contingency, and margin.',
   1, 24),

  ('20000000-0000-0000-0001-000000000003', '10000000-0000-0000-0000-000000000001',
   'Cash Flow Management for Construction', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Cash flow kills more construction businesses than lack of work. This session covers how to build a rolling cash flow forecast, structure payment stages, and stop the feast-and-famine cycle.',
   2, 22),

  ('20000000-0000-0000-0001-000000000004', '10000000-0000-0000-0000-000000000001',
   'Setting Your Monthly Revenue & Profit Targets', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Abstract targets like ''grow the business'' mean nothing. This session walks through how to set specific, achievable monthly targets based on your actual numbers.',
   3, 14),

-- Module 2: Pipeline & Sales
  ('20000000-0000-0000-0002-000000000001', '10000000-0000-0000-0000-000000000002',
   'Where Does Your Work Actually Come From?', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Before you spend money on marketing, you need to understand where your current work comes from. This session is an audit exercise.',
   0, 16),

  ('20000000-0000-0000-0002-000000000002', '10000000-0000-0000-0000-000000000002',
   'The Quoting System: Speed, Clarity, Follow-Up', 'video',
   'https://player.vimeo.com/video/1121582501?h=ad5f727774',
   'The difference between a 20% win rate and a 50% win rate isn''t price - it''s speed, presentation, and follow-up.',
   1, 28),

  ('20000000-0000-0000-0002-000000000003', '10000000-0000-0000-0000-000000000002',
   'Building a Referral Engine', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Referrals are the highest quality leads in construction. But most businesses leave them to chance.',
   2, 19),

  ('20000000-0000-0000-0002-000000000004', '10000000-0000-0000-0000-000000000002',
   'Google Business Profile: Your Free Lead Machine', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Your Google Business Profile is the single most underused free marketing tool in construction.',
   3, 15),

-- Module 3: Building Your Team
  ('20000000-0000-0000-0003-000000000001', '10000000-0000-0000-0000-000000000003',
   'When to Hire (And When Not To)', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Hiring too early burns cash. Hiring too late means you''re the bottleneck. This session gives you the framework.',
   0, 20),

  ('20000000-0000-0000-0003-000000000002', '10000000-0000-0000-0000-000000000003',
   'Writing Job Descriptions That Attract the Right People', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   '''Looking for a hard worker'' is not a job description. This session shows you how to write clear, specific job descriptions.',
   1, 12),

  ('20000000-0000-0000-0003-000000000003', '10000000-0000-0000-0000-000000000003',
   'The First 2 Weeks: Onboarding That Sets Standards', 'video',
   'https://player.vimeo.com/video/1121582501?h=ad5f727774',
   'How someone starts is how they continue. Most construction businesses throw new hires in at the deep end.',
   2, 17),

  ('20000000-0000-0000-0003-000000000004', '10000000-0000-0000-0000-000000000003',
   'Building Accountability Without Micromanaging', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'The difference between checking up on people and checking in with people.',
   3, 21),

-- Module 4: Systems & Operations
  ('20000000-0000-0000-0004-000000000001', '10000000-0000-0000-0000-000000000004',
   'Project Management for Construction (Simple Version)', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'You don''t need a PhD in project management. You need a simple system that tracks what''s happening on every job.',
   0, 25),

  ('20000000-0000-0000-0004-000000000002', '10000000-0000-0000-0000-000000000004',
   'Standard Operating Procedures (SOPs) That Actually Get Used', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'An SOP nobody reads is worthless. This session shows you how to create simple, visual, one-page SOPs.',
   1, 15),

  ('20000000-0000-0000-0004-000000000003', '10000000-0000-0000-0000-000000000004',
   'Digital Job Sheets & Site Documentation', 'video',
   'https://player.vimeo.com/video/1121582501?h=ad5f727774',
   'Paper job sheets get lost, damaged, and ignored. This session sets up a digital system.',
   2, 18),

-- Module 5: Time Management
  ('20000000-0000-0000-0005-000000000001', '10000000-0000-0000-0000-000000000005',
   'The Owner''s Weekly Planning System', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Every Sunday evening, 20 minutes. That''s all it takes to plan a week that actually moves the business forward.',
   0, 16),

  ('20000000-0000-0000-0005-000000000002', '10000000-0000-0000-0000-000000000005',
   'Delegation: Getting Off the Tools (For Real)', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'You can''t grow a business while you''re on the tools 50 hours a week.',
   1, 22),

  ('20000000-0000-0000-0005-000000000003', '10000000-0000-0000-0000-000000000005',
   'Eliminating Time Wasters', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Most construction business owners lose 10+ hours per week to things that could be eliminated, automated, or delegated.',
   2, 13),

-- Module 6: Standards & Quality
  ('20000000-0000-0000-0006-000000000001', '10000000-0000-0000-0000-000000000006',
   'Quality Checklists Per Trade Stage', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'If quality depends on who''s doing the job, you don''t have quality - you have luck.',
   0, 19),

  ('20000000-0000-0000-0006-000000000002', '10000000-0000-0000-0000-000000000006',
   'Client Communication That Builds Trust', 'video',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   '80% of client complaints in construction come from poor communication, not poor workmanship.',
   1, 14)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CHECK-INS
-- ============================================

-- Ryan O'Neill (1 check-in)
INSERT INTO public.checkins (id, client_id, week_number, mood, wins, challenges, questions, admin_reply, replied_at, created_at) VALUES
  ('30000000-0000-0000-0001-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'good',
   'Started tracking job costs on the spreadsheet Marc gave me. Already spotted two jobs I was undercharging on.',
   'Still doing most of the quoting myself. Hard to find time to work on the business when I''m on roofs all day.',
   'How do I price domestic re-roofs properly? I think I''m leaving money on the table.',
   'Good start Ryan. The fact you spotted the undercharging already shows the value of tracking. For domestic re-roofs, we''ll go through the pricing calculator next session - bring your last 5 quotes.',
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days')
ON CONFLICT (id) DO NOTHING;

-- Paul Thompson (2 check-ins)
INSERT INTO public.checkins (id, client_id, week_number, mood, wins, challenges, questions, admin_reply, replied_at, created_at) VALUES
  ('30000000-0000-0000-0002-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'okay',
   'Finally sat down and worked out my actual profit on the last 3 months. It''s lower than I thought.',
   'Cash flow is brutal. Got 8k out there in unpaid invoices. Two of them over 60 days.',
   'What''s the best way to chase overdue invoices without damaging the relationship?',
   'Good work facing the numbers Paul, that''s the first step. On the invoices - we''ll build you a 3-stage follow-up process. For the two over 60 days, let''s discuss on the call.',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '26 days'),

  ('30000000-0000-0000-0002-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 'good',
   'Chased the overdue invoices using the script Marc gave me. One paid within 48 hours. Other promised end of week.',
   'Quoted 3 jobs this week but feel like I''m still guessing on price. Takes me ages to put a quote together.',
   'Can we look at a standard pricing structure for domestic rewires? I want to speed up quoting.',
   'Brilliant result on the invoices - that''s 4-8k recovered. Yes, we''ll build a quick-quote calculator for your most common jobs. Bring your top 5 job types to next session.',
   NOW() - INTERVAL '17 days', NOW() - INTERVAL '19 days')
ON CONFLICT (id) DO NOTHING;

-- Sean Murphy (5 check-ins)
INSERT INTO public.checkins (id, client_id, week_number, mood, wins, challenges, questions, admin_reply, replied_at, created_at) VALUES
  ('30000000-0000-0000-0003-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'okay',
   'Won a 35k fit-out for a dental practice. Biggest single job this year.',
   'The 35k job is great but I''m worried about cash flow during it. Materials alone will be 15k upfront.',
   'How should I structure payment stages on bigger jobs?',
   'Great win Sean. For a 35k fit-out: 30% deposit, 30% at first fix complete, 30% at second fix, 10% on snag-free handover. Never start without the deposit cleared.',
   NOW() - INTERVAL '38 days', NOW() - INTERVAL '40 days'),

  ('30000000-0000-0000-0003-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2, 'great',
   'Got the 30% deposit in before starting. That''s the first time I''ve had proper cash staging on a job. Also hired a new joiner - starts Monday.',
   'Need to figure out how to onboard the new guy properly. Don''t want him just standing around the first week.',
   'Do you have an onboarding checklist template for new team members?',
   'Perfect cash flow management. Yes - I''ll share the onboarding template. Key thing: have his first 2 weeks planned out.',
   NOW() - INTERVAL '31 days', NOW() - INTERVAL '33 days'),

  ('30000000-0000-0000-0003-000000000003', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 3, 'good',
   'New joiner settling in well. Dental practice job on track. Won another enquiry for a restaurant fit-out (quoting 28k).',
   'Running two bigger jobs at once is testing my project management. I''m the only one keeping track of everything.',
   'What''s the simplest way to track two parallel projects without it eating all my time?',
   'This is exactly why we need to get you off being the single point of tracking. Let''s set up a simple Gantt.',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '26 days'),

  ('30000000-0000-0000-0003-000000000004', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 4, 'good',
   'Project tracker set up and working. Both jobs running on time. Restaurant quote accepted - 28k job starting in 3 weeks.',
   'Cash is getting tight with materials for both jobs. The restaurant job needs a 12k materials order.',
   'Should I negotiate better terms with suppliers or get a business credit card?',
   'Both. Open a 30-day account with your top 2 suppliers - you''ve got the track record.',
   NOW() - INTERVAL '17 days', NOW() - INTERVAL '19 days'),

  ('30000000-0000-0000-0003-000000000005', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 5, 'great',
   'Opened 30-day account with main timber supplier. Restaurant job deposit in. Hired a second labourer. Team of 5 now.',
   'Need to get better at delegating. I keep checking everyone''s work instead of trusting them.',
   'How do I build trust with the team so I''m not micromanaging?',
   'Good growth Sean - from 3 to 5 is a big step. On delegation: set clear expectations upfront, inspect results (not process).',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days')
ON CONFLICT (id) DO NOTHING;

-- James McConnell (3 check-ins)
INSERT INTO public.checkins (id, client_id, week_number, mood, wins, challenges, questions, admin_reply, replied_at, created_at) VALUES
  ('30000000-0000-0000-0004-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 6, 'great',
   'Hit 42k revenue this month - best month yet. The pricing changes from Month 1 are compounding now. Won 3 new jobs through referrals alone.',
   'My site manager is good but needs more confidence making decisions without checking with me.',
   'How do I push decision-making down to the site manager without losing quality?',
   '42k is brilliant James - that''s the pricing and pipeline work paying off. For the site manager: give him a decision-making framework.',
   NOW() - INTERVAL '16 days', NOW() - INTERVAL '17 days'),

  ('30000000-0000-0000-0004-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 7, 'great',
   'Site manager handled a client issue himself for the first time. Customer was happy. I didn''t even know about it until he told me.',
   'Starting to think about a second team. Is it too early?',
   'What''s the minimum revenue I need before it makes sense to split into two teams?',
   'That''s a massive milestone. On team 2: you need consistent 55k+ months with a healthy pipeline before splitting.',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '10 days'),

  ('30000000-0000-0000-0004-000000000003', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 8, 'good',
   'Took Friday off for the first time in 3 years. Site ran fine without me. Cash flow forecast looking strong for next 6 weeks.',
   'Need to get better at the sales side - I''m good at building but not great at selling the value on initial consultations.',
   'Can we work on my sales pitch? I think I''m losing some of the bigger extension jobs at the consultation stage.',
   NULL, NULL, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- David Kelly (3 check-ins)
INSERT INTO public.checkins (id, client_id, week_number, mood, wins, challenges, questions, admin_reply, replied_at, created_at) VALUES
  ('30000000-0000-0000-0005-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 3, 'good',
   'Finished my first direct-to-client kitchen. Client loves it. Got permission for before/after photos.',
   'Marketing is the weak point. I''m great at the work but nobody knows I exist.',
   'What''s the fastest way to get visible locally without spending a fortune on ads?',
   'Great first direct job David. The photos are gold. Fastest local visibility: Google Business Profile, Facebook 3x/week, and Google reviews.',
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '19 days'),

  ('30000000-0000-0000-0005-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 4, 'great',
   'Set up Google Business Profile. Posted 3 before/after sets on Facebook. Got 2 enquiries from Facebook already. Kitchen client left a 5-star Google review.',
   'Quoting bespoke work is hard - every job is different. Takes me too long to price things up.',
   'Is there a way to standardise pricing for bespoke joinery?',
   'Two enquiries from organic Facebook in week 1 - that''s the power of good content. On bespoke pricing: build a rate card for common elements.',
   NOW() - INTERVAL '11 days', NOW() - INTERVAL '12 days'),

  ('30000000-0000-0000-0005-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 5, 'good',
   'Built the rate card for common elements - quoting is already faster. Won the 2 Facebook enquiries. First month without any subcontract work.',
   'Workshop space is getting tight with 3 jobs on. Need to think about whether to move to a bigger unit.',
   'When does it make sense to invest in a bigger workshop?',
   NULL, NULL, NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BUSINESS PLANS
-- ============================================

-- Ryan O'Neill
INSERT INTO public.business_plans (id, client_id, summary, status, created_at) VALUES
  ('40000000-0000-0000-0001-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Get Ryan off the tools and into a position to hire. Foundation first: know his numbers, fix his pricing, then build pipeline and systems to support a team of 4.',
   'active', NOW() - INTERVAL '21 days')
ON CONFLICT (id) DO NOTHING;

-- Paul Thompson
INSERT INTO public.business_plans (id, client_id, summary, status, created_at) VALUES
  ('40000000-0000-0000-0002-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Fix cash flow and pricing first, then build pipeline systems. Paul is working 60-hour weeks because he has no systems and his pricing doesn''t account for true costs.',
   'active', NOW() - INTERVAL '28 days')
ON CONFLICT (id) DO NOTHING;

-- Sean Murphy
INSERT INTO public.business_plans (id, client_id, summary, status, created_at) VALUES
  ('40000000-0000-0000-0003-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'Scale Sean from a 3-man operation to 8. He''s winning bigger contracts but needs financial controls, project management, and team systems to handle the growth.',
   'active', NOW() - INTERVAL '42 days')
ON CONFLICT (id) DO NOTHING;

-- James McConnell
INSERT INTO public.business_plans (id, client_id, summary, status, created_at) VALUES
  ('40000000-0000-0000-0004-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
   'James is the furthest along. Foundation is solid, pipeline is working, site manager is in place. Now focused on scaling: better sales process, team 2 planning, and quality systems.',
   'active', NOW() - INTERVAL '56 days')
ON CONFLICT (id) DO NOTHING;

-- David Kelly
INSERT INTO public.business_plans (id, client_id, summary, status, created_at) VALUES
  ('40000000-0000-0000-0005-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   'Help David transition from subcontracting to 100% direct-to-client work. Build his brand visibility, standardise pricing for bespoke work, and set up systems.',
   'active', NOW() - INTERVAL '35 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BUSINESS PLAN PHASES
-- ============================================

-- Ryan phases
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('50000000-0000-0001-0001-000000000000', '40000000-0000-0000-0001-000000000001',
   'Phase 1: Financial Foundation',
   'Ryan''s been undercharging on most jobs. Needs to understand true costs before anything else.',
   0),
  ('50000000-0000-0001-0002-000000000000', '40000000-0000-0000-0001-000000000001',
   'Phase 2: Pipeline & Sales',
   'Once pricing is fixed, build a proper quoting and lead tracking system. Ryan relies entirely on word of mouth.',
   1),
  ('50000000-0000-0001-0003-000000000000', '40000000-0000-0000-0001-000000000001',
   'Phase 3: Team & Systems',
   'Can''t hire until he has systems. Needs job descriptions, onboarding, and basic project management.',
   2)
ON CONFLICT (id) DO NOTHING;

-- Paul phases
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('50000000-0000-0002-0001-000000000000', '40000000-0000-0000-0002-000000000001',
   'Phase 1: Financial Foundation',
   'Cash flow is the urgent problem - 8k in unpaid invoices. Fix the leaks first, then build pricing systems.',
   0),
  ('50000000-0000-0002-0002-000000000000', '40000000-0000-0000-0002-000000000001',
   'Phase 2: Pipeline & Sales',
   'Paul doesn''t know where his work comes from. Needs to audit lead sources and build basic online presence.',
   1),
  ('50000000-0000-0002-0003-000000000000', '40000000-0000-0000-0002-000000000001',
   'Phase 3: First Hire & Systems',
   'Once cash flow is stable and pricing is solid, prep for the apprentice.',
   2)
ON CONFLICT (id) DO NOTHING;

-- Sean phases
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('50000000-0000-0003-0001-000000000000', '40000000-0000-0000-0003-000000000001',
   'Phase 1: Financial Controls',
   'Sean is winning bigger jobs but cash flow nearly caught him out. Staged payments and supplier credit are critical.',
   0),
  ('50000000-0000-0003-0002-000000000000', '40000000-0000-0000-0003-000000000001',
   'Phase 2: Pipeline & Growth',
   'Work is coming in but it''s all reactive. Needs a tender template and referral partnerships.',
   1),
  ('50000000-0000-0003-0003-000000000000', '40000000-0000-0000-0003-000000000001',
   'Phase 3: Team & Operations',
   'Growing fast - from 3 to 5 already. Needs onboarding, team meetings, and project management.',
   2),
  ('50000000-0000-0003-0004-000000000000', '40000000-0000-0000-0003-000000000001',
   'Phase 4: Quality & Standards',
   'As the team grows, quality can''t depend on Sean checking everything.',
   3)
ON CONFLICT (id) DO NOTHING;

-- James phases
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('50000000-0000-0004-0001-000000000000', '40000000-0000-0000-0004-000000000001',
   'Phase 1: Financial Foundation',
   'All done. Pricing rebuilt from scratch, cash flow process in place, job costing tracked.',
   0),
  ('50000000-0000-0004-0002-000000000000', '40000000-0000-0000-0004-000000000001',
   'Phase 2: Pipeline & Sales',
   'Referral system is generating 2-3 enquiries/week. Now needs to improve close rate on bigger extension jobs.',
   1),
  ('50000000-0000-0004-0003-000000000000', '40000000-0000-0000-0004-000000000001',
   'Phase 3: Team Development',
   'Site manager is stepping up well. Now planning for team 2. Need 55k+ consistent months.',
   2),
  ('50000000-0000-0004-0004-000000000000', '40000000-0000-0000-0004-000000000001',
   'Phase 4: Systems & Quality',
   'Project management and quality checkpoints are in. Final pieces: snag list process and completion pack.',
   3)
ON CONFLICT (id) DO NOTHING;

-- David phases
INSERT INTO public.business_plan_phases (id, plan_id, name, notes, order_index) VALUES
  ('50000000-0000-0005-0001-000000000000', '40000000-0000-0000-0005-000000000001',
   'Phase 1: Pricing & Revenue',
   'David''s been undervaluing his work as a subcontractor. Needs to price direct jobs properly.',
   0),
  ('50000000-0000-0005-0002-000000000000', '40000000-0000-0000-0005-000000000001',
   'Phase 2: Visibility & Pipeline',
   'David''s work sells itself when people see it. Priority is getting his portfolio in front of local buyers.',
   1),
  ('50000000-0000-0005-0003-000000000000', '40000000-0000-0000-0005-000000000001',
   'Phase 3: Systems & Growth',
   'As direct work ramps up, needs scheduling, material systems, and eventually a first hire.',
   2)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BUSINESS PLAN ITEMS
-- ============================================

-- Ryan Phase 1
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0001-0001-0000-000000000001', '50000000-0000-0001-0001-000000000000', 'Set up job costing spreadsheet', true, NOW() - INTERVAL '18 days', 0),
  ('60000000-0001-0001-0000-000000000002', '50000000-0000-0001-0001-000000000000', 'Calculate true hourly rate (including overheads)', false, NULL, 1),
  ('60000000-0001-0001-0000-000000000003', '50000000-0000-0001-0001-000000000000', 'Review last 10 quotes for margin analysis', false, NULL, 2),
  ('60000000-0001-0001-0000-000000000004', '50000000-0000-0001-0001-000000000000', 'Set up separate business account for tax', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- Ryan Phase 2
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0001-0002-0000-000000000001', '50000000-0000-0001-0002-000000000000', 'Create standard quote template with T&Cs', false, NULL, 0),
  ('60000000-0001-0002-0000-000000000002', '50000000-0000-0001-0002-000000000000', 'Set up lead tracking (enquiry to quote to win)', false, NULL, 1),
  ('60000000-0001-0002-0000-000000000003', '50000000-0000-0001-0002-000000000000', 'Build a referral system with existing happy clients', false, NULL, 2)
ON CONFLICT (id) DO NOTHING;

-- Ryan Phase 3
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0001-0003-0000-000000000001', '50000000-0000-0001-0003-000000000000', 'Write job description for first hire', false, NULL, 0),
  ('60000000-0001-0003-0000-000000000002', '50000000-0000-0001-0003-000000000000', 'Create onboarding checklist for new roofer', false, NULL, 1),
  ('60000000-0001-0003-0000-000000000003', '50000000-0000-0001-0003-000000000000', 'Set up project management tool (Trello/Monday)', false, NULL, 2),
  ('60000000-0001-0003-0000-000000000004', '50000000-0000-0001-0003-000000000000', 'Create job completion checklist', false, NULL, 3),
  ('60000000-0001-0003-0000-000000000005', '50000000-0000-0001-0003-000000000000', 'Build photo documentation process for every job', false, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- Paul Phase 1
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0002-0001-0000-000000000001', '50000000-0000-0002-0001-000000000000', 'Complete 3-month profit analysis', true, NOW() - INTERVAL '26 days', 0),
  ('60000000-0002-0001-0000-000000000002', '50000000-0000-0002-0001-000000000000', 'Set up invoice chasing system (7/14/30 day)', true, NOW() - INTERVAL '19 days', 1),
  ('60000000-0002-0001-0000-000000000003', '50000000-0000-0002-0001-000000000000', 'Build quick-quote calculator for top 5 jobs', false, NULL, 2),
  ('60000000-0002-0001-0000-000000000004', '50000000-0000-0002-0001-000000000000', 'Set monthly revenue and profit targets', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- Paul Phase 2
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0002-0002-0000-000000000001', '50000000-0000-0002-0002-000000000000', 'Audit current lead sources', true, NOW() - INTERVAL '22 days', 0),
  ('60000000-0002-0002-0000-000000000002', '50000000-0000-0002-0002-000000000000', 'Set up Google Business Profile properly', false, NULL, 1),
  ('60000000-0002-0002-0000-000000000003', '50000000-0000-0002-0002-000000000000', 'Create a follow-up process for lost quotes', false, NULL, 2)
ON CONFLICT (id) DO NOTHING;

-- Paul Phase 3
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0002-0003-0000-000000000001', '50000000-0000-0002-0003-000000000000', 'Define apprentice role and requirements', false, NULL, 0),
  ('60000000-0002-0003-0000-000000000002', '50000000-0000-0002-0003-000000000000', 'Register with local college for apprentice scheme', false, NULL, 1),
  ('60000000-0002-0003-0000-000000000003', '50000000-0000-0002-0003-000000000000', 'Standardise van stock list', false, NULL, 2),
  ('60000000-0002-0003-0000-000000000004', '50000000-0000-0002-0003-000000000000', 'Create job sheet template (digital)', false, NULL, 3),
  ('60000000-0002-0003-0000-000000000005', '50000000-0000-0002-0003-000000000000', 'Set up customer feedback system (post-job survey)', false, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- Sean Phase 1
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0003-0001-0000-000000000001', '50000000-0000-0003-0001-000000000000', 'Set up staged payment structure for all jobs over 10k', true, NOW() - INTERVAL '38 days', 0),
  ('60000000-0003-0001-0000-000000000002', '50000000-0000-0003-0001-000000000000', 'Open 30-day trade accounts with top 3 suppliers', true, NOW() - INTERVAL '12 days', 1),
  ('60000000-0003-0001-0000-000000000003', '50000000-0000-0003-0001-000000000000', 'Build cash flow forecast (rolling 8 weeks)', true, NOW() - INTERVAL '20 days', 2),
  ('60000000-0003-0001-0000-000000000004', '50000000-0000-0003-0001-000000000000', 'Set profit margin targets per job type', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- Sean Phase 2
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0003-0002-0000-000000000001', '50000000-0000-0003-0002-000000000000', 'Create tender response template', true, NOW() - INTERVAL '30 days', 0),
  ('60000000-0003-0002-0000-000000000002', '50000000-0000-0003-0002-000000000000', 'Build referral incentive program', false, NULL, 1),
  ('60000000-0003-0002-0000-000000000003', '50000000-0000-0003-0002-000000000000', 'Target 3 architects/designers for repeat referrals', false, NULL, 2)
ON CONFLICT (id) DO NOTHING;

-- Sean Phase 3
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0003-0003-0000-000000000001', '50000000-0000-0003-0003-000000000000', 'Write job descriptions for all roles', true, NOW() - INTERVAL '33 days', 0),
  ('60000000-0003-0003-0000-000000000002', '50000000-0000-0003-0003-000000000000', 'Create team onboarding checklist', true, NOW() - INTERVAL '30 days', 1),
  ('60000000-0003-0003-0000-000000000003', '50000000-0000-0003-0003-000000000000', 'Set up weekly 15-min team briefing', false, NULL, 2),
  ('60000000-0003-0003-0000-000000000004', '50000000-0000-0003-0003-000000000000', 'Set up project management tool', true, NOW() - INTERVAL '25 days', 3),
  ('60000000-0003-0003-0000-000000000005', '50000000-0000-0003-0003-000000000000', 'Create job handover process (site manager sign-off)', false, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- Sean Phase 4
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0003-0004-0000-000000000001', '50000000-0000-0003-0004-000000000000', 'Build quality checklist per trade type', false, NULL, 0),
  ('60000000-0003-0004-0000-000000000002', '50000000-0000-0003-0004-000000000000', 'Set up completion photo documentation', true, NOW() - INTERVAL '15 days', 1)
ON CONFLICT (id) DO NOTHING;

-- James Phase 1 (all complete)
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0004-0001-0000-000000000001', '50000000-0000-0004-0001-000000000000', 'Rebuild pricing model with 25% minimum margin', true, NOW() - INTERVAL '50 days', 0),
  ('60000000-0004-0001-0000-000000000002', '50000000-0000-0004-0001-000000000000', 'Set up weekly cash flow review process', true, NOW() - INTERVAL '45 days', 1),
  ('60000000-0004-0001-0000-000000000003', '50000000-0000-0004-0001-000000000000', 'Create job costing template (track actual vs quoted)', true, NOW() - INTERVAL '40 days', 2),
  ('60000000-0004-0001-0000-000000000004', '50000000-0000-0004-0001-000000000000', 'Open business savings account (tax reserve)', true, NOW() - INTERVAL '35 days', 3)
ON CONFLICT (id) DO NOTHING;

-- James Phase 2
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0004-0002-0000-000000000001', '50000000-0000-0004-0002-000000000000', 'Build referral system with past clients', true, NOW() - INTERVAL '30 days', 0),
  ('60000000-0004-0002-0000-000000000002', '50000000-0000-0004-0002-000000000000', 'Create consultation framework for extension enquiries', false, NULL, 1),
  ('60000000-0004-0002-0000-000000000003', '50000000-0000-0004-0002-000000000000', 'Set up automated follow-up for lost quotes', true, NOW() - INTERVAL '25 days', 2),
  ('60000000-0004-0002-0000-000000000004', '50000000-0000-0004-0002-000000000000', 'Target estate agents for referral partnerships', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- James Phase 3
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0004-0003-0000-000000000001', '50000000-0000-0004-0003-000000000000', 'Hire site manager', true, NOW() - INTERVAL '42 days', 0),
  ('60000000-0004-0003-0000-000000000002', '50000000-0000-0004-0003-000000000000', 'Create decision-making authority framework', true, NOW() - INTERVAL '15 days', 1),
  ('60000000-0004-0003-0000-000000000003', '50000000-0000-0004-0003-000000000000', 'Set up weekly team meeting (Monday AM)', true, NOW() - INTERVAL '38 days', 2),
  ('60000000-0004-0003-0000-000000000004', '50000000-0000-0004-0003-000000000000', 'Build team 2 recruitment plan', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- James Phase 4
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0004-0004-0000-000000000001', '50000000-0000-0004-0004-000000000000', 'Implement project management system', true, NOW() - INTERVAL '48 days', 0),
  ('60000000-0004-0004-0000-000000000002', '50000000-0000-0004-0004-000000000000', 'Create stage-gate quality checkpoints per job', true, NOW() - INTERVAL '12 days', 1),
  ('60000000-0004-0004-0000-000000000003', '50000000-0000-0004-0004-000000000000', 'Build snag list process with client sign-off', true, NOW() - INTERVAL '8 days', 2),
  ('60000000-0004-0004-0000-000000000004', '50000000-0000-0004-0004-000000000000', 'Photo documentation at each stage', true, NOW() - INTERVAL '45 days', 3),
  ('60000000-0004-0004-0000-000000000005', '50000000-0000-0004-0004-000000000000', 'Create client communication schedule (weekly updates)', true, NOW() - INTERVAL '20 days', 4),
  ('60000000-0004-0004-0000-000000000006', '50000000-0000-0004-0004-000000000000', 'Build completion pack template (photos, warranty, maintenance)', false, NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- David Phase 1
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0005-0001-0000-000000000001', '50000000-0000-0005-0001-000000000000', 'Price first 5 direct jobs using margin calculator', true, NOW() - INTERVAL '22 days', 0),
  ('60000000-0005-0001-0000-000000000002', '50000000-0000-0005-0001-000000000000', 'Build rate card for common joinery elements', true, NOW() - INTERVAL '5 days', 1),
  ('60000000-0005-0001-0000-000000000003', '50000000-0000-0005-0001-000000000000', 'Track monthly revenue: subcontract vs direct', true, NOW() - INTERVAL '30 days', 2),
  ('60000000-0005-0001-0000-000000000004', '50000000-0000-0005-0001-000000000000', 'Set 3-month target: 100% direct-to-client revenue', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- David Phase 2
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0005-0002-0000-000000000001', '50000000-0000-0005-0002-000000000000', 'Set up Google Business Profile', true, NOW() - INTERVAL '12 days', 0),
  ('60000000-0005-0002-0000-000000000002', '50000000-0000-0005-0002-000000000000', 'Post 3x/week on Facebook (before/after content)', true, NOW() - INTERVAL '10 days', 1),
  ('60000000-0005-0002-0000-000000000003', '50000000-0000-0005-0002-000000000000', 'Get 10 Google reviews from past clients', false, NULL, 2),
  ('60000000-0005-0002-0000-000000000004', '50000000-0000-0005-0002-000000000000', 'Build a simple portfolio page (website or Instagram)', false, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- David Phase 3
INSERT INTO public.business_plan_items (id, phase_id, title, completed, completed_at, order_index) VALUES
  ('60000000-0005-0003-0000-000000000001', '50000000-0000-0005-0003-000000000000', 'Identify first hire need (apprentice vs experienced joiner)', false, NULL, 0),
  ('60000000-0005-0003-0000-000000000002', '50000000-0000-0005-0003-000000000000', 'Create material ordering system (reduce waste)', false, NULL, 1),
  ('60000000-0005-0003-0000-000000000003', '50000000-0000-0005-0003-000000000000', 'Set up job scheduling calendar', true, NOW() - INTERVAL '28 days', 2),
  ('60000000-0005-0003-0000-000000000004', '50000000-0000-0005-0003-000000000000', 'Photograph every completed job (portfolio building)', true, NOW() - INTERVAL '19 days', 3),
  ('60000000-0005-0003-0000-000000000005', '50000000-0000-0005-0003-000000000000', 'Create client handover process (care instructions, warranty)', false, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PHASE TRAINING LINKS
-- (mapping old content IDs to new UUIDs)
-- mc-1-1 = 20000000-0000-0000-0001-000000000001
-- mc-1-2 = 20000000-0000-0000-0001-000000000002
-- mc-1-3 = 20000000-0000-0000-0001-000000000003
-- mc-1-4 = 20000000-0000-0000-0001-000000000004
-- mc-2-1 = 20000000-0000-0000-0002-000000000001
-- mc-2-2 = 20000000-0000-0000-0002-000000000002
-- mc-2-3 = 20000000-0000-0000-0002-000000000003
-- mc-2-4 = 20000000-0000-0000-0002-000000000004
-- mc-3-1 = 20000000-0000-0000-0003-000000000001
-- mc-3-2 = 20000000-0000-0000-0003-000000000002
-- mc-3-3 = 20000000-0000-0000-0003-000000000003
-- mc-3-4 = 20000000-0000-0000-0003-000000000004
-- mc-4-1 = 20000000-0000-0000-0004-000000000001
-- mc-4-2 = 20000000-0000-0000-0004-000000000002
-- mc-4-3 = 20000000-0000-0000-0004-000000000003
-- mc-5-1 = 20000000-0000-0000-0005-000000000001
-- mc-6-1 = 20000000-0000-0000-0006-000000000001
-- mc-6-2 = 20000000-0000-0000-0006-000000000002
-- ============================================

-- Ryan Phase 1: mc-1-1, mc-1-2, mc-1-3
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0001-0001-000000000000', '20000000-0000-0000-0001-000000000001'),
  ('50000000-0000-0001-0001-000000000000', '20000000-0000-0000-0001-000000000002'),
  ('50000000-0000-0001-0001-000000000000', '20000000-0000-0000-0001-000000000003')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Ryan Phase 2: mc-2-2, mc-2-3
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0001-0002-000000000000', '20000000-0000-0000-0002-000000000002'),
  ('50000000-0000-0001-0002-000000000000', '20000000-0000-0000-0002-000000000003')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Ryan Phase 3: mc-3-1, mc-3-3, mc-4-1
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0001-0003-000000000000', '20000000-0000-0000-0003-000000000001'),
  ('50000000-0000-0001-0003-000000000000', '20000000-0000-0000-0003-000000000003'),
  ('50000000-0000-0001-0003-000000000000', '20000000-0000-0000-0004-000000000001')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Paul Phase 1: mc-1-1, mc-1-2, mc-1-3, mc-1-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0002-0001-000000000000', '20000000-0000-0000-0001-000000000001'),
  ('50000000-0000-0002-0001-000000000000', '20000000-0000-0000-0001-000000000002'),
  ('50000000-0000-0002-0001-000000000000', '20000000-0000-0000-0001-000000000003'),
  ('50000000-0000-0002-0001-000000000000', '20000000-0000-0000-0001-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Paul Phase 2: mc-2-1, mc-2-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0002-0002-000000000000', '20000000-0000-0000-0002-000000000001'),
  ('50000000-0000-0002-0002-000000000000', '20000000-0000-0000-0002-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Paul Phase 3: mc-3-1, mc-3-2, mc-3-3, mc-4-3
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0002-0003-000000000000', '20000000-0000-0000-0003-000000000001'),
  ('50000000-0000-0002-0003-000000000000', '20000000-0000-0000-0003-000000000002'),
  ('50000000-0000-0002-0003-000000000000', '20000000-0000-0000-0003-000000000003'),
  ('50000000-0000-0002-0003-000000000000', '20000000-0000-0000-0004-000000000003')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Sean Phase 1: mc-1-3, mc-1-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0003-0001-000000000000', '20000000-0000-0000-0001-000000000003'),
  ('50000000-0000-0003-0001-000000000000', '20000000-0000-0000-0001-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Sean Phase 2: mc-2-2, mc-2-3
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0003-0002-000000000000', '20000000-0000-0000-0002-000000000002'),
  ('50000000-0000-0003-0002-000000000000', '20000000-0000-0000-0002-000000000003')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Sean Phase 3: mc-3-2, mc-3-3, mc-3-4, mc-4-1
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0003-0003-000000000000', '20000000-0000-0000-0003-000000000002'),
  ('50000000-0000-0003-0003-000000000000', '20000000-0000-0000-0003-000000000003'),
  ('50000000-0000-0003-0003-000000000000', '20000000-0000-0000-0003-000000000004'),
  ('50000000-0000-0003-0003-000000000000', '20000000-0000-0000-0004-000000000001')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- Sean Phase 4: mc-6-1, mc-6-2
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0003-0004-000000000000', '20000000-0000-0000-0006-000000000001'),
  ('50000000-0000-0003-0004-000000000000', '20000000-0000-0000-0006-000000000002')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- James Phase 1: mc-1-1, mc-1-2, mc-1-3, mc-1-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0004-0001-000000000000', '20000000-0000-0000-0001-000000000001'),
  ('50000000-0000-0004-0001-000000000000', '20000000-0000-0000-0001-000000000002'),
  ('50000000-0000-0004-0001-000000000000', '20000000-0000-0000-0001-000000000003'),
  ('50000000-0000-0004-0001-000000000000', '20000000-0000-0000-0001-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- James Phase 2: mc-2-2, mc-2-3, mc-2-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0004-0002-000000000000', '20000000-0000-0000-0002-000000000002'),
  ('50000000-0000-0004-0002-000000000000', '20000000-0000-0000-0002-000000000003'),
  ('50000000-0000-0004-0002-000000000000', '20000000-0000-0000-0002-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- James Phase 3: mc-3-1, mc-3-3, mc-3-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0004-0003-000000000000', '20000000-0000-0000-0003-000000000001'),
  ('50000000-0000-0004-0003-000000000000', '20000000-0000-0000-0003-000000000003'),
  ('50000000-0000-0004-0003-000000000000', '20000000-0000-0000-0003-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- James Phase 4: mc-4-1, mc-4-2, mc-4-3, mc-6-1, mc-6-2
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0004-0004-000000000000', '20000000-0000-0000-0004-000000000001'),
  ('50000000-0000-0004-0004-000000000000', '20000000-0000-0000-0004-000000000002'),
  ('50000000-0000-0004-0004-000000000000', '20000000-0000-0000-0004-000000000003'),
  ('50000000-0000-0004-0004-000000000000', '20000000-0000-0000-0006-000000000001'),
  ('50000000-0000-0004-0004-000000000000', '20000000-0000-0000-0006-000000000002')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- David Phase 1: mc-1-2, mc-1-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0005-0001-000000000000', '20000000-0000-0000-0001-000000000002'),
  ('50000000-0000-0005-0001-000000000000', '20000000-0000-0000-0001-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- David Phase 2: mc-2-1, mc-2-3, mc-2-4
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0005-0002-000000000000', '20000000-0000-0000-0002-000000000001'),
  ('50000000-0000-0005-0002-000000000000', '20000000-0000-0000-0002-000000000003'),
  ('50000000-0000-0005-0002-000000000000', '20000000-0000-0000-0002-000000000004')
ON CONFLICT (phase_id, content_id) DO NOTHING;

-- David Phase 3: mc-3-1, mc-4-1, mc-5-1
INSERT INTO public.phase_training_links (phase_id, content_id) VALUES
  ('50000000-0000-0005-0003-000000000000', '20000000-0000-0000-0003-000000000001'),
  ('50000000-0000-0005-0003-000000000000', '20000000-0000-0000-0004-000000000001'),
  ('50000000-0000-0005-0003-000000000000', '20000000-0000-0000-0005-000000000001')
ON CONFLICT (phase_id, content_id) DO NOTHING;
