import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AuctionRoom, AuctionTeam, AuctionPlayer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Coins,
  Shield,
  Flame,
  Globe,
  Award,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Settings,
  Ticket
} from 'lucide-react';

interface AuctionDetailsPageProps {
  auctionId: string;
  onBack: () => void;
  onEnterArena: (auctionId: string) => void;
  onViewResults: (auctionId: string) => void;
  onOpenAuth?: () => void;
}

export const AuctionDetailsPage: React.FC<AuctionDetailsPageProps> = ({
  auctionId,
  onBack,
  onEnterArena,
  onViewResults,
  onOpenAuth,
}) => {
  const { isAuthenticated, user, isAuctioneer } = useAuth();
  const [auction, setAuction] = useState<any>(null);
  const [teams, setTeams] = useState<AuctionTeam[]>([]);
  const [players, setPlayers] = useState<AuctionPlayer[]>([]);
  const [rulesConfig, setRulesConfig] = useState<any>({});
  const [userRegistration, setUserRegistration] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Registration state
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regRole, setRegRole] = useState<'bidder' | 'viewer'>('bidder');
  const [regSuccess, setRegSuccess] = useState<boolean>(false);

  const fetchAuctionDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAuction(auctionId);
      if (res && res.auction) {
        setAuction(res.auction);
        setTeams(res.teams || []);
        setPlayers(res.players || []);
        setRulesConfig(res.rulesConfig || {});
        setUserRegistration(res.userRegistration || null);
      } else {
        setError('Auction not found');
      }
    } catch (err: any) {
      console.error('Failed to load auction details:', err);
      setError(err.message || 'Failed to load auction');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctionDetails();
  }, [auctionId]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    setIsRegistering(true);
    try {
      const res = await api.registerForAuction(auctionId, { role_type: regRole });
      if (res && res.registration) {
        setUserRegistration(res.registration);
        setRegSuccess(true);
      }
    } catch (err: any) {
      alert(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stroom-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-stroom-orange border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Loading auction details...</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen bg-stroom-black text-white flex flex-col items-center justify-center p-4">
        <div className="p-8 max-w-md w-full bg-stroom-cardDark rounded-3xl border border-stroom-borderDark text-center">
          <AlertCircle className="w-12 h-12 text-stroom-orange mx-auto mb-3" />
          <h2 className="text-xl font-black uppercase">Auction Not Found</h2>
          <p className="mt-2 text-xs text-stone-400 font-semibold">{error || 'This auction room may not exist.'}</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Auction Hub</span>
          </button>
        </div>
      </div>
    );
  }

  const isLive = auction.status === 'LIVE';
  const isCompleted = auction.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-stroom-black text-white pb-24">
      {/* Top Floating Nav */}
      <div className="border-b border-stroom-borderDark bg-stroom-cardDark/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-black text-stone-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-stroom-orange" />
            <span>Back to Auction Hub</span>
          </button>

          <div className="flex items-center gap-3">
            {isCompleted ? (
              <button
                onClick={() => onViewResults(auction.id)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5 text-stroom-orange" />
                <span>View Results & Analytics</span>
              </button>
            ) : (
              <button
                onClick={() => onEnterArena(auction.id)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Enter Live Auction Arena</span>
                {isLive && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banner / Hero Section */}
      <div className="relative bg-stroom-black">
        <div className="h-64 sm:h-80 w-full relative overflow-hidden">
          <img
            src={auction.cover_image_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80'}
            alt={auction.title}
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stroom-black via-stroom-black/50 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 absolute bottom-8 inset-x-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand">
              {auction.format_category ? auction.format_category.replace('_', ' ').toUpperCase() : 'IPL MOCK'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-stroom-cream border border-white/20">
              {auction.city_name || 'Hyderabad'}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isLive
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse'
                  : isCompleted
                  ? 'bg-stone-800 text-stone-400'
                  : 'bg-stroom-orange/30 text-stroom-orange border border-stroom-orange/40'
              }`}
            >
              {isLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
              <span>{auction.status}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            {auction.title}
          </h1>

          <p className="mt-2 text-stone-300 text-xs sm:text-sm max-w-3xl font-medium leading-relaxed">
            {auction.description || 'Live cricket bidding room. Authentic franchises, player lots, and countdown timer.'}
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Format Rules, Franchises & Player Pool */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Quick Metadata Info */}
            <div className="bg-stroom-cardDark rounded-3xl p-6 border border-stroom-borderDark grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-stroom-orange flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Date & Schedule</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{auction.event_date || 'Saturday'}</p>
                  <p className="text-xs text-stone-400 font-semibold">{auction.event_time || '5:00 PM IST'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-stroom-orange flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Host Venue</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{auction.venue_name}</p>
                  <p className="text-xs text-stone-400 font-semibold">{auction.city_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-stroom-orange flex-shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400">Team Purse Cap</p>
                  <p className="text-sm font-black text-stroom-orange mt-0.5">₹{(auction.team_purse_cap / 10000000).toFixed(2)} Cr</p>
                  <p className="text-xs text-stone-400 font-semibold">Min Increment: ₹{(auction.min_bid_increment / 1000).toFixed(0)}k</p>
                </div>
              </div>
            </div>

            {/* Format Rules & Constraints */}
            <div className="bg-stroom-cardDark rounded-3xl p-6 sm:p-8 border border-stroom-borderDark">
              <h2 className="text-lg font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-stroom-orange" />
                <span>Auction Format & Rule Book</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] font-black uppercase text-stone-400">Squad Size Limits</p>
                  <p className="text-base font-black text-white mt-1">{auction.min_squad_size} - {auction.max_squad_size} Players</p>
                  <p className="text-xs text-stone-400 mt-1">Each franchise must purchase at least {auction.min_squad_size} players to complete a valid squad.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] font-black uppercase text-stone-400">Overseas Player Constraint</p>
                  <p className="text-base font-black text-white mt-1">Max {auction.overseas_limit || 4} Overseas Slots</p>
                  <p className="text-xs text-stone-400 mt-1">Teams cannot hold more than {auction.overseas_limit || 4} international players simultaneously.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] font-black uppercase text-stone-400">Countdown Clock & Gavel</p>
                  <p className="text-base font-black text-white mt-1">{auction.countdown_seconds}s Countdown</p>
                  <p className="text-xs text-stone-400 mt-1">Countdown automatically resets by {auction.auto_extend_seconds}s if a bid is placed near expiry.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] font-black uppercase text-stone-400">Unsold Player Re-entry</p>
                  <p className="text-base font-black text-white mt-1">Rapid Re-entry Pool</p>
                  <p className="text-xs text-stone-400 mt-1">Unsold players re-enter the acceleration round at the conclusion of the main marquee pool.</p>
                </div>
              </div>
            </div>

            {/* Competing Franchises */}
            <div className="bg-stroom-cardDark rounded-3xl p-6 sm:p-8 border border-stroom-borderDark">
              <h2 className="text-lg font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-stroom-orange" />
                <span>Competing Franchises ({teams.length} Teams)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs text-white shadow-md flex-shrink-0"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white">{t.name}</h4>
                        <p className="text-[10px] text-stone-400">Captain: {t.captain_name || 'TBD'}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-emerald-400">₹{(t.purse_remaining / 10000000).toFixed(2)} Cr</p>
                      <p className="text-[10px] text-stone-500 font-bold">{t.squad_count} in squad</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Player Pool Preview */}
            <div className="bg-stroom-cardDark rounded-3xl p-6 sm:p-8 border border-stroom-borderDark">
              <h2 className="text-lg font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <Flame className="w-5 h-5 text-stroom-orange" />
                <span>Player Pool Preview ({players.length} Lots)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {players.slice(0, 6).map((p) => (
                  <div key={p.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                    <img
                      src={p.photo_url}
                      alt={p.name}
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 flex-shrink-0"
                    />
                    <div className="truncate">
                      <h4 className="text-xs font-black text-white truncate">{p.name}</h4>
                      <p className="text-[10px] text-stroom-orange font-bold truncate">{p.role}</p>
                      <p className="text-[9px] text-stone-400 font-mono">Base: ₹{(p.base_price / 100000).toFixed(1)}L</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Registration Card & Action Hub */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Arena Entry / Launch Box */}
            <div className="bg-stroom-cardDark rounded-3xl p-6 border-2 border-stroom-orange/30 shadow-2xl sticky top-20">
              <div className="text-center pb-4 border-b border-stroom-borderDark">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange/20 text-stroom-orange border border-stroom-orange/30">
                  Broadcast Experience
                </span>
                <p className="text-2xl font-black text-white mt-3">{auction.title}</p>
                <p className="text-xs text-stone-400 mt-1 font-medium">{auction.venue_name}, {auction.city_name}</p>
              </div>

              {/* Status and Action Buttons */}
              <div className="mt-6 space-y-3">
                {isCompleted ? (
                  <button
                    onClick={() => onViewResults(auction.id)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs uppercase tracking-wider shadow-brand hover:brightness-105 transition-all flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    <span>View Post-Auction Results</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onEnterArena(auction.id)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs uppercase tracking-wider shadow-brand hover:brightness-105 transition-all flex items-center justify-center gap-2"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Launch Live Auction Arena</span>
                    {isLive && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                  </button>
                )}

                {/* Registration Section */}
                <div className="pt-4 border-t border-stroom-borderDark">
                  {userRegistration ? (
                    <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs font-black text-white uppercase">You Are Registered!</p>
                      <p className="text-[11px] text-emerald-300 font-semibold mt-1">
                        Role: {userRegistration.role_type.toUpperCase()}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-black text-stone-300 uppercase">Register for this Auction:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRegRole('bidder')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                            regRole === 'bidder' ? 'bg-stroom-orange text-white border-stroom-orange' : 'bg-white/5 border-white/10 text-stone-400'
                          }`}
                        >
                          Bidder / Owner
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegRole('viewer')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                            regRole === 'viewer' ? 'bg-stroom-orange text-white border-stroom-orange' : 'bg-white/5 border-white/10 text-stone-400'
                          }`}
                        >
                          Live Viewer
                        </button>
                      </div>

                      <button
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-stone-200 text-stroom-black font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Ticket className="w-4 h-4 text-stroom-orange" />
                        <span>{isRegistering ? 'Registering...' : 'Confirm Registration'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-stroom-borderDark space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-400">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Real-time concurrency protected bidding</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-stone-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Projector mode optimized for venue displays</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
