import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Event } from '../../types';
import { RegistrationModal, EventDetails } from '../modals/RegistrationModal';
import { EmptyState } from '../common/EmptyState';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ArrowRight,
  Filter,
  Sparkles,
  RefreshCw,
  Trophy,
  Coffee,
  Film,
  Compass,
  Gamepad2,
  Bike,
  Activity,
  Palette,
  Briefcase,
  Users,
  ChevronRight,
  CheckCircle2,
  Flame,
  AlertCircle,
  Plus
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

interface DiscoverEventsPageProps {
  initialCategory?: string;
  initialCity?: string;
  onSelectEvent: (eventId: string) => void;
  onGoToCommunities?: () => void;
  onGoToSubmitEvent?: () => void;
  onOpenAuth?: (eventId?: string) => void;
}

// 10 Official STROOM Experience Categories
const CATEGORIES = [
  { id: 'all', label: 'All Experiences', icon: Compass },
  { id: 'cricket', label: 'Box Cricket', icon: Trophy, isFlagship: true },
  { id: 'sports', label: 'Sports & Turf', icon: Activity },
  { id: 'gaming', label: 'Gaming & Esports', icon: Gamepad2 },
  { id: 'cafe', label: 'Café Meetups', icon: Coffee },
  { id: 'movie', label: 'Movie Screenings', icon: Film },
  { id: 'fitness', label: 'Fitness & Outdoor', icon: Activity },
  { id: 'cycling', label: 'Cycling & Runs', icon: Bike },
  { id: 'networking', label: 'Networking', icon: Briefcase },
  { id: 'creative', label: 'Art & Pottery', icon: Palette },
  { id: 'social', label: 'Board Games & Trivia', icon: Users },
];

const CITIES = [
  { id: 'all', name: 'All Cities' },
  { id: 'city_hyd', name: 'Hyderabad' },
  { id: 'city_pune', name: 'Pune' },
  { id: 'city_mum', name: 'Mumbai (Coming Soon)' },
  { id: 'city_delhi', name: 'Delhi (Coming Soon)' },
  { id: 'city_blr', name: 'Bangalore (Coming Soon)' },
  { id: 'city_kolkata', name: 'Kolkata (Coming Soon)' },
];

export const DiscoverEventsPage: React.FC<DiscoverEventsPageProps> = ({
  initialCategory = 'all',
  initialCity = 'all',
  onSelectEvent,
  onGoToCommunities,
  onOpenAuth,
  onGoToSubmitEvent,
}) => {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [timeframe, setTimeframe] = useState<'upcoming' | 'featured' | 'past'>('upcoming');

  // Registration Modal State
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getEvents({
        city_id: selectedCity !== 'all' ? selectedCity : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery.trim() || undefined,
        price_filter: priceFilter !== 'all' ? priceFilter : undefined,
        timeframe: timeframe,
      });

      if (res && res.events) {
        setEvents(res.events);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError('Unable to load events right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedCity, selectedCategory, priceFilter, timeframe]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchEvents();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleOpenRegistration = (ev: Event) => {
    if (!isAuthenticated) {
      if (onOpenAuth) {
        onOpenAuth(ev.id);
      }
      return;
    }
    const eventDetails: EventDetails = {
      id: ev.id,
      title: ev.title,
      city: ev.city_name || 'Hyderabad',
      date: ev.event_date,
      time: ev.event_time,
      venue: ev.venue_name ? `${ev.venue_name}, ${ev.venue_area || ''}` : 'STROOM Arena',
      seatsLeft: ev.seats_left !== undefined ? ev.seats_left : (ev.seats_total - ev.seats_booked),
      category: ev.category,
      entryFee: ev.entry_fee,
    };
    setSelectedEventForModal(eventDetails);
    setIsModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCity('all');
    setSelectedCategory('all');
    setPriceFilter('all');
    setTimeframe('upcoming');
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Header Banner */}
      <section className="bg-gradient-to-b from-stroom-cream to-stroom-ivory border-b border-stroom-borderLight pt-10 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stroom-orange/10 border border-stroom-orange/30 text-stroom-deep text-xs font-black uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
                <span>Real-World Social Experiences</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stroom-black tracking-tight uppercase">
                Find Your Next <span className="text-stroom-orange">Experience</span>.
              </h1>
              <p className="mt-2 text-stroom-charcoal/80 text-sm sm:text-base max-w-2xl font-medium">
                Sporting showdowns, turf tournaments, café mixers, and community gatherings across Hyderabad, Pune, Bangalore, and Mumbai.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              {onGoToCommunities && (
                <button
                  onClick={onGoToCommunities}
                  className="px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-black text-stroom-black shadow-xs flex items-center gap-2 transition-all"
                >
                  <Users className="w-4 h-4 text-stroom-orange" />
                  <span>Browse Communities</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar & City Selector */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-8 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search by event title, venue, locality, or interest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-stroom-borderLight rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange focus:border-transparent shadow-xs placeholder-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stroom-black"
                >
                  Clear
                </button>
              )}
            </div>

            {/* City Selector */}
            <div className="md:col-span-4 flex items-center bg-white p-1 rounded-2xl border border-stroom-borderLight shadow-xs overflow-x-auto">
              {CITIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCity(c.id)}
                  className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-extrabold text-center transition-all ${
                    selectedCity === c.id
                      ? 'bg-stroom-orange text-white shadow-xs'
                      : 'text-stroom-charcoal/80 hover:text-stroom-black hover:bg-stroom-cream/50'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Chips Bar */}
          <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap border transition-all ${
                    isSelected
                      ? 'bg-stroom-black text-white border-stroom-black shadow-brand'
                      : 'bg-white text-stroom-charcoal border-stroom-borderLight hover:border-stroom-orange/60 hover:bg-stroom-cream/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-stroom-orange' : 'text-stroom-orange/80'}`} />
                  <span>{cat.label}</span>
                  {cat.isFlagship && (
                    <span className="w-1.5 h-1.5 rounded-full bg-stroom-orange animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub Filters: Timeframe & Price Filter */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stroom-borderLight/60">
            {/* Timeframe Tabs */}
            <div className="flex items-center gap-1.5 bg-stroom-cream/70 p-1 rounded-xl">
              <button
                onClick={() => setTimeframe('upcoming')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  timeframe === 'upcoming'
                    ? 'bg-white text-stroom-black shadow-xs'
                    : 'text-stroom-charcoal/70 hover:text-stroom-black'
                }`}
              >
                Upcoming Events
              </button>
              <button
                onClick={() => setTimeframe('featured')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  timeframe === 'featured'
                    ? 'bg-white text-stroom-deep shadow-xs'
                    : 'text-stroom-charcoal/70 hover:text-stroom-black'
                }`}
              >
                <Flame className="w-3 h-3 text-stroom-orange" />
                Flagship Events
              </button>
              <button
                onClick={() => setTimeframe('past')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  timeframe === 'past'
                    ? 'bg-white text-stroom-black shadow-xs'
                    : 'text-stroom-charcoal/70 hover:text-stroom-black'
                }`}
              >
                Past Highlights
              </button>
            </div>

            {/* Price Filter & Reset */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-stroom-borderLight p-1 rounded-xl">
                <button
                  onClick={() => setPriceFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                    priceFilter === 'all' ? 'bg-stroom-orange text-white' : 'text-stone-600 hover:text-stroom-black'
                  }`}
                >
                  All Pricing
                </button>
                <button
                  onClick={() => setPriceFilter('free')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                    priceFilter === 'free' ? 'bg-stroom-orange text-white' : 'text-stone-600 hover:text-stroom-black'
                  }`}
                >
                  Free Entry
                </button>
                <button
                  onClick={() => setPriceFilter('paid')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                    priceFilter === 'paid' ? 'bg-stroom-orange text-white' : 'text-stone-600 hover:text-stroom-black'
                  }`}
                >
                  Paid Pass
                </button>
              </div>

              {(searchQuery || selectedCity !== 'all' || selectedCategory !== 'all' || priceFilter !== 'all' || timeframe !== 'upcoming') && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 text-xs font-bold text-stroom-deep hover:text-stroom-orange flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Events Grid Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Results Counter */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-extrabold text-stroom-charcoal uppercase tracking-wider">
            Showing <span className="text-stroom-orange font-black">{events.length}</span> {timeframe === 'past' ? 'Past Meetups' : 'Upcoming Experiences'}
          </p>
          <div className="text-xs font-bold text-stone-500">
            Live Verified Real-World Meetups
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-stroom-orange animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-stroom-charcoal">Loading experiences across your city...</p>
          </div>
        )}

        {/* Error Notice */}
        {error && !isLoading && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={fetchEvents}
              className="ml-auto underline font-bold hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && events.length === 0 && (
          <EmptyState
            icon={Compass}
            title="New Experiences Coming Soon"
            description="We are curating upcoming weekend sessions for this selection. Be among the first to propose an experience or host in your city."
            secondaryActionText="Reset All Filters"
            onSecondaryAction={handleResetFilters}
            actionText={onGoToSubmitEvent ? "Submit an Event" : undefined}
            onAction={onGoToSubmitEvent}
          />
        )}

        {/* Event Cards Grid */}
        {!isLoading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev) => {
              const seatsLeft = ev.seats_left !== undefined ? ev.seats_left : (ev.seats_total - ev.seats_booked);
              const isSoldOut = seatsLeft <= 0;
              const isPast = ev.status === 'completed' || timeframe === 'past';
              const percentBooked = Math.min(100, Math.round((ev.seats_booked / ev.seats_total) * 100));

              return (
                <div
                  key={ev.id}
                  className="bg-white rounded-3xl border border-stroom-borderLight overflow-hidden hover:shadow-xl hover:border-stroom-orange/50 transition-all duration-300 flex flex-col group"
                >
                  {/* Card Banner Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-stroom-charcoal">
                    <img
                      src={ev.image_url}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-black/80 backdrop-blur-md text-white border border-white/20">
                        {ev.category.toUpperCase()}
                      </span>
                      {ev.is_flagship === 1 && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-current" />
                          FLAGSHIP
                        </span>
                      )}
                    </div>

                    {/* Bottom Metadata inside image */}
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-white text-xs font-bold">
                      <div className="flex items-center gap-1.5 drop-shadow-md">
                        <MapPin className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>{ev.city_name || 'Hyderabad'}</span>
                      </div>
                      <div className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-extrabold text-stroom-cream border border-white/10">
                        {ev.entry_fee}
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Title */}
                      <h3
                        onClick={() => onSelectEvent(ev.id)}
                        className="text-base font-black text-stroom-black group-hover:text-stroom-orange transition-colors cursor-pointer line-clamp-1"
                      >
                        {ev.title}
                      </h3>

                      {/* Description */}
                      <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium line-clamp-2">
                        {ev.description}
                      </p>

                      {/* Date & Time */}
                      <div className="mt-4 space-y-2 text-xs font-bold text-stroom-charcoal">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-stroom-orange" />
                          <span>{ev.event_date}</span>
                          <span className="text-stone-300">•</span>
                          <Clock className="w-3.5 h-3.5 text-stroom-orange" />
                          <span>{ev.event_time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-500 font-semibold truncate">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                          <span className="truncate">{ev.venue_name || 'Venue'}, {ev.venue_area || ev.city_name}</span>
                        </div>
                      </div>

                      {/* Capacity & Progress */}
                      {!isPast && (
                        <div className="mt-4 pt-3 border-t border-stroom-borderLight/80">
                          <div className="flex items-center justify-between text-[11px] font-extrabold mb-1.5">
                            <span className="text-stroom-charcoal">
                              Seats Booked: <span className="text-stroom-black font-black">{ev.seats_booked}/{ev.seats_total}</span>
                            </span>
                            <span className={seatsLeft <= 5 ? 'text-red-600 font-black' : 'text-stroom-deep font-bold'}>
                              {isSoldOut ? 'Sold Out' : `${seatsLeft} seats left`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSoldOut
                                  ? 'bg-stone-400'
                                  : seatsLeft <= 5
                                  ? 'bg-red-500'
                                  : 'bg-gradient-to-r from-stroom-orange to-stroom-deep'
                              }`}
                              style={{ width: `${percentBooked}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-3 flex items-center gap-2">
                      <button
                        onClick={() => onSelectEvent(ev.id)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-stroom-cream hover:bg-stroom-cream/80 text-stroom-black font-black text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5 text-stroom-orange" />
                      </button>

                      {!isPast && !isSoldOut ? (
                        <button
                          onClick={() => handleOpenRegistration(ev)}
                          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Register</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="py-2.5 px-3 rounded-xl bg-stone-100 text-stone-400 font-bold text-xs cursor-not-allowed"
                        >
                          {isPast ? 'Concluded' : 'Full'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Registration Modal */}
      <RegistrationModal
        isOpen={isModalOpen}
        event={selectedEventForModal}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEventForModal(null);
        }}
        onOpenAuth={onOpenAuth}
        onRegistrationSuccess={() => {
          fetchEvents();
        }}
      />
    </div>
  );
};
