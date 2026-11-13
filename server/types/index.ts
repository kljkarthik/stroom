export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export type UserRole =
  | 'user'
  | 'admin'
  | 'super_admin'
  | 'event_manager'
  | 'auctioneer'
  | 'checkin_staff'
  | 'partner_manager'
  | 'venue_partner'
  | 'participant';

export type QuestionType = 'single' | 'multiple';
export type VersionPublicationStatus = 'draft' | 'published' | 'archived';
export type QuizSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  member_id?: string;
  phone?: string;
  city?: string;
  bio?: string;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  state: string;
  is_active: number;
  launch_order: number;
  tagline?: string;
  created_at: string;
}

export interface Venue {
  id: string;
  city_id: string;
  city_name?: string;
  name: string;
  area: string;
  address: string;
  capacity: number;
  partner_type: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  is_verified: number;
  partnership_tier: string;
  created_at: string;
}

export interface Event {
  id: string;
  city_id: string;
  city_name?: string;
  venue_id: string;
  venue_name?: string;
  venue_area?: string;
  title: string;
  category: string;
  event_date: string;
  event_time: string;
  description: string;
  seats_total: number;
  seats_booked: number;
  entry_fee: string;
  status: string;
  is_flagship: number;
  image_url: string;
  created_by?: string;
  created_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  event_title?: string;
  event_date?: string;
  event_time?: string;
  city_name?: string;
  venue_name?: string;
  venue_address?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  pass_code: string;
  qr_token: string;
  seat_tier: string;
  role_type: string;
  checkin_status: 'confirmed' | 'checked_in' | 'cancelled';
  checked_in_at?: string;
  checked_in_by?: string;
  created_at: string;
}

export interface AuctionRoom {
  id: string;
  event_id: string;
  event_title?: string;
  city_name?: string;
  venue_name?: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  format_type: string;
  format_category?: 'ipl_mock' | 'all_time_mega' | 'rapid_draft' | 'custom' | string;
  status: 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'REGISTRATION_OPEN';
  current_player_id?: string;
  countdown_seconds: number;
  auto_extend_seconds: number;
  min_bid_increment: number;
  max_squad_size: number;
  min_squad_size: number;
  team_purse_cap: number;
  overseas_limit?: number;
  registration_fee?: string;
  registration_status?: 'open' | 'closed';
  bid_increment_slabs_json?: string;
  rules_json?: string;
  total_players?: number;
  sold_players?: number;
  total_teams?: number;
  event_date?: string;
  event_time?: string;
  created_at: string;
}

export interface AuctionTeam {
  id: string;
  auction_id: string;
  name: string;
  city: string;
  color: string;
  logo_url?: string;
  purse_initial: number;
  purse_remaining: number;
  squad_count: number;
  overseas_count?: number;
  captain_name?: string;
  owner_user_id?: string;
  owner_name?: string;
  owner_email?: string;
  players?: AuctionPlayer[];
  created_at: string;
}

export interface AuctionPlayer {
  id: string;
  auction_id: string;
  lot_number: number;
  name: string;
  role: 'Batter' | 'Fast Bowler' | 'Spin All-Rounder' | 'Wicketkeeper Batter' | 'Pace All-Rounder' | string;
  category?: 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper' | 'Overseas' | 'Legend' | string;
  nationality?: string;
  is_overseas?: number;
  batting_style?: string;
  bowling_style?: string;
  age?: number;
  previous_team?: string;
  base_price: number;
  current_bid: number;
  status: 'UPCOMING' | 'IN_AUCTION' | 'SOLD' | 'UNSOLD' | 'WITHDRAWN';
  highest_bidder_team_id?: string;
  highest_bidder_name?: string;
  highest_bidder_color?: string;
  photo_url: string;
  stats_json: string;
  bio: string;
  reentry_count: number;
  sold_at?: string;
  created_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  player_id: string;
  team_id: string;
  team_name?: string;
  team_color?: string;
  bidder_user_id?: string;
  bidder_name?: string;
  amount: number;
  placed_at: string;
  time_remaining?: number;
}

export interface AuctionRegistration {
  id: string;
  auction_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  role_type: 'bidder' | 'team_owner' | 'viewer';
  team_id?: string;
  team_name?: string;
  registered_at: string;
  status: string;
}

export interface AuctionFormatConfig {
  formatName: string;
  formatType: 'ipl_mock' | 'all_time_mega' | 'rapid_draft' | 'custom';
  purseCap: number;
  maxSquadSize: number;
  minSquadSize: number;
  overseasLimit: number;
  countdownSeconds: number;
  autoExtendSeconds: number;
  minBidIncrement: number;
  slabs?: { upTo: number; increment: number }[];
  allowReentry?: boolean;
  retentionAllowed?: boolean;
  rulesSummary?: string;
}

export interface Coupon {
  id: string;
  venue_id: string;
  venue_name?: string;
  code: string;
  title: string;
  description: string;
  discount_type: string;
  discount_value: string;
  max_redemptions: number;
  actual_redemptions: number;
  status: 'active' | 'paused' | 'expired';
  valid_until: string;
  created_at: string;
}

export interface PartnerProposal {
  id: string;
  venue_id?: string;
  proposer_name: string;
  proposer_email: string;
  proposer_phone: string;
  venue_name: string;
  city: string;
  event_type: string;
  proposed_date: string;
  expected_attendees: number;
  perks_offered?: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  proposal_pdf_data?: string;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  badge_key: string;
  title: string;
  description: string;
  icon_name: string;
  category: string;
  unlocked_at: string;
}

// Existing Quiz CMS Types
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
