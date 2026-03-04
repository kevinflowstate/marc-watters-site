export type UserRole = 'client' | 'admin';
export type TrafficLight = 'green' | 'amber' | 'red';
export type ModuleStatus = 'locked' | 'in_progress' | 'completed';
export type ContentType = 'video' | 'pdf' | 'text' | 'checklist';
export type CheckInMood = 'great' | 'good' | 'okay' | 'struggling';

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
  admin_reply?: string;
  replied_at?: string;
  created_at: string;
  client?: ClientProfile;
}

export interface BusinessPlanItem {
  id: string;
  category: string;
  title: string;
  completed: boolean;
  completed_at?: string;
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
  business_plan: BusinessPlanItem[];
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
