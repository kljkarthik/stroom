import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { DiscoveryItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  Search,
  Users,
  Calendar,
  Compass,
  UserCheck,
  MapPin,
  Check,
  ChevronRight,
  Filter,
  Trophy,
  Ticket
} from 'lucide-react';

interface DiscoveryFeedProps {
  onStartQuiz: () => void;
  onGoToAuction?: () => void;
}

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({ onStartQuiz, onGoToAuction }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPersonalized, setIsPersonalized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [joinedItems, setJoinedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDiscovery();
    loadPreferences();
  }, [selectedType, searchQuery, user?.onboarding_status]);

  const loadDiscovery = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDiscoveryFeed({
        type: selectedType,
        search: searchQuery,
      });
      setItems(data.items);
      setIsPersonalized(data.is_personalized);
    } catch (err) {
      console.error('Failed to load discovery feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreferences = async () => {
    if (user && user.onboarding_status === 'COMPLETED') {
      try {
        const prefData = await api.getUserPreferences();
        setUserTags(prefData.tags || []);
      } catch {
        // ignore
      }
    }
  };

  const handleActionClick = (id: string) => {
    setJoinedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filterTabs = [
    { id: 'all', label: 'All Vibes', icon: Filter },
    { id: 'community', label: 'Communities', icon: Users },
    { id: 'event', label: 'Meetups', icon: Calendar },
    { id: 'person', label: 'People', icon: UserCheck },
    { id: 'trip', label: 'Trips', icon: Compass },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 animate-fade-in text-stroom-black">
      
      {/* Featured Auction Hero Banner in Community Feed */}
      {onGoToAuction && (
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-stroom-charcoal via-stroom-black to-stroom-cardDark text-white border border-stroom-orange/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stroom-orange flex items-center justify-center text-white shadow-brand">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
                Flagship Community Event
              </span>
              <h3 className="text-base sm:text-lg font-black text-white font-display">
                STROOM Live Cricket Player Auction Hub
              </h3>
              <p className="text-xs text-stroom-cream/70 mt-0.5">
                Join live bidding tables, draft squads, and experience the thrill!
              </p>
            </div>
          </div>
          <button
            onClick={onGoToAuction}
            className="relative z-10 px-5 py-2.5 rounded-xl bg-stroom-orange text-white font-extrabold text-xs shadow-brand hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            <span>Enter Auction Arena</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner based on Onboarding Status */}
      {user?.onboarding_status === 'SKIPPED' && (
        <div className="mb-6 p-5 rounded-3xl bg-stroom-cream/80 border border-stroom-orange/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stroom-orange text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-stroom-black">General Community Feed</p>
              <p className="text-xs text-stroom-charcoal/80">
                You skipped the vibe quiz. Take 1 minute to unlock personalized matching!
              </p>
            </div>
          </div>
          <button
            onClick={onStartQuiz}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs whitespace-nowrap shadow-brand hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Personalize My Feed</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {user?.onboarding_status === 'COMPLETED' && (
        <div className="mb-6 p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-stroom-orange animate-pulse" />
              <span className="text-xs font-black text-stroom-deep tracking-wider uppercase">
                STROOM VIBE MATCHING ACTIVE
              </span>
            </div>
            <button
              onClick={onStartQuiz}
              className="text-xs text-stroom-orange hover:text-stroom-deep transition-colors font-bold hover:underline"
            >
              Update preferences
            </button>
          </div>
          <p className="text-xs text-stroom-charcoal/80 mb-2.5">
            Your community feed is dynamically ranked using your active vibe tags:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {userTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg bg-stroom-cream border border-stroom-orange/30 text-stroom-deep text-[11px] font-bold"
              >
                #{tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-5">
        <Search className="w-4 h-4 text-stroom-orange absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search communities, cricket auctions, cafe meetups, travel trips..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-stroom-borderLight rounded-2xl text-sm font-semibold text-stroom-black placeholder-stone-400 focus:outline-none focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stroom-black"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-6">
        {filterTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'bg-white hover:bg-stroom-cream border border-stroom-borderLight text-stroom-charcoal'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Discovery Items Grid */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-stroom-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-stroom-charcoal/70">Curating STROOM community vibes...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-3xl border border-stroom-borderLight bg-white shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mx-auto mb-3">
            <Compass className="w-7 h-7 text-stroom-orange" />
          </div>
          <h3 className="text-lg font-black text-stroom-black font-display">
            No matching community vibes found
          </h3>
          <p className="text-xs text-stroom-charcoal/80 mt-1 max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? `We couldn't find any vibes matching "${searchQuery}". Try searching for cricket, cafes, gaming, or explore all cities.`
              : `No experiences currently listed under this category. Be the first to start a group!`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <button
              onClick={() => {
                setSelectedType('all');
                setSearchQuery('');
              }}
              className="px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all"
            >
              Reset Filters & Show All Vibes
            </button>
            <button
              onClick={() => {
                setSelectedType('community');
                setSearchQuery('');
              }}
              className="px-4 py-2.5 rounded-xl bg-stroom-cream border border-stroom-orange/30 text-stroom-black text-xs font-bold hover:bg-stroom-orange hover:text-white transition-all"
            >
              Browse Hyderabad & Pune Communities
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => {
            const isJoined = !!joinedItems[item.id];
            return (
              <div
                key={item.id}
                className="group rounded-3xl overflow-hidden border border-stroom-borderLight bg-white hover:border-stroom-orange/50 transition-all duration-300 hover:shadow-brand flex flex-col justify-between"
              >
                <div>
                  {/* Image & Match Overlay */}
                  <div className="relative h-48 w-full overflow-hidden bg-stroom-cream">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stroom-black/80 via-transparent to-transparent" />

                    {/* Vibe Match Badge */}
                    {item.is_vibe_match && (
                      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-black/85 backdrop-blur-md border border-stroom-orange/50 text-stroom-orange text-xs font-black shadow-lg">
                        <Sparkles className="w-3.5 h-3.5 fill-stroom-orange" />
                        <span>{item.match_percentage}% Vibe Match</span>
                      </div>
                    )}

                    {/* Category Pill */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-stroom-black text-[11px] font-black shadow">
                      {item.category}
                    </div>

                    {/* Location or Date badge */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white font-semibold">
                      {item.location && (
                        <span className="inline-flex items-center gap-1 drop-shadow-md">
                          <MapPin className="w-3.5 h-3.5 text-stroom-orange" />
                          <span>{item.location}</span>
                        </span>
                      )}
                      {item.member_count !== undefined && item.member_count > 0 && (
                        <span className="inline-flex items-center gap-1 drop-shadow-md">
                          <Users className="w-3.5 h-3.5 text-stroom-cream" />
                          <span>{item.member_count} members</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Text Details */}
                  <div className="p-5">
                    <h3 className="text-base font-extrabold text-stroom-black group-hover:text-stroom-deep transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-stroom-charcoal/80 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-lg bg-stroom-cream text-stroom-deep text-[10px] font-bold"
                          >
                            #{tag.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="p-5 pt-0">
                  <button
                    onClick={() => handleActionClick(item.id)}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      isJoined
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-stroom-cream hover:bg-stroom-orange hover:text-white text-stroom-black border border-stroom-orange/30'
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Joined / RSVD</span>
                      </>
                    ) : (
                      <>
                        <span>{(item as any).action_label || 'Join Experience'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
