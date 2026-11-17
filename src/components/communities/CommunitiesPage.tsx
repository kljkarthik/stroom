import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Community } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../common/EmptyState';
import {
  Users,
  Compass,
  Search,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  Check,
  Plus,
  RefreshCw,
  Trophy,
  Coffee,
  Film,
  Gamepad2,
  Bike,
  Activity,
  Palette,
  Briefcase,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface CommunitiesPageProps {
  initialCategory?: string;
  initialCity?: string;
  onSelectCommunity: (communityId: string) => void;
  onOpenAuth?: () => void;
  onGoToEvents?: () => void;
  onGoToSubmitEvent?: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Communities', icon: Compass },
  { id: 'cricket', label: 'Cricket & Sports', icon: Trophy },
  { id: 'gaming', label: 'Gaming & Esports', icon: Gamepad2 },
  { id: 'cafe', label: 'Café Explorers', icon: Coffee },
  { id: 'movie', label: 'Movie Buffs', icon: Film },
  { id: 'fitness', label: 'Fitness & Outdoors', icon: Activity },
  { id: 'cycling', label: 'Cycling & Running', icon: Bike },
  { id: 'networking', label: 'Tech & Networking', icon: Briefcase },
  { id: 'creative', label: 'Art & Design', icon: Palette },
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

export const CommunitiesPage: React.FC<CommunitiesPageProps> = ({
  initialCategory = 'all',
  initialCity = 'all',
  onSelectCommunity,
  onOpenAuth,
  onGoToEvents,
  onGoToSubmitEvent,
}) => {
  const { isAuthenticated } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchCommunities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCommunities({
        city_id: selectedCity !== 'all' ? selectedCity : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res && res.communities) {
        setCommunities(res.communities);
      } else {
        setCommunities([]);
      }
    } catch (err: any) {
      console.error('Error fetching communities:', err);
      setError('Unable to load communities right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [selectedCity, selectedCategory]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCommunities();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleToggleMembership = async (comm: Community, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    setJoiningId(comm.id);
    try {
      if (comm.is_member) {
        const res = await api.leaveCommunity(comm.id);
        setCommunities((prev) =>
          prev.map((c) =>
            c.id === comm.id ? { ...c, is_member: false, member_count: res.member_count } : c
          )
        );
      } else {
        const res = await api.joinCommunity(comm.id);
        setCommunities((prev) =>
          prev.map((c) =>
            c.id === comm.id ? { ...c, is_member: true, member_count: res.member_count } : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to update membership:', err);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Header Banner */}
      <section className="bg-gradient-to-b from-stroom-cream to-stroom-ivory border-b border-stroom-borderLight pt-10 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stroom-orange/10 border border-stroom-orange/30 text-stroom-deep text-xs font-black uppercase tracking-wider mb-3">
                <Users className="w-3.5 h-3.5 text-stroom-orange" />
                <span>Micro-Communities & Interest Circles</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stroom-black tracking-tight uppercase">
                Find Your <span className="text-stroom-orange">People</span>.
              </h1>
              <p className="mt-2 text-stroom-charcoal/80 text-sm sm:text-base max-w-2xl font-medium">
                Connect with active groups for sports, board games, cafes, and passions. Regular meetups, shared interests, and real-world friendships.
              </p>
            </div>

            {onGoToEvents && (
              <button
                onClick={onGoToEvents}
                className="px-4 py-2.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black shadow-md flex items-center gap-2 transition-all self-start md:self-auto"
              >
                <Compass className="w-4 h-4 text-stroom-orange" />
                <span>Explore City Events</span>
              </button>
            )}
          </div>

          {/* Search Bar & City Selector */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-8 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search communities by name, topic, or interest..."
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
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Communities Grid Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-extrabold text-stroom-charcoal uppercase tracking-wider">
            Showing <span className="text-stroom-orange font-black">{communities.length}</span> Communities
          </p>
          <div className="text-xs font-bold text-stone-500">
            Real People • Real Meetups
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-stroom-orange animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-stroom-charcoal">Loading active communities...</p>
          </div>
        )}

        {/* Error Notice */}
        {error && !isLoading && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={fetchCommunities} className="ml-auto underline font-bold hover:text-red-900">
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && communities.length === 0 && (
          <EmptyState
            icon={Users}
            title="Communities Are Growing"
            description="Be among the first to start an authentic real-world circle. Connect with people in your city around sports, coffee, board games, and creative passions."
            secondaryActionText="Reset Search & Filters"
            onSecondaryAction={() => {
              setSearchQuery('');
              setSelectedCity('all');
              setSelectedCategory('all');
            }}
            actionText={onGoToSubmitEvent ? "Propose an Experience" : undefined}
            onAction={onGoToSubmitEvent}
          />
        )}

        {/* Community Cards Grid */}
        {!isLoading && !error && communities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities.map((comm) => (
              <div
                key={comm.id}
                onClick={() => onSelectCommunity(comm.id)}
                className="bg-white rounded-3xl border border-stroom-borderLight overflow-hidden hover:shadow-xl hover:border-stroom-orange/50 transition-all duration-300 flex flex-col group cursor-pointer"
              >
                {/* Banner Image */}
                <div className="relative h-44 w-full overflow-hidden bg-stroom-charcoal">
                  <img
                    src={comm.image_url}
                    alt={comm.name}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-black/80 backdrop-blur-md text-white border border-white/20">
                      {comm.category.toUpperCase()}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand">
                      {comm.city_name || 'Hyderabad'}
                    </span>
                  </div>

                  {/* Members count inside image */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-white text-xs font-extrabold">
                    <div className="flex items-center gap-1.5 drop-shadow-md">
                      <Users className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>{comm.member_count} Members</span>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-black text-stroom-black group-hover:text-stroom-orange transition-colors">
                      {comm.name}
                    </h3>
                    <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium line-clamp-2 leading-relaxed">
                      {comm.description}
                    </p>

                    {/* Schedule & Organizer */}
                    <div className="mt-4 pt-3 border-t border-stroom-borderLight/80 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                        <Calendar className="w-3.5 h-3.5 text-stroom-orange flex-shrink-0" />
                        <span className="truncate">{comm.meeting_schedule}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                        <span className="w-5 h-5 rounded-full bg-stroom-cream text-stroom-deep font-bold text-[10px] flex items-center justify-center flex-shrink-0 border border-stroom-orange/30">
                          {comm.organizer_name.charAt(0)}
                        </span>
                        <span className="truncate">Lead: {comm.organizer_name} ({comm.organizer_role})</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-3 border-t border-stroom-borderLight flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCommunity(comm.id);
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stroom-cream hover:bg-stroom-cream/80 text-stroom-black font-black text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Explore</span>
                      <ArrowRight className="w-3.5 h-3.5 text-stroom-orange" />
                    </button>

                    <button
                      onClick={(e) => handleToggleMembership(comm, e)}
                      disabled={joiningId === comm.id}
                      className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        comm.is_member
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-stroom-orange text-white shadow-brand hover:brightness-105'
                      }`}
                    >
                      {joiningId === comm.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : comm.is_member ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Joined</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Join</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lead a Community Banner */}
        <div className="mt-16 bg-gradient-to-r from-stroom-black via-stone-900 to-stroom-charcoal rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-stone-800">
          <div className="relative z-10 max-w-2xl">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand">
              STROOM Chapter Leadership
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3 uppercase tracking-tight">
              Want to start a community in your city?
            </h2>
            <p className="mt-2 text-stone-300 text-xs sm:text-sm font-medium leading-relaxed">
              Become an official STROOM Chapter Host. We provide venue partnerships, digital ticketing, event management tools, and support to build your tribe.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
