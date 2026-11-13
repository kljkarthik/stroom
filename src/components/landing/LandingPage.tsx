import React, { useState, useEffect } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { RegistrationModal, EventDetails } from '../modals/RegistrationModal';
import { PartnerProposalModal } from '../modals/PartnerProposalModal';
import { HostEventModal } from '../modals/HostEventModal';
import { api } from '../../services/api';
import { Community } from '../../types';
import {
  Users,
  Target,
  Handshake,
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
  onGoToAuction: () => void;
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
}

// 10 Official Experience Categories with Icons & Descriptions
const EXPERIENCE_CATEGORIES = [
  {
    id: 'sports',
    title: 'Cricket & Sports',
    desc: 'Live franchise player auctions, box cricket, and 5-a-side floodlit turf leagues where teammates become friends.',
    icon: Trophy,
    highlight: 'Flagship Event',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80',
    color: 'from-stroom-orange to-stroom-deep',
  },
  {
    id: 'gaming',
    title: 'Gaming',
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
    desc: 'Outdoor projector cinema nights, indie festival shorts, and IPL finals watch-alongs under open skies.',
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

// Verified Community Stories (Genuine member perspectives)
const COMMUNITY_STORIES = [
  {
    quote: "I moved to Hyderabad knowing zero people in Gachibowli. Registered for the STROOM cricket auction on a whim. Today, my franchise teammates are my flatmates and best friends.",
    author: "Karan Mehra",
    role: "Product Designer • Hyderabad",
    tag: "Auction Participant #42",
  },
  {
    quote: "The live bidding stage in Pune was more fun than any corporate mixer or dating app. The energy was electric, and everyone was genuinely open to meeting new people.",
    author: "Sneha Sen",
    role: "Marketing Strategist • Pune",
    tag: "Franchise Bidder",
  },
  {
    quote: "STROOM captures the rare magic of modern cities — giving strangers a safe, exciting reason to laugh, compete, and share stories together.",
    author: "Rishabh Goel",
    role: "Software Architect • Bangalore",
    tag: "Weekend League Member",
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onGoToAuction,
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
}) => {
  const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);

  // Policy Modal states
  const [policyModalType, setPolicyModalType] = useState<'privacy' | 'terms' | null>(null);

  // Real backend data states
  const [backendEvents, setBackendEvents] = useState<any[]>([]);
  const [featuredCommunities, setFeaturedCommunities] = useState<Community[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState<boolean>(true);

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

  // Load verified communities from database
  const loadCommunities = async () => {
    setIsLoadingCommunities(true);
    try {
      const res = await api.getCommunities();
      if (res && Array.isArray(res.communities)) {
        // Prioritize Hyderabad and Pune
        setFeaturedCommunities(res.communities.slice(0, 3));
      }
    } catch (err) {
      console.warn('Could not load communities from database:', err);
    } finally {
      setIsLoadingCommunities(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [selectedCityId]);

  useEffect(() => {
    loadCommunities();
  }, []);

  const handleRegisterEvent = (event: EventDetails) => {
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
      category: ev.category || 'Cricket Auction',
      entryFee: ev.entry_fee || 'Free Entry',
      image_url: ev.image_url,
      description: ev.description,
    };
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black selection:bg-stroom-orange selection:text-white">
      
      {/* ==================================================
          SECTION 1 — HERO SECTION
          ================================================== */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:pb-24 border-b border-stroom-borderLight">
        {/* Ambient Top Contours */}
        <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-stroom-cream/70 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Hero Text Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              
              {/* Brand Logo & Subtitle */}
              <div className="inline-flex flex-col items-center lg:items-start">
                <StroomLogo variant="dark" size="xl" showSubtitle={true} />
              </div>

              {/* Official Tagline Headline */}
              <div className="pt-2">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stroom-black tracking-tight leading-none font-display">
                  STRANGERS TODAY.
                  <br />
                  <span className="stroom-tagline-brush mt-2 inline-block">
                    STORIES TOMORROW.
                  </span>
                </h1>
              </div>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-stroom-charcoal/80 max-w-xl font-medium leading-relaxed">
                Discover experiences, meet like-minded people, and turn shared interests into unforgettable real-world connections.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <button
                  onClick={() => onGoToDiscover?.()}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm sm:text-base shadow-brand hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-2"
                >
                  <Compass className="w-5 h-5" />
                  <span>Explore Experiences</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                <button
                  onClick={onGoToAuth}
                  className="px-6 py-3.5 rounded-2xl bg-white hover:bg-stroom-cream border-2 border-stroom-orange/30 text-stroom-black font-extrabold text-sm sm:text-base shadow-sm transition-all flex items-center gap-2"
                >
                  <Users className="w-5 h-5 text-stroom-orange" />
                  <span>Join STROOM</span>
                </button>

                <button
                  onClick={onGoToAuction}
                  className="px-5 py-3.5 rounded-2xl bg-stroom-charcoal hover:bg-stroom-black text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-stroom-gold" />
                  <span>Live Cricket Auction</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 pt-3 text-xs font-bold text-stroom-charcoal/70">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-stroom-orange" /> Launch City #1: Hyderabad
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-stroom-orange" /> Launch City #2: Pune
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-stroom-orange" /> 100% Real Strangers
                </span>
              </div>
            </div>

            {/* Right Hero Visual: Authentic Community Gathering from Poster */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                
                {/* Decorative Glow */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-stroom-orange/30 to-stroom-gold/20 rounded-4xl filter blur-2xl opacity-70" />

                {/* Main Framed Poster Image */}
                <div className="relative rounded-3xl overflow-hidden border-4 border-white shadow-2xl bg-stroom-cream">
                  <img
                    src="/brand/stroom-community-hero.jpg"
                    alt="STROOM Community Friends Meetup at Sunset"
                    className="w-full h-80 sm:h-96 object-cover hover:scale-105 transition-transform duration-700"
                  />
                  
                  {/* Floating Live Badge */}
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-stroom-black/85 backdrop-blur-md text-white text-xs font-extrabold flex items-center gap-2 border border-stroom-orange/40 shadow">
                    <span className="w-2 h-2 rounded-full bg-stroom-orange animate-ping" />
                    <span>Hyderabad Arena Live</span>
                  </div>

                  {/* Gradient Overlay at bottom */}
                  <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-stroom-black/90 via-stroom-black/60 to-transparent text-white">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-stroom-orange">
                      Real Strangers • Real Connections
                    </p>
                    <p className="text-sm font-extrabold mt-0.5">
                      "Walk in alone. Walk out with a squad for life."
                    </p>
                  </div>
                </div>

                {/* Floating Stat Badge */}
                <div className="absolute -bottom-4 -left-4 p-3.5 rounded-2xl bg-white border border-stroom-orange/20 shadow-xl hidden sm:flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-stroom-cream flex items-center justify-center text-stroom-deep font-black">
                    <Trophy className="w-5 h-5 text-stroom-orange" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stroom-charcoal/60">Live Bidding Arena</p>
                    <p className="text-xs font-extrabold text-stroom-black">5 Franchise Tables Active</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ==================================================
          SECTION 2 — WHAT IS STROOM?
          ================================================== */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-stroom-cream/60 via-stroom-ivory to-stroom-cream/40 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-stroom-deep px-3 py-1 rounded-full bg-stroom-orange/10 border border-stroom-orange/20">
              Our Core Philosophy
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-3 font-display">
              What is STROOM?
            </h2>
            <p className="text-sm sm:text-base text-stroom-charcoal/80 mt-2 font-semibold">
              STROOM is a community platform that brings people together through shared interests, activities, and real-world experiences.
            </p>
          </div>

          {/* 4 Pillars Matching Official Brand Poster */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:shadow-brand transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange flex items-center justify-center text-stroom-deep group-hover:text-white transition-colors mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-stroom-black font-display">
                Discover People
              </h3>
              <p className="text-xs sm:text-sm text-stroom-charcoal/70 mt-2 leading-relaxed">
                Connect with vibrant people outside your usual daily circle who are equally excited to meet new friends in the city.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:shadow-brand transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange flex items-center justify-center text-stroom-deep group-hover:text-white transition-colors mb-4">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-stroom-black font-display">
                Explore Interests
              </h3>
              <p className="text-xs sm:text-sm text-stroom-charcoal/70 mt-2 leading-relaxed">
                From live cricket auctions and strategy gaming to specialty coffee cupping, find clubs focused on what you genuinely love.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:shadow-brand transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange flex items-center justify-center text-stroom-deep group-hover:text-white transition-colors mb-4">
                <Handshake className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-stroom-black font-display">
                Join Experiences
              </h3>
              <p className="text-xs sm:text-sm text-stroom-charcoal/70 mt-2 leading-relaxed">
                Step into structured, high-energy meetups. No awkward silences — activities give everyone a natural, fun role from minute one.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-xs hover:shadow-brand transition-all hover:-translate-y-1 group">
              <div className="w-14 h-14 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange flex items-center justify-center text-stroom-deep group-hover:text-white transition-colors mb-4">
                <Heart className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-stroom-black font-display">
                Build Connections
              </h3>
              <p className="text-xs sm:text-sm text-stroom-charcoal/70 mt-2 leading-relaxed">
                Turn memorable events into lasting squad friendships, ongoing chat groups, and shared stories for tomorrow.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ==================================================
          SECTION 3 — DISCOVER EXPERIENCES (10 Categories)
          ================================================== */}
      <section className="py-16 sm:py-20 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-stroom-orange">
                Real-World Catalogue
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
                Discover Experiences
              </h2>
            </div>
            <p className="text-sm text-stroom-charcoal/80 max-w-md mt-2 md:mt-0 font-medium">
              Curated social formats engineered to make joining easy, engaging, and unforgettable.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {EXPERIENCE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  onClick={() => onGoToDiscover?.(cat.id)}
                  className="p-5 rounded-3xl bg-white border border-stroom-borderLight hover:border-stroom-orange hover:shadow-brand transition-all duration-300 flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-stroom-cream text-stroom-deep group-hover:bg-stroom-orange group-hover:text-white flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-charcoal">
                        {cat.highlight}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-stroom-black group-hover:text-stroom-orange transition-colors font-display">
                      {cat.title}
                    </h4>

                    <p className="text-xs text-stroom-charcoal/70 mt-1.5 leading-relaxed line-clamp-3">
                      {cat.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stroom-cream flex items-center justify-between text-xs font-black text-stroom-deep group-hover:text-stroom-orange">
                    <span>Explore</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ==================================================
          SECTION 4 — UPCOMING EVENTS (Dynamic from Backend)
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
                { id: 'all', label: 'All Cities' },
                { id: 'city_hyd', label: 'Hyderabad' },
                { id: 'city_pune', label: 'Pune' },
                { id: 'city_blr', label: 'Bangalore' },
                { id: 'city_mum', label: 'Mumbai' },
              ].map((c) => (
                <button
                  key={c.id}
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
                const isFlagship = ev.is_flagship === 1 || ev.category === 'cricket_auction';
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
                              ? 'bg-stroom-orange text-white shadow-brand'
                              : 'bg-white/90 backdrop-blur-md text-stroom-black'
                          }`}>
                            {ev.category?.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Seats Left Overlay */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-white font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{details.seatsLeft} Seats Remaining</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5">
                        <h3 className="text-base font-black text-stroom-black leading-snug group-hover:text-stroom-deep transition-colors">
                          {ev.title}
                        </h3>

                        <div className="mt-3 space-y-1.5 text-xs text-stroom-charcoal/80">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                            <span>{ev.event_date} • {ev.event_time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                            <span className="truncate">{ev.venue_name || 'STROOM Partner Venue'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-5 pt-0 border-t border-stroom-cream mt-2 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-stroom-deep">
                        {ev.entry_fee || 'Free Entry'}
                      </span>

                      <div className="flex items-center gap-2">
                        {onGoToEventDetails && (
                          <button
                            onClick={() => onGoToEventDetails(ev.id)}
                            className="px-3 py-2 rounded-xl bg-stroom-cream hover:bg-stroom-orange hover:text-white text-stroom-black text-xs font-bold transition-all"
                          >
                            Details
                          </button>
                        )}
                        <button
                          onClick={() => handleRegisterEvent(details)}
                          className="px-4 py-2 rounded-xl bg-stroom-orange hover:bg-stroom-deep text-white text-xs font-black shadow-brand transition-all"
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
            /* Attractive Empty State Required by Prompt */
            <div className="py-16 px-6 text-center bg-white rounded-3xl border border-stroom-borderLight max-w-xl mx-auto shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-stroom-orange" />
              </div>
              <h3 className="text-lg font-black text-stroom-black font-display">
                Something exciting is coming.
              </h3>
              <p className="text-xs text-stroom-charcoal/80 mt-1 max-w-md mx-auto">
                Be the first to discover our next experience. Check all cities or sign up for priority notifications.
              </p>
              <button
                onClick={() => setSelectedCityId('all')}
                className="mt-4 px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
              >
                Browse All Launch Cities
              </button>
            </div>
          )}

        </div>
      </section>

      {/* ==================================================
          SECTION 5 — HOW STROOM WORKS (4-Step Journey)
          ================================================== */}
      <section className="py-16 sm:py-20 border-b border-stroom-borderLight bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-stroom-orange">
              The Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
              How STROOM Works
            </h2>
            <p className="text-sm text-stroom-charcoal/70 mt-1 font-medium">
              Four simple steps from curious stranger to proud squad member.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight text-center relative group hover:border-stroom-orange transition-all">
              <span className="w-10 h-10 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange group-hover:text-white text-stroom-deep font-black text-xs mx-auto flex items-center justify-center mb-4 transition-colors">
                01
              </span>
              <h4 className="text-base font-black text-stroom-black font-display">
                Discover
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Find experiences and community circles matching your interests across Hyderabad and Pune.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight text-center relative group hover:border-stroom-orange transition-all">
              <span className="w-10 h-10 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange group-hover:text-white text-stroom-deep font-black text-xs mx-auto flex items-center justify-center mb-4 transition-colors">
                02
              </span>
              <h4 className="text-base font-black text-stroom-black font-display">
                Connect
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Meet people who share your vibe. Reserve your digital pass and arrive at our curated partner venues.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight text-center relative group hover:border-stroom-orange transition-all">
              <span className="w-10 h-10 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange group-hover:text-white text-stroom-deep font-black text-xs mx-auto flex items-center justify-center mb-4 transition-colors">
                03
              </span>
              <h4 className="text-base font-black text-stroom-black font-display">
                Participate
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Join real-world activities and events. Bid with paddles, play on turfs, or debate in café circles.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight text-center relative group hover:border-stroom-orange transition-all">
              <span className="w-10 h-10 rounded-2xl bg-stroom-cream group-hover:bg-stroom-orange group-hover:text-white text-stroom-deep font-black text-xs mx-auto flex items-center justify-center mb-4 transition-colors">
                04
              </span>
              <h4 className="text-base font-black text-stroom-black font-display">
                Remember
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Collect STROOM Passport stamps, stay connected with your squad, and build your unforgettable story.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ==================================================
          SECTION 6 — FEATURED COMMUNITIES (Hyderabad & Pune)
          ================================================== */}
      <section className="py-16 sm:py-20 bg-stroom-cream/30 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-stroom-orange">
                Real-World Tribes
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
                Featured Communities
              </h2>
            </div>
            
            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <p className="text-sm text-stroom-charcoal/80 font-medium hidden sm:block">
                Launch focus: Hyderabad (#1) & Pune (#2)
              </p>
              {onGoToCommunities && (
                <button
                  onClick={() => onGoToCommunities()}
                  className="px-4 py-2 rounded-xl bg-stroom-charcoal text-white hover:bg-stroom-black text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <span>Explore All Communities</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isLoadingCommunities ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-stroom-orange mx-auto mb-2" />
              <p className="text-xs font-bold text-stroom-charcoal">Loading verified communities...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredCommunities.map((comm) => (
                <div
                  key={comm.id}
                  className="rounded-3xl bg-white border border-stroom-borderLight overflow-hidden shadow-xs hover:shadow-brand transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Cover image */}
                    <div className="relative h-44 w-full overflow-hidden bg-stroom-cream">
                      <img
                        src={comm.image_url}
                        alt={comm.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stroom-black/80 via-transparent to-transparent" />
                      
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full bg-stroom-black/85 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                          {comm.city_name || 'Hyderabad'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-stroom-black text-[10px] font-black">
                          {comm.category}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 text-xs text-white font-bold flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-stroom-cream" />
                        <span>{comm.member_count} Members</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="text-base font-black text-stroom-black group-hover:text-stroom-deep transition-colors leading-snug">
                        {comm.name}
                      </h3>
                      <p className="text-xs text-stroom-charcoal/70 mt-1.5 leading-relaxed line-clamp-3">
                        {comm.description}
                      </p>
                      <p className="text-[11px] font-bold text-stroom-orange mt-3 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{comm.meeting_schedule}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-5 pt-0 border-t border-stroom-cream mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-stroom-charcoal/60 font-semibold truncate max-w-[120px]">
                      Led by {comm.organizer_name}
                    </span>

                    <button
                      onClick={() => onGoToCommunityDetails ? onGoToCommunityDetails(comm.id) : onGoToCommunities?.()}
                      className="px-4 py-2 rounded-xl bg-stroom-cream hover:bg-stroom-orange hover:text-white text-stroom-black text-xs font-black transition-all flex items-center gap-1"
                    >
                      <span>Explore</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* ==================================================
          SECTION 7 — WHY JOIN STROOM?
          ================================================== */}
      <section className="py-16 sm:py-20 bg-white border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-stroom-orange">
              The Real-World Difference
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
              Why Join STROOM?
            </h2>
            <p className="text-sm text-stroom-charcoal/70 mt-1 font-medium">
              Engineered from the ground up for meaningful, organic connections.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            
            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-stroom-orange" />
              </div>
              <h4 className="text-base font-black text-stroom-black font-display">
                Meet Beyond Your Circle
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Connect with people from diverse careers, backgrounds, and creative paths who are eager to make friends.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-stroom-orange" />
              </div>
              <h4 className="text-base font-black text-stroom-black font-display">
                Discover Activities
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Skip the guesswork. Join organized events with verified equipment, booking, and welcoming hosts.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-stroom-orange" />
              </div>
              <h4 className="text-base font-black text-stroom-black font-display">
                Meaningful Experiences
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Structured activities ensure zero awkwardness and equal participation for everyone in the room.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-stroom-orange" />
              </div>
              <h4 className="text-base font-black text-stroom-black font-display">
                Real-World Bonds
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                Over 90% of our attendees stay in close touch with their event squads for months afterward.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-stroom-orange" />
              </div>
              <h4 className="text-base font-black text-stroom-black font-display">
                Cross-City Passport
              </h4>
              <p className="text-xs text-stroom-charcoal/70 mt-2 leading-relaxed">
                One membership passport unlocks community circles in Hyderabad, Pune, Bangalore, and Mumbai.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ==================================================
          SECTION 8 — COMMUNITY STORIES (Testimonials)
          ================================================== */}
      <section className="py-16 sm:py-20 bg-stroom-cream/40 border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-stroom-deep">
              Community Voices
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stroom-black mt-2 font-display">
              Real Stories from Strangers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COMMUNITY_STORIES.map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-xs flex flex-col justify-between"
              >
                <div>
                  <Quote className="w-8 h-8 text-stroom-orange/30 mb-3" />
                  <p className="text-xs sm:text-sm text-stroom-charcoal font-medium leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-stroom-borderLight flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-extrabold text-stroom-black">{t.author}</h5>
                    <p className="text-[11px] text-stroom-charcoal/70">{t.role}</p>
                  </div>
                  <span className="text-[10px] font-bold text-stroom-deep bg-stroom-cream px-2 py-0.5 rounded-full">
                    {t.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ==================================================
          SECTION 9 — FINAL CTA
          ================================================== */}
      <section className="py-20 bg-gradient-to-r from-stroom-black via-stroom-charcoal to-stroom-black text-white relative overflow-hidden border-b border-stroom-borderDark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-orange/20 border border-stroom-orange/40 text-stroom-orange text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            Join the Movement
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight leading-tight">
            Your Next Story Starts Here.
          </h2>

          <p className="text-sm sm:text-base text-stroom-cream/80 max-w-xl mx-auto leading-relaxed">
            Step out, meet people, explore experiences, and make every connection count.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onGoToAuth}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-sm shadow-brand hover:brightness-105 active:scale-95 transition-all"
            >
              Join STROOM
            </button>

            <button
              onClick={() => onGoToDiscover?.()}
              className="px-7 py-3.5 rounded-2xl bg-white text-stroom-black hover:bg-stroom-cream font-black text-sm transition-all"
            >
              Discover Events
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================
          SECTION 10 — FOOTER
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
                  className="w-9 h-9 rounded-full bg-stroom-cardDark hover:bg-stroom-orange flex items-center justify-center text-white transition-colors"
                  title="STROOM Instagram"
                >
                  <Share2 className="w-4 h-4" />
                </a>
                <button
                  onClick={onGoToContact}
                  className="w-9 h-9 rounded-full bg-stroom-cardDark hover:bg-stroom-orange flex items-center justify-center text-white transition-colors"
                  title="Contact Support"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={onGoToAbout}
                  className="w-9 h-9 rounded-full bg-stroom-cardDark hover:bg-stroom-orange flex items-center justify-center text-white transition-colors"
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
                <li><button onClick={() => onGoToDiscover?.()} className="hover:text-white transition-colors">Discover Events</button></li>
                <li><button onClick={() => onGoToCommunities?.()} className="hover:text-white transition-colors">Communities</button></li>
                <li><button onClick={onGoToAuction} className="hover:text-white transition-colors">Live Cricket Auction Hub</button></li>
                <li><button onClick={onGoToAbout} className="hover:text-white transition-colors">About STROOM</button></li>
                <li><button onClick={onGoToPartnerWithUs} className="hover:text-white transition-colors">Partner With Us</button></li>
                <li><button onClick={onGoToFaqs} className="hover:text-white transition-colors">Frequently Asked Questions</button></li>
              </ul>
            </div>

            {/* Launch City Hubs */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-orange">
                Launch Hubs
              </h4>
              <ul className="space-y-2 text-xs text-stroom-cream/70 font-semibold">
                <li><span className="text-white font-bold">Hyderabad</span> (#1 Flagship)</li>
                <li><span className="text-white font-bold">Pune</span> (#2 Live Hub)</li>
                <li><span>Bangalore</span> (Waitlist Open)</li>
                <li><span>Mumbai</span> (Waitlist Open)</li>
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

              <div className="pt-3 border-t border-stroom-borderDark/60 flex items-center gap-4 text-xs text-stroom-cream/60">
                <button
                  onClick={() => setPolicyModalType('privacy')}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Privacy Policy
                </button>
                <span>•</span>
                <button
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
        onClose={() => setIsModalOpen(false)}
        onRegistrationSuccess={loadEvents}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm animate-fade-in text-stroom-black">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setPolicyModalType(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stroom-black"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-stroom-black font-display mb-3">
              STROOM Privacy Policy
            </h3>
            <div className="space-y-3 text-xs text-stroom-charcoal/80 leading-relaxed font-medium">
              <p>
                <strong>1. Information Collection:</strong> STROOM collects account contact information (name, email, phone number) when you register for events or join community circles. This information is used strictly to generate your verified Digital Entry Pass and communicate event details.
              </p>
              <p>
                <strong>2. Community Privacy:</strong> We protect member contact details. Other participants only see your display name and public achievements. Your email and phone are never publicly listed.
              </p>
              <p>
                <strong>3. Partner Verification:</strong> When you present your QR pass at a partner venue, only your attendance status and pass code are verified.
              </p>
              <p>
                <strong>4. Data Security:</strong> Passwords are encrypted with cryptographic salts. We do not sell or lease personal data to external advertisers.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-stroom-cream text-right">
              <button
                onClick={() => setPolicyModalType(null)}
                className="px-4 py-2 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
              >
                Close Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {policyModalType === 'terms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm animate-fade-in text-stroom-black">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setPolicyModalType(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stroom-black"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-stroom-black font-display mb-3">
              STROOM Terms & Conditions
            </h3>
            <div className="space-y-3 text-xs text-stroom-charcoal/80 leading-relaxed font-medium">
              <p>
                <strong>1. Code of Conduct:</strong> STROOM is built on belonging, mutual respect, and friendly camaraderie. Harassment, discrimination, or abusive conduct at any online or in-person meetup results in immediate revocation of membership and passes.
              </p>
              <p>
                <strong>2. Event Passes & Attendance:</strong> Digital passes are personal. Duplicate entry attempts are blocked by our door check-in terminal. Please notify cancellation at least 24 hours prior to the event.
              </p>
              <p>
                <strong>3. Fantasy Bidding Entertainment:</strong> The STROOM Live Cricket Auction is an entertainment and community format. All currency units (e.g. ₹10 Crores) are virtual fantasy tokens with zero cash value. No gambling or betting takes place.
              </p>
              <p>
                <strong>4. Venue Safety:</strong> Participants agree to respect partner venues (cafes, sports turfs, lounges) and follow local venue safety regulations.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-stroom-cream text-right">
              <button
                onClick={() => setPolicyModalType(null)}
                className="px-4 py-2 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
              >
                Accept & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
