export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export type UserRole =
  | 'user'
  | 'admin'
  | 'super_admin'
  | 'platform_admin'
  | 'event_manager'
  | 'auctioneer'
  | 'auction_manager'
  | 'community_manager'
  | 'checkin_staff'
  | 'partner_manager'
  | 'support_staff'
  | 'venue_partner'
  | 'participant';

export type QuestionType = 'single' | 'multiple';
export type VersionPublicationStatus = 'draft' | 'published' | 'archived';
export type QuizSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  cover_url?: string;
  role: UserRole;
  account_status?: 'active' | 'suspended';
  member_id?: string;
  phone?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  interests_json?: string;
  is_public?: number;
  privacy_settings?: {
    showCommunities?: boolean;
    showAchievements?: boolean;
    showStamps?: boolean;
    showCity?: boolean;
  };
  notification_settings?: {
    eventReminders?: boolean;
    communityUpdates?: boolean;
    achievementAlerts?: boolean;
    marketing?: boolean;
  };
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
  active_events_count?: number;
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
  total_events_hosted?: number;
  active_coupons_count?: number;
  created_at: string;
}

export interface Event {
  id: string;
  city_id: string;
  city_name?: string;
  state_name?: string;
  venue_id: string;
  venue_name?: string;
  venue_area?: string;
  venue_address?: string;
  title: string;
  category: string;
  event_date: string;
  event_time: string;
  description: string;
  seats_total: number;
  seats_booked: number;
  seats_left?: number;
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
  event_category?: string;
  event_image?: string;
  city_name?: string;
  venue_name?: string;
  venue_address?: string;
  user_id: string;
  attendee_name?: string;
  attendee_email?: string;
  attendee_member_id?: string;
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
  user_registration?: AuctionRegistration;
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
  highest_bidder_team_id?: string | null;
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

export interface PassportStamp {
  id: string;
  event_id: string;
  event_title: string;
  event_category: string;
  city_name: string;
  venue_name: string;
  stamp_icon: string;
  verified_at: string;
}

export interface AchievementMaster {
  id: string;
  badge_key: string;
  title: string;
  description: string;
  icon_name: string;
  category: string;
  points: number;
  requirement_type: string;
  requirement_threshold: number;
  is_active: number;
  is_unlocked?: number;
  unlocked_at?: string;
}

export interface MemberNotification {
  id: string;
  user_id: string;
  type: 'registration' | 'checkin' | 'achievement' | 'community' | 'reminder' | 'system';
  title: string;
  message: string;
  data_json?: string;
  is_read: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description?: string;
  reference_id?: string;
  created_at: string;
}

// Vibe Quiz CMS types
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

export interface Community {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  city_name?: string;
  state_name?: string;
  category: string;
  description: string;
  image_url: string;
  organizer_name: string;
  organizer_role: string;
  organizer_avatar: string;
  member_count: number;
  meeting_schedule: string;
  guidelines: string;
  is_member?: boolean;
  upcoming_events?: Event[];
  created_at: string;
}

export interface ContactInquiry {
  id?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  user_id?: string;
  status?: string;
  created_at?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqCategory {
  category: string;
  items: FaqItem[];
}

export type PartnerVerificationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Verified'
  | 'Rejected'
  | 'Suspended';

export interface PartnerAccount {
  id: string;
  owner_user_id: string;
  business_name: string;
  business_logo?: string;
  cover_url?: string;
  category: string;
  description?: string;
  contact_person: string;
  contact_email: string;
  contact_phone?: string;
  website?: string;
  social_links_json?: string;
  city: string;
  address?: string;
  maps_url?: string;
  capacity?: number;
  facilities_json?: string;
  operating_hours_json?: string;
  collaboration_interests_json?: string;
  verification_status: PartnerVerificationStatus;
  verification_notes?: string;
  onboarding_step: number;
  partnership_start_date?: string;
  partnership_tier?: string;
  user_partner_role?: string;
  venues_count?: number;
  collaborations_count?: number;
  pending_campaigns_count?: number;
  created_at: string;
  updated_at: string;
}

export interface VenueAvailabilitySlot {
  id: string;
  venue_id: string;
  partner_id?: string;
  date: string;
  time_slot: 'full_day' | 'morning' | 'afternoon' | 'evening';
  status: 'available' | 'unavailable' | 'proposed' | 'booked';
  event_id?: string;
  collaboration_id?: string;
  collaboration_event_name?: string;
  event_title?: string;
  notes?: string;
  created_at: string;
}

export interface PartnerCollaboration {
  id: string;
  partner_id: string;
  partner_name?: string;
  venue_id: string;
  venue_name?: string;
  venue_address?: string;
  event_id?: string;
  initiated_by: 'admin' | 'partner';
  organizer_name: string;
  event_name: string;
  event_category: string;
  description: string;
  proposed_date: string;
  proposed_time: string;
  expected_attendance: number;
  target_audience?: string;
  partner_responsibilities?: string;
  stroom_responsibilities?: string;
  marketing_plan?: string;
  commercial_arrangement?: string;
  special_requirements?: string;
  status:
    | 'Draft'
    | 'Proposal Sent'
    | 'Under Review'
    | 'Negotiation'
    | 'Approved'
    | 'Scheduled'
    | 'Live'
    | 'Completed'
    | 'Rejected'
    | 'Cancelled';
  suggested_date?: string;
  suggested_time?: string;
  operational_notes?: string;
  timeline?: { step: string; date?: string; completed: boolean }[];
  comments?: {
    id: string;
    sender_name: string;
    sender_role: string;
    message: string;
    action_type: string;
    created_at: string;
  }[];
  seats_booked?: number;
  seats_total?: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerCampaign extends Coupon {
  partner_id?: string;
  offer_category?: string;
  min_purchase?: number;
  valid_from?: string;
  eligible_event_id?: string;
  eligible_event_title?: string;
  eligible_audience?: string;
  terms_conditions?: string;
  image_url?: string;
  approval_status?: 'Draft' | 'Submitted' | 'Approved' | 'Active' | 'Paused' | 'Expired' | 'Rejected';
  verified_purchases_count?: number;
  verified_purchase_total?: number;
  partner_name?: string;
}

export interface PartnerCommunication {
  id: string;
  partner_id: string;
  event_id?: string;
  event_title?: string;
  collaboration_id?: string;
  collaboration_title?: string;
  sender_name: string;
  sender_role: 'partner' | 'coordinator' | 'admin';
  subject: string;
  message: string;
  type: 'coordinator_message' | 'announcement' | 'operational_note' | 'verification_update';
  is_read: number;
  created_at: string;
}

