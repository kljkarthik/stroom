import React, { useState, useEffect } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { EmptyState } from '../common/EmptyState';
import { RegistrationModal, EventDetails } from '../modals/RegistrationModal';
import { PartnerProposalModal } from '../modals/PartnerProposalModal';
import { HostEventModal } from '../modals/HostEventModal';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Target,
  Heart,
  Calendar,
  MapPin,
  ArrowRight,
  Flame,
  Trophy,
  Coffee,
  Film,
  Compass,
  Sparkles,
  Gamepad2,
  CheckCircle2,
  Quote,
  Share2,
  Globe,
  MessageCircle,
  Mail,
  Phone,
  Ticket,
  Building2,
  PlusCircle,
  Loader2,
  Bike,
  Activity,
  Palette,
  Briefcase,
  ChevronRight,
  Shield,
  Clock,
  X
} from 'lucide-react';

interface LandingPageProps {
  onGoToAuth: () => void;
  onGoToParticipant: () => void;
  onGoToDiscover?: (category?: string) => void;
  onGoToEventDetails?: (eventId: string) => void;
  onGoToCommunities?: (category?: string) => void;
  onGoToCommunityDetails?: (communityId: string) => void;
  onGoToAbout?: () => void;
  onGoToPartnerWithUs?: () => void;
  onGoToContact?: () => void;
  onGoToFaqs?: () => void;
  onOpenAuth?: (eventId?: string) => void;
}

// 10 Official Experience Categories
const EXPERIENCE_CATEGORIES = [
  {
    id: 'sports',
    title: 'Cricket & Sports',
    desc: 'Box cricket leagues, football blitzes, and floodlit turf games where teammates become friends.',
    icon: Trophy,
    highlight: 'Flagship Event',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
    color: 'from-stroom-orange to-stroom-deep',
  },
  {
    id: 'gaming',
    title: 'Gaming & Board Games',
    desc: 'Board game battle nights, Catan tournaments, and FIFA console face-offs at premium city lounges.',
    icon: Gamepad2,
    highlight: 'Trending',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
    color: 'from-purple-600 to-indigo-600',
  },
  {
    id: 'cafe_meetup',
    title: 'Café Meetups',
    desc: 'Chai mornings, artisanal brews, book exchanges, and open-hearted conversations at iconic local cafes.',
    icon: Coffee,
    highlight: 'Chill & Cozy',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80',
    color: 'from-amber-600 to-yellow-600',
  },
  {
    id: 'movies',
    title: 'Movie Screenings',
    desc: 'Outdoor projector cinema nights, indie festival shorts, and sports watch-alongs under open skies.',
    icon: Film,
    highlight: 'Community Night',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
    color: 'from-rose-600 to-pink-600',
  },
  {
    id: 'travel',
    title: 'Travel & Getaways',
    desc: 'Weekend canyon camping, stargazing bonfires, and misty hill retreats curated exclusively for strangers.',
    icon: Compass,
    highlight: 'Adventures',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80',
    color: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'fitness',
    title: 'Fitness & Wellness',
    desc: 'Sunrise park workouts, yoga circles, and functional training sessions designed for every stamina level.',
    icon: Activity,
    highlight: 'Active Life',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80',
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'cycling',
    title: 'Cycling & Outdoors',
    desc: 'Fort foothill pedal rides, dawn trail exploration, and breakfast pitstops with an energetic cycling pack.',
    icon: Bike,
    highlight: 'Early Dawn',
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
    color: 'from-cyan-600 to-blue-700',
  },
  {
    id: 'creativity',
    title: 'Creative Communities',
    desc: 'Sunset acoustic jams, pottery workshops, poetry circles, and art mixers for curious creators.',
    icon: Palette,
    highlight: 'Arts & Culture',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    color: 'from-fuchsia-600 to-purple-700',
  },
  {
    id: 'social',
    title: 'Social Gatherings',
    desc: 'Structured mixer games, trivia showdowns, rooftop socials, and dinner tables designed for easy conversation.',
    icon: Users,
    highlight: 'Weekly',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80',
    color: 'from-stroom-orange to-amber-600',
  },
  {
    id: 'networking',
    title: 'Entrepreneurship & Networking',
    desc: 'Candid founder roundtables, developer brainstorms, and informal builder mixers without stuffy slide decks.',
    icon: Briefcase,
    highlight: 'Builders',
    image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80',
    color: 'from-blue-600 to-indigo-700',
  },
];

// 6 Official Launch Cities
const LAUNCH_CITIES = [
  {
    id: 'city_hyd',
    name: 'Hyderabad',
    state: 'Telangana',
    status: 'open',
    statusLabel: 'Open • Live Experiences',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    description: 'Flagship Launch Hub. Active cricket turfs, artisanal café mixers, and gaming nights across Jubilee Hills & Gachibowli.',
    areas: ['Jubilee Hills', 'Gachibowli', 'Kondapur', 'Hitec City'],
    image: 'https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=800&auto=format&fit=crop&q=80',
    isOpen: true,
  },
  {
    id: 'city_pune',
    name: 'Pune',
    state: 'Maharashtra',
    status: 'open',
    statusLabel: 'Open • Live Experiences',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    description: 'Premier Expansion Hub. Weekend turf tournaments, open-air cafe meetups, and cycling squads in FC Road & Koregaon Park.',
    areas: ['Koregaon Park', 'FC Road', 'Baner', 'Viman Nagar'],
    image: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800&auto=format&fit=crop&q=80',
    isOpen: true,
  },
  {
    id: 'city_mum',
    name: 'Mumbai',
    state: 'Maharashtra',
    status: 'coming_soon',
    statusLabel: 'Coming Soon • Waitlist Open',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    description: 'Coastal Arena & Social Mixer Hub. Sunset runs, turf showdowns, and acoustic cafe evenings across Bandra & BKC.',
    areas: ['Bandra West', 'BKC', 'Juhu', 'Lower Parel'],
    image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&auto=format&fit=crop&q=80',
    isOpen: false,
  },
  {
    id: 'city_delhi',
    name: 'Delhi',
    state: 'Delhi NCR',
    status: 'coming_soon',
    statusLabel: 'Coming Soon • Waitlist Open',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    description: 'Capital Social Hub. Weekend box cricket leagues, cultural walks, and founders coffee meetups across Hauz Khas & CP.',
    areas: ['Hauz Khas', 'Connaught Place', 'South Extension', 'Cyber Hub'],
    image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&auto=format&fit=crop&q=80',
    isOpen: false,
  },
  {
    id: 'city_blr',
    name: 'Bangalore',
    state: 'Karnataka',
    status: 'coming_soon',
    statusLabel: 'Coming Soon • Waitlist Open',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    description: 'Tech & Social Circle Hub. Sunset cycling trails, board game showdowns, and rooftop coffee gatherings across Indiranagar.',
    areas: ['Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield'],
    image: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80',
    isOpen: false,
  },
  {
    id: 'city_kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    status: 'coming_soon',
    statusLabel: 'Coming Soon • Waitlist Open',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    description: 'Cultural & Meetup Hub. Evening chai circles, heritage photo walks, and friendly neighborhood turf sports across Park Street.',
    areas: ['Park Street', 'Salt Lake', 'New Town', 'Ballygunge'],
    image: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=800&auto=format&fit=crop&q=80',
    isOpen: false,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onGoToAuth,
  onGoToParticipant,
  onGoToDiscover,
  onGoToEventDetails,
  onGoToCommunities,
  onGoToCommunityDetails,
  onGoToAbout,
  onGoToPartnerWithUs,
  onGoToContact,
  onGoToFaqs,
  onOpenAuth,
}) => {
  const { isAuthenticated } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);

  // Policy Modal states
  const [policyModalType, setPolicyModalType] = useState<'privacy' | 'terms' | null>(null);

  // Real backend data states
  const [backendEvents, setBackendEvents] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);

  // Load verified events from database
  const loadEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const params = selectedCityId !== 'all' ? { city_id: selectedCityId } : {};
      const res = await api.getEvents(params);
      if (res && Array.isArray(res.events)) {
        setBackendEvents(res.events);
      }
    } catch (err) {
      console.warn('Could not load events from database:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [selectedCityId]);

  const handleRegisterEvent = (event: EventDetails) => {
    if (!isAuthenticated) {
      if (onOpenAuth) {
        onOpenAuth(event.id);
      } else if (onGoToAuth) {
        onGoToAuth();
      }
      return;
    }
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // Map backend event object to EventDetails format
  const mapBackendEventToDetails = (ev: any): EventDetails => {
    const seatsRemaining = ev.seats_left !== undefined
      ? ev.seats_left
      : Math.max(0, (ev.seats_total || 60) - (ev.seats_booked || 0));

    return {
      id: ev.id,
      title: ev.title,
      city: ev.city_name || 'Hyderabad',
      date: ev.event_date,
      time: ev.event_time,
      venue: ev.venue_name || 'STROOM Partner Venue',
      seatsLeft: seatsRemaining,
      category: ev.category || 'Sports & Social',
      entryFee: ev.entry_fee || 'Free Entry',
      image_url: ev.image_url,
      description: ev.description,
    };
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black selection:bg-stroom-orange selection:text-white">
      
      {/* ==================================================
          1. HERO SECTION — IMMERSIVE EDITORIAL CINEMATIC HERO
          ================================================== */}
      <section className="relative overflow-hidden bg-stone-950 text-white min-h-[640px] sm:min-h-[740px] lg:min-h-[820px] flex items-center justify-center border-b border-stroom-borderDark">
        {/* Immersive Full-Bleed Cinematic Background Photograph */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden bg-stone-950">
          <img
            src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=2560&q=85"
            alt="STROOM Community Meetups and Experiences"
            className="w-full h-full object-cover object-[center_35%] filter brightness-[0.72] contrast-[1.08] animate-hero-bg"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Balanced Multi-Layered Dark & Amber Contrast Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/85 via-stone-950/65 to-stone-950 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stroom-orange/15 via-transparent to-stone-950/90 pointer-events-none" />

        {/* Oversized Low-Opacity Architectural Background Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <span className="text-[14vw] sm:text-[12vw] font-black uppercase tracking-tighter text-white/[0.035] leading-none whitespace-nowrap select-none">
            STRANGERS TO STORIES
          </span>
        </div>

        {/* Foreground Content with Precise Center Axis Alignment */}
        <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-20 sm:pt-32 sm:pb-28 flex flex-col items-center">
          
          {/* Confident Brand Logo */}
          <div className="inline-flex items-center justify-center animate-hero-fade mb-5 sm:mb-6">
            <StroomLogo variant="light" size="xl" showSubtitle={false} />
          </div>

          {/* Editorial Headline Reveal */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.08] font-display max-w-4xl mx-auto text-center mb-4 sm:mb-6">
            <span className="block text-white animate-hero-headline-1 pb-1">
              Strangers Today.
            </span>
            <span className="block bg-gradient-to-r from-stroom-orange via-[#FFA24C] to-stroom-gold bg-clip-text text-transparent animate-hero-headline-2 drop-shadow-sm pb-1">
              Stories Tomorrow.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-stone-200/95 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow text-center mb-7 sm:mb-9 animate-hero-desc">
            Discover experiences, meet people, and find your community beyond the screen.
          </p>

          {/* Primary & Secondary Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto mb-8 sm:mb-10 animate-hero-cta">
            <button
              type="button"
              onClick={() => onGoToDiscover?.()}
              className="w-full sm:w-auto h-13 sm:h-14 px-8 sm:px-9 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm sm:text-base shadow-brand-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
            >
              <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
              <span>Explore Experiences</span>
              <ArrowRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => onGoToCommunities ? onGoToCommunities() : onGoToDiscover?.()}
              className="w-full sm:w-auto h-13 sm:h-14 px-8 sm:px-9 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border-2 border-white/25 text-white font-extrabold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Users className="w-5 h-5 text-stroom-orange" />
              <span>Discover Communities</span>
            </button>
          </div>

          {/* Subtle Trust Anchors */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-bold text-stone-300/80 animate-hero-trust">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stroom-orange shrink-0" /> Real-World Gatherings
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stroom-orange shrink-0" /> Zero Awkwardness Hosts
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stroom-orange shrink-0" /> Verified Partner Venues
            </span>
          </div>

        </div>
      </section>

      {/* ==================================================
          2. WHAT IS STROOM? (The 3 Real-World Pillars)
          ================================================== */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-stroom-cream/60 via-stroom-ivory to-stroom-cream/40 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-stroom-deep">
              The Real-World Platform
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
              Real Experiences. Genuine Connections.
            </h2>
            <p className="text-sm sm:text-base text-stroom-charcoal/80 mt-2 font-medium">
              We replace endless swiping and awkward small talk with engaging, structured offline activities where real chemistry happens naturally.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Pillar 1 */}
            <div className="p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:border-stroom-orange/40 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Compass className="w-7 h-7 text-stroom-orange" />
                </div>
                <h3 className="text-xl font-black text-stroom-black font-display">
                  1. Real-World Activities
                </h3>
                <p className="text-xs sm:text-sm text-stroom-charcoal/80 mt-3 leading-relaxed">
                  Box cricket under floodlights, artisanal café mixers, board game tournaments, and outdoor cycling trails. You connect over things you already love doing.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stroom-cream flex items-center gap-2 text-xs font-extrabold text-stroom-deep">
                <span>10 Curated Categories</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:border-stroom-orange/40 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-stroom-orange" />
                </div>
                <h3 className="text-xl font-black text-stroom-black font-display">
                  2. Welcoming Strangers
                </h3>
                <p className="text-xs sm:text-sm text-stroom-charcoal/80 mt-3 leading-relaxed">
                  Every attendee shows up solo or with friends specifically to expand their circle. Our certified hosts facilitate introductions so there's zero awkwardness.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stroom-cream flex items-center gap-2 text-xs font-extrabold text-stroom-deep">
                <span>Inclusive Community</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:border-stroom-orange/40 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-7 h-7 text-stroom-orange" />
                </div>
                <h3 className="text-xl font-black text-stroom-black font-display">
                  3. Verified Partner Venues
                </h3>
                <p className="text-xs sm:text-sm text-stroom-charcoal/80 mt-3 leading-relaxed">
                  All experiences take place in hand-selected, verified venues—from premium sports turfs to third-wave specialty roasters and gaming lounges.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stroom-cream flex items-center gap-2 text-xs font-extrabold text-stroom-deep">
                <span>Safe & Certified Spots</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ==================================================
          3. EXPLORE EXPERIENCES (10 Categories + Dynamic Events)
          ================================================== */}
      <section className="py-16 sm:py-20 bg-stroom-cream/30 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-orange/15 text-stroom-deep border border-stroom-orange/30 text-xs font-black uppercase tracking-widest">
                <Flame className="w-3.5 h-3.5 text-stroom-orange" />
                Live Season Schedule
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
                Upcoming Experiences
              </h2>
            </div>
            
            {/* City Selector & View All Events */}
            <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
              {[
                { id: 'all', label: 'All Open Cities' },
                { id: 'city_hyd', label: 'Hyderabad' },
                { id: 'city_pune', label: 'Pune' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCityId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    selectedCityId === c.id
                      ? 'bg-stroom-orange text-white shadow-brand'
                      : 'bg-white text-stroom-charcoal hover:bg-stroom-cream border border-stroom-borderLight'
                  }`}
                >
                  {c.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => onGoToDiscover?.()}
                className="px-4 py-1.5 rounded-xl bg-stroom-charcoal text-white hover:bg-stroom-black text-xs font-black transition-all ml-1 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Dynamic Events Grid */}
          {isLoadingEvents ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-stroom-orange mx-auto mb-2" />
              <p className="text-xs font-bold text-stroom-charcoal">Loading live experiences...</p>
            </div>
          ) : backendEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {backendEvents.slice(0, 3).map((ev) => {
                const details = mapBackendEventToDetails(ev);
                const isFlagship = ev.is_flagship === 1;
                return (
                  <div
                    key={ev.id}
                    className="rounded-3xl bg-white border border-stroom-borderLight overflow-hidden shadow-xs hover:shadow-brand transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Banner Image */}
                      <div className="relative h-44 w-full overflow-hidden bg-stroom-cream">
                        <img
                          src={ev.image_url}
                          alt={ev.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stroom-black/80 via-transparent to-transparent" />
                        
                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full bg-stroom-black/85 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                            {details.city}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isFlagship
                              ? 'bg-gradient-to-r from-stroom-orange to-stroom-deep text-white shadow'
                              : 'bg-white/90 text-stroom-black'
                          }`}>
                            {isFlagship ? 'Flagship' : details.category}
                          </span>
                        </div>

                        {/* Seats Remaining Pill */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold">
                          <Ticket className="w-3.5 h-3.5 text-stroom-orange" />
                          <span>{details.seatsLeft} spots open</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="text-base font-black text-stroom-black group-hover:text-stroom-deep transition-colors line-clamp-1 leading-snug">
                          {details.title}
                        </h3>
                        <p className="text-xs text-stroom-charcoal/70 mt-1 line-clamp-2 leading-relaxed">
                          {details.description || 'Join fellow enthusiasts for an energetic community gathering.'}
                        </p>

                        <div className="mt-4 pt-3 border-t border-stroom-cream flex items-center justify-between text-xs text-stroom-charcoal/80 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-stroom-orange" />
                            <span>{details.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-stroom-orange" />
                            <span>{details.time}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 text-xs text-stroom-charcoal/70 truncate">
                          <MapPin className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                          <span className="truncate">{details.venue}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="p-5 pt-0 border-t border-stroom-cream mt-2 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stroom-charcoal/60 uppercase font-black block">Access</span>
                        <span className="text-sm font-black text-stroom-black">{details.entryFee}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {onGoToEventDetails && (
                          <button
                            type="button"
                            onClick={() => onGoToEventDetails(ev.id)}
                            className="px-3 py-2 rounded-xl bg-stroom-cream hover:bg-stroom-cream/80 text-stroom-black text-xs font-black transition-all"
                          >
                            Details
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRegisterEvent(details)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black shadow-brand hover:brightness-105 active:scale-95 transition-all"
                        >
                          Register
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Compass}
              title="New Experiences Coming Soon"
              description="We are curating upcoming weekend sessions. Be among the first to propose an experience or host in your city."
              secondaryActionText="Browse All Open Cities"
              onSecondaryAction={() => setSelectedCityId('all')}
              actionText={onGoToPartnerWithUs ? "Submit an Event" : undefined}
              onAction={onGoToPartnerWithUs}
            />
          )}

          {/* 10 Category Quick Pills */}
          <div className="mt-12 pt-8 border-t border-stroom-borderLight">
            <p className="text-[10px] font-black uppercase tracking-widest text-stroom-charcoal/60 mb-4 text-center">
              Explore Experiences by Passion
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {EXPERIENCE_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onGoToDiscover?.(cat.id)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white hover:bg-stroom-cream/60 border border-stroom-borderLight hover:border-stroom-orange/40 text-xs font-bold text-stroom-black transition-all hover:-translate-y-0.5 shadow-2xs"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-stroom-orange" />
                    <span>{cat.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================
          4. DISCOVER COMMUNITIES (Tribe Teaser Banner)
          ================================================== */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-stroom-black via-stone-900 to-stroom-black text-white relative overflow-hidden border-b border-stroom-borderLight">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,87,34,0.15),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-black uppercase tracking-widest text-stroom-orange">
                Find Your Tribe
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
                Discover Interest-Based Communities
              </h2>
              <p className="text-sm sm:text-base text-stone-300 font-medium leading-relaxed">
                Connect with verified local circles across sports, fitness, café meetups, cinema, and casual gaming in your neighborhood. Walk into events where everyone shares your passion.
              </p>
            </div>
            <div className="shrink-0 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => onGoToCommunities?.()}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-sm shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>Explore All Communities</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          5. LAUNCH HUB — 6 CITIES AVAILABILITY
          ================================================== */}
      <section className="py-16 sm:py-20 bg-white border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-stroom-orange">
              National Footprint
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
              Launch Hub & City Availability
            </h2>
            <p className="text-xs sm:text-sm text-stroom-charcoal/70 mt-1 font-medium">
              STROOM is live in Hyderabad and Pune, with Mumbai, Delhi, Bangalore, and Kolkata launching next.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {LAUNCH_CITIES.map((city) => (
              <div
                key={city.id}
                className="rounded-3xl bg-stroom-ivory border border-stroom-borderLight overflow-hidden flex flex-col justify-between hover:border-stroom-orange/40 hover:-translate-y-1 transition-all duration-300 shadow-2xs"
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden bg-stroom-cream">
                    <img
                      src={city.image}
                      alt={city.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${city.badgeClass}`}>
                        {city.isOpen ? 'Open' : 'Coming Soon'}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 text-white">
                      <h3 className="text-lg font-black">{city.name}</h3>
                      <p className="text-[11px] font-bold text-stroom-orange">{city.state}</p>
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="text-xs text-stroom-charcoal/80 leading-relaxed font-medium">
                      {city.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {city.areas.map((area, aIdx) => (
                        <span key={aIdx} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-stroom-borderLight text-stroom-charcoal">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  {city.isOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCityId(city.id);
                        onGoToDiscover?.(city.id);
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Explore {city.name} Experiences</span>
                    </button>
                  ) : (
                    <div className="w-full py-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 font-bold text-xs text-center flex items-center justify-center gap-1.5 cursor-not-allowed">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Waitlist Open • Registrations Coming Soon</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ==================================================
          7. HOST OR BUILD YOUR COMMUNITY
          ================================================== */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-stroom-cream/40 via-stroom-ivory to-stroom-cream/60 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Host an Experience */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4 hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream flex items-center justify-center text-stroom-deep">
                <PlusCircle className="w-6 h-6 text-stroom-orange" />
              </div>
              <h3 className="text-2xl font-black text-stroom-black font-display">
                Host an Experience in Your City
              </h3>
              <p className="text-xs sm:text-sm text-stroom-charcoal/80 leading-relaxed font-medium">
                Got a passion for box cricket, acoustic music, bouldering, or chess? Create and lead a STROOM experience. We provide member discovery, venue booking support, and attendance verification.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsHostModalOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-stroom-black text-white font-black text-xs uppercase tracking-wider hover:bg-stone-800 transition-all flex items-center gap-2"
                >
                  <span>Propose an Experience</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Partner With Us */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4 hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream flex items-center justify-center text-stroom-deep">
                <Building2 className="w-6 h-6 text-stroom-orange" />
              </div>
              <h3 className="text-2xl font-black text-stroom-black font-display">
                Partner Your Venue With STROOM
              </h3>
              <p className="text-xs sm:text-sm text-stroom-charcoal/80 leading-relaxed font-medium">
                Own a turf, café, board game lounge, or creative studio? Become a certified STROOM destination. Bring genuine recurring community crowds to your location during peak and off-peak hours.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs uppercase tracking-wider shadow-brand hover:brightness-105 transition-all flex items-center gap-2"
                >
                  <span>Partner With Us</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {onGoToPartnerWithUs && (
                  <button
                    type="button"
                    onClick={onGoToPartnerWithUs}
                    className="px-5 py-3 rounded-2xl bg-stroom-cream text-stroom-black font-black text-xs hover:bg-stroom-cream/80 transition-all"
                  >
                    Learn More
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================
          8. FINAL CTA — JOIN THE STROOM COMMUNITY
          ================================================== */}
      <section className="py-20 bg-gradient-to-r from-stroom-black via-stroom-charcoal to-stroom-black text-white relative overflow-hidden border-b border-stroom-borderDark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-orange/20 border border-stroom-orange/40 text-stroom-orange text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            Official Launch
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight leading-tight">
            Your Next Story Starts Here.
          </h2>

          <p className="text-sm sm:text-base text-stroom-cream/80 max-w-xl mx-auto leading-relaxed font-medium">
            Step out, meet people, explore experiences, and turn strangers into unforgettable friends.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={onGoToAuth}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-sm shadow-brand hover:brightness-105 active:scale-95 transition-all"
            >
              Join STROOM
            </button>

            <button
              type="button"
              onClick={() => onGoToDiscover?.()}
              className="px-7 py-3.5 rounded-2xl bg-white text-stroom-black hover:bg-stroom-cream font-black text-sm transition-all"
            >
              Discover Experiences
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================
          FOOTER
          ================================================== */}
      <footer className="bg-stroom-black text-white pt-16 pb-8 border-t border-stroom-borderDark relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-stroom-borderDark">
            
            {/* Logo and Brand Narrative */}
            <div className="md:col-span-4 space-y-4">
              <StroomLogo variant="light" size="lg" showSubtitle={true} />
              <p className="text-xs text-stroom-cream/80 max-w-sm mt-3 leading-relaxed">
                STRANGERS ROOM (STROOM) brings people together through shared interests, activities, and real-world experiences. Strangers Today. Stories Tomorrow.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://instagram.com/stroom.club"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stroom-orange flex items-center justify-center text-white transition-colors"
                  title="STROOM Instagram"
                >
                  <Share2 className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={onGoToContact}
                  className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stroom-orange flex items-center justify-center text-white transition-colors"
                  title="Contact Support"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onGoToAbout}
                  className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stroom-orange flex items-center justify-center text-white transition-colors"
                  title="About STROOM"
                >
                  <Globe className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Public Navigation */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-orange">
                Explore Platform
              </h4>
              <ul className="space-y-2 text-xs text-stroom-cream/70 font-semibold">
                <li><button type="button" onClick={() => onGoToDiscover?.()} className="hover:text-white transition-colors">Discover Experiences</button></li>
                <li><button type="button" onClick={() => onGoToCommunities?.()} className="hover:text-white transition-colors">Communities</button></li>
                <li><button type="button" onClick={onGoToAbout} className="hover:text-white transition-colors">About STROOM</button></li>
                <li><button type="button" onClick={onGoToPartnerWithUs} className="hover:text-white transition-colors">Partner With Us</button></li>
                <li><button type="button" onClick={onGoToFaqs} className="hover:text-white transition-colors">Frequently Asked Questions</button></li>
              </ul>
            </div>

            {/* Launch City Hubs */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-orange">
                Launch Hubs
              </h4>
              <ul className="space-y-2 text-xs text-stroom-cream/70 font-semibold">
                <li><span className="text-white font-bold">Hyderabad</span> (Open)</li>
                <li><span className="text-white font-bold">Pune</span> (Open)</li>
                <li><span>Mumbai</span> (Coming Soon)</li>
                <li><span>Delhi</span> (Coming Soon)</li>
                <li><span>Bangalore</span> (Coming Soon)</li>
                <li><span>Kolkata</span> (Coming Soon)</li>
              </ul>
            </div>

            {/* Contact Information & Legal Links */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-orange">
                Contact & Support
              </h4>
              <div className="space-y-2 text-xs text-stroom-cream/70 font-medium">
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                  <span>community@stroom.club</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                  <span>+91 80 4920 8800 (Mon-Sat)</span>
                </p>
              </div>

              <div className="pt-3 border-t border-stone-800 flex items-center gap-4 text-xs text-stroom-cream/60">
                <button
                  type="button"
                  onClick={() => setPolicyModalType('privacy')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Privacy Policy
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setPolicyModalType('terms')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Terms & Conditions
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
            <p>© {new Date().getFullYear()} STROOM (STRANGERS ROOM). All rights reserved.</p>
            <p className="text-stroom-orange font-bold">
              "Strangers Today. Stories Tomorrow."
            </p>
          </div>
        </div>
      </footer>

      {/* ==================================================
          MODALS
          ================================================== */}

      {/* Registration Modal */}
      <RegistrationModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEvent(null);
        }}
        onOpenAuth={onOpenAuth}
        onRegistrationSuccess={() => {
          loadEvents();
          if (onGoToParticipant) onGoToParticipant();
        }}
      />

      {/* Partner Proposal Modal */}
      <PartnerProposalModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
      />

      {/* Host Event Modal */}
      <HostEventModal
        isOpen={isHostModalOpen}
        onClose={() => setIsHostModalOpen(false)}
      />

      {/* Privacy Policy Modal */}
      {policyModalType === 'privacy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-stroom-borderLight flex items-center justify-between bg-stroom-ivory">
              <h3 className="text-lg font-black text-stroom-black font-display">STROOM Privacy Policy</h3>
              <button
                type="button"
                onClick={() => setPolicyModalType(null)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-stroom-charcoal/90 leading-relaxed font-sans">
              <p><strong>Effective Date:</strong> January 2026</p>
              <p>STROOM ("Strangers Room") is committed to safeguarding the privacy and personal security of all community participants, partners, and organizers.</p>
              <p><strong>1. Information Collection:</strong> We collect details such as your name, contact information, profile preferences, and attendance history when registering for events or joining community circles.</p>
              <p><strong>2. Use of Information:</strong> Collected data is strictly used to facilitate event check-ins, generate digital verified entry passes, match shared interest circles, and coordinate safety with venue hosts.</p>
              <p><strong>3. Photo and Media:</strong> Photographs taken during public community gatherings may be used for verified community storytelling only with member authorization.</p>
              <p><strong>4. Data Security:</strong> Passwords are encrypted with cryptographic salts. We do not sell or lease personal data to external advertisers.</p>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {policyModalType === 'terms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-stroom-borderLight flex items-center justify-between bg-stroom-ivory">
              <h3 className="text-lg font-black text-stroom-black font-display">STROOM Terms of Participation</h3>
              <button
                type="button"
                onClick={() => setPolicyModalType(null)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-stroom-charcoal/90 leading-relaxed font-sans">
              <p><strong>Community Standard:</strong> STROOM experiences are built on mutual respect, friendly collaboration, and safe, inclusive community interaction.</p>
              <p><strong>1. Code of Conduct:</strong> Harassment, discriminatory speech, uninvited physical contact, or disruptive actions will result in immediate pass revocation and permanent ban from STROOM.</p>
              <p><strong>2. Event Passes:</strong> Passes are issued individually to verified users and are non-transferable at the gate terminal scanner.</p>
              <p><strong>3. Cancellations & Seats:</strong> When cancelling an event pass, notice must be provided through the Participant Hub so released seats can be made available to members on waitlists.</p>
              <p><strong>4. Safety:</strong> Sports and outdoor activities require attendees to adhere to turf guidelines and prioritize personal safety and the safety of teammates.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default LandingPage;
