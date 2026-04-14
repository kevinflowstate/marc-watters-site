-- Store the initial Business & Personal Health Checklist inside the portal
-- so clients can complete it in-product and Marc can review it per client.

CREATE TABLE IF NOT EXISTS public.client_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  questionnaire_type TEXT NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, questionnaire_type)
);

CREATE INDEX IF NOT EXISTS idx_client_questionnaires_client_id
  ON public.client_questionnaires(client_id);

CREATE INDEX IF NOT EXISTS idx_client_questionnaires_type
  ON public.client_questionnaires(questionnaire_type);

ALTER TABLE public.client_questionnaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own questionnaires" ON public.client_questionnaires;
CREATE POLICY "Clients can view own questionnaires" ON public.client_questionnaires
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clients can manage own questionnaires" ON public.client_questionnaires;
CREATE POLICY "Clients can manage own questionnaires" ON public.client_questionnaires
  FOR ALL USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage all questionnaires" ON public.client_questionnaires;
CREATE POLICY "Admins can manage all questionnaires" ON public.client_questionnaires
  FOR ALL USING (public.is_admin());

INSERT INTO public.form_config (form_type, config) VALUES
(
  'business_health_checklist',
  $${
    "title": "Business & Personal Health Checklist",
    "description": "Complete this initial questionnaire so Marc can understand where the business and life side of things currently sit.",
    "submit_label": "Submit Checklist",
    "success_title": "Checklist Submitted",
    "success_description": "Marc can now review your starting point inside the portal.",
    "questions": [
      {
        "id": "name_company_name",
        "section": "Snapshot",
        "label": "Name & Company Name",
        "placeholder": "Your name and business name",
        "type": "text",
        "required": true
      },
      {
        "id": "current_turnover",
        "label": "Current Turnover",
        "help_text": "If you don't know, just state \"unknown\".",
        "placeholder": "For example: £450,000 or unknown",
        "type": "text",
        "required": true
      },
      {
        "id": "current_profit_percent",
        "label": "Current profit % on turnover?",
        "help_text": "If you don't know, just state \"unknown\".",
        "placeholder": "For example: 18% or unknown",
        "type": "text",
        "required": true
      },
      {
        "id": "satisfied_with_figures",
        "label": "Are you satisfied with the above figures?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" }
        ]
      },
      {
        "id": "why_not_satisfied",
        "label": "If not satisfied with these figures, state why.",
        "placeholder": "Explain what feels off or where the gap is",
        "type": "textarea",
        "required": true
      },
      {
        "id": "turnover_target",
        "label": "What is your turnover target for this year?",
        "placeholder": "Your target figure",
        "type": "text",
        "required": true
      },
      {
        "id": "profit_target_percent",
        "label": "What is your profit % target this year?",
        "placeholder": "Your target profit percentage",
        "type": "text",
        "required": true
      },
      {
        "id": "hours_worked_average",
        "section": "Time & Lifestyle",
        "label": "How many hours do you work on average?",
        "help_text": "Think realistically here. Not just on the tools: include admin, pricing jobs, calls, and everything else.",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "16_or_less", "label": "16hrs or less" },
          { "value": "16_to_32", "label": "16 - 32 hrs" },
          { "value": "32_to_45", "label": "32 - 45 hrs" },
          { "value": "45_to_63", "label": "45 - 63 hrs" },
          { "value": "more_than_63", "label": "More than 63hrs" }
        ]
      },
      {
        "id": "satisfied_with_hours",
        "label": "Are you satisfied with the above?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "maybe", "label": "Maybe" }
        ]
      },
      {
        "id": "ideal_hours",
        "label": "How many hours would you like to work?",
        "placeholder": "Your ideal weekly hours",
        "type": "text",
        "required": true
      },
      {
        "id": "work_life_balance",
        "label": "Do you think you achieve a good work/life balance?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "maybe", "label": "Maybe" }
        ]
      },
      {
        "id": "quality_time_with_family",
        "label": "How much quality time do you spend with friends & family?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "a_lot", "label": "Alot" },
          { "value": "enough", "label": "Enough - this isn't really an issue for me." },
          { "value": "not_enough", "label": "Not enough" },
          { "value": "hardly_any", "label": "Hardly any" }
        ]
      },
      {
        "id": "switch_off_with_family",
        "label": "When you're with your friends & family, can you switch off and be present?",
        "help_text": "Or are you still thinking of the business?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes_fine", "label": "Yes - I'm fine with this" },
          { "value": "no_issue", "label": "No - This is an issue" },
          { "value": "maybe_unsure", "label": "Maybe - I'm not really sure" }
        ]
      },
      {
        "id": "holidays_last_year",
        "label": "How many holidays did you take last year?",
        "placeholder": "Number of holidays",
        "type": "text",
        "required": true
      },
      {
        "id": "holiday_target",
        "label": "What would you like the above figure to be?",
        "placeholder": "Your ideal number",
        "type": "text",
        "required": true
      },
      {
        "id": "what_is_stopping_you",
        "label": "What's stopping you?",
        "type": "single_choice",
        "required": true,
        "allow_other": true,
        "options": [
          { "value": "time", "label": "Time" },
          { "value": "money", "label": "Money" },
          { "value": "both", "label": "Both" },
          { "value": "not_an_issue", "label": "None - its not an issue." },
          { "value": "other", "label": "Other" }
        ]
      },
      {
        "id": "stress_level",
        "section": "Stress & Direction",
        "label": "On a scale of 1 - 10, how would you rate your stress levels throughout the year?",
        "type": "scale",
        "required": true,
        "min": 1,
        "max": 10,
        "min_label": "Low",
        "max_label": "Really high"
      },
      {
        "id": "biggest_cause_of_stress",
        "label": "What would you say is the biggest cause of your stress?",
        "placeholder": "Main source of stress",
        "type": "textarea",
        "required": true
      },
      {
        "id": "stress_management_strategies",
        "label": "Do you have any strategies to manage stress?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" }
        ]
      },
      {
        "id": "mission_and_vision",
        "label": "Do you have a clear mission and vision for your business?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "need_help", "label": "I need help with this" }
        ]
      },
      {
        "id": "accounts_tax_up_to_date",
        "section": "Business Operations",
        "label": "Are your accounts and tax affairs up to date?",
        "help_text": "VAT and tax returns complete and paid, etc.",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "tax_efficient_business",
        "label": "Is your business tax efficient?",
        "help_text": "Set up in a tax efficient way by a qualified accountant.",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "defined_team_roles",
        "label": "Do you have clearly defined roles for each team member, and is it written down and communicated?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "known_not_written", "label": "I know, but its not written down anywhere" }
        ]
      },
      {
        "id": "tracking_kpis",
        "label": "Are you tracking KPI's for yourself, your business & your team?",
        "help_text": "KPI = key performance indicators.",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "systemised_workflows",
        "label": "Are your workflows systemised & efficient?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "project_tracking",
        "label": "Do you track each project to record performance in terms of programme & profit?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "maybe", "label": "Maybe" }
        ]
      },
      {
        "id": "client_feedback_system",
        "label": "Do you have a client feedback system in place?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "active_business_promotion",
        "label": "Are you actively promoting your business with social media, advertising & networking?",
        "type": "single_choice",
        "required": true,
        "allow_other": true,
        "options": [
          { "value": "all_over_it", "label": "Yes, all over it" },
          { "value": "not_at_all", "label": "No, not at all" },
          { "value": "not_enough", "label": "Yes, but not enough" },
          { "value": "dont_need_to", "label": "I don't need to" },
          { "value": "other", "label": "Other" }
        ]
      },
      {
        "id": "electronic_filing_system",
        "label": "Do you have an efficient electronic filing system for your documents?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "quality_control_measures",
        "label": "Do you have quality control measures in place for your projects?",
        "help_text": "Do you use site reports, checklists, etc.?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "dont_know", "label": "I don't know" }
        ]
      },
      {
        "id": "lead_team_ability",
        "section": "Leadership & Team",
        "label": "How would you rate your ability to lead and manage a team?",
        "type": "scale",
        "required": true,
        "min": 1,
        "max": 10,
        "min_label": "Awful",
        "max_label": "Excellent"
      },
      {
        "id": "team_following_instruction",
        "label": "How do you rate your team with taking and following instruction?",
        "type": "scale",
        "required": true,
        "min": 1,
        "max": 10,
        "min_label": "Awfull",
        "max_label": "They are perfect"
      },
      {
        "id": "difficulty_finding_talent",
        "label": "Do you find it difficult to find talent for your business?",
        "type": "single_choice",
        "required": true,
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" },
          { "value": "maybe", "label": "Maybe" }
        ]
      },
      {
        "id": "additional_help_needed",
        "label": "Is there anything not covered above that you specifically feel you need help with?",
        "placeholder": "Anything else Marc should know before working with you",
        "type": "textarea",
        "required": true
      }
    ]
  }$$::jsonb
)
ON CONFLICT (form_type) DO UPDATE
SET
  config = EXCLUDED.config,
  updated_at = NOW();
