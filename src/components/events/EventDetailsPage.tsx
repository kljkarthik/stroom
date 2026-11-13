import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Event, EventRegistration } from '../../types';
import { RegistrationModal, EventDetails } from '../modals/RegistrationModal';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Share2,
  Bookmark,
  CheckCircle2,
  Ticket,
  Users,
  Shield,
  AlertCircle,
  ExternalLink,
  Flame,
  Award,
  Sparkles,
  Info,
  Navigation,
  Check
} from 'lucide-react';

interface EventDetailsPageProps {
  eventId: string;
  onBack: () => void;
  onGoToAuction?: () => void;
  onGoToParticipant?: () => void;
}

export const EventDetailsPage: React.FC<EventDetailsPageProps> = ({
  eventId,
  onBack,
  onGoToAuction,
  onGoToParticipant,
}) => {
  const [event, setEvent] = useState<(Event & { venue_capacity?: number; venue_tier?: string }) | null>(null);
  const [userRegistration, setUserRegistration] = useState<EventRegistration | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction States
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [showShareToast, setShowShareToast] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchEventDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getEvent(eventId);
      if (res && res.event) {
        setEvent(res.event);
        setUserRegistration(res.userRegistration || null);
      } else {
        setError('Event not found');
      }
    } catch (err: any) {
      console.error('Error fetching event details:', err);
      setError('Unable to load event details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventDetails();
    // Check bookmark state from localStorage
    try {
      const savedBookmarks = JSON.parse(localStorage.getItem('stroom_bookmarks') || '[]');
      setIsBookmarked(savedBookmarks.includes(eventId));
    } catch (e) {
      // ignore
    }
  }, [eventId]);

  const toggleBookmark = () => {
    try {
      const savedBookmarks = JSON.parse(localStorage.getItem('stroom_bookmarks') || '[]');
      let updated: string[];
      if (savedBookmarks.includes(eventId)) {
        updated = savedBookmarks.filter((id: string) => id !== eventId);
        setIsBookmarked(false);
      } else {
        updated = [...savedBookmarks, eventId];
        setIsBookmarked(true);
      }
      localStorage.setItem('stroom_bookmarks', JSON.stringify(updated));
    } catch (e) {
      setIsBookmarked(!isBookmarked);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: event ? `${event.title} | STROOM` : 'STROOM Experience',
      text: event ? `Join me at ${event.title} on STROOM — Strangers Today. Stories Tomorrow.` : 'Explore STROOM events!',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // Fallback to clipboard
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
        <p className="text-sm font-bold text-stroom-charcoal uppercase tracking-wider">Loading experience details...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex flex-col items-center justify-center p-4">
        <div className="p-8 max-w-md w-full bg-white rounded-3xl border border-stroom-borderLight text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-stroom-orange mx-auto mb-3" />
          <h2 className="text-xl font-black text-stroom-black uppercase">Experience Not Found</h2>
          <p className="mt-2 text-xs text-stone-600 font-semibold">{error || 'This event may have been moved or removed.'}</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Discover</span>
          </button>
        </div>
      </div>
    );
  }

  const seatsLeft = event.seats_left !== undefined ? event.seats_left : (event.seats_total - event.seats_booked);
  const isSoldOut = seatsLeft <= 0;
  const isPast = event.status === 'completed';
  const percentBooked = Math.min(100, Math.round((event.seats_booked / event.seats_total) * 100));

  const modalEventDetails: EventDetails = {
    id: event.id,
    title: event.title,
    city: event.city_name || 'Hyderabad',
    date: event.event_date,
    time: event.event_time,
    venue: event.venue_name ? `${event.venue_name}, ${event.venue_area || ''}` : 'STROOM Arena',
    seatsLeft: seatsLeft,
    category: event.category,
    entryFee: event.entry_fee,
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Top Floating / Navigation Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-stroom-borderLight sticky top-20 z-30 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-black text-stroom-charcoal hover:text-stroom-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-stroom-orange" />
            <span>Back to Experiences</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleBookmark}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                isBookmarked
                  ? 'bg-stroom-cream border-stroom-orange text-stroom-deep'
                  : 'bg-white border-stroom-borderLight text-stroom-charcoal hover:border-stroom-orange'
              }`}
              title={isBookmarked ? 'Remove Bookmark' : 'Save Event'}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current text-stroom-orange' : ''}`} />
              <span className="hidden sm:inline">{isBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold text-stroom-charcoal transition-all flex items-center gap-1.5"
              title="Share Experience"
            >
              <Share2 className="w-4 h-4 text-stroom-orange" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-stroom-black text-white text-xs font-extrabold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-fade-in border border-stone-700">
          <Check className="w-4 h-4 text-stroom-orange" />
          <span>Event link copied to clipboard!</span>
        </div>
      )}

      {/* Banner & Hero Section */}
      <div className="relative bg-stroom-black text-white">
        <div className="h-72 sm:h-96 w-full relative overflow-hidden">
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stroom-black via-stroom-black/40 to-transparent" />
        </div>

        {/* Hero Overlay Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 absolute bottom-8 inset-x-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand">
              {event.category.toUpperCase()}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-stroom-cream border border-white/20">
              {event.city_name || 'Hyderabad'}
            </span>
            {event.is_flagship === 1 && (
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-current" />
                FLAGSHIP EXPERIENCE
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isPast ? 'bg-stone-700 text-stone-300' : isSoldOut ? 'bg-red-900/80 text-red-200' : 'bg-emerald-900/80 text-emerald-200'
            }`}>
              {isPast ? 'CONCLUDED' : isSoldOut ? 'SOLD OUT' : 'BOOKING OPEN'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            {event.title}
          </h1>

          <p className="mt-2 text-stone-300 text-xs sm:text-sm max-w-3xl font-medium">
            Hosted under the official STROOM Community Hub. Discover people, enjoy shared passions, and create lasting memories.
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Details & Experience Breakdown */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Quick Metadata Card */}
            <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stroom-cream flex items-center justify-center text-stroom-orange flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Date & Schedule</p>
                  <p className="text-sm font-extrabold text-stroom-black mt-0.5">{event.event_date}</p>
                  <p className="text-xs font-semibold text-stroom-charcoal/80 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-stroom-orange" />
                    <span>{event.event_time}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stroom-cream flex items-center justify-center text-stroom-orange flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Venue Location</p>
                  <p className="text-sm font-extrabold text-stroom-black mt-0.5">{event.venue_name}</p>
                  <p className="text-xs font-semibold text-stroom-charcoal/80 mt-0.5">{event.venue_area || event.city_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:col-span-2 md:col-span-1">
                <div className="w-10 h-10 rounded-2xl bg-stroom-cream flex items-center justify-center text-stroom-orange flex-shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Entry & Pass</p>
                  <p className="text-sm font-black text-stroom-orange mt-0.5">{event.entry_fee}</p>
                  <p className="text-xs font-semibold text-stone-500 mt-0.5">Digital Pass with QR</p>
                </div>
              </div>
            </div>

            {/* About The Experience */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs">
              <h2 className="text-xl font-black text-stroom-black uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-stroom-orange" />
                <span>About this Experience</span>
              </h2>
              <div className="mt-4 text-stroom-charcoal text-sm leading-relaxed whitespace-pre-line font-medium">
                {event.description}
              </div>

              {/* STROOM Experience Highlights */}
              <div className="mt-8 pt-6 border-t border-stroom-borderLight">
                <h3 className="text-sm font-black text-stroom-black uppercase tracking-wider mb-4">
                  What to Expect at STROOM:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-stroom-ivory/60 border border-stroom-borderLight flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-stroom-black">Curated Social Icebreakers</h4>
                      <p className="text-[11px] text-stone-600 mt-0.5">No awkward silences. Our hosts ensure everyone is introduced and engaged immediately.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stroom-ivory/60 border border-stroom-borderLight flex items-start gap-3">
                    <Users className="w-5 h-5 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-stroom-black">Verified Community Members</h4>
                      <p className="text-[11px] text-stone-600 mt-0.5">Every attendee is verified through digital pass check-in to ensure a safe, welcoming environment.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stroom-ivory/60 border border-stroom-borderLight flex items-start gap-3">
                    <Award className="w-5 h-5 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-stroom-black">Official STROOM Passport Stamp</h4>
                      <p className="text-[11px] text-stone-600 mt-0.5">Attending unlocks verified city passport stamps and leaderboard badges on your profile.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stroom-ivory/60 border border-stroom-borderLight flex items-start gap-3">
                    <Shield className="w-5 h-5 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-stroom-black">Dedicated STROOM Host</h4>
                      <p className="text-[11px] text-stone-600 mt-0.5">An on-ground representative coordinates timings, seating, and ensures an enjoyable meetup.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Venue & Directions */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs">
              <h2 className="text-xl font-black text-stroom-black uppercase tracking-tight flex items-center gap-2">
                <MapPin className="w-5 h-5 text-stroom-orange" />
                <span>Venue & Location</span>
              </h2>

              <div className="mt-4 p-5 rounded-2xl bg-stroom-cream/40 border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-stroom-deep tracking-wider px-2 py-0.5 rounded-full bg-stroom-cream border border-stroom-orange/30">
                    Official Venue Partner
                  </span>
                  <h3 className="text-base font-black text-stroom-black mt-2">{event.venue_name}</h3>
                  <p className="text-xs text-stone-600 font-medium mt-1">{event.venue_address || `${event.venue_area}, ${event.city_name}`}</p>
                  {event.venue_capacity && (
                    <p className="text-[11px] text-stone-500 font-semibold mt-1">Capacity: {event.venue_capacity} Guests</p>
                  )}
                </div>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name} ${event.venue_address || event.city_name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all self-start sm:self-center"
                >
                  <Navigation className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>Get Directions</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </div>
            </div>

            {/* Guidelines & Cancellation Policy */}
            <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-xs space-y-4">
              <h3 className="text-sm font-black text-stroom-black uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-stroom-orange" />
                <span>Participation Guidelines & House Rules</span>
              </h3>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-stroom-orange mt-1.5 flex-shrink-0" />
                  <span><strong>Check-in Requirement:</strong> Please arrive 15 minutes prior to start time with your digital pass QR code.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-stroom-orange mt-1.5 flex-shrink-0" />
                  <span><strong>Code of Conduct:</strong> STROOM fosters an inclusive, respectful environment. Harassment or inappropriate conduct will lead to immediate pass revocation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-stroom-orange mt-1.5 flex-shrink-0" />
                  <span><strong>Cancellation Policy:</strong> Registrations can be transferred or cancelled up to 24 hours prior to the event start via the Participant Hub.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Registration Box & Organizer Info */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Registration Card */}
            <div className="bg-white rounded-3xl p-6 border-2 border-stroom-orange/30 shadow-xl sticky top-36">
              <div className="flex items-center justify-between pb-4 border-b border-stroom-borderLight">
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Entry Pass</p>
                  <p className="text-2xl font-black text-stroom-orange">{event.entry_fee}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-stone-400">Availability</p>
                  <p className={`text-xs font-black ${isSoldOut ? 'text-red-600' : 'text-emerald-700'}`}>
                    {isSoldOut ? 'Sold Out' : `${seatsLeft} of ${event.seats_total} left`}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSoldOut ? 'bg-stone-400' : seatsLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-stroom-orange to-stroom-deep'
                    }`}
                    style={{ width: `${percentBooked}%` }}
                  />
                </div>
                <p className="text-[10px] font-extrabold text-stone-500 mt-1.5 text-center">
                  {percentBooked}% Booked • Instant Digital Confirmation
                </p>
              </div>

              {/* Registration CTAs */}
              <div className="mt-6 space-y-3">
                {userRegistration ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs font-black text-emerald-900 uppercase">You are registered!</p>
                    <p className="text-[11px] text-emerald-700 font-medium mt-1">Pass Code: {userRegistration.id.slice(0, 10).toUpperCase()}</p>
                    {onGoToParticipant && (
                      <button
                        onClick={onGoToParticipant}
                        className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Ticket className="w-4 h-4" />
                        <span>View My Digital Pass</span>
                      </button>
                    )}
                  </div>
                ) : isPast ? (
                  <div className="p-4 rounded-2xl bg-stone-100 text-center">
                    <p className="text-xs font-black text-stone-500 uppercase">This event has concluded</p>
                    <button
                      onClick={onBack}
                      className="mt-3 w-full py-2.5 rounded-xl bg-stroom-black text-white font-bold text-xs"
                    >
                      Browse Upcoming Meetups
                    </button>
                  </div>
                ) : isSoldOut ? (
                  <div className="p-4 rounded-2xl bg-red-50 text-center border border-red-200">
                    <p className="text-xs font-black text-red-700 uppercase">All Seats Are Full</p>
                    <p className="text-[11px] text-red-600 mt-1">Join the waitlist or explore similar upcoming sessions.</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-sm shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Register For Experience</span>
                  </button>
                )}

                {/* If cricket auction, highlight live hub */}
                {event.category === 'cricket' && onGoToAuction && (
                  <button
                    onClick={onGoToAuction}
                    className="w-full py-2.5 px-4 rounded-xl bg-stroom-black hover:bg-stone-800 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Flame className="w-4 h-4 text-stroom-orange" />
                    <span>Open Live Cricket Auction Arena</span>
                  </button>
                )}
              </div>

              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-stroom-borderLight space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-500">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>100% Verified STROOM Community Meetup</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Instant QR Code Pass Generated</span>
                </div>
              </div>
            </div>

            {/* Organizer Card */}
            <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-xs">
              <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Meet Your Host</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-stroom-black text-white flex items-center justify-center font-black text-base border border-stroom-orange">
                  ST
                </div>
                <div>
                  <h4 className="text-sm font-black text-stroom-black">STROOM Experience Crew</h4>
                  <p className="text-xs text-stroom-deep font-bold">Community Chapter Host</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-stone-600 font-medium leading-relaxed">
                Our certified community hosts facilitate introductions, manage timings, and ensure an energetic and comfortable experience for first-timers and regulars alike.
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* Registration Modal */}
      <RegistrationModal
        isOpen={isModalOpen}
        event={modalEventDetails}
        onClose={() => setIsModalOpen(false)}
        onRegistrationSuccess={() => {
          fetchEventDetails();
        }}
      />
    </div>
  );
};
