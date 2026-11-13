import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Trophy,
  Gavel,
  Plus,
  ExternalLink,
  ScanLine,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  RefreshCw,
  ShieldCheck,
  Clock,
  Users,
} from 'lucide-react';

interface AdminAuctionsCheckinPanelProps {
  mode: 'auctions' | 'checkin';
  permissions: string[];
  onGoToLiveAuction?: (auctionId?: string) => void;
}

export const AdminAuctionsCheckinPanel: React.FC<AdminAuctionsCheckinPanelProps> = ({
  mode,
  permissions,
  onGoToLiveAuction,
}) => {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auctions state
  const [auctions, setAuctions] = useState<any[]>([]);
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [eventsForAuction, setEventsForAuction] = useState<any[]>([]);
  const [isCreateAuctionOpen, setIsCreateAuctionOpen] = useState(false);
  const [creatingAuction, setCreatingAuction] = useState(false);
  const [auctionForm, setAuctionForm] = useState({
    event_id: '',
    title: '',
    format_type: 'stroom_premier',
    format_category: 'ipl_mock',
    team_purse_cap: 10000000,
    min_bid_increment: 25000,
    max_squad_size: 15,
    overseas_limit: 4,
    countdown_seconds: 15,
  });

  // Check-in state
  const [checkinEvents, setCheckinEvents] = useState<any[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [passInput, setPassInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanOutcome, setScanOutcome] = useState<{
    status: string;
    message: string;
    pass?: any;
    newAchievements?: string[];
    ok: boolean;
  } | null>(null);

  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingPasses, setSearchingPasses] = useState(false);

  // Override modal state
  const [overrideTarget, setOverrideTarget] = useState<any | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'confirmed' | 'checked_in'>('confirmed');
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);

  const canManageAuctions = permissions.includes('auctions.manage');
  const canOverrideCheckin = permissions.includes('checkin.override');

  useEffect(() => {
    if (mode === 'auctions') {
      loadAuctions();
    } else {
      loadCheckinData();
    }
  }, [mode]);

  const loadAuctions = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAuctions();
      setAuctions(res.auctions || []);
      setRecentBids(res.recentBids || []);
      if (permissions.includes('events.view')) {
        api
          .getAdminEvents()
          .then((ev) => {
            setEventsForAuction(ev.events || []);
            if (!auctionForm.event_id && ev.events?.[0]?.id) {
              setAuctionForm((prev) => ({ ...prev, event_id: ev.events[0].id }));
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load auctions' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAuction(true);
    setBanner(null);
    try {
      await api.createAdminAuction(auctionForm);
      setBanner({ type: 'success', message: `Auction "${auctionForm.title}" scheduled cleanly.` });
      setIsCreateAuctionOpen(false);
      loadAuctions();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to create auction' });
    } finally {
      setCreatingAuction(false);
    }
  };

  const loadCheckinData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCheckinEvents();
      setCheckinEvents(res.events || []);
      setRecentCheckins(res.recentCheckins || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load check-in terminal data' });
    } finally {
      setLoading(false);
    }
  };

  const handleScanCode = async (codeOverride?: string) => {
    const codeToVerify = (codeOverride ?? passInput).trim();
    if (!codeToVerify) return;
    setScanning(true);
    setScanOutcome(null);
    try {
      const res = await api.scanAdminCheckinPass(codeToVerify, selectedEventId);
      setScanOutcome({
        status: res.verificationStatus || 'Valid',
        message: res.message,
        pass: res.pass,
        newAchievements: res.newAchievements || [],
        ok: true,
      });
      if (!codeOverride) setPassInput('');
      loadCheckinData();
      if (attendeeSearch.trim()) handleSearchPasses(attendeeSearch);
    } catch (err: any) {
      setScanOutcome({
        status: err.data?.verificationStatus || 'Invalid Pass',
        message: err.data?.error || err.message || 'Verification failed',
        pass: err.data?.pass,
        ok: false,
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSearchPasses = async (queryOverride?: string) => {
    setSearchingPasses(true);
    try {
      const q = queryOverride !== undefined ? queryOverride : attendeeSearch;
      const res = await api.searchAdminCheckinPasses(selectedEventId, q);
      setSearchResults(res.passes || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Search failed' });
    } finally {
      setSearchingPasses(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTarget) return;
    setOverriding(true);
    setBanner(null);
    try {
      const res = await api.overrideAdminCheckin(overrideTarget.id, overrideStatus, overrideReason);
      setBanner({ type: 'success', message: res.message || 'Override logged.' });
      setOverrideTarget(null);
      setOverrideReason('');
      loadCheckinData();
      handleSearchPasses(attendeeSearch);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Override denied' });
    } finally {
      setOverriding(false);
    }
  };

  useEffect(() => {
    if (mode === 'checkin') {
      handleSearchPasses('');
    }
  }, [selectedEventId, mode]);

  if (mode === 'auctions') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-stroom-black font-display">Auction Operations & Arena Control</h2>
            <p className="text-xs text-stroom-charcoal/70">
              Monitor live IPL-style auction rooms, lot progression, purse allocations, and jump directly into the Live Auction Arena.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={loadAuctions}
              className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-stroom-orange" />
              <span>Refresh</span>
            </button>
            {canManageAuctions && (
              <button
                onClick={() => setIsCreateAuctionOpen(true)}
                className="px-4 py-2 rounded-xl bg-stroom-orange hover:bg-stroom-deep text-white font-black text-xs flex items-center gap-1.5 shadow-brand"
              >
                <Plus className="w-4 h-4" />
                <span>Create Auction Room</span>
              </button>
            )}
          </div>
        </div>

        {banner && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <span>{banner.message}</span>
            <button onClick={() => setBanner(null)} className="underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              {auctions.length === 0 ? (
                <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
                  No auction rooms found.
                </div>
              ) : (
                auctions.map((a) => (
                  <div
                    key={a.id}
                    className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              a.status === 'LIVE'
                                ? 'bg-red-100 text-red-700 animate-pulse'
                                : a.status === 'PAUSED'
                                ? 'bg-amber-100 text-amber-800'
                                : a.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {a.status}
                          </span>
                          <span className="text-[11px] font-bold text-stone-500">
                            {a.city_name} • {a.venue_name}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-stroom-black mt-1">{a.title}</h3>
                        <p className="text-xs text-stone-500">Linked Event: {a.event_title}</p>
                      </div>

                      {onGoToLiveAuction && (
                        <button
                          onClick={() => onGoToLiveAuction(a.id)}
                          className="px-4 py-2 rounded-xl bg-stroom-black hover:bg-stroom-orange text-white font-black text-xs flex items-center gap-1.5 transition-colors shrink-0 self-start"
                        >
                          <Gavel className="w-3.5 h-3.5" />
                          <span>Open Live Arena</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-2xl bg-stroom-ivory">
                        <div className="text-[10px] font-black uppercase text-stone-500">Franchises</div>
                        <div className="text-base font-black text-stroom-black mt-0.5">{a.teams_count || 0}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-stroom-ivory">
                        <div className="text-[10px] font-black uppercase text-stone-500">Lots (Sold / Total)</div>
                        <div className="text-base font-black text-stroom-black mt-0.5">
                          {a.sold_lots || 0} / {a.total_lots || 0}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-stroom-ivory">
                        <div className="text-[10px] font-black uppercase text-stone-500">Unsold</div>
                        <div className="text-base font-black text-stroom-black mt-0.5">{a.unsold_lots || 0}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-stroom-ivory">
                        <div className="text-[10px] font-black uppercase text-stone-500">Participants</div>
                        <div className="text-base font-black text-stroom-black mt-0.5">{a.registered_participants || 0}</div>
                      </div>
                    </div>

                    {a.current_player_name && (
                      <div className="p-3 rounded-2xl bg-stroom-cream/70 border border-stroom-orange/30 flex items-center justify-between text-xs">
                        <span className="font-bold text-stroom-black">
                          On Block: <span className="font-black text-stroom-deep">{a.current_player_name}</span>
                        </span>
                        <span className="font-mono font-black text-stroom-orange">
                          Current Bid: ₹{Number(a.current_player_bid || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Live Bid Ledger */}
            <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3 self-start">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-stroom-orange" />
                <h3 className="text-sm font-black text-stroom-black">Recent Auction Bids</h3>
              </div>
              {recentBids.length === 0 ? (
                <p className="text-xs text-stone-400 py-4">No bids recorded in the database yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentBids.map((b) => (
                    <div key={b.id} className="p-3 rounded-2xl bg-stroom-ivory text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-black text-stroom-black">
                        <span>{b.player_name}</span>
                        <span className="text-stroom-orange font-mono">
                          ₹{Number(b.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Team: {b.team_name} • {b.auction_title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Auction Modal */}
        {isCreateAuctionOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full border border-stroom-borderLight shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
                <h3 className="text-base font-black text-stroom-black">Schedule Auction Room</h3>
                <button onClick={() => setIsCreateAuctionOpen(false)} className="p-1.5 rounded-xl hover:bg-stroom-ivory">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateAuction} className="p-5 space-y-3 text-xs">
                <div>
                  <label className="block font-black mb-1">Host Event *</label>
                  <select
                    required
                    value={auctionForm.event_id}
                    onChange={(e) => setAuctionForm({ ...auctionForm, event_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                  >
                    {eventsForAuction.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.city_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-black mb-1">Auction Title *</label>
                  <input
                    required
                    value={auctionForm.title}
                    onChange={(e) => setAuctionForm({ ...auctionForm, title: e.target.value })}
                    placeholder="e.g., STROOM Premier Draft 2026"
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black mb-1">Team Purse Cap (₹)</label>
                    <input
                      type="number"
                      value={auctionForm.team_purse_cap}
                      onChange={(e) => setAuctionForm({ ...auctionForm, team_purse_cap: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-black mb-1">Bid Increment (₹)</label>
                    <input
                      type="number"
                      value={auctionForm.min_bid_increment}
                      onChange={(e) => setAuctionForm({ ...auctionForm, min_bid_increment: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black mb-1">Max Squad Size</label>
                    <input
                      type="number"
                      value={auctionForm.max_squad_size}
                      onChange={(e) => setAuctionForm({ ...auctionForm, max_squad_size: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-black mb-1">Timer Seconds</label>
                    <input
                      type="number"
                      value={auctionForm.countdown_seconds}
                      onChange={(e) => setAuctionForm({ ...auctionForm, countdown_seconds: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                    />
                  </div>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateAuctionOpen(false)}
                    className="px-4 py-2 rounded-xl border border-stroom-borderLight font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAuction}
                    className="px-5 py-2 rounded-xl bg-stroom-orange text-white font-black disabled:opacity-50"
                  >
                    {creatingAuction ? 'Creating...' : 'Create Auction'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DOOR CHECK-IN TERMINAL MODE
  const activeEventObj = checkinEvents.find((ev) => ev.id === selectedEventId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">Live Door Check-in Terminal</h2>
          <p className="text-xs text-stroom-charcoal/70">
            Verify member digital passes, prevent duplicate or wrong-event entry, and award STROOM Passport stamps in real time.
          </p>
        </div>
        <button
          onClick={loadCheckinData}
          className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-stroom-orange" />
          <span>Sync Terminal</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Event Gate Selector + Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-xs font-black uppercase tracking-wider text-stroom-black">
              Active Check-in Event Gate
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="sm:w-80 px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none focus:border-stroom-orange"
            >
              <option value="all">All Published & Live Events</option>
              {checkinEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.checked_in_count}/{ev.registered_count} checked in)
                </option>
              ))}
            </select>
          </div>

          {activeEventObj && (
            <div className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-black text-stroom-black">{activeEventObj.title}</div>
                <div className="text-[11px] text-stone-500">
                  {activeEventObj.venue_name}, {activeEventObj.city_name} • {activeEventObj.event_date}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white border border-stroom-borderLight font-black text-stroom-orange">
                {activeEventObj.checked_in_count} / {activeEventObj.registered_count} Checked In
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 relative">
              <ScanLine className="w-4 h-4 text-stroom-orange absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScanCode();
                }}
                placeholder="Scan or enter PASS-XXXXXX, QR token, or Registration ID..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stroom-borderLight bg-stroom-ivory font-mono text-xs font-bold outline-none focus:border-stroom-orange"
              />
            </div>
            <button
              onClick={() => handleScanCode()}
              disabled={scanning || !passInput.trim()}
              className="px-6 py-3 rounded-2xl bg-stroom-orange hover:bg-stroom-deep text-white font-black text-xs shadow-brand disabled:opacity-50"
            >
              {scanning ? 'Verifying...' : 'Verify & Check In'}
            </button>
          </div>

          {/* Honest Live Verification Notice */}
          <p className="text-[11px] text-stone-500">
            Live database verification required: every pass code is validated against authoritative backend records before admission or stamp issuance.
          </p>

          {/* Explicit Verification Result Box */}
          {scanOutcome && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                scanOutcome.ok
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : scanOutcome.status === 'Already Checked In' || scanOutcome.status === 'Event Mismatch'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {scanOutcome.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : scanOutcome.status === 'Already Checked In' || scanOutcome.status === 'Event Mismatch' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase tracking-wider">{scanOutcome.status}</span>
                  {scanOutcome.pass?.pass_code && (
                    <span className="font-mono font-bold">{scanOutcome.pass.pass_code}</span>
                  )}
                </div>
                <p className="font-bold">{scanOutcome.message}</p>
                {scanOutcome.pass && (
                  <p className="text-[11px] opacity-80">
                    Attendee: {scanOutcome.pass.attendee_name} • Event: {scanOutcome.pass.event_title} • Tier:{' '}
                    {scanOutcome.pass.seat_tier || 'Standard'}
                  </p>
                )}
                {scanOutcome.newAchievements && scanOutcome.newAchievements.length > 0 && (
                  <p className="text-[11px] font-black text-emerald-700">
                    Passport Achievements Unlocked: {scanOutcome.newAchievements.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Attendee Search & Manual Verify */}
          <div className="pt-3 border-t border-stroom-borderLight space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchPasses();
                  }}
                  placeholder="Lookup attendee by name, STROOM ID, or pass code..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-semibold outline-none"
                />
              </div>
              <button
                onClick={() => handleSearchPasses()}
                className="px-4 py-2 rounded-xl bg-stroom-black text-white font-black text-xs"
              >
                Lookup
              </button>
            </div>

            {searchingPasses ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-stroom-orange" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">No registrations matched this gate filter.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-black text-stroom-black">
                        {p.attendee_name}{' '}
                        <span className="font-mono text-[10px] text-stone-500">({p.member_id})</span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        <span className="font-mono font-bold text-stroom-deep">{p.pass_code}</span> • {p.event_title} •{' '}
                        {p.seat_tier || 'Standard'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          p.checkin_status === 'checked_in'
                            ? 'bg-emerald-100 text-emerald-700'
                            : p.checkin_status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.checkin_status}
                      </span>
                      {p.checkin_status === 'confirmed' && (
                        <button
                          onClick={() => handleScanCode(p.pass_code)}
                          className="px-2.5 py-1 rounded-xl bg-stroom-orange text-white font-black text-[11px]"
                        >
                          Check In
                        </button>
                      )}
                      {canOverrideCheckin && p.checkin_status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setOverrideTarget(p);
                            setOverrideStatus(p.checkin_status === 'checked_in' ? 'confirmed' : 'checked_in');
                            setOverrideReason('');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-white border border-stroom-borderLight text-[11px] font-bold"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Check-ins Log */}
        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3 self-start">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black text-stroom-black">Recent Verified Check-ins</h3>
          </div>
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-stroom-orange" />
            </div>
          ) : recentCheckins.length === 0 ? (
            <p className="text-xs text-stone-400 py-4">No verified check-ins recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {recentCheckins.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl bg-stroom-ivory text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-black text-stroom-black">
                    <span>{c.attendee_name}</span>
                    <span className="font-mono text-[10px] text-emerald-700">{c.pass_code}</span>
                  </div>
                  <div className="text-[11px] text-stone-500">{c.event_title}</div>
                  <div className="text-[10px] text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {c.checked_in_at} {c.checked_in_by_name ? `• by ${c.checked_in_by_name}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Override Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-stroom-borderLight shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <h3 className="text-base font-black text-stroom-black">Audited Check-in Override</h3>
              <button onClick={() => setOverrideTarget(null)} className="p-1.5 rounded-xl hover:bg-stroom-ivory">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleOverrideSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-stroom-ivory">
                <div className="font-black">{overrideTarget.attendee_name}</div>
                <div className="font-mono text-[11px] text-stone-500">
                  {overrideTarget.pass_code} • Current: {overrideTarget.checkin_status}
                </div>
              </div>
              <div>
                <label className="block font-black mb-1">New Check-in Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as 'confirmed' | 'checked_in')}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                >
                  <option value="confirmed">Revert to Confirmed (Not Checked In)</option>
                  <option value="checked_in">Force Checked In</option>
                </select>
              </div>
              <div>
                <label className="block font-black mb-1">Mandatory Audit Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why an admin override is required..."
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideTarget(null)}
                  className="px-4 py-2 rounded-xl border border-stroom-borderLight font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overriding || !overrideReason.trim()}
                  className="px-5 py-2 rounded-xl bg-stroom-orange text-white font-black disabled:opacity-50"
                >
                  {overriding ? 'Applying...' : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
