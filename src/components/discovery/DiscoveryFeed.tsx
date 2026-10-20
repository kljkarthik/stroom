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
  Filter
} from 'lucide-react';

interface DiscoveryFeedProps {
  onStartQuiz: () => void;
}

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({ onStartQuiz }) => {
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
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 animate-fade-in">
      {/* Top Banner based on Onboarding Status */}
      {user?.onboarding_status === 'SKIPPED' && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">General Discovery Feed</p>
              <p className="text-xs text-slate-300">
                You skipped the vibe quiz. Take 1 minute to unlock personalized matching!
              </p>
            </div>
          </div>
          <button
            onClick={onStartQuiz}
            className="py-2 px-4 rounded-xl vibe-gradient-bg text-white font-semibold text-xs whitespace-nowrap shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Personalize My Feed</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {user?.onboarding_status === 'COMPLETED' && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400 tracking-wide uppercase">
                VIBE MATCHING ACTIVE
              </span>
            </div>
            <button
              onClick={onStartQuiz}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium hover:underline"
            >
              Update preferences
            </button>
          </div>
          <p className="text-xs text-slate-300 mb-2.5">
            Your feed is dynamically ranked using your active vibe tags:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {userTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium"
              >
                #{tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-5">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search communities, meetups, travel trips, or creators..."
          className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
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
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200'
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
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Curating your discovery vibe...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
          <p className="text-base font-semibold text-slate-300">No matching vibes found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((item) => {
            const isJoined = !!joinedItems[item.id];
            return (
              <div
                key={item.id}
                className="group rounded-3xl overflow-hidden border border-white/10 bg-slate-900/70 hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
              >
                <div>
                  {/* Image & Match Overlay */}
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                    {/* Vibe Match Badge */}
                    {item.is_vibe_match && (
                      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-lg">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>{item.match_percentage}% Vibe Match</span>
                      </div>
                    )}

                    {/* Category Pill */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-200 text-[11px] font-medium">
                      {item.category}
                    </div>

                    {/* Location or Date badge */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                      {item.location && (
                        <span className="inline-flex items-center gap-1 drop-shadow-md">
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          <span>{item.location}</span>
                        </span>
                      )}
                      {item.member_count !== undefined && item.member_count > 0 && (
                        <span className="inline-flex items-center gap-1 drop-shadow-md bg-slate-950/60 px-2 py-0.5 rounded-lg border border-white/10">
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>{item.member_count} members</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 text-left">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-indigo-300/80 font-medium mb-2">{item.subtitle}</p>
                    <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    {/* Matching Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => {
                        const isMatched = item.matching_tags?.includes(tag);
                        return (
                          <span
                            key={tag}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                              isMatched
                                ? 'bg-indigo-500/25 border border-indigo-500/50 text-indigo-200 font-bold'
                                : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                            }`}
                          >
                            #{tag.replace(/_/g, '-')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-5 pb-5 pt-2">
                  <button
                    onClick={() => handleActionClick(item.id)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      isJoined
                        ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                        : item.type === 'community'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : item.type === 'event'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : item.type === 'person'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Connected</span>
                      </>
                    ) : item.type === 'community' ? (
                      <>
                        <Users className="w-4 h-4" />
                        <span>Join Community</span>
                      </>
                    ) : item.type === 'event' ? (
                      <>
                        <Calendar className="w-4 h-4" />
                        <span>RSVP • Free</span>
                      </>
                    ) : item.type === 'person' ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Say Hello 👋</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-4 h-4" />
                        <span>View Trip Details</span>
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
