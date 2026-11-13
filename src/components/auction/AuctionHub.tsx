import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AuctionArena } from './AuctionArena';
import { AuctionDetailsPage } from './AuctionDetailsPage';
import { AuctionResultsView } from './AuctionResultsView';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  Trophy,
  Flame,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  Coins,
  Shield,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Filter,
  CheckCircle2,
  Award,
  Globe,
  Radio,
  Plus,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

interface AuctionHubProps {
  onGoToAuth?: () => void;
  initialAuctionId?: string;
  initialView?: 'hub' | 'details' | 'arena' | 'results';
}

const CITIES = [
  { id: 'all', name: 'All Cities' },
  { id: 'city_hyd', name: 'Hyderabad' },
  { id: 'city_pune', name: 'Pune' },
  { id: 'city_blr', name: 'Bangalore' },
];

const FORMAT_OPTIONS = [
  { id: 'all', label: 'All Formats' },
  { id: 'ipl_mock', label: 'IPL Mock Auction' },
  { id: 'all_time_mega', label: 'All-Time Mega Auction' },
  { id: 'rapid_draft', label: 'Rapid Draft Blitz' },
];

export const AuctionHub: React.FC<AuctionHubProps> = ({
  onGoToAuth,
  initialAuctionId,
  initialView = 'hub',
}) => {
  const { isAuthenticated, isAdmin } = useAuth();

  // Internal Navigation State: 'hub' | 'details' | 'arena' | 'results'
  const [viewState, setViewState] = useState<'hub' | 'details' | 'arena' | 'results'>(initialView || 'hub');
  const [activeAuctionId, setActiveAuctionId] = useState<string>(initialAuctionId || 'auc_hyd_001');

  useEffect(() => {
    if (initialAuctionId) {
      setActiveAuctionId(initialAuctionId);
    }
    if (initialView) {
      setViewState(initialView);
    }
  }, [initialAuctionId, initialView]);

  // Auctions data state
  const [auctions, setAuctions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchAuctions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAuctions({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        format: formatFilter !== 'all' ? formatFilter : undefined,
        city: selectedCity !== 'all' ? selectedCity : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res && res.auctions) {
        setAuctions(res.auctions);
      } else {
        setAuctions([]);
      }
    } catch (err: any) {
      console.error('Failed to load auctions:', err);
      setError('Unable to load auctions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [statusFilter, formatFilter, selectedCity]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAuctions();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Route: If viewState is 'arena'
  if (viewState === 'arena') {
    return (
      <ErrorBoundary
        fallbackTitle="Auction Arena Stage"
        fallbackMessage="The Live Bidding Arena encountered an issue. Click below to reconnect to the live auction room."
        dark={true}
        onReset={() => {
          setViewState('hub');
          fetchAuctions();
        }}
      >
        <AuctionArena
          initialAuctionId={activeAuctionId}
          onBackToHub={() => {
            setViewState('hub');
            fetchAuctions();
          }}
          onViewResults={(id) => {
            setActiveAuctionId(id);
            setViewState('results');
          }}
          onOpenAuth={onGoToAuth}
        />
      </ErrorBoundary>
    );
  }

  // Route: If viewState is 'details'
  if (viewState === 'details') {
    return (
      <ErrorBoundary
        fallbackTitle="Auction Details"
        fallbackMessage="Unable to display auction details. Click below to return to the hub."
        dark={true}
        onReset={() => setViewState('hub')}
      >
        <AuctionDetailsPage
          auctionId={activeAuctionId}
          onBack={() => setViewState('hub')}
          onEnterArena={(id) => {
            setActiveAuctionId(id);
            setViewState('arena');
          }}
          onViewResults={(id) => {
            setActiveAuctionId(id);
            setViewState('results');
          }}
          onOpenAuth={onGoToAuth}
        />
      </ErrorBoundary>
    );
  }

  // Route: If viewState is 'results'
  if (viewState === 'results') {
    return (
      <ErrorBoundary
        fallbackTitle="Auction Results"
        fallbackMessage="Unable to display auction results. Click below to return to the hub."
        dark={true}
        onReset={() => setViewState('hub')}
      >
        <AuctionResultsView
          auctionId={activeAuctionId}
          onBack={() => setViewState('hub')}
          onGoToArena={() => setViewState('arena')}
        />
      </ErrorBoundary>
    );
  }

  // Currency formatter
  const formatINR = (val: number) => {
    if (!val || val === 0) return '₹0';
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)} Lakh`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const liveAuctions = auctions.filter((a) => a.status === 'LIVE');
  const featuredAuction = liveAuctions[0] || auctions[0];

  return (
    <div className="min-h-screen bg-stroom-black text-white pb-24">
      {/* Top Hero Banner */}
      <section className="bg-gradient-to-b from-stone-900 via-stroom-black to-stroom-black border-b border-stroom-borderDark pt-12 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stroom-orange/20 border border-stroom-orange/40 text-stroom-orange text-xs font-black uppercase tracking-wider mb-4">
                <Trophy className="w-3.5 h-3.5" />
                <span>STROOM Official Cricket Auction Arena</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
                IPL Franchise <span className="text-stroom-orange">Auction Hub</span>.
              </h1>

              <p className="mt-2 text-stone-300 text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
                Experience the thrill of team ownership. Bid live on marquee local talent, manage franchise purses, and build your championship squad.
              </p>
            </div>

            {/* Quick Live Room Direct CTA */}
            {featuredAuction && (
              <button
                onClick={() => {
                  setActiveAuctionId(featuredAuction.id);
                  setViewState('arena');
                }}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center gap-2 self-start md:self-auto"
              >
                <Trophy className="w-4 h-4" />
                <span>Enter Live Auction Arena</span>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              </button>
            )}
          </div>

          {/* Quick Hub Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-[10px] font-black uppercase text-stone-400 block">Total Active Rooms</span>
              <span className="text-xl font-black text-white mt-0.5 block">{auctions.length} Tournaments</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-[10px] font-black uppercase text-stone-400 block">Total Purse Managed</span>
              <span className="text-xl font-black text-stroom-orange mt-0.5 block">₹4.50 Cr</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-[10px] font-black uppercase text-stone-400 block">Franchise Teams</span>
              <span className="text-xl font-black text-white mt-0.5 block">17 Competing</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-[10px] font-black uppercase text-stone-400 block">Live Bidding Engine</span>
              <span className="text-xl font-black text-emerald-400 mt-0.5 block flex items-center gap-1.5">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Authoritative</span>
              </span>
            </div>
          </div>

          {/* Search Bar & City Selector */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search auctions by title, venue, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-stroom-cardDark border border-stroom-borderDark rounded-2xl text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-stroom-orange placeholder-stone-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="md:col-span-4 flex items-center bg-stroom-cardDark p-1 rounded-2xl border border-stroom-borderDark overflow-x-auto">
              {CITIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCity(c.id)}
                  className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-extrabold text-center transition-all ${
                    selectedCity === c.id
                      ? 'bg-stroom-orange text-white shadow-xs'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Status Tabs & Format Filter */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  statusFilter === 'all' ? 'bg-stroom-orange text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                All Auctions
              </button>
              <button
                onClick={() => setStatusFilter('live')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'live' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                <span>Live Rooms</span>
              </button>
              <button
                onClick={() => setStatusFilter('upcoming')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  statusFilter === 'upcoming' ? 'bg-stroom-orange text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Upcoming & Scheduled
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  statusFilter === 'completed' ? 'bg-stroom-orange text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Completed Results
              </button>
            </div>

            {/* Format Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-stone-400">Format:</span>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="bg-stroom-cardDark border border-stroom-borderDark text-xs font-bold text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-stroom-orange"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Auctions Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">
            Showing <span className="text-stroom-orange font-black">{auctions.length}</span> Tournaments
          </p>
          <div className="text-xs font-bold text-stone-400">
            Real Concurrency-Safe Bidding
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-stroom-orange animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Loading auction tournaments...</p>
          </div>
        )}

        {/* Error Notice */}
        {error && !isLoading && (
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-semibold flex items-center gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={fetchAuctions} className="ml-auto underline font-bold">Retry</button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && auctions.length === 0 && (
          <div className="text-center py-20 bg-stroom-cardDark rounded-3xl border border-stroom-borderDark p-8 max-w-lg mx-auto">
            <Trophy className="w-12 h-12 text-stone-600 mx-auto mb-3" />
            <h3 className="text-base font-black uppercase text-white">No auctions found</h3>
            <p className="mt-1 text-xs text-stone-400">No auction rooms match your search or filters.</p>
            <button
              onClick={() => {
                setStatusFilter('all');
                setFormatFilter('all');
                setSelectedCity('all');
                setSearchQuery('');
              }}
              className="mt-5 px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Auctions Card Grid */}
        {!isLoading && !error && auctions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auc) => {
              const isLive = auc.status === 'LIVE';
              const isCompleted = auc.status === 'COMPLETED';

              return (
                <div
                  key={auc.id}
                  className="bg-stroom-cardDark rounded-3xl border border-stroom-borderDark overflow-hidden hover:border-stroom-orange/50 transition-all duration-300 flex flex-col group shadow-lg"
                >
                  {/* Card Banner Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-stroom-charcoal">
                    <img
                      src={auc.cover_image_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80'}
                      alt={auc.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md text-white border border-white/20">
                        {auc.format_category ? auc.format_category.replace('_', ' ').toUpperCase() : 'IPL MOCK'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          isLive
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : isCompleted
                            ? 'bg-stone-800 text-stone-400'
                            : 'bg-stroom-orange text-white shadow-brand'
                        }`}
                      >
                        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                        <span>{auc.status}</span>
                      </span>
                    </div>

                    {/* Bottom Metadata in Image */}
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between text-white text-xs font-bold">
                      <div className="flex items-center gap-1.5 drop-shadow-md">
                        <MapPin className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>{auc.city_name || auc.city || 'Hyderabad'}</span>
                      </div>
                      <span className="text-[11px] font-extrabold text-stroom-cream">
                        {formatINR(auc.team_purse_cap)} Cap
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3
                        onClick={() => {
                          setActiveAuctionId(auc.id);
                          setViewState('details');
                        }}
                        className="text-base font-black text-white group-hover:text-stroom-orange transition-colors cursor-pointer line-clamp-1"
                      >
                        {auc.title}
                      </h3>

                      <p className="mt-2 text-xs text-stone-300 font-medium line-clamp-2 leading-relaxed">
                        {auc.description || 'Live franchise auction. Bid for top marquee players, manage team purse, and build your tournament squad.'}
                      </p>

                      {/* Specs */}
                      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-xs font-bold">
                        <div>
                          <span className="text-[10px] text-stone-400 uppercase block">Franchise Teams</span>
                          <span className="text-white font-mono mt-0.5 block">{auc.total_teams || 4} Teams</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-400 uppercase block">Player Lots</span>
                          <span className="text-white font-mono mt-0.5 block">{auc.total_players || 8} Lots</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveAuctionId(auc.id);
                          setViewState('details');
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5 text-stroom-orange" />
                      </button>

                      {isCompleted ? (
                        <button
                          onClick={() => {
                            setActiveAuctionId(auc.id);
                            setViewState('results');
                          }}
                          className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs transition-all flex items-center gap-1.5"
                        >
                          <Award className="w-3.5 h-3.5 text-stroom-orange" />
                          <span>Results</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveAuctionId(auc.id);
                            setViewState('arena');
                          }}
                          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>{isLive ? 'Enter Arena' : 'Open Arena'}</span>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
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
    </div>
  );
};
