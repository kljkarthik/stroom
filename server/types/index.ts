export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type UserRole = 'user' | 'admin';
export type QuestionType = 'single' | 'multiple';
export type VersionPublicationStatus = 'draft' | 'published' | 'archived';
export type QuizSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
}

export interface QuizOption {
  id: string;
  question_id: string;
  label: string;
  stable_value: string;
  display_order: number;
  is_active: number; // 1 or 0
}

export interface QuizQuestion {
  id: string;
  quiz_version_id: string;
  question_text: string;
  description?: string;
  question_type: QuestionType;
  is_required: number; // 1 or 0
  min_selections: number;
  max_selections: number;
  display_order: number;
  is_active: number; // 1 or 0
  options?: QuizOption[];
}

export interface QuizVersion {
  id: string;
  quiz_id: string;
  version_number: number;
  publication_status: VersionPublicationStatus;
  published_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  questions?: QuizQuestion[];
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  active_version?: QuizVersion;
}

export interface QuizSession {
  id: string;
  user_id: string;
  quiz_version_id: string;
  status: QuizSessionStatus;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  skipped_at?: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  preference_key: string;
  preference_value: string;
  source: string;
  updated_at: string;
}

export interface DiscoveryItem {
  id: string;
  type: 'community' | 'event' | 'person' | 'trip';
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  category: string;
  tags: string[]; // parsed from JSON string
  location?: string;
  member_count?: number;
  date_time?: string;
  is_vibe_match?: boolean;
  match_percentage?: number;
  matching_tags?: string[];
}
