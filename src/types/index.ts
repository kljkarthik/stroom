export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type UserRole = 'user' | 'admin';
export type QuestionType = 'single' | 'multiple';
export type VersionPublicationStatus = 'draft' | 'published' | 'archived';
export type QuizSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface User {
  id: string;
  email: string;
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
  is_active: number;
}

export interface QuizQuestion {
  id: string;
  quiz_version_id: string;
  question_text: string;
  description?: string;
  question_type: QuestionType;
  is_required: number;
  min_selections: number;
  max_selections: number;
  display_order: number;
  is_active: number;
  options: QuizOption[];
}

export interface QuizVersion {
  id: string;
  quiz_id: string;
  version_number: number;
  publication_status: VersionPublicationStatus;
  published_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  questions?: QuizQuestion[];
  total_questions?: number;
  active_questions?: number;
  sessions_count?: number;
}

export interface QuizData {
  quiz: {
    id: string;
    title: string;
    description?: string;
  };
  version: {
    id: string;
    version_number: number;
    published_at?: string;
  };
  questions: QuizQuestion[];
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
  tag: string;
  label: string;
}

export interface DiscoveryItem {
  id: string;
  type: 'community' | 'event' | 'person' | 'trip';
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  category: string;
  tags: string[];
  location?: string;
  member_count?: number;
  date_time?: string;
  is_vibe_match?: boolean;
  match_percentage?: number;
  matching_tags?: string[];
}
