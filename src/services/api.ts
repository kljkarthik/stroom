import { QuizData, QuizSession, User, DiscoveryItem, UserPreference, QuizVersion } from '../types';

const API_BASE = '/api';

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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

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
};
