import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StroomLogo } from '../common/StroomLogo';
import { StroomPassportView } from '../passport/StroomPassportView';
import { ProfileStudioView } from '../profile/ProfileStudioView';
import { PublicProfileModal } from '../profile/PublicProfileModal';
import {
  Ticket,
  Trophy,
  Calendar,
  MapPin,
  Sparkles,
  Award,
  ChevronRight,
  Download,
  Share2,
  Clock,
  Heart,
  Users,
  CheckCircle2,
  Shield,
  QrCode,
  Sliders,
  Flame,
  Activity,
  Compass,
  ArrowRight,
  Eye,
  X,
  AlertCircle,
  Filter,
  Check,
  Coffee,
  User
} from 'lucide-react';
import { isUploadedPhoto } from '../../utils/avatarUtils';

interface ParticipantDashboardProps {
  onExploreEvents?: () => void;
  onTriggerQuiz?: () => void;
  onGoToCommunities?: () => void;
  onGoToEventDetails?: (eventId: string) => void;
  onGoToCommunityDetails?: (communityId: string) => void;
}

export type ParticipantHubTab = 'overview' | 'events' | 'communities' | 'passport' | 'studio' | 'activity';

export const ParticipantDashboard: React.FC<ParticipantDashboardProps> = ({
  onExploreEvents,
  onTriggerQuiz,
  onGoToCommunities,
  onGoToEventDetails,
  onGoToCommunityDetails,
}) => {
  const { user } = useAuth();

  // Active Hub Tab
  const [activeTab, setActiveTab] = useState<ParticipantHubTab>('overview');

  // Backend state
  const [profileData, setProfileData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cancellingPassId, setCancellingPassId] = useState<string | null>(null);

  // Modals & Popups
  const [selectedPassForQR, setSelectedPassForQR] = useState<any | null>(null);
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);

  // Filters for Event History
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [eventsSubTab, setEventsSubTab] = useState<'upcoming' | 'history'>('upcoming');

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUserProfile();
      if (res && (res.user || res.success)) {
        setProfileData(res);
      }
    } catch (err) {
      console.warn('Could not load participant dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPass = async (passId: string) => {
    if (!window.confirm('Are you sure you want to cancel this registration? Your seat will be released for other members.')) {
      return;
    }
    setCancellingPassId(passId);
    try {
      await api.cancelPass(passId);
      await loadDashboardData();
      if (selectedPassForQR?.pass_id === passId) {
        setSelectedPassForQR(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel registration');
    } finally {
      setCancellingPassId(null);
    }
  };

  const member = { ...(profileData?.user || {}), ...(user || {}) };
  const stats = profileData?.stats || {
    totalRegistered: 0,
    totalAttended: 0,
    upcomingCount: 0,
    communitiesCount: 0,
    achievementsCount: 0,
    passportStampsCount: 0,
    completionPercentage: 60,
  };

  const upcomingEvents: any[] = profileData?.upcomingEvents || [];
  const eventHistory: any[] = profileData?.eventHistory || [];
  const joinedCommunities: any[] = profileData?.joinedCommunities || [];
  const activityTimeline: any[] = profileData?.activityTimeline || [];
  const passportStamps: any[] = profileData?.passportStamps || [];

  const displayName = member?.display_name || member?.full_name || 'Member';
  const firstName = member?.first_name || displayName.split(' ')[0] || 'Friend';
  const memberId = member?.member_id || (member?.id ? `STR-HYD-${member.id.substring(0, 4).toUpperCase()}` : 'STR-HYD-1001');
  const memberCity = member?.city || 'Hyderabad';
  const memberSince = member?.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026';
  const completionPercentage = stats.completionPercentage || 60;

  // Filtered Event History
  const filteredHistory = eventHistory.filter((ev) => {
    if (historyCategoryFilter === 'all') return true;
    return ev.category?.toLowerCase() === historyCategoryFilter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black py-8 px-4 sm:px-6 lg:px-8 font-sans selection:bg-stroom-orange selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ==================================================
            1. PERSONALIZED MEMBER DASHBOARD HEADER
            ================================================== */}
        <header className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-stroom-charcoal via-stroom-black to-stroom-cardDark text-white border border-stroom-orange/30 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Infinity background glow */}
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none select-none">
            <span className="text-[260px] font-black text-stroom-orange leading-none">∞</span>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Profile Avatar with completion ring */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-stroom-orange to-stroom-gold p-1 shadow-brand overflow-hidden shrink-0">
                {isUploadedPhoto(member?.avatar_url) ? (
                  <img src={member.avatar_url} alt={displayName} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400">
                    <User className="w-10 h-10" />
                  </div>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider border-2 border-stroom-black">
                Verified
              </span>
            </div>

            {/* Profile Narrative & Greetings */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-stroom-orange/20 text-stroom-orange border border-stroom-orange/30 tracking-wider">
                  {memberId}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/10 text-white/90">
                  {memberCity} Chapter
                </span>
                <span className="text-[10px] font-semibold text-stroom-cream/70">
                  Member since {memberSince}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-display tracking-tight">
                Welcome back, {firstName}!
              </h1>

              <p className="text-xs sm:text-sm text-stroom-cream/80 font-medium">
                Your next experience is waiting. Strangers Today. Stories Tomorrow.
              </p>
            </div>
          </div>

          {/* Quick Header Controls (Profile completion, Edit Profile, Passport) */}
          <div className="relative z-10 flex flex-wrap items-center gap-3">
            {/* Profile Completeness Pill */}
            <div className="p-3 px-4 rounded-2xl bg-white/10 border border-white/15 text-left shrink-0">
              <div className="flex items-center justify-between gap-4 text-[10px] font-extrabold uppercase text-stroom-cream/80">
                <span>Profile Studio</span>
                <span className="text-stroom-gold">{completionPercentage}%</span>
              </div>
              <div className="w-28 h-1.5 bg-black/40 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-stroom-orange to-stroom-gold rounded-full" style={{ width: `${completionPercentage}%` }} />
              </div>
            </div>

            <button
              onClick={() => setActiveTab('passport')}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep hover:brightness-105 text-white font-black text-xs uppercase tracking-wider shadow-brand flex items-center gap-2 transition-all active:scale-98"
            >
              <Award className="w-4 h-4" />
              <span>STROOM Passport</span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className="px-3.5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Sliders className="w-4 h-4 text-stroom-orange" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => setPreviewMemberId(memberId)}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1 transition-all"
              title="Preview Public Profile as Others See It"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ==================================================
            2. UNIFIED MEMBER NAVIGATION BAR
            ================================================== */}
        <nav className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-stroom-borderLight shadow-sm overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: Compass },
            { id: 'events', label: `My Events (${upcomingEvents.length + eventHistory.length})`, icon: Ticket },
            { id: 'communities', label: `My Communities (${joinedCommunities.length})`, icon: Users },
            { id: 'passport', label: `STROOM Passport (${passportStamps.length} Stamps)`, icon: Award },
            { id: 'studio', label: 'Profile Studio', icon: Sliders },
            { id: 'activity', label: 'Activity Timeline', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ParticipantHubTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                  isActive
                    ? 'bg-stroom-orange text-white shadow-brand'
                    : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ==================================================
            TAB 1: OVERVIEW DASHBOARD
            ================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Real Summary Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-xs">
                <Ticket className="w-5 h-5 text-stroom-orange mb-2" />
                <p className="text-2xl font-black text-stroom-black">{stats.totalRegistered || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-stroom-charcoal/70 mt-0.5">
                  Total Registered
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
                <p className="text-2xl font-black text-stroom-black">{stats.totalAttended || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-stroom-charcoal/70 mt-0.5">
                  Events Attended
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-xs">
                <Calendar className="w-5 h-5 text-amber-500 mb-2" />
                <p className="text-2xl font-black text-stroom-black">{stats.upcomingCount || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-stroom-charcoal/70 mt-0.5">
                  Upcoming Experiences
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-xs">
                <Users className="w-5 h-5 text-sky-500 mb-2" />
                <p className="text-2xl font-black text-stroom-black">{stats.communitiesCount || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-stroom-charcoal/70 mt-0.5">
                  Communities Joined
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-xs">
                <Trophy className="w-5 h-5 text-stroom-gold mb-2" />
                <p className="text-2xl font-black text-stroom-black">{stats.achievementsCount || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-stroom-charcoal/70 mt-0.5">
                  Badges Unlocked
                </p>
              </div>
            </div>

            {/* Next Upcoming Experience Highlight */}
            {upcomingEvents.length > 0 ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-stroom-borderLight">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-stroom-orange" />
                    <h3 className="text-base font-black text-stroom-black font-display">
                      Next Confirmed Experience
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider">
                    {upcomingEvents[0].checkin_status || 'Confirmed'}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Event Cover Image */}
                  <div className="w-full md:w-56 h-40 rounded-2xl bg-stone-900 border border-stroom-borderLight overflow-hidden shrink-0 relative">
                    <img
                      src={upcomingEvents[0].image_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=700&q=80'}
                      alt={upcomingEvents[0].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-stroom-black/80 text-white text-[9px] font-black uppercase">
                      {upcomingEvents[0].category || 'Event'}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-2 text-center md:text-left">
                    <h4 className="text-xl font-black text-stroom-black">
                      {upcomingEvents[0].title}
                    </h4>
                    <p className="text-xs text-stroom-charcoal/80 flex items-center justify-center md:justify-start gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                      <span>{upcomingEvents[0].event_date} • {upcomingEvents[0].event_time}</span>
                    </p>
                    <p className="text-xs text-stroom-charcoal/80 flex items-center justify-center md:justify-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                      <span>{upcomingEvents[0].venue_name} ({upcomingEvents[0].city_name})</span>
                    </p>

                    <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                      <button
                        onClick={() => setSelectedPassForQR(upcomingEvents[0])}
                        className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>View Digital Pass</span>
                      </button>

                      <button
                        onClick={() => handleCancelPass(upcomingEvents[0].pass_id)}
                        disabled={cancellingPassId === upcomingEvents[0].pass_id}
                        className="px-3.5 py-2 rounded-xl bg-stroom-cream hover:bg-red-50 hover:text-red-700 text-stroom-charcoal font-bold text-xs transition-colors"
                      >
                        {cancellingPassId === upcomingEvents[0].pass_id ? 'Cancelling...' : 'Cancel Registration'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl bg-white border border-stroom-borderLight text-center space-y-3">
                <Ticket className="w-10 h-10 text-stone-300 mx-auto" />
                <h4 className="text-base font-black text-stroom-black font-display">
                  No Upcoming Registrations
                </h4>
                <p className="text-xs text-stroom-charcoal/80 max-w-sm mx-auto">
                  You don't have an active event ticket right now. Explore our city calendar for sports blitzes, social mixers, and coffee meetups.
                </p>
                {onExploreEvents && (
                  <button
                    onClick={onExploreEvents}
                    className="px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105"
                  >
                    Explore Experiences
                  </button>
                )}
              </div>
            )}

            {/* 2-Column: Quick Passport Stamps Glance & Recent Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* STROOM Passport Snapshot (6 cols) */}
              <div className="lg:col-span-6 p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-stroom-orange" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black">
                      STROOM Passport Verified Stamps
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('passport')}
                    className="text-[11px] font-black text-stroom-deep hover:underline flex items-center gap-1"
                  >
                    <span>Full Passport</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {passportStamps.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Award className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="text-xs font-bold text-stroom-black">0 Verified Stamps</p>
                    <p className="text-[11px] text-stroom-charcoal/70 max-w-[240px] mx-auto">
                      Check in at the door of your first STROOM event to earn your inaugural digital stamp.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {passportStamps.slice(0, 4).map((stamp: any) => (
                      <div
                        key={stamp.id}
                        className="p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex items-center gap-2.5"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-stroom-gold/40 flex items-center justify-center text-stroom-gold shrink-0">
                          <Award className="w-4 h-4 text-stroom-gold" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-stroom-black truncate">{stamp.event_title}</p>
                          <p className="text-[10px] text-stroom-charcoal/70 truncate">{stamp.city_name} • Verified</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Personal Activity Timeline (6 cols) */}
              <div className="lg:col-span-6 p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-stroom-orange" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black">
                      Recent Activity Timeline
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className="text-[11px] font-black text-stroom-deep hover:underline flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {activityTimeline.length === 0 ? (
                  <div className="py-8 text-center space-y-1">
                    <Activity className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="text-xs font-bold text-stroom-black">No Recent Activity</p>
                    <p className="text-[11px] text-stroom-charcoal/70">Your event registrations and milestones will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activityTimeline.slice(0, 4).map((act: any) => (
                      <div key={act.id} className="flex items-start gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-stroom-orange mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-stroom-black leading-tight">{act.title}</p>
                          {act.description && (
                            <p className="text-[11px] text-stroom-charcoal/80 leading-snug mt-0.5">{act.description}</p>
                          )}
                          <span className="text-[9px] font-bold text-stroom-charcoal/50 block mt-0.5">
                            {act.created_at ? new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ==================================================
            TAB 2: MY EVENTS (UPCOMING + HISTORY TIMELINE)
            ================================================== */}
        {activeTab === 'events' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Events Sub-switcher */}
            <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEventsSubTab('upcoming')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    eventsSubTab === 'upcoming'
                      ? 'bg-stroom-orange text-white shadow-brand'
                      : 'bg-white hover:bg-stroom-cream text-stroom-charcoal border border-stroom-borderLight'
                  }`}
                >
                  Upcoming Passes ({upcomingEvents.length})
                </button>

                <button
                  onClick={() => setEventsSubTab('history')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    eventsSubTab === 'history'
                      ? 'bg-stroom-orange text-white shadow-brand'
                      : 'bg-white hover:bg-stroom-cream text-stroom-charcoal border border-stroom-borderLight'
                  }`}
                >
                  Event History & Stamps ({eventHistory.length})
                </button>
              </div>

              {onExploreEvents && (
                <button
                  onClick={onExploreEvents}
                  className="px-3.5 py-2 rounded-xl bg-stroom-black text-white text-xs font-extrabold hover:bg-stone-800 transition-colors flex items-center gap-1.5"
                >
                  <Compass className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>Explore More</span>
                </button>
              )}
            </div>

            {/* 1. UPCOMING PASSES VIEW */}
            {eventsSubTab === 'upcoming' && (
              <div>
                {upcomingEvents.length === 0 ? (
                  <div className="p-12 rounded-3xl bg-white border border-stroom-borderLight text-center space-y-3">
                    <Ticket className="w-12 h-12 text-stone-300 mx-auto" />
                    <h4 className="text-base font-black text-stroom-black font-display">
                      No Upcoming Events
                    </h4>
                    <p className="text-xs text-stroom-charcoal/80 max-w-sm mx-auto">
                      You are not registered for any upcoming events. Explore curated experiences or coffee meetups in your city.
                    </p>
                    {onExploreEvents && (
                      <button
                        onClick={onExploreEvents}
                        className="px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
                      >
                        Browse Calendar
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {upcomingEvents.map((ev) => (
                      <div
                        key={ev.pass_id}
                        className="rounded-3xl bg-white border border-stroom-borderLight overflow-hidden shadow-xs hover:border-stroom-orange transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative h-44 bg-stone-900">
                            <img
                              src={ev.image_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=700&q=80'}
                              alt={ev.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-stroom-black/80 text-white text-[10px] font-black uppercase">
                              {ev.category}
                            </div>
                            <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase shadow-xs">
                              {ev.checkin_status}
                            </div>
                          </div>

                          <div className="p-5 space-y-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-stroom-deep">
                              <span>PASS CODE:</span>
                              <span className="bg-stroom-cream px-1.5 py-0.2 rounded font-extrabold">{ev.pass_code}</span>
                            </div>

                            <h4 className="text-base font-black text-stroom-black leading-snug">
                              {ev.title}
                            </h4>

                            <p className="text-xs text-stroom-charcoal/80 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                              <span>{ev.event_date} • {ev.event_time}</span>
                            </p>

                            <p className="text-xs text-stroom-charcoal/80 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                              <span className="truncate">{ev.venue_name} ({ev.city_name})</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-5 pt-0 border-t border-stroom-borderLight/60 mt-3 pt-3 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setSelectedPassForQR(ev)}
                            className="flex-1 py-2 rounded-xl bg-stroom-orange text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-brand hover:brightness-105"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>View Pass</span>
                          </button>

                          <button
                            onClick={() => handleCancelPass(ev.pass_id)}
                            disabled={cancellingPassId === ev.pass_id}
                            className="px-3 py-2 rounded-xl bg-stroom-cream hover:bg-red-50 hover:text-red-700 text-stroom-charcoal font-bold text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. EVENT HISTORY VIEW WITH CATEGORY FILTERS */}
            {eventsSubTab === 'history' && (
              <div className="space-y-4">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: 'All Categories' },
                    { id: 'sports', label: 'Sports' },
                    { id: 'cafe_meetup', label: 'Café Meetups' },
                    { id: 'gaming', label: 'Gaming' },
                    { id: 'fitness', label: 'Fitness' },
                    { id: 'travel', label: 'Travel' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setHistoryCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                        historyCategoryFilter === cat.id
                          ? 'bg-stroom-charcoal text-white'
                          : 'bg-white hover:bg-stroom-cream text-stroom-charcoal border border-stroom-borderLight'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center space-y-2">
                    <Calendar className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="text-xs font-bold text-stroom-black">No Events in this Category</p>
                    <p className="text-[11px] text-stroom-charcoal/70">No past participation found for the selected filter.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((ev) => {
                      const isCheckedIn = ev.checkin_status === 'checked_in';
                      const isCancelled = ev.checkin_status === 'cancelled';

                      return (
                        <div
                          key={ev.pass_id}
                          className="p-4 rounded-2xl bg-white border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 overflow-hidden shrink-0">
                              <img
                                src={ev.image_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=300&q=80'}
                                alt={ev.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-stroom-cream text-stroom-deep">
                                  {ev.category}
                                </span>
                                {isCheckedIn ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" /> Checked In
                                  </span>
                                ) : isCancelled ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-stone-100 text-stone-600">
                                    Cancelled
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    Registered
                                  </span>
                                )}
                              </div>
                              <h5 className="text-sm font-black text-stroom-black mt-1">{ev.title}</h5>
                              <p className="text-[11px] text-stroom-charcoal/70">
                                {ev.event_date} • {ev.venue_name} ({ev.city_name})
                              </p>
                            </div>
                          </div>

                          <div className="sm:text-right shrink-0">
                            <span className="text-[10px] font-mono text-stroom-charcoal block">Pass: {ev.pass_code}</span>
                            {isCheckedIn && (
                              <span className="text-[10px] font-extrabold text-stroom-gold flex items-center justify-end gap-1 mt-0.5">
                                <Award className="w-3.5 h-3.5" /> Passport Stamped
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ==================================================
            TAB 3: MY COMMUNITIES
            ================================================== */}
        {activeTab === 'communities' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
              <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black">
                Joined Communities ({joinedCommunities.length})
              </h3>
              {onGoToCommunities && (
                <button
                  onClick={onGoToCommunities}
                  className="px-3.5 py-1.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand flex items-center gap-1"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Discover More Circles</span>
                </button>
              )}
            </div>

            {joinedCommunities.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white border border-stroom-borderLight text-center space-y-3">
                <Users className="w-12 h-12 text-stone-300 mx-auto" />
                <h4 className="text-base font-black text-stroom-black font-display">
                  You Haven't Joined Any Communities Yet
                </h4>
                <p className="text-xs text-stroom-charcoal/80 max-w-sm mx-auto">
                  STROOM communities are where people with shared interests coordinate meetups, share stories, and organize weekend gatherings.
                </p>
                {onGoToCommunities && (
                  <button
                    onClick={onGoToCommunities}
                    className="px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
                  >
                    Browse Local Communities
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {joinedCommunities.map((comm) => (
                  <div
                    key={comm.id}
                    className="p-5 rounded-3xl bg-white border border-stroom-borderLight hover:border-stroom-orange shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3.5 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-stone-900 overflow-hidden shrink-0">
                          <img src={comm.image_url} alt={comm.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-stroom-cream text-stroom-deep">
                            {comm.category}
                          </span>
                          <h4 className="text-sm font-black text-stroom-black mt-1 leading-snug truncate">
                            {comm.name}
                          </h4>
                          <p className="text-[10px] text-stroom-charcoal/70">{comm.city_name} Chapter</p>
                        </div>
                      </div>

                      <p className="text-xs text-stroom-charcoal/80 line-clamp-2 leading-relaxed">
                        {comm.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stroom-borderLight/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stroom-charcoal flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>{comm.member_count} members</span>
                      </span>

                      {onGoToCommunityDetails ? (
                        <button
                          onClick={() => onGoToCommunityDetails(comm.id)}
                          className="px-3 py-1.5 rounded-xl bg-stroom-ivory hover:bg-stroom-cream text-stroom-black text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <span>Open Circle</span>
                          <ArrowRight className="w-3 h-3 text-stroom-orange" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================
            TAB 4: STROOM PASSPORT
            ================================================== */}
        {activeTab === 'passport' && (
          <StroomPassportView
            onExploreEvents={onExploreEvents}
            onOpenProfileStudio={() => setActiveTab('studio')}
            onPreviewPublicProfile={(id) => setPreviewMemberId(id)}
          />
        )}

        {/* ==================================================
            TAB 5: PROFILE STUDIO
            ================================================== */}
        {activeTab === 'studio' && (
          <ProfileStudioView
            onTriggerQuiz={onTriggerQuiz}
            onPreviewPublicProfile={(id) => setPreviewMemberId(id)}
            onBackToDashboard={() => setActiveTab('overview')}
          />
        )}

        {/* ==================================================
            TAB 6: ACTIVITY TIMELINE
            ================================================== */}
        {activeTab === 'activity' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-6 max-w-3xl mx-auto animate-fade-in">
            <div className="pb-3 border-b border-stroom-borderLight">
              <h3 className="text-sm font-black uppercase tracking-wider text-stroom-black flex items-center gap-2">
                <Activity className="w-4 h-4 text-stroom-orange" />
                <span>Your Community Journey Timeline</span>
              </h3>
              <p className="text-xs text-stroom-charcoal/70 mt-0.5">
                Authentic audit record of event registrations, door check-ins, circle memberships, and unlocked achievements.
              </p>
            </div>

            {activityTimeline.length === 0 ? (
              <div className="py-12 text-center text-stone-400 space-y-2">
                <Activity className="w-10 h-10 mx-auto text-stone-300" />
                <p className="text-xs font-bold text-stroom-black">Timeline Empty</p>
                <p className="text-[11px] text-stroom-charcoal/70">As you take part in STROOM, milestones will appear here.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stroom-borderLight">
                {activityTimeline.map((act) => (
                  <div key={act.id} className="relative flex items-start gap-4">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-stroom-orange border-2 border-white ring-2 ring-stroom-cream" />
                    <div className="min-w-0 flex-1 p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs font-black text-stroom-black">{act.title}</h5>
                        <span className="text-[9px] font-bold text-stroom-charcoal/60">
                          {act.created_at ? new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </span>
                      </div>
                      {act.description && (
                        <p className="text-[11px] text-stroom-charcoal/80 mt-1 leading-snug">{act.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ==================================================
          QR PASS VIEWER MODAL
          ================================================== */}
      {selectedPassForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-white border-2 border-stroom-orange/30 shadow-2xl p-6 text-center space-y-4 text-stroom-black">
            <button
              onClick={() => setSelectedPassForQR(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stroom-ivory hover:bg-stroom-cream text-stroom-black flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center">
              <StroomLogo variant="dark" size="sm" showSubtitle={false} />
            </div>

            <div>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">
                OFFICIAL ENTRY PASS
              </span>
              <h3 className="text-base font-black text-stroom-black mt-1 font-display">
                {selectedPassForQR.title}
              </h3>
              <p className="text-xs text-stroom-charcoal/80 mt-0.5">
                {selectedPassForQR.event_date} • {selectedPassForQR.event_time}
              </p>
            </div>

            {/* QR Code Container */}
            <div className="p-4 rounded-2xl bg-stroom-ivory border-2 border-dashed border-stroom-charcoal/30 flex flex-col items-center justify-center mx-auto w-48 h-48">
              <QrCode className="w-32 h-32 text-stroom-black" />
              <span className="font-mono text-xs font-black tracking-widest text-stroom-deep mt-2">
                {selectedPassForQR.pass_code}
              </span>
            </div>

            <div className="text-[11px] text-stroom-charcoal/80 space-y-0.5">
              <p>Attendee: <strong className="text-stroom-black">{displayName}</strong></p>
              <p>Venue: <strong className="text-stroom-black">{selectedPassForQR.venue_name} ({selectedPassForQR.city_name})</strong></p>
              <p className="text-[10px] text-stone-400 mt-2">
                Show this QR code at the door scanner to receive your verified STROOM Passport stamp.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  alert(`Digital Pass ${selectedPassForQR.pass_code} saved to device offline.`);
                  setSelectedPassForQR(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-stroom-black text-white text-xs font-black hover:bg-stone-800"
              >
                Save Offline
              </button>
              <button
                onClick={() => handleCancelPass(selectedPassForQR.pass_id)}
                disabled={cancellingPassId === selectedPassForQR.pass_id}
                className="px-4 py-2.5 rounded-xl bg-stroom-cream text-red-700 hover:bg-red-50 text-xs font-extrabold"
              >
                Cancel Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          PUBLIC PROFILE PREVIEW MODAL
          ================================================== */}
      {previewMemberId && (
        <PublicProfileModal
          memberIdOrId={previewMemberId}
          isOpen={!!previewMemberId}
          onClose={() => setPreviewMemberId(null)}
        />
      )}

    </div>
  );
};
