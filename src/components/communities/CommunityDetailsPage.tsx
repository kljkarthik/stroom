import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Community, Event } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Users,
  Calendar,
  MapPin,
  Clock,
  Shield,
  Sparkles,
  Share2,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  Award,
  ChevronRight,
  Ticket
} from 'lucide-react';

interface CommunityDetailsPageProps {
  communityId: string;
  onBack: () => void;
  onSelectEvent: (eventId: string) => void;
  onOpenAuth?: () => void;
}

export const CommunityDetailsPage: React.FC<CommunityDetailsPageProps> = ({
  communityId,
  onBack,
  onSelectEvent,
  onOpenAuth,
}) => {
  const { isAuthenticated } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showShareToast, setShowShareToast] = useState<boolean>(false);

  const fetchCommunity = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCommunity(communityId);
      if (res && res.community) {
        setCommunity(res.community);
      } else {
        setError('Community not found');
      }
    } catch (err: any) {
      console.error('Error fetching community details:', err);
      setError('Unable to load community details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunity();
  }, [communityId]);

  const handleToggleMembership = async () => {
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (!community) return;

    setIsUpdating(true);
    try {
      if (community.is_member) {
        const res = await api.leaveCommunity(community.id);
        setCommunity({
          ...community,
          is_member: false,
          member_count: res.member_count,
        });
      } else {
        const res = await api.joinCommunity(community.id);
        setCommunity({
          ...community,
          is_member: true,
          member_count: res.member_count,
        });
      }
    } catch (err) {
      console.error('Failed to update membership:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share && community) {
      try {
        await navigator.share({
          title: `${community.name} | STROOM Community`,
          text: `Join ${community.name} on STROOM!`,
          url: shareUrl,
        });
        return;
      } catch (e) {
        // Fallback
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-stroom-orange border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-stroom-charcoal uppercase tracking-wider">Loading community circle...</p>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex flex-col items-center justify-center p-4">
        <div className="p-8 max-w-md w-full bg-white rounded-3xl border border-stroom-borderLight text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-stroom-orange mx-auto mb-3" />
          <h2 className="text-xl font-black text-stroom-black uppercase">Community Not Found</h2>
          <p className="mt-2 text-xs text-stone-600 font-semibold">{error || 'This community circle may not exist.'}</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Communities</span>
          </button>
        </div>
      </div>
    );
  }

  const upcomingEvents = community.upcoming_events || [];

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Top Floating Nav */}
      <div className="bg-white/80 backdrop-blur-md border-b border-stroom-borderLight sticky top-20 z-30 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-black text-stroom-charcoal hover:text-stroom-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-stroom-orange" />
            <span>Back to Communities</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold text-stroom-charcoal transition-all flex items-center gap-1.5"
            title="Share Community"
          >
            <Share2 className="w-4 h-4 text-stroom-orange" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-stroom-black text-white text-xs font-extrabold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-fade-in border border-stone-700">
          <Check className="w-4 h-4 text-stroom-orange" />
          <span>Community link copied to clipboard!</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative bg-stroom-black text-white">
        <div className="h-64 sm:h-80 w-full relative overflow-hidden">
          <img
            src={community.image_url}
            alt={community.name}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stroom-black via-stroom-black/40 to-transparent" />
        </div>

        {/* Hero Overlay Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 absolute bottom-8 inset-x-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand">
              {community.category.toUpperCase()}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-stroom-cream border border-white/20">
              {community.city_name || 'Hyderabad'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-stone-300 border border-white/10 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-stroom-orange" />
              <span>{community.member_count} Members</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            {community.name}
          </h1>

          <p className="mt-2 text-stone-300 text-xs sm:text-sm max-w-2xl font-medium">
            Meeting Schedule: {community.meeting_schedule}
          </p>
        </div>
      </div>

      {/* Main Details Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Description, Guidelines, Meetups */}
          <div className="lg:col-span-8 space-y-8">
            {/* About Box */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs">
              <h2 className="text-xl font-black text-stroom-black uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-stroom-orange" />
                <span>About this Community</span>
              </h2>
              <p className="mt-4 text-stroom-charcoal text-sm leading-relaxed font-medium whitespace-pre-line">
                {community.description}
              </p>

              {/* Guidelines */}
              <div className="mt-8 pt-6 border-t border-stroom-borderLight">
                <h3 className="text-sm font-black text-stroom-black uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-stroom-orange" />
                  <span>Community Guidelines</span>
                </h3>
                <p className="text-xs text-stone-600 font-medium leading-relaxed bg-stroom-ivory/60 p-4 rounded-2xl border border-stroom-borderLight">
                  {community.guidelines || 'Be welcoming, respect member boundaries, show up to confirmed meetups, and maintain an inclusive social atmosphere.'}
                </p>
              </div>
            </div>

            {/* Upcoming Meetups Section */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-stroom-black uppercase tracking-tight flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-stroom-orange" />
                    <span>Upcoming Community Meetups</span>
                  </h2>
                  <p className="text-xs text-stone-500 font-semibold mt-1">
                    Scheduled experiences hosted for {community.name}
                  </p>
                </div>
              </div>

              {upcomingEvents.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No Upcoming Meetups Currently Scheduled"
                  description={`Regular sessions follow: ${community.meeting_schedule || 'weekly weekend schedule'}. Check back soon for the next booking drop!`}
                  className="my-4"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {upcomingEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onSelectEvent(ev.id)}
                      className="p-4 rounded-2xl border border-stroom-borderLight hover:border-stroom-orange hover:shadow-md transition-all cursor-pointer bg-stroom-ivory/30 group"
                    >
                      <div className="h-32 rounded-xl overflow-hidden mb-3 relative bg-stroom-charcoal">
                        <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 text-[10px] font-extrabold text-white">
                          {ev.entry_fee}
                        </div>
                      </div>
                      <h4 className="text-xs font-black text-stroom-black group-hover:text-stroom-orange transition-colors line-clamp-1">
                        {ev.title}
                      </h4>
                      <div className="mt-2 text-[11px] text-stone-500 font-semibold space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-stroom-orange" />
                          <span>{ev.event_date} • {ev.event_time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3 h-3 text-stone-400 flex-shrink-0" />
                          <span className="truncate">{ev.venue_name || 'STROOM Venue'}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-stone-200 flex items-center justify-between text-xs font-bold text-stroom-orange">
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Membership Card & Organizer */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Membership Box */}
            <div className="bg-white rounded-3xl p-6 border-2 border-stroom-orange/30 shadow-xl sticky top-36">
              <div className="text-center pb-4 border-b border-stroom-borderLight">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-cream text-stroom-deep">
                  STROOM Verified Circle
                </span>
                <p className="text-3xl font-black text-stroom-black mt-3">{community.member_count}</p>
                <p className="text-xs font-bold text-stone-500">Active Members in {community.city_name}</p>
              </div>

              {/* Join / Leave Action */}
              <div className="mt-6">
                <button
                  onClick={handleToggleMembership}
                  disabled={isUpdating}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${
                    community.is_member
                      ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                      : 'bg-gradient-to-r from-stroom-orange to-stroom-deep text-white shadow-brand hover:brightness-105 active:scale-98'
                  }`}
                >
                  {isUpdating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : community.is_member ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Member of this Circle (Leave)</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Join this Community</span>
                    </>
                  )}
                </button>
              </div>

              {/* Perks */}
              <div className="mt-6 pt-4 border-t border-stroom-borderLight space-y-2.5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-600">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Early access to limited-seat meetups</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-600">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exclusive chapter chat & announcements</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-600">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Community host facilitation on meetups</span>
                </div>
              </div>
            </div>

            {/* Organizer Card */}
            <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-xs">
              <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Chapter Organizer</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-stroom-orange text-white flex items-center justify-center font-black text-base shadow-brand">
                  {community.organizer_name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-black text-stroom-black">{community.organizer_name}</h4>
                  <p className="text-xs text-stroom-deep font-bold">{community.organizer_role}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-stone-600 font-medium leading-relaxed">
                Leads regular gatherings, ensures high participation, and acts as the point of contact for new members joining this circle.
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
