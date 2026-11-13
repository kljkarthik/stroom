import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { StroomLogo } from '../common/StroomLogo';
import { sounds } from '../../utils/soundEffects';
import { CertificateModal } from '../modals/CertificateModal';
import { AuctionFormatConfigModal } from './AuctionFormatConfigModal';
import { AuctionTeamManager } from './AuctionTeamManager';
import { AuctionPlayerManager } from './AuctionPlayerManager';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AuctionRoom, AuctionTeam, AuctionPlayer, Bid } from '../../types';
import {
  Gavel,
  Clock,
  Users,
  Trophy,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Award,
  Flame,
  CheckCircle,
  XCircle,
  RotateCcw,
  Shield,
  Activity,
  Download,
  AlertCircle,
  Pause,
  Play,
  ArrowLeft,
  Settings,
  Plus,
  RefreshCw,
  Globe,
  Radio,
  Check,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';

interface AuctionArenaProps {
  initialAuctionId?: string;
  onBackToHub: () => void;
  onViewResults: (auctionId: string) => void;
  onOpenAuth?: () => void;
}

export const AuctionArena: React.FC<AuctionArenaProps> = ({
  initialAuctionId = 'auc_hyd_001',
  onBackToHub,
  onViewResults,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, isAdmin, isAuctioneer } = useAuth();

  const [auctionsList, setAuctionsList] = useState<any[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>(initialAuctionId);
  const [auction, setAuction] = useState<any>(null);
  const [teams, setTeams] = useState<AuctionTeam[]>([]);
  const [players, setPlayers] = useState<AuctionPlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null);
  const [recentBids, setRecentBids] = useState<Bid[]>([]);
  const [selectedBidderTeamId, setSelectedBidderTeamId] = useState<string>('');

  // Right sidebar tab: 'bids' | 'pool'
  const [rightSidebarTab, setRightSidebarTab] = useState<'bids' | 'pool'>('bids');

  // Live Timer & Status
  const [timer, setTimer] = useState<number>(15);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [customBidInput, setCustomBidInput] = useState<string>('');

  // SSE Stream State
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [activeListeners, setActiveListeners] = useState<number>(1);

  // Modals & Sub-managers
  const [isFormatModalOpen, setIsFormatModalOpen] = useState<boolean>(false);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState<boolean>(false);
  const [isPlayerManagerOpen, setIsPlayerManagerOpen] = useState<boolean>(false);
  const [isSoldModalOpen, setIsSoldModalOpen] = useState<boolean>(false);
  const [lastSoldEvent, setLastSoldEvent] = useState<any>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Currency Formatter
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

  // Determine user bidding permissions
  const canOperateAuction = isAdmin || isAuctioneer;
  const userTeam = teams.find((t) => t.owner_user_id === user?.id || (user?.email && t.owner_email === user?.email));
  const canPlaceBids = canOperateAuction || !!userTeam || (isAuthenticated && user?.role === 'participant');

  // Load Auctions List
  useEffect(() => {
    loadAuctionsList();
  }, []);

  // Load Active Room State
  useEffect(() => {
    if (selectedAuctionId) {
      loadAuctionRoom(selectedAuctionId);
      setupSSE(selectedAuctionId);
    }
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [selectedAuctionId]);

  const loadAuctionsList = async () => {
    try {
      const res = await api.getAuctions();
      setAuctionsList(res.auctions || []);
    } catch (err) {
      console.warn('Failed to load auctions list:', err);
    }
  };

  const loadAuctionRoom = async (roomId: string) => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await api.getAuction(roomId);
      setAuction(data.auction);
      setTeams(data.teams || []);
      setPlayers(data.players || []);
      
      const activeLot = data.currentLot || data.currentPlayer || data.players?.find((p: any) => p.status === 'IN_AUCTION') || data.players?.[0] || null;
      setCurrentPlayer(activeLot);
      setRecentBids(data.recentBids || []);

      if (data.teams && data.teams.length > 0) {
        // If user owns a team, select their team by default; otherwise keep current or select first
        const owned = data.teams.find((t: any) => t.owner_user_id === user?.id || (user?.email && t.owner_email === user?.email));
        setSelectedBidderTeamId((prev) => {
          if (prev && data.teams.some((t: any) => t.id === prev)) return prev;
          return owned ? owned.id : data.teams[0].id;
        });
      } else {
        setSelectedBidderTeamId('');
      }

      setTimer(data.auction?.countdown_seconds || 15);
      setTimerActive(data.auction?.status === 'LIVE' && activeLot?.status === 'IN_AUCTION');
      setActiveListeners(data.activeListeners || 1);
    } catch (err: any) {
      console.error('Failed to load auction room:', err);
      if (err.status === 503 || err.message?.includes('unreachable') || err.message?.includes('Failed to fetch')) {
        setActionError('Unable to connect to the STROOM backend server. Please verify backend status.');
      } else if (err.status === 404) {
        setActionError('Auction room not found. Please select an active auction from the Hub.');
      } else if (err.status === 403 || err.status === 401) {
        setActionError('Authentication required to operate or participate in this auction.');
      } else {
        setActionError(err.message || 'Unable to load auction stage data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Real-Time SSE Stream Setup
  const setupSSE = (roomId: string) => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    try {
      const streamUrl = `/api/auctions/${roomId}/stream`;
      const es = new EventSource(streamUrl);
      sseRef.current = es;

      es.onopen = () => {
        setSseConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleSSEEvent(payload);
        } catch (e) {
          // ignore parsing error
        }
      };

      es.onerror = () => {
        setSseConnected(false);
      };
    } catch (e) {
      setSseConnected(false);
    }
  };

  // Handle incoming Real-time SSE Events
  const handleSSEEvent = (event: any) => {
    if (event.type === 'NEW_BID') {
      const { bid, currentBid, highestBidderTeamId, timeRemaining } = event;
      if (soundEnabled) sounds.playBid();

      // Update current player bid
      setCurrentPlayer((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          current_bid: currentBid,
          highest_bidder_team_id: highestBidderTeamId,
          highest_bidder_name: bid.teamName,
          highest_bidder_color: bid.teamColor,
        };
      });

      // Update team state in local cache
      setTeams((prevTeams) =>
        prevTeams.map((t) => {
          if (t.id === highestBidderTeamId) {
            return { ...t };
          }
          return t;
        })
      );

      // Add to recent bids feed
      setRecentBids((prev) => [
        {
          id: bid.bidId,
          auction_id: selectedAuctionId,
          player_id: bid.playerId,
          team_id: bid.teamId,
          team_name: bid.teamName,
          team_color: bid.teamColor,
          amount: currentBid,
          placed_at: 'Just now',
          time_remaining: timeRemaining,
        },
        ...prev.slice(0, 29),
      ]);

      // Reset countdown timer
      setTimer(timeRemaining || auction?.countdown_seconds || 15);
      setTimerActive(true);
    } else if (event.type === 'GAVEL_STRIKE') {
      const { action, result } = event;
      if (soundEnabled) sounds.playGavel();

      if (action === 'SOLD') {
        if (soundEnabled) setTimeout(() => sounds.playFanfare(), 300);
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF7100', '#E9A34A', '#FFFFFF', '#10B981'],
        });

        setLastSoldEvent({
          playerName: result.player,
          teamName: result.winningTeam,
          amount: result.amount,
          role: currentPlayer?.role || 'Player',
        });
        setIsSoldModalOpen(true);
      }

      // Refresh complete state to ensure authoritative data consistency
      loadAuctionRoom(selectedAuctionId);
    } else if (event.type === 'NEXT_LOT') {
      if (event.player) {
        setCurrentPlayer(event.player);
        setTimer(auction?.countdown_seconds || 15);
        setTimerActive(auction?.status === 'LIVE');
        setRecentBids([]);
        if (soundEnabled) sounds.playBid();
      }
      loadAuctionRoom(selectedAuctionId);
    } else if (event.type === 'STATUS_CHANGE') {
      setAuction((prev: any) => prev ? { ...prev, status: event.status } : prev);
      setTimerActive(event.status === 'LIVE');
    }
  };

  // Countdown Clock Timer Effect
  useEffect(() => {
    if (timerActive && currentPlayer?.status === 'IN_AUCTION' && auction?.status === 'LIVE') {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          if (prev === 4 && soundEnabled) {
            sounds.playCountdown();
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, currentPlayer?.status, auction?.status, soundEnabled]);

  // Handle Placing Bids
  const handlePlaceBid = async (inc?: number, directAmount?: number) => {
    setActionError(null);
    if (!selectedBidderTeamId) {
      setActionError('Active Paddle: Please select a franchise team before bidding.');
      return;
    }
    if (!currentPlayer) {
      setActionError('No active player lot on stage to place a bid.');
      return;
    }

    const activeTeam = teams.find((t) => t.id === selectedBidderTeamId);
    if (!activeTeam) {
      setActionError('Selected franchise team is invalid.');
      return;
    }

    // Validate squad capacity
    if (activeTeam.squad_count >= (auction?.max_squad_size || 15)) {
      setActionError(`${activeTeam.name} has already reached maximum squad size (${activeTeam.squad_count}/${auction?.max_squad_size || 15}).`);
      return;
    }

    // Validate overseas limit
    if (currentPlayer.is_overseas === 1 && auction?.overseas_limit) {
      if ((activeTeam.overseas_count || 0) >= auction.overseas_limit) {
        setActionError(`Overseas player limit reached (${activeTeam.overseas_count || 0}/${auction.overseas_limit}) for ${activeTeam.name}.`);
        return;
      }
    }

    // Prevent consecutive self-bidding
    if (currentPlayer.highest_bidder_team_id === selectedBidderTeamId) {
      setActionError(`${activeTeam.name} is already the highest bidder for ${currentPlayer.name}.`);
      return;
    }

    try {
      const payload: any = {
        team_id: selectedBidderTeamId,
        player_id: currentPlayer.id,
      };

      if (directAmount) {
        payload.custom_amount = directAmount;
      } else if (inc) {
        payload.increment = inc;
      }

      await api.placeAuctionBid(selectedAuctionId, payload);
      setCustomBidInput('');
    } catch (err: any) {
      console.error('Bid failed:', err);
      setActionError(err.message || 'Bid rejected by server transaction');
    }
  };

  // Handle Gavel Strike (SOLD / UNSOLD)
  const handleGavel = async (action: 'SOLD' | 'UNSOLD') => {
    setActionError(null);
    if (!currentPlayer) return;

    if (action === 'SOLD' && !currentPlayer.highest_bidder_team_id) {
      setActionError('Cannot gavel SOLD without an active winning bidder.');
      return;
    }

    try {
      await api.gavelStrike(selectedAuctionId, {
        player_id: currentPlayer.id,
        action,
      });
    } catch (err: any) {
      console.error('Gavel strike failed:', err);
      setActionError(err.message || `Failed to mark lot as ${action}`);
    }
  };

  // Advance to Next Lot
  const handleNextLot = async (targetPlayerId?: string) => {
    setActionError(null);
    try {
      const res = await api.nextAuctionLot(selectedAuctionId, targetPlayerId);
      if (res.completed) {
        alert('All player lots completed! Auction has concluded.');
      }
    } catch (err: any) {
      console.error('Next lot advance failed:', err);
      setActionError(err.message || 'Failed to advance to next lot');
    }
  };

  // Navigate to Previous Lot
  const handlePrevLot = async () => {
    setActionError(null);
    if (!currentPlayer || players.length === 0) return;
    const currentIndex = players.findIndex((p) => p.id === currentPlayer.id);
    if (currentIndex > 0) {
      const prevPlayer = players[currentIndex - 1];
      await handleSelectLot(prevPlayer.id);
    } else {
      setActionError('Already at the first lot in the pool.');
    }
  };

  // Select Specific Player Lot for Central Stage
  const handleSelectLot = async (playerId: string) => {
    setActionError(null);
    try {
      await api.selectAuctionLot(selectedAuctionId, playerId);
      await loadAuctionRoom(selectedAuctionId);
    } catch (err: any) {
      console.error('Select lot failed:', err);
      setActionError(err.message || 'Failed to select player for stage');
    }
  };

  // Open / Commence Bidding on Current Lot
  const handleOpenBidding = async () => {
    if (!currentPlayer) return;
    try {
      await api.reopenAuctionLot(selectedAuctionId, currentPlayer.id);
      await loadAuctionRoom(selectedAuctionId);
    } catch (err: any) {
      setActionError(err.message || 'Failed to open bidding');
    }
  };

  // Skip Player
  const handleSkipLot = async () => {
    setActionError(null);
    if (!currentPlayer) return;
    try {
      await api.skipAuctionLot(selectedAuctionId, currentPlayer.id);
      await handleNextLot();
    } catch (err: any) {
      setActionError(err.message || 'Failed to skip lot');
    }
  };

  // Pause / Resume
  const handleTogglePause = async () => {
    if (!auction) return;
    const nextStatus = auction.status === 'LIVE' ? 'PAUSED' : 'LIVE';
    try {
      await api.setAuctionStatus(selectedAuctionId, nextStatus);
      setAuction({ ...auction, status: nextStatus });
      setTimerActive(nextStatus === 'LIVE');
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle pause');
    }
  };

  // Export CSV Sheet
  const handleExportSheet = async () => {
    try {
      const res = await api.getAuctionReport(selectedAuctionId);
      const csvContent = res.report?.csvData || res.report?.csv_export;
      if (!csvContent) {
        alert('No auction data recorded to export yet.');
        return;
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${(auction?.title || 'stroom-auction').replace(/\s+/g, '_')}_Rosters.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setActionError(err.message || 'Failed to export tournament sheet');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stroom-black text-white flex flex-col items-center justify-center p-4">
        <StroomLogo variant="light" size="xl" showSubtitle={true} className="animate-pulse" />
        <p className="mt-4 text-xs font-black text-stroom-orange tracking-widest uppercase animate-pulse">
          Connecting to STROOM Auction Arena...
        </p>
      </div>
    );
  }

  const activeBidderTeam = teams.find((t) => t.id === selectedBidderTeamId);
  const minIncrement = auction?.min_bid_increment || 25000;
  const currentBidAmount = currentPlayer?.current_bid || currentPlayer?.base_price || 0;
  const nextRequiredBid = currentBidAmount === 0 || !currentPlayer?.highest_bidder_team_id
    ? Math.max(currentPlayer?.base_price || 500000, currentBidAmount + minIncrement)
    : currentBidAmount + minIncrement;

  return (
    <div className={`min-h-screen bg-stroom-black text-white flex flex-col font-sans select-none ${isProjectorMode ? 'p-2 sm:p-4' : 'pb-16'}`}>
      
      {/* 1. TOP BROADCAST CONTROL BAR */}
      <header className="bg-stroom-cardDark border-b border-stroom-borderDark px-4 sm:px-6 py-3 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Left: Brand & Back */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
              title="Exit Arena"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="cursor-pointer" onClick={onBackToHub}>
              <StroomLogo variant="light" size="sm" showSubtitle={false} />
            </div>

            <div className="hidden md:block h-5 w-[1px] bg-white/10 mx-1" />

            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-black text-white tracking-wide truncate max-w-xs">
                {auction?.title || 'Cricket Auction Arena'}
              </span>
              <span className="text-[10px] text-stone-400 font-semibold">({auction?.city_name || 'Hyderabad'})</span>
            </div>
          </div>

          {/* Center: Live / Status & Real-time Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-xs font-black">
              <span
                className={`w-2 h-2 rounded-full ${
                  auction?.status === 'LIVE' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className={auction?.status === 'LIVE' ? 'text-emerald-400 uppercase' : 'text-amber-400 uppercase'}>
                {auction?.status || 'LIVE'}
              </span>
            </div>

            {/* SSE Stream Status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                sseConnected ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-red-950/60 text-red-300 border-red-800 animate-pulse'
              }`}
              title={sseConnected ? 'Connected to authoritative real-time bidding stream' : 'Reconnecting to stream...'}
            >
              <Radio className="w-3 h-3" />
              <span>{sseConnected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
            </div>
          </div>

          {/* Right: Quick Tools (Export, Sound, Projector, Admin Options) */}
          <div className="flex items-center gap-2">
            {/* Room Selector Dropdown */}
            {auctionsList.length > 1 && (
              <select
                value={selectedAuctionId}
                onChange={(e) => setSelectedAuctionId(e.target.value)}
                className="hidden lg:block bg-stroom-surfaceDark border border-stroom-borderDark text-stone-300 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-stroom-orange"
              >
                {auctionsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.status})
                  </option>
                ))}
              </select>
            )}

            {/* Export Sheet */}
            <button
              onClick={handleExportSheet}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 hover:text-white transition-all"
              title="Download Tournament Sheet (CSV)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                soundEnabled ? 'bg-stroom-orange/20 border-stroom-orange text-stroom-orange' : 'bg-white/5 border-white/10 text-stone-400'
              }`}
              title={soundEnabled ? 'Sound On' : 'Muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Projector Fullscreen Mode */}
            <button
              onClick={() => setIsProjectorMode(!isProjectorMode)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                isProjectorMode ? 'bg-stroom-orange text-white border-stroom-orange' : 'bg-white/5 border-white/10 text-stone-300'
              }`}
              title={isProjectorMode ? 'Exit Projector View' : 'Projector Mode'}
            >
              {isProjectorMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Operator Admin Settings */}
            {canOperateAuction && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => setIsTeamManagerOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-stone-300 hover:text-white transition-all flex items-center gap-1"
                >
                  <Users className="w-3 h-3 text-stroom-orange" />
                  <span>Teams</span>
                </button>

                <button
                  onClick={() => setIsPlayerManagerOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-stone-300 hover:text-white transition-all flex items-center gap-1"
                >
                  <Flame className="w-3 h-3 text-stroom-orange" />
                  <span>Pool</span>
                </button>

                <button
                  onClick={() => setIsFormatModalOpen(true)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 hover:text-white transition-all"
                  title="Configure Rules"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error notification banner */}
      {actionError && (
        <div className="bg-red-950/85 border-b border-red-800 text-red-200 text-xs font-semibold px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span className="flex-1">{actionError}</span>
            <button
              onClick={() => loadAuctionRoom(selectedAuctionId)}
              className="px-2.5 py-1 rounded-lg bg-red-800 hover:bg-red-700 text-white text-[11px] font-bold transition-all"
            >
              Retry
            </button>
            <button onClick={() => setActionError(null)} className="ml-2 text-stone-400 hover:text-white text-xs">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN BROADCAST ARENA STAGE */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-2 sm:px-4 lg:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: FRANCHISE TEAMS & SQUADS (3 cols) */}
        <aside className="lg:col-span-3 space-y-3 order-2 lg:order-1">
          <div className="bg-stroom-cardDark rounded-3xl p-4 border border-stroom-borderDark">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stroom-borderDark">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-stroom-orange" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Franchise Purses ({teams.length} Teams)</h3>
              </div>
              {canOperateAuction && (
                <button
                  onClick={() => setIsTeamManagerOpen(true)}
                  className="text-[10px] text-stroom-orange hover:underline font-bold"
                >
                  Manage
                </button>
              )}
            </div>

            {/* Teams list */}
            {teams.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-stone-500 mx-auto">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-white">0 Teams Configured</h4>
                  <p className="text-[11px] text-stone-400 mt-1">
                    No franchise tables configured for this auction room yet.
                  </p>
                </div>
                {canOperateAuction && (
                  <button
                    onClick={() => setIsTeamManagerOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-stroom-orange text-white text-xs font-extrabold shadow-brand hover:brightness-105"
                  >
                    Add Franchise Team
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {teams.map((t) => {
                  const isHoldingWinningBid = currentPlayer?.highest_bidder_team_id === t.id;
                  const isSelectedForBidding = selectedBidderTeamId === t.id;
                  const percentSpent = Math.min(100, Math.round(((t.purse_initial - t.purse_remaining) / (t.purse_initial || 1)) * 100));
                  const availableSquadSlots = Math.max(0, (auction?.max_squad_size || 15) - t.squad_count);

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedBidderTeamId(t.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                        isHoldingWinningBid
                          ? 'bg-stroom-orange/15 border-stroom-orange shadow-brand'
                          : isSelectedForBidding
                          ? 'bg-white/10 border-white/40 ring-1 ring-white/20'
                          : 'bg-stroom-surfaceDark border-stroom-borderDark hover:border-white/20'
                      }`}
                    >
                      {/* Winning bid glow line */}
                      {isHoldingWinningBid && (
                        <div className="absolute top-0 inset-x-0 h-1 bg-stroom-orange animate-pulse" />
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {t.logo_url ? (
                            <img
                              src={t.logo_url}
                              alt={t.name}
                              className="w-8 h-8 rounded-xl object-cover border border-white/20 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: t.color || '#FF7100' }}
                            >
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-white truncate leading-tight flex items-center gap-1">
                              <span>{t.name}</span>
                              {isHoldingWinningBid && (
                                <Award className="w-3 h-3 text-stroom-gold fill-current flex-shrink-0" />
                              )}
                            </h4>
                            <p className="text-[10px] text-stone-400 truncate mt-0.5">
                              Capt: <strong className="text-stone-300">{t.captain_name || 'TBA'}</strong>
                              {t.owner_name ? ` • ${t.owner_name}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-black ${t.purse_remaining < 500000 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatINR(t.purse_remaining)}
                          </p>
                          <p className="text-[9px] text-stone-400">rem. purse</p>
                        </div>
                      </div>

                      {/* Detailed Purse & Squad breakdown */}
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-stone-400">
                        <span>Squad: <strong className="text-white">{t.squad_count}/{auction?.max_squad_size || 15}</strong> ({availableSquadSlots} slots)</span>
                        <span>Spent: <strong className="text-stone-300">{formatINR(t.purse_initial - t.purse_remaining)}</strong></span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1 bg-black/40 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${percentSpent}%`,
                            backgroundColor: t.color || '#FF7100',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER COLUMN: MAIN BROADCAST SPOTLIGHT (6 cols) */}
        <section className="lg:col-span-6 space-y-4 order-1 lg:order-2">
          {currentPlayer ? (
            <div className="bg-stroom-cardDark rounded-3xl border-2 border-stroom-borderDark overflow-hidden shadow-2xl relative">
              
              {/* Countdown Clock Header Banner */}
              <div className="bg-black/60 px-6 py-3 border-b border-stroom-borderDark flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase text-stone-400">LOT #{currentPlayer.lot_number}</span>
                  <span className="text-stone-600">•</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange text-white">
                    {currentPlayer.category || currentPlayer.role}
                  </span>
                  {currentPlayer.is_overseas === 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800">
                      Overseas
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    currentPlayer.status === 'SOLD'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : currentPlayer.status === 'UNSOLD'
                      ? 'bg-stone-800 text-stone-400'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                  }`}>
                    {currentPlayer.status}
                  </span>
                </div>

                {/* Broadcast Countdown Ring / Clock */}
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${timer <= 5 ? 'text-red-500 animate-bounce' : 'text-stroom-orange'}`} />
                  <span
                    className={`font-mono text-xl font-black ${
                      timer <= 5 ? 'text-red-500 scale-110' : timer <= 10 ? 'text-amber-400' : 'text-white'
                    } transition-transform`}
                  >
                    00:{timer.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Main Player Spotlight Card */}
              <div className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Player Photograph */}
                  <div className="relative w-36 h-44 sm:w-44 sm:h-52 rounded-2xl overflow-hidden bg-stone-900 border-2 border-white/10 flex-shrink-0 shadow-lg">
                    <img
                      src={currentPlayer.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80'}
                      alt={currentPlayer.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-2 inset-x-2 text-center">
                      <span className="text-[10px] font-bold text-stroom-cream uppercase tracking-wider drop-shadow">
                        {currentPlayer.nationality || 'India'}
                      </span>
                    </div>
                  </div>

                  {/* Player Info & Stats */}
                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                      <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                        {currentPlayer.name}
                      </h2>
                    </div>

                    <p className="text-xs text-stroom-orange font-bold">
                      {currentPlayer.role} • {currentPlayer.batting_style || 'Right-hand bat'}
                      {currentPlayer.bowling_style ? ` • ${currentPlayer.bowling_style}` : ''}
                    </p>

                    <p className="mt-1 text-[11px] font-mono text-stone-500">
                      Player ID: {currentPlayer.id}
                      {currentPlayer.previous_team ? ` • Ex: ${currentPlayer.previous_team}` : ''}
                    </p>

                    <p className="mt-2 text-xs text-stone-300 font-medium leading-relaxed line-clamp-2">
                      {currentPlayer.bio || 'Verified cricket tournament athlete eligible for franchise draft pool.'}
                    </p>

                    {/* Quick Stats Grid */}
                    {(() => {
                      let stats: any = {};
                      try {
                        stats = typeof currentPlayer.stats_json === 'string' ? JSON.parse(currentPlayer.stats_json) : currentPlayer.stats_json;
                      } catch (e) {
                        stats = {};
                      }

                      return (
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-center">
                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-[9px] uppercase font-bold text-stone-400 block">Matches</span>
                            <span className="text-xs font-black text-white">{stats?.matches || 28}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-[9px] uppercase font-bold text-stone-400 block">Strike Rate</span>
                            <span className="text-xs font-black text-white">{stats?.strikeRate || 142.5}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-[9px] uppercase font-bold text-stone-400 block">Best / Wkts</span>
                            <span className="text-xs font-black text-stroom-cream">{stats?.bestScore || `${stats?.wickets || 24} W`}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Current Bid & High Bidder Banner */}
                <div className="mt-6 pt-5 border-t border-stroom-borderDark">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    {/* Base Price & Current Bid */}
                    <div>
                      <span className="text-[10px] font-black uppercase text-stone-400">
                        Base Price: <strong className="text-white">{formatINR(currentPlayer.base_price)}</strong>
                      </span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                          {formatINR(currentBidAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Winning Team Tag */}
                    <div className="sm:text-right">
                      <span className="text-[10px] font-black uppercase text-stone-400 block mb-1">
                        Current Winning Franchise
                      </span>
                      {currentPlayer.highest_bidder_name ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: currentPlayer.highest_bidder_color || '#FF7100' }}
                          />
                          <span className="text-xs font-black text-white">{currentPlayer.highest_bidder_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-stone-400 italic">Waiting for opening bid</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-stroom-cardDark rounded-3xl p-12 text-center border border-stroom-borderDark">
              <Trophy className="w-12 h-12 text-stone-500 mx-auto mb-3" />
              <h3 className="text-base font-black uppercase text-white">No active player lot in progress</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                Select a player lot from the Player Lot Pool or click 'Next Player' to commence live franchise bidding.
              </p>
              {canOperateAuction && (
                <button
                  onClick={() => handleNextLot()}
                  className="mt-4 px-4 py-2 rounded-xl bg-stroom-orange text-white font-extrabold text-xs shadow-brand hover:brightness-105"
                >
                  Bring Next Lot to Stage
                </button>
              )}
            </div>
          )}

          {/* 3. INTERACTIVE BIDDING & OPERATOR CONTROLS */}
          <div className="bg-stroom-cardDark rounded-3xl p-4 sm:p-5 border border-stroom-borderDark">
            
            {/* Operator Controls Bar (Admin / Auctioneer) */}
            {canOperateAuction && (
              <div className="mb-4 pb-4 border-b border-stroom-borderDark">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-stroom-orange tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Auctioneer Hammer & Stage Controls</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTogglePause}
                      className="text-[11px] font-bold text-stone-300 hover:text-white flex items-center gap-1"
                    >
                      {auction?.status === 'LIVE' ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
                      <span>{auction?.status === 'LIVE' ? 'Pause Auction' : 'Resume Auction'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleGavel('SOLD')}
                    disabled={!currentPlayer?.highest_bidder_team_id || currentPlayer?.status === 'SOLD'}
                    className={`py-2 px-2.5 rounded-xl font-black text-xs uppercase shadow-brand transition-all flex items-center justify-center gap-1.5 ${
                      currentPlayer?.highest_bidder_team_id && currentPlayer?.status !== 'SOLD'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:brightness-110 active:scale-98'
                        : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>Gavel SOLD</span>
                  </button>

                  <button
                    onClick={() => handleGavel('UNSOLD')}
                    disabled={currentPlayer?.status === 'SOLD'}
                    className="py-2 px-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-300 font-black text-xs uppercase transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-stone-400" />
                    <span>Mark UNSOLD</span>
                  </button>

                  <button
                    onClick={handlePrevLot}
                    className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 font-bold text-xs uppercase transition-all flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev Lot</span>
                  </button>

                  <button
                    onClick={() => handleNextLot()}
                    className="py-2 px-2.5 rounded-xl bg-stroom-orange hover:brightness-110 text-white font-black text-xs uppercase shadow-brand transition-all flex items-center justify-center gap-1"
                  >
                    <span>Next Lot</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleOpenBidding}
                    className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-stroom-gold" />
                    <span>Open / Reopen</span>
                  </button>
                </div>
              </div>
            )}

            {/* Franchise Paddle / Bidding Controls */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                {/* Active Paddle Team Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-300 uppercase">Active Paddle:</span>
                  <select
                    value={selectedBidderTeamId}
                    onChange={(e) => setSelectedBidderTeamId(e.target.value)}
                    className="bg-stroom-surfaceDark border border-stroom-borderDark text-white text-xs font-black rounded-xl px-3 py-1.5 focus:outline-none focus:border-stroom-orange"
                  >
                    <option value="">Select Team...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({formatINR(t.purse_remaining)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] text-stone-400 flex items-center gap-3">
                  <span>
                    Purse: <strong className="text-emerald-400">{activeBidderTeam ? formatINR(activeBidderTeam.purse_remaining) : '—'}</strong>
                  </span>
                  <span>
                    Slots: <strong className="text-white">{activeBidderTeam ? `${activeBidderTeam.squad_count}/${auction?.max_squad_size || 15}` : '—'}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handlePlaceBid(25000)}
                  disabled={!canPlaceBids || auction?.status !== 'LIVE' || !selectedBidderTeamId || (activeBidderTeam && activeBidderTeam.purse_remaining < nextRequiredBid)}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-black text-white shadow-xs transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>+ ₹25,000</span>
                </button>

                <button
                  onClick={() => handlePlaceBid(50000)}
                  disabled={!canPlaceBids || auction?.status !== 'LIVE' || !selectedBidderTeamId || (activeBidderTeam && activeBidderTeam.purse_remaining < nextRequiredBid)}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-black text-white shadow-xs transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>+ ₹50,000</span>
                </button>

                <button
                  onClick={() => handlePlaceBid(100000)}
                  disabled={!canPlaceBids || auction?.status !== 'LIVE' || !selectedBidderTeamId || (activeBidderTeam && activeBidderTeam.purse_remaining < nextRequiredBid)}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-black text-white shadow-xs transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>+ ₹1 Lakh</span>
                </button>

                <button
                  onClick={() => handlePlaceBid(500000)}
                  disabled={!canPlaceBids || auction?.status !== 'LIVE' || !selectedBidderTeamId || (activeBidderTeam && activeBidderTeam.purse_remaining < nextRequiredBid)}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-black text-white shadow-xs transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>+ ₹5 Lakh</span>
                </button>
              </div>

              {/* Custom Bid Entry */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`Custom Bid (min ₹${nextRequiredBid.toLocaleString('en-IN')})...`}
                  value={customBidInput}
                  onChange={(e) => setCustomBidInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white placeholder-stone-500 focus:outline-none focus:border-stroom-orange"
                />
                <button
                  onClick={() => {
                    const parsed = parseInt(customBidInput);
                    if (parsed) handlePlaceBid(undefined, parsed);
                  }}
                  disabled={!canPlaceBids || !customBidInput || parseInt(customBidInput) < nextRequiredBid}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs uppercase shadow-brand hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Raise Bid
                </button>
              </div>

              {!canPlaceBids && (
                <div className="mt-2 text-center text-[11px] text-stone-400 font-semibold">
                  Viewing Live Broadcast • Sign in as Team Owner or Operator to submit bids.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: TABS (LIVE BIDS FEED & PLAYER LOT POOL) (3 cols) */}
        <aside className="lg:col-span-3 space-y-3 order-3">
          <div className="bg-stroom-cardDark rounded-3xl p-4 border border-stroom-borderDark">
            
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/40 border border-white/5 mb-3">
              <button
                onClick={() => setRightSidebarTab('bids')}
                className={`py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  rightSidebarTab === 'bids'
                    ? 'bg-stroom-orange text-white shadow-brand'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Bids ({recentBids.length})</span>
              </button>

              <button
                onClick={() => setRightSidebarTab('pool')}
                className={`py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  rightSidebarTab === 'pool'
                    ? 'bg-stroom-orange text-white shadow-brand'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lots ({players.length})</span>
              </button>
            </div>

            {/* TAB 1: SERVER BID FEED */}
            {rightSidebarTab === 'bids' && (
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stroom-borderDark">
                  <span className="text-[10px] font-black uppercase text-stone-400">Server Bid Feed</span>
                  <span className="text-[10px] font-mono text-stroom-orange font-bold">
                    {recentBids.length > 0 ? `${recentBids.length} Placed` : '0 Bids'}
                  </span>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {recentBids.length === 0 ? (
                    <div className="py-16 text-center text-stone-400 text-xs font-bold space-y-2">
                      <Clock className="w-8 h-8 mx-auto text-stone-600 animate-pulse" />
                      <p className="text-white font-extrabold">Waiting for opening bid</p>
                      <p className="text-[11px] text-stone-500 max-w-[200px] mx-auto">
                        Stage is primed. Select your franchise paddle and raise the opening bid.
                      </p>
                    </div>
                  ) : (
                    recentBids.map((b, idx) => (
                      <div
                        key={b.id || idx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          idx === 0
                            ? 'bg-stroom-orange/15 border-stroom-orange/40 shadow-sm animate-fade-in'
                            : 'bg-stroom-surfaceDark border-white/5'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: b.team_color || '#FF7100' }}
                            />
                            <span className="text-xs font-black text-white truncate">{b.team_name}</span>
                            {idx === 0 && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-stroom-orange text-white">
                                Top
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-400 truncate mt-0.5">
                            {b.placed_at} • {currentPlayer?.name}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs font-black font-mono ${idx === 0 ? 'text-stroom-orange' : 'text-stone-300'}`}>
                            {formatINR(b.amount)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PLAYER LOT POOL */}
            {rightSidebarTab === 'pool' && (
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stroom-borderDark">
                  <span className="text-[10px] font-black uppercase text-stone-400">Player Lot Pool</span>
                  {canOperateAuction && (
                    <button
                      onClick={() => setIsPlayerManagerOpen(true)}
                      className="text-[10px] text-stroom-orange hover:underline font-bold"
                    >
                      Manage Pool
                    </button>
                  )}
                </div>

                {players.length === 0 ? (
                  <div className="py-16 text-center text-stone-400 text-xs font-bold space-y-2">
                    <Flame className="w-8 h-8 mx-auto text-stone-600" />
                    <p className="text-white font-extrabold">0 Lots in Auction Pool</p>
                    <p className="text-[11px] text-stone-500 max-w-[200px] mx-auto">
                      No player lots have been uploaded to this auction yet.
                    </p>
                    {canOperateAuction && (
                      <button
                        onClick={() => setIsPlayerManagerOpen(true)}
                        className="mt-2 px-3.5 py-1.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
                      >
                        Add Players to Pool
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {players.map((p) => {
                      const isCurrent = currentPlayer?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isCurrent
                              ? 'bg-stroom-orange/15 border-stroom-orange'
                              : 'bg-stroom-surfaceDark border-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={p.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80'}
                              alt={p.name}
                              className="w-9 h-11 rounded-lg object-cover border border-white/10 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-mono text-stone-400 uppercase">Lot #{p.lot_number}</span>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                  p.status === 'SOLD'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : p.status === 'UNSOLD'
                                    ? 'bg-stone-800 text-stone-400'
                                    : p.status === 'IN_AUCTION'
                                    ? 'bg-stroom-orange text-white animate-pulse'
                                    : 'bg-white/10 text-stone-300'
                                }`}>
                                  {p.status}
                                </span>
                              </div>
                              <h5 className="text-xs font-black text-white truncate leading-tight mt-0.5">
                                {p.name}
                              </h5>
                              <p className="text-[10px] text-stone-400 truncate">
                                {p.role} • Base: {formatINR(p.base_price)}
                              </p>
                            </div>
                          </div>

                          {/* Operator Selection Button */}
                          {canOperateAuction && (
                            <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[9px] font-mono text-stone-500 truncate max-w-[100px]">
                                {p.id}
                              </span>
                              {isCurrent ? (
                                <span className="text-[10px] font-bold text-stroom-orange flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Live on Stage
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSelectLot(p.id)}
                                  className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-stroom-orange hover:text-white text-[10px] font-black text-stone-300 transition-colors"
                                >
                                  Bring to Stage
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </aside>

      </main>

      {/* SOLD CELEBRATION CERTIFICATE MODAL */}
      <CertificateModal
        isOpen={isSoldModalOpen}
        onClose={() => setIsSoldModalOpen(false)}
        eventTitle={auction?.title || 'STROOM Premier Cricket Auction 2026'}
        teamName={lastSoldEvent?.teamName || 'Winning Franchise'}
        playerName={lastSoldEvent?.playerName || 'Marquee Player'}
        finalPrice={lastSoldEvent?.amount ? formatINR(lastSoldEvent.amount) : '₹0'}
        role={lastSoldEvent?.role || 'Player'}
      />

      {/* ADMIN FORMAT CONFIG MODAL */}
      <AuctionFormatConfigModal
        auctionId={selectedAuctionId}
        isOpen={isFormatModalOpen}
        currentConfig={auction}
        onClose={() => setIsFormatModalOpen(false)}
        onSaved={() => loadAuctionRoom(selectedAuctionId)}
      />

      {/* ADMIN TEAM MANAGER MODAL */}
      <AuctionTeamManager
        auctionId={selectedAuctionId}
        isOpen={isTeamManagerOpen}
        teams={teams}
        onClose={() => setIsTeamManagerOpen(false)}
        onRefresh={() => loadAuctionRoom(selectedAuctionId)}
      />

      {/* ADMIN PLAYER MANAGER MODAL */}
      <AuctionPlayerManager
        auctionId={selectedAuctionId}
        isOpen={isPlayerManagerOpen}
        players={players}
        onClose={() => setIsPlayerManagerOpen(false)}
        onRefresh={() => loadAuctionRoom(selectedAuctionId)}
      />

    </div>
  );
};