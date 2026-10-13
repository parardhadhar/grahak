// TypeScript types matching backend schemas

export type PlanType = 'trial' | 'pro' | 'business';
export type ContactStatus = 'new_lead' | 'active_customer' | 'returning_customer' | 'follow_up_required' | 'complaint' | 'closed' | 'spam';
export type MessageDirection = 'inbound' | 'outbound';
export type IntentType = 'new_lead' | 'returning_customer' | 'question' | 'complaint' | 'spam' | 'support' | 'purchase_intent' | 'other';
export type PriorityLevel = 'low' | 'medium' | 'high';
export type ReminderStatus = 'pending' | 'sent' | 'done' | 'cancelled';

export interface User {
  user_id: string;
  email: string;
  full_name: string;
  business_id: string;
  business_name: string;
  onboarding_completed: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  business_id: string;
  full_name: string;
  onboarding_completed: boolean;
}

export interface Business {
  id: string;
  name: string;
  category: string | null;
  owner_name: string | null;
  whatsapp_number: string | null;
  whatsapp_connected: boolean;
  plan: PlanType;
  onboarding_step: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  business_id: string;
  whatsapp_number: string;
  display_name: string | null;
  first_contacted_at: string;
  last_contacted_at: string;
  message_count: number;
  status: ContactStatus;
  priority: PriorityLevel;
  ai_summary: string | null;
  extracted_service: string | null;
  extracted_budget: number | null;
  extracted_date: string | null;
  extracted_location: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  contact_id: string;
  direction: MessageDirection;
  body: string;
  intent: IntentType | null;
  ai_processed: boolean;
  is_simulator: boolean;
  created_at: string;
}

export interface Reminder {
  id: string;
  business_id: string;
  contact_id: string;
  due_at: string;
  status: ReminderStatus;
  note: string | null;
  created_at: string;
  contact_name?: string | null;
  contact_whatsapp?: string | null;
  contact_service?: string | null;
}

export interface Note {
  id: string;
  contact_id: string;
  business_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  id: string;
  contact_id: string;
  intent: IntentType | null;
  priority: PriorityLevel | null;
  summary: string | null;
  customer_name: string | null;
  service: string | null;
  budget: number | null;
  date: string | null;
  location: string | null;
  suggested_action: string | null;
  needs_followup: boolean;
  followup_hours: number | null;
  created_at: string;
}

export interface DashboardStats {
  new_leads: number;
  active_conversations: number;
  pending_followups: number;
  complaints: number;
  total_contacts: number;
}

export interface DashboardData {
  stats: DashboardStats;
  todays_followups: Reminder[];
  recent_conversations: Contact[];
  ai_insights_summary: string | null;
  whatsapp_status: { connected: boolean; mode: string; phone_number_id: string | null };
  ai_status: { available: boolean; provider: string; model: string | null };
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  page_size: number;
}

export interface SimulateMessageResponse {
  success: boolean;
  message_id: string;
  contact_id: string;
  ai_processed: boolean;
  ai_result: Record<string, unknown> | null;
  message: string;
}

export interface SearchResponse {
  contacts: Contact[];
  total: number;
}
