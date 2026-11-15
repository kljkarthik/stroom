import { QuizData, QuizSession, User, DiscoveryItem, UserPreference, QuizVersion } from '../types';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('stroom_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message?.includes('fetch')) {
      throw new ApiError('Backend server is temporarily unreachable. Please ensure the STROOM backend server is running on http://localhost:5000.', 503);
    }
    throw new ApiError(err.message || 'Network request failed', 500);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `HTTP error ${res.status}`, res.status, data);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(credentials: { email: string; password: string }) {
    return request<{ message: string; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async register(details: { email: string; password: string; full_name: string; avatar_url?: string }) {
    return request<{ message: string; token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    });
  },

  async getMe() {
    return request<{ user: User; preferences: any[] }>('/auth/me');
  },

  async logout() {
    return request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' });
  },

  async resetDemo(status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED') {
    return request<{ message: string; user: User }>('/auth/reset-demo', {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  // Onboarding
  async getActiveQuiz() {
    return request<QuizData>('/onboarding/quiz');
  },

  async createOrResumeSession() {
    return request<{
      session: QuizSession;
      quiz: QuizData;
      responses: Record<string, string[]>;
      resumed: boolean;
    }>('/onboarding/sessions', {
      method: 'POST',
    });
  },

  async getSession(id: string) {
    return request<{
      session: QuizSession;
      quiz: QuizData;
      responses: Record<string, string[]>;
    }>(`/onboarding/sessions/${id}`);
  },

  async saveResponse(sessionId: string, questionId: string, optionIds: string[]) {
    return request<{
      message: string;
      responses: Record<string, string[]>;
    }>(`/onboarding/sessions/${sessionId}/responses`, {
      method: 'PUT',
      body: JSON.stringify({ question_id: questionId, option_ids: optionIds }),
    });
  },

  async completeSession(sessionId: string) {
    return request<{
      message: string;
      status: 'COMPLETED';
      preferences: string[];
      user: User;
    }>(`/onboarding/sessions/${sessionId}/complete`, {
      method: 'POST',
    });
  },

  async skipSession(sessionId: string) {
    return request<{
      message: string;
      status: 'SKIPPED';
      user: User;
    }>(`/onboarding/sessions/${sessionId}/skip`, {
      method: 'POST',
    });
  },

  async restartQuiz() {
    return request<{
      message: string;
      session: QuizSession;
      quiz: QuizData;
      responses: Record<string, string[]>;
    }>('/onboarding/restart', {
      method: 'POST',
    });
  },

  // User Preferences
  async getUserPreferences() {
    return request<{
      user_id: string;
      tags: string[];
      preferences: UserPreference[];
      onboarding_status: string;
    }>('/users/me/preferences');
  },

  async updateUserPreferences(tags: string[]) {
    return request<{
      message: string;
      tags: string[];
    }>('/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  },

  // Discovery Feed
  async getDiscoveryFeed(params: { type?: string; search?: string } = {}) {
    const searchParams = new URLSearchParams();
    if (params.type && params.type !== 'all') searchParams.append('type', params.type);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return request<{
      items: DiscoveryItem[];
      total: number;
      is_personalized: boolean;
      user_onboarding_status: string | null;
      matched_tag_count: number;
    }>(`/discovery${qs ? '?' + qs : ''}`);
  },

  // Admin CMS
  async getAdminOverview() {
    return request<{
      stats: {
        total_sessions: number;
        completed_sessions: number;
        skipped_sessions: number;
        in_progress_sessions: number;
        total_users: number;
        completion_rate: number;
        skip_rate: number;
      };
      published_version: any;
      draft_version: any;
    }>('/admin/overview');
  },

  async getAdminQuizzes() {
    return request<{ quizzes: any[] }>('/admin/quizzes');
  },

  async getAdminVersion(versionId: string) {
    return request<{ version: QuizVersion }>(`/admin/versions/${versionId}`);
  },

  async createDraft(quizId: string) {
    return request<{
      message: string;
      draft_version_id: string;
      version_number: number;
    }>(`/admin/quizzes/${quizId}/create-draft`, {
      method: 'POST',
    });
  },

  async createQuestion(data: any) {
    return request<{ message: string; question: any }>('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateQuestion(questionId: string, data: any) {
    return request<{ message: string; question: any }>(`/admin/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteQuestion(questionId: string) {
    return request<{ message: string }>(`/admin/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  async reorderQuestions(question_ids: string[]) {
    return request<{ message: string }>('/admin/questions/reorder', {
      method: 'POST',
      body: JSON.stringify({ question_ids }),
    });
  },

  async addOption(questionId: string, data: { label: string; stable_value?: string }) {
    return request<{ message: string; option: any }>(`/admin/questions/${questionId}/options`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateOption(optionId: string, data: any) {
    return request<{ message: string; option: any }>(`/admin/options/${optionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteOption(optionId: string) {
    return request<{ message: string }>(`/admin/options/${optionId}`, {
      method: 'DELETE',
    });
  },

  async publishVersion(versionId: string) {
    return request<{ message: string; version: QuizVersion }>(`/admin/versions/${versionId}/publish`, {
      method: 'POST',
    });
  },

  // STROOM Cities & Events
  async getCities() {
    return request<{ cities: any[] }>('/events/cities');
  },

  async getEvents(params: {
    city_id?: string;
    category?: string;
    status?: string;
    search?: string;
    price_filter?: string;
    timeframe?: string;
  } = {}) {
    const q = new URLSearchParams();
    if (params.city_id) q.set('city_id', params.city_id);
    if (params.category) q.set('category', params.category);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    if (params.price_filter) q.set('price_filter', params.price_filter);
    if (params.timeframe) q.set('timeframe', params.timeframe);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<{ events: any[] }>(`/events${queryStr}`);
  },

  async getEvent(id: string) {
    return request<{ event: any; userRegistration: any }>(`/events/${id}`);
  },

  async registerForEvent(eventId: string, details: { role_type?: string; seat_tier?: string; user_id?: string; attendee_name?: string; email?: string; phone?: string; role?: string }) {
    return request<{ success: boolean; existing: boolean; pass: any; registration: any; error?: string }>(`/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify(details),
    });
  },

  async createEvent(data: any) {
    return request<{ message: string; event: any }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // STROOM Independent Auction Engine
  async getAuctions(params: { status?: string; format?: string; city?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.format) q.set('format', params.format);
    if (params.city) q.set('city', params.city);
    if (params.search) q.set('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<{ auctions: any[]; rooms: any[] }>(`/auctions${queryStr}`);
  },

  async getAuction(id: string) {
    return request<{
      auction: any;
      teams: any[];
      players: any[];
      currentPlayer: any;
      currentLot: any;
      recentBids: any[];
      rulesConfig?: any;
      userRegistration?: any;
      userTeam?: any;
      activeListeners?: number;
    }>(`/auctions/${id}`);
  },

  async getMyAuctionRegistrations() {
    return request<{ success: boolean; registrations: any[] }>('/auctions/my/registrations');
  },

  async registerForAuction(auctionId: string, data: { role_type?: 'bidder' | 'team_owner' | 'viewer'; team_id?: string } = {}) {
    return request<{ success: boolean; message: string; registration: any }>(`/auctions/${auctionId}/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async placeAuctionBid(auctionId: string, data: { team_id: string; player_id: string; increment?: number; custom_amount?: number; amount?: number }) {
    return request<{ success: boolean; message: string; result: any; currentBid: number; highestBidderTeamId: string }>(`/auctions/${auctionId}/bid`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async gavelStrike(auctionId: string, data: { player_id?: string; action: 'SOLD' | 'UNSOLD' }) {
    return request<{ success: boolean; message: string; result: any; action: string; player: any }>(`/auctions/${auctionId}/gavel`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async nextAuctionLot(auctionId: string, next_player_id?: string) {
    return request<{ completed: boolean; player?: any }>(`/auctions/${auctionId}/next-lot`, {
      method: 'POST',
      body: JSON.stringify({ next_player_id }),
    });
  },

  async skipAuctionLot(auctionId: string, player_id?: string) {
    return request<{ success: boolean; message: string }>(`/auctions/${auctionId}/skip-lot`, {
      method: 'POST',
      body: JSON.stringify({ player_id }),
    });
  },

  async reopenAuctionLot(auctionId: string, player_id: string) {
    return request<{ success: boolean; message: string; player: any }>(`/auctions/${auctionId}/reopen-lot`, {
      method: 'POST',
      body: JSON.stringify({ player_id }),
    });
  },

  async selectAuctionLot(auctionId: string, player_id: string) {
    return request<{ success: boolean; message: string; player: any }>(`/auctions/${auctionId}/select-lot`, {
      method: 'POST',
      body: JSON.stringify({ player_id }),
    });
  },

  async setAuctionStatus(auctionId: string, status: 'LIVE' | 'PAUSED' | 'COMPLETED' | 'SCHEDULED') {
    return request<{ message: string }>(`/auctions/${auctionId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async getAuctionReport(auctionId: string) {
    return request<{ report: any }>(`/auctions/${auctionId}/report`);
  },

  async getAuctionResults(auctionId: string) {
    return request<{ report: any }>(`/auctions/${auctionId}/results`);
  },

  async createAuction(data: any) {
    return request<{ success: boolean; auction: any }>('/auctions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAuction(auctionId: string, data: any) {
    return request<{ success: boolean; auction: any }>(`/auctions/${auctionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Team Management
  async createAuctionTeam(auctionId: string, data: any) {
    return request<{ success: boolean; team: any }>(`/auctions/${auctionId}/teams`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAuctionTeam(auctionId: string, teamId: string, data: any) {
    return request<{ success: boolean; team: any }>(`/auctions/${auctionId}/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAuctionTeam(auctionId: string, teamId: string) {
    return request<{ success: boolean; message: string }>(`/auctions/${auctionId}/teams/${teamId}`, {
      method: 'DELETE',
    });
  },

  // Player Management
  async createAuctionPlayer(auctionId: string, data: any) {
    return request<{ success: boolean; player: any }>(`/auctions/${auctionId}/players`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAuctionPlayer(auctionId: string, playerId: string, data: any) {
    return request<{ success: boolean; player: any }>(`/auctions/${auctionId}/players/${playerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAuctionPlayer(auctionId: string, playerId: string) {
    return request<{ success: boolean; message: string }>(`/auctions/${auctionId}/players/${playerId}`, {
      method: 'DELETE',
    });
  },

  async batchImportAuctionPlayers(auctionId: string, players: any[]) {
    return request<{ success: boolean; message: string }>(`/auctions/${auctionId}/players/batch`, {
      method: 'POST',
      body: JSON.stringify({ players }),
    });
  },

  // STROOM Digital Passes & Check-in
  async getMyPasses() {
    return request<{ passes: any[] }>('/passes/my-passes');
  },

  async verifyPass(token: string) {
    return request<{ valid: boolean; pass: any; isCheckedIn: boolean }>(`/passes/verify/${token}`);
  },

  async checkInPass(data: { qr_token?: string; pass_code?: string }) {
    return request<{ message: string; passId: string; passCode: string }>('/passes/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // STROOM Partner Portal & Venues
  async getPartnerVenues() {
    return request<{ venues: any[] }>('/partners/venues');
  },

  async getPartnerStats(venueId: string) {
    return request<{
      venue: any;
      aggregate: any;
      events: any[];
      coupons: any[];
    }>(`/partners/stats/${venueId}`);
  },

  async submitProposal(data: any) {
    return request<{ message: string; proposalId: string }>('/partners/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getProposals() {
    return request<{ proposals: any[] }>('/partners/proposals');
  },

  async createCoupon(data: any) {
    return request<{ message: string; couponId: string }>('/partners/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async redeemCoupon(data: { coupon_code: string; venue_id?: string; pass_code?: string; order_amount?: number; notes?: string }) {
    return request<{ message: string; result: any }>('/partners/coupons/redeem', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyCoupon(data: { coupon_code: string; venue_id?: string; pass_code?: string; order_amount?: number }) {
    return request<{ valid: boolean; coupon: any }>('/partners/coupons/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // PHASE 5: Business Partner Ecosystem APIs
  async getMyPartnerAccounts() {
    return request<{ success: boolean; accounts: any[] }>('/partners/my-accounts');
  },

  async savePartnerOnboarding(data: any) {
    return request<{ success: boolean; partner: any; message: string }>('/partners/onboarding/save', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async submitPartnerOnboarding(partnerId: string) {
    return request<{ success: boolean; partner: any; message: string }>('/partners/onboarding/submit', {
      method: 'POST',
      body: JSON.stringify({ partner_id: partnerId }),
    });
  },

  async updatePartnerProfile(partnerId: string, data: any) {
    return request<{ success: boolean; partner: any; message: string }>(`/partners/accounts/${partnerId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getPartnerDashboard(partnerId: string) {
    return request<{
      success: boolean;
      partner: any;
      partnerRole: string;
      venues: any[];
      summary: any;
      recentEvents: any[];
      collaborations: any[];
      recentCampaigns: any[];
      recentRedemptions: any[];
      communications: any[];
      unreadCommsCount: number;
    }>(`/partners/accounts/${partnerId}/dashboard`);
  },

  async getPartnerAccountVenues(partnerId: string) {
    return request<{ success: boolean; venues: any[] }>(`/partners/accounts/${partnerId}/venues`);
  },

  async createPartnerVenue(partnerId: string, data: any) {
    return request<{ success: boolean; venue: any }>(`/partners/accounts/${partnerId}/venues`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePartnerVenue(partnerId: string, venueId: string, data: any) {
    return request<{ success: boolean; venue: any }>(`/partners/accounts/${partnerId}/venues/${venueId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getVenueAvailability(partnerId: string, venueId: string) {
    return request<{ success: boolean; availability: any[] }>(`/partners/accounts/${partnerId}/venues/${venueId}/availability`);
  },

  async setVenueAvailability(partnerId: string, venueId: string, data: { date: string; time_slot: string; status: string; notes?: string }) {
    return request<{ success: boolean; availability: any[] }>(`/partners/accounts/${partnerId}/venues/${venueId}/availability`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPartnerCollaborations(partnerId: string) {
    return request<{ success: boolean; collaborations: any[] }>(`/partners/accounts/${partnerId}/collaborations`);
  },

  async respondToCollaboration(
    partnerId: string,
    collabId: string,
    data: { action: 'accept' | 'reject' | 'request_changes' | 'suggest_date' | 'comment'; message?: string; suggested_date?: string; suggested_time?: string }
  ) {
    return request<{ success: boolean; collaboration: any }>(`/partners/accounts/${partnerId}/collaborations/${collabId}/respond`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPartnerHostedEvents(partnerId: string) {
    return request<{ success: boolean; events: any[] }>(`/partners/accounts/${partnerId}/events`);
  },

  async updatePartnerEventOperations(partnerId: string, eventId: string, operationalNotes: string) {
    return request<{ success: boolean; message: string }>(`/partners/accounts/${partnerId}/events/${eventId}/operations`, {
      method: 'PATCH',
      body: JSON.stringify({ partner_operational_notes: operationalNotes }),
    });
  },

  async getPartnerCampaigns(partnerId: string) {
    return request<{ success: boolean; campaigns: any[] }>(`/partners/accounts/${partnerId}/campaigns`);
  },

  async createPartnerCampaign(partnerId: string, data: any) {
    return request<{ success: boolean; campaign: any; message: string }>(`/partners/accounts/${partnerId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePartnerCampaign(partnerId: string, campaignId: string, data: any) {
    return request<{ success: boolean; campaign: any }>(`/partners/accounts/${partnerId}/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getPartnerRedemptions(partnerId: string) {
    return request<{ success: boolean; redemptions: any[] }>(`/partners/accounts/${partnerId}/redemptions`);
  },

  async getPartnerAnalytics(partnerId: string, params: { range?: string; from?: string; to?: string; venueId?: string } = {}) {
    const q = new URLSearchParams();
    if (params.range) q.set('range', params.range);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.venueId) q.set('venueId', params.venueId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      success: boolean;
      summary: any;
      eventsPerformance: any[];
      campaignsPerformance: any[];
      checkinsByDate: any[];
      redemptionsHistory: any[];
    }>(`/partners/accounts/${partnerId}/analytics${qs}`);
  },

  async exportPartnerReport(partnerId: string, params: { type?: string; range?: string; from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.range) q.set('range', params.range);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ success: boolean; filename: string; csv: string }>(`/partners/accounts/${partnerId}/reports/export${qs}`);
  },

  async getPartnerCommunications(partnerId: string) {
    return request<{ success: boolean; communications: any[] }>(`/partners/accounts/${partnerId}/communications`);
  },

  async sendPartnerCommunication(partnerId: string, data: { subject: string; message: string; event_id?: string; collaboration_id?: string; type?: string }) {
    return request<{ success: boolean; communication: any }>(`/partners/accounts/${partnerId}/communications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async markPartnerCommunicationRead(partnerId: string, msgId: string) {
    return request<{ success: boolean }>(`/partners/accounts/${partnerId}/communications/${msgId}/read`, {
      method: 'PATCH',
    });
  },

  // Admin Partner Management APIs
  async getAdminPartnersOverview(params: { status?: string; city?: string; category?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.city) q.set('city', params.city);
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      success: boolean;
      partners: any[];
      pendingCampaigns: any[];
      collaborations: any[];
      publicProposals: any[];
    }>(`/partners/admin/overview${qs}`);
  },

  async getAdminPartnerDetails(partnerId: string) {
    return request<{
      success: boolean;
      partner: any;
      venues: any[];
      collaborations: any[];
      campaigns: any[];
      analytics: any;
      auditLogs: any[];
    }>(`/partners/admin/${partnerId}/details`);
  },

  async verifyAdminPartner(partnerId: string, data: { status: string; notes?: string; partnership_tier?: string }) {
    return request<{ success: boolean; partner: any }>(`/partners/admin/${partnerId}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createAdminCollaboration(data: any) {
    return request<{ success: boolean; collaboration: any }>('/partners/admin/collaborations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async confirmAdminCollaboration(collabId: string) {
    return request<{ success: boolean; collaboration: any; eventId: string }>(`/partners/admin/collaborations/${collabId}/confirm`, {
      method: 'POST',
    });
  },

  async reviewAdminCampaign(campaignId: string, data: { decision: 'approve' | 'reject' | 'pause'; notes?: string }) {
    return request<{ success: boolean; campaign: any }>(`/partners/admin/campaigns/${campaignId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // STROOM User Profile & Member Management (Phase 4 Member Ecosystem)
  async getUserProfile() {
    return request<{
      success: boolean;
      user: any;
      stats: any;
      achievements: any[];
      passportStamps: any[];
      upcomingEvents: any[];
      eventHistory: any[];
      joinedCommunities: any[];
      activityTimeline: any[];
    }>('/users/me/profile');
  },

  async updateUserProfile(data: {
    full_name?: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    city?: string;
    bio?: string;
    avatar_url?: string;
    cover_url?: string;
    interests?: string[];
    is_public?: boolean;
    privacy_settings?: any;
    notification_settings?: any;
  }) {
    return request<{ success: boolean; message: string; user: any; completionPercentage: number }>('/users/me/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: { current_password: string; new_password: string }) {
    return request<{ success: boolean; message: string }>('/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getPassport() {
    return request<{ success: boolean; passport: any }>('/users/me/passport');
  },

  async getNotifications() {
    return request<{ success: boolean; notifications: any[]; unreadCount: number }>('/users/me/notifications');
  },

  async markNotificationRead(id: string) {
    return request<{ success: boolean; message: string }>(`/users/me/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsRead() {
    return request<{ success: boolean; message: string }>('/users/me/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  async getPublicProfile(memberIdOrId: string) {
    return request<{
      success?: boolean;
      isPrivate?: boolean;
      profile?: any;
      displayName?: string;
      memberId?: string;
      message?: string;
    }>(`/users/public/${memberIdOrId}`);
  },

  async getAdminMembers(params: { search?: string; city?: string; role?: string } = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.city) q.set('city', params.city);
    if (params.role) q.set('role', params.role);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<{ members: any[] }>(`/users/admin/members${queryStr}`);
  },

  async getAdminMemberDetails(id: string) {
    return request<{
      success: boolean;
      member: any;
      registrations: any[];
      stamps: any[];
      achievements: any[];
      activity: any[];
    }>(`/users/admin/members/${id}/details`);
  },

  async awardAdminAchievement(id: string, badge_key: string) {
    return request<{ success: boolean; message: string }>(`/users/admin/members/${id}/award-achievement`, {
      method: 'POST',
      body: JSON.stringify({ badge_key }),
    });
  },

  async updateMemberRole(userId: string, role: string) {
    return request<{ message: string; memberId: string; newRole: string }>(`/users/admin/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async cancelPass(passId: string) {
    return request<{ success: boolean; message: string }>(`/passes/${passId}/cancel`, {
      method: 'POST',
    });
  },

  // STROOM Communities
  async getCommunities(params: { city_id?: string; category?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.city_id) q.set('city_id', params.city_id);
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<{ communities: any[] }>(`/communities${queryStr}`);
  },

  async getCommunity(id: string) {
    return request<{ community: any }>(`/communities/${id}`);
  },

  async joinCommunity(id: string) {
    return request<{ message: string; is_member: boolean; member_count: number }>(`/communities/${id}/join`, {
      method: 'POST',
    });
  },

  async leaveCommunity(id: string) {
    return request<{ message: string; is_member: boolean; member_count: number }>(`/communities/${id}/leave`, {
      method: 'POST',
    });
  },

  // STROOM Contact & FAQs
  async submitContactInquiry(data: { name: string; email: string; subject: string; message: string }) {
    return request<{ success: boolean; message: string; inquiryId: string }>('/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getFaqs() {
    return request<{ faqs: { category: string; items: { id: string; question: string; answer: string }[] }[] }>('/contact/faqs');
  },

  // PHASE 6: Centralized Admin Control Center APIs
  async getAdminPermissions() {
    return request<{ success: boolean; role: string; permissions: string[]; allowedSections: string[]; user: any }>('/admin/me/permissions');
  },

  async adminGlobalSearch(q: string) {
    return request<{ success: boolean; results: any }>(`/admin/global-search?q=${encodeURIComponent(q)}`);
  },

  async getAdminDashboardOverview() {
    return request<{ success: boolean; metrics: any; activity: any }>('/admin/dashboard-overview');
  },

  async getAdminOverviewAnalytics(params: { range?: string; from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.range) q.set('range', params.range);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return request<{
      success: boolean;
      period: { range: string; fromDate: string; toDate: string; label: string; groupByMonth: boolean };
      filteredSummary: {
        eventsCreated: number;
        newMembers: number;
        registrations: number;
        verifiedCheckins: number;
        activePartners: number;
      };
      charts: {
        eventCategoryDistribution: { key: string; name: string; count: number; percentage: number }[];
        eventCityDistribution: { id: string; name: string; count: number; percentage: number }[];
        registrationStatusDistribution: { key: string; name: string; count: number; percentage: number }[];
        partnerStatusDistribution: { name: string; count: number; percentage: number }[];
        eventGrowth: { period: string; count: number }[];
        memberGrowth: { period: string; count: number }[];
        cityEventComparison: { city: string; events: number; registrations: number; checkins: number }[];
        attendanceComparison: {
          id: string;
          eventTitle: string;
          shortTitle: string;
          cityName: string;
          registrations: number;
          checkedIn: number;
          pendingArrival: number;
        }[];
        partnerPerformance: {
          id: string;
          partnerName: string;
          shortName: string;
          city: string;
          status: string;
          venuesCount: number;
          hostedEvents: number;
          couponRedemptions: number;
        }[];
        activityTimeline: {
          period: string;
          newMembers: number;
          registrations: number;
          checkins: number;
          eventsPublished: number;
        }[];
      };
    }>(`/admin/overview-analytics${q.toString() ? '?' + q.toString() : ''}`);
  },

  // Events & Cities Admin
  async getAdminEvents(params: { status?: string; city_id?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.city_id) q.set('city_id', params.city_id);
    if (params.search) q.set('search', params.search);
    return request<{ success: boolean; events: any[] }>(`/admin/events${q.toString() ? '?' + q.toString() : ''}`);
  },

  async createAdminEvent(data: any) {
    return request<{ success: boolean; event: any }>('/admin/events', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateAdminEvent(id: string, data: any) {
    return request<{ success: boolean; event: any }>(`/admin/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async duplicateAdminEvent(id: string) {
    return request<{ success: boolean; event: any }>(`/admin/events/${id}/duplicate`, { method: 'POST' });
  },

  async getAdminEventDependencies(id: string) {
    return request<{
      success: boolean;
      event: any;
      paymentsAuthorized: boolean;
      canDeletePermanently: boolean;
      dependencies: {
        registrationsTotal: number;
        activeRegistrations: number;
        checkedInCount: number;
        attendanceStamps: number;
        paymentsCount: number | null;
        auctionsCount: number;
        collaborationsCount: number;
        venueBookingsCount: number;
        hasProtectedDependencies: boolean;
      };
    }>(`/admin/events/${id}/dependencies`);
  },

  async deleteAdminEvent(id: string, opts: { mode?: 'archive' | 'cancel' | 'delete'; forcePermanent?: boolean; reason?: string } | boolean = {}) {
    const options = typeof opts === 'boolean' ? { forcePermanent: opts } : opts;
    const q = new URLSearchParams();
    if (options.mode) q.set('mode', options.mode);
    if (options.forcePermanent) q.set('forcePermanent', 'true');
    if (options.reason) q.set('reason', options.reason);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{
      success: boolean;
      action: 'archived' | 'cancelled' | 'deleted';
      idempotent?: boolean;
      message: string;
      event?: any;
      deletedEventId?: string;
      dependencies?: Record<string, number>;
    }>(`/admin/events/${id}${qs}`, { method: 'DELETE' });
  },

  async getAdminRegistrations(params: { event_id?: string; status?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.event_id) q.set('event_id', params.event_id);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    return request<{ success: boolean; registrations: any[] }>(`/admin/registrations${q.toString() ? '?' + q.toString() : ''}`);
  },

  async updateAdminRegistration(id: string, data: { checkin_status?: string; seat_tier?: string }) {
    return request<{ success: boolean; registration: any }>(`/admin/registrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async getAdminCities() {
    return request<{ success: boolean; cities: any[] }>('/admin/cities');
  },

  async createAdminCity(data: any) {
    return request<{ success: boolean; city: any }>('/admin/cities', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateAdminCity(id: string, data: any) {
    return request<{ success: boolean; city: any }>(`/admin/cities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  // Members & Roles Granular Admin
  async getAdminMembersDirectory(params: { search?: string; city?: string; role?: string; status?: string; sort?: string; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.city) q.set('city', params.city);
    if (params.role) q.set('role', params.role);
    if (params.status) q.set('status', params.status);
    if (params.sort) q.set('sort', params.sort);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return request<{ success: boolean; members: any[]; total: number; page: number; limit: number }>(
      `/admin/members-directory${q.toString() ? '?' + q.toString() : ''}`
    );
  },

  async updateAdminMemberStatus(id: string, account_status: 'active' | 'suspended', reason?: string) {
    return request<{ success: boolean; memberId: string; account_status: string }>(`/admin/members/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ account_status, reason }),
    });
  },

  async assignAdminMemberRole(id: string, role: string) {
    return request<{ success: boolean; memberId: string; role: string }>(`/admin/members/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async getAdminRolesMatrix() {
    return request<{ success: boolean; matrix: Record<string, string[]> }>('/admin/roles-matrix');
  },

  // Communities Admin
  async getAdminCommunities() {
    return request<{ success: boolean; communities: any[] }>('/admin/communities');
  },

  async createAdminCommunity(data: any) {
    return request<{ success: boolean; community: any }>('/admin/communities', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateAdminCommunity(id: string, data: any) {
    return request<{ success: boolean; community: any }>(`/admin/communities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async getAdminCommunityMembers(id: string) {
    return request<{ success: boolean; members: any[] }>(`/admin/communities/${id}/members`);
  },

  // Auctions Admin
  async getAdminAuctions() {
    return request<{ success: boolean; auctions: any[]; recentBids: any[] }>('/admin/auctions');
  },

  async createAdminAuction(data: any) {
    return request<{ success: boolean; auction: any }>('/admin/auctions', { method: 'POST', body: JSON.stringify(data) });
  },

  // Venues Admin
  async getAdminVenues() {
    return request<{ success: boolean; venues: any[] }>('/admin/venues');
  },

  async verifyAdminVenue(id: string, data: { is_verified?: boolean; status?: string }) {
    return request<{ success: boolean; venue: any }>(`/admin/venues/${id}/verify`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  // Door Check-In Admin
  async getAdminCheckinEvents() {
    return request<{ success: boolean; events: any[]; recentCheckins: any[] }>('/admin/checkin/events');
  },

  async searchAdminCheckinPasses(eventId: string, q: string) {
    return request<{ success: boolean; passes: any[] }>(`/admin/checkin/search?eventId=${encodeURIComponent(eventId)}&q=${encodeURIComponent(q)}`);
  },

  async scanAdminCheckinPass(code: string, event_id?: string) {
    return request<{ success: boolean; verificationStatus: string; message: string; pass: any; newAchievements?: string[] }>('/admin/checkin/scan', {
      method: 'POST',
      body: JSON.stringify({ code, event_id }),
    });
  },

  async overrideAdminCheckin(registration_id: string, new_status: 'confirmed' | 'checked_in', reason: string) {
    return request<{ success: boolean; message: string }>('/admin/checkin/override', {
      method: 'POST',
      body: JSON.stringify({ registration_id, new_status, reason }),
    });
  },

  // Moderation, Payments, Notifications
  async getAdminModerationPosts(params: { status?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    return request<{ success: boolean; posts: any[] }>(`/admin/moderation/posts${q.toString() ? '?' + q.toString() : ''}`);
  },

  async moderateAdminPost(id: string, data: { status: string; moderation_notes?: string; suspend_author?: boolean }) {
    return request<{ success: boolean; post: any }>(`/admin/moderation/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async getAdminPayments(status?: string) {
    return request<{ success: boolean; gatewayConfigured: boolean; gatewayNotice: string; transactions: any[] }>(
      `/admin/payments${status ? '?status=' + encodeURIComponent(status) : ''}`
    );
  },

  async refundAdminPayment(id: string, refund_amount?: number, reason?: string) {
    return request<{ success: boolean; transaction: any }>(`/admin/payments/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ refund_amount, reason }),
    });
  },

  async getAdminAnnouncements() {
    return request<{ success: boolean; announcements: any[] }>('/admin/notifications/announcements');
  },

  async broadcastAdminAnnouncement(data: { title: string; message: string; target_audience: string; target_filter?: string; category?: string }) {
    return request<{ success: boolean; deliveredCount: number; deliveryChannel: string }>('/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Analytics, Reports, Settings, Audit Logs
  async getAdminAnalytics(params: { range?: string; from?: string; to?: string; city?: string; category?: string; status?: string } = {}) {
    const q = new URLSearchParams();
    if (params.range) q.set('range', params.range);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.city) q.set('city', params.city);
    if (params.category) q.set('category', params.category);
    if (params.status) q.set('status', params.status);
    return request<{
      success: boolean;
      cityActivity: any[];
      categoryPerformance: any[];
      memberGrowth: any[];
      registrationTrends: any[];
      partnerAndCampaignStats: any;
    }>(`/admin/analytics${q.toString() ? '?' + q.toString() : ''}`);
  },

  async exportAdminReport(type: string) {
    return request<{ success: boolean; filename: string; csv: string }>(`/admin/reports/export?type=${encodeURIComponent(type)}`);
  },

  async getAdminSettings() {
    return request<{ success: boolean; settings: Record<string, any> }>('/admin/settings');
  },

  async updateAdminSettings(key: string, value: Record<string, any>) {
    return request<{ success: boolean; message: string }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  },

  async getAdminAuditLogs(params: { action?: string; entity_type?: string; actor?: string } = {}) {
    const q = new URLSearchParams();
    if (params.action) q.set('action', params.action);
    if (params.entity_type) q.set('entity_type', params.entity_type);
    if (params.actor) q.set('actor', params.actor);
    return request<{ success: boolean; logs: any[] }>(`/admin/audit-logs${q.toString() ? '?' + q.toString() : ''}`);
  },

  // Media / Upload
  async uploadImage(file: File, folder: string = 'general'): Promise<{
    success: boolean;
    url: string;
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  }> {
    const token = localStorage.getItem('stroom_token');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/upload/image`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        throw new ApiError('Backend server is temporarily unreachable.', 503);
      }
      throw new ApiError(err.message || 'Image upload request failed', 500);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.error || `Upload failed with status ${res.status}`, res.status, data);
    }

    return data;
  },

  async deleteUploadedImage(publicId: string) {
    return request<{ success: boolean; message: string }>('/upload', {
      method: 'DELETE',
      body: JSON.stringify({ public_id: publicId }),
    });
  },

  async getMyUploads() {
    return request<{ uploads: any[] }>('/upload/my-uploads');
  },
};
