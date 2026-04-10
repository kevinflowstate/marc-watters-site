export type UserRole = 'client' | 'admin';
export type TrafficLight = 'green' | 'amber' | 'red';
export type ModuleStatus = 'locked' | 'in_progress' | 'completed';
export type ContentType = 'video' | 'pdf' | 'text' | 'checklist';
export type CheckInMood = 'great' | 'good' | 'okay' | 'struggling' | string;
export type QuestionnaireType = 'business_health_checklist';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface ClientProfile {
  id: string;
  user_id: string;
  phone?: string;
  business_name?: string;
  business_type?: string;
  goals?: string;
  start_date: string;
  status: TrafficLight;
  notes?: string;
  last_login?: string;
  last_checkin?: string;
  created_at: string;
  user?: User;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  order_index: number;
  thumbnail_url?: string;
  is_published: boolean;
  created_at: string;
  content?: ModuleContent[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'sheet' | 'doc' | 'image' | 'other';
  size?: string;
}

export interface ModuleContent {
  id: string;
  module_id: string;
  title: string;
  content_type: ContentType;
  content_url?: string;
  content_text?: string;
  order_index: number;
  duration_minutes?: number;
  attachments?: Attachment[];
  created_at: string;
}

export interface ClientModule {
  id: string;
  client_id: string;
  module_id: string;
  status: ModuleStatus;
  started_at?: string;
  completed_at?: string;
  module?: TrainingModule;
}

export interface ContentProgress {
  id: string;
  client_id: string;
  content_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface CheckIn {
  id: string;
  client_id: string;
  week_number: number;
  mood: CheckInMood;
  wins?: string;
  challenges?: string;
  questions?: string;
  responses?: Record<string, string>;
  admin_reply?: string;
  replied_at?: string;
  created_at: string;
  client?: ClientProfile;
}

export interface ClientQuestionnaireSubmission {
  id: string;
  client_id: string;
  questionnaire_type: QuestionnaireType;
  responses: Record<string, string>;
  submitted_at: string;
  updated_at: string;
}

export interface BusinessPlanItem {
  id: string;
  category: string;
  title: string;
  completed: boolean;
  completed_at?: string;
}

export interface BusinessPlanPhase {
  id: string;
  name: string;
  notes: string;
  order_index: number;
  items: BusinessPlanItem[];
  linked_trainings: string[];
}

export interface BusinessPlan {
  id: string;
  client_id: string;
  summary: string;
  status: 'active' | 'completed';
  created_at: string;
  completed_at?: string;
  phases: BusinessPlanPhase[];
  discovery_answers?: Record<string, string>;
  pdf_url?: string;
}

export interface DemoClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  business_name: string;
  business_type: string;
  goals: string;
  start_date: string;
  status: TrafficLight;
  current_week: number;
  last_login: string;
  last_checkin: string;
  checkins: CheckIn[];
  business_plan: BusinessPlan[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  created_at: string;
}

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time: string;
  recurrence: RecurrenceType;
  recurrence_day?: number;
  link?: string;
  link_label?: string;
  is_active: boolean;
  created_at: string;
}

// Form config types
export type FormFieldType = 'textarea' | 'text' | 'single_choice' | 'scale';

export interface FormOption {
  value: string;
  label: string;
}

export interface FormQuestion {
  id: string;
  label: string;
  placeholder?: string;
  help_text?: string;
  section?: string;
  type: FormFieldType;
  required?: boolean;
  options?: FormOption[];
  allow_other?: boolean;
  min?: number;
  max?: number;
  min_label?: string;
  max_label?: string;
}

export interface MoodOption {
  value: string;
  label: string;
  color: string;
}

export interface CheckinFormConfig {
  checkin_day: string;
  mood_enabled: boolean;
  mood_options: MoodOption[];
  questions: FormQuestion[];
}

export interface BusinessPlanFormConfig {
  questions: FormQuestion[];
}

export interface QuestionnaireFormConfig {
  title: string;
  description?: string;
  submit_label?: string;
  success_title?: string;
  success_description?: string;
  questions: FormQuestion[];
}
