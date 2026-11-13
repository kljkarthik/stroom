import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  MapPin,
  CheckCircle2,
  XCircle,
  CreditCard,
  Bell,
  Send,
  Loader2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  X,
  Building2,
  Info,
} from 'lucide-react';

interface AdminVenuesFinancePanelProps {
  mode: 'venues' | 'payments' | 'notifications';
  permissions: string[];
}

export const AdminVenuesFinancePanel: React.FC<AdminVenuesFinancePanelProps> = ({
  mode,
  permissions,
}) => {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Venues state
  const [venues, setVenues] = useState<any[]>([]);

  // Payments state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [gatewayNotice, setGatewayNotice] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Notifications state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    target_audience: 'all_members',
    target_filter: '',
    category: 'system',
  });

  const canRefund = permissions.includes('payments.refund');

  useEffect(() => {
    if (mode === 'venues') loadVenues();
    else if (mode === 'payments') loadPayments();
    else loadNotifications();
  }, [mode, paymentStatusFilter]);

  const loadVenues = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminVenues();
      setVenues(res.venues || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load venues' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerifyVenue = async (venue: any, nextVerified: boolean, nextStatus?: string) => {
    setBanner(null);
    try {
      await api.verifyAdminVenue(venue.id, {
        is_verified: nextVerified,
        status: nextStatus || (nextVerified ? 'active' : venue.status),
      });
      setBanner({
        type: 'success',
        message: `${venue.name} ${nextVerified ? 'verified for events' : 'verification updated'}.`,
      });
      loadVenues();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to update venue' });
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminPayments(paymentStatusFilter);
      setTransactions(res.transactions || []);
      setGatewayNotice(res.gatewayNotice || '');
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load payment records' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setRefunding(true);
    setBanner(null);
    try {
      await api.refundAdminPayment(refundTarget.id, refundAmount, refundReason);
      setBanner({ type: 'success', message: `Refund recorded for transaction ${refundTarget.id}.` });
      setRefundTarget(null);
      loadPayments();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Refund failed' });
    } finally {
      setRefunding(false);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [annRes, cRes] = await Promise.all([api.getAdminAnnouncements(), api.getCities().catch(() => ({ cities: [] }))]);
      setAnnouncements(annRes.announcements || []);
      setCities(cRes.cities || []);
      if (permissions.includes('communities.manage')) {
        api.getAdminCommunities().then((r) => setCommunities(r.communities || [])).catch(() => {});
      }
      if (permissions.includes('events.view')) {
        api.getAdminEvents().then((r) => setEvents(r.events || [])).catch(() => {});
      }
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load announcements' });
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcasting(true);
    setBanner(null);
    try {
      const res = await api.broadcastAdminAnnouncement(broadcastForm);
      setBanner({
        type: 'success',
        message: `Delivered to ${res.deliveredCount} recipient(s) via ${res.deliveryChannel}.`,
      });
      setBroadcastForm({ title: '', message: '', target_audience: 'all_members', target_filter: '', category: 'system' });
      loadNotifications();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Broadcast failed' });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">
            {mode === 'venues'
              ? 'Centralized Venue Directory & Verification'
              : mode === 'payments'
              ? 'Payments & Refund Ledger'
              : 'Platform Notifications & Broadcasts'}
          </h2>
          <p className="text-xs text-stroom-charcoal/70">
            {mode === 'venues'
              ? 'Verify venue capacity and partner status across STROOM cities before assigning flagship events.'
              : mode === 'payments'
              ? 'Audit real pass & event transactions recorded in SQLite and process authorized refunds.'
              : 'Publish preference-aware in-app announcements to members, cities, clubs, events, or business partners.'}
          </p>
        </div>
        <button
          onClick={() => (mode === 'venues' ? loadVenues() : mode === 'payments' ? loadPayments() : loadNotifications())}
          className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-stroom-orange" />
          <span>Refresh</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* VENUES MODE */}
      {mode === 'venues' && (
        <>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : venues.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No venues registered yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {venues.map((v) => (
                <div key={v.id} className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-stroom-orange" />
                        <h3 className="text-base font-black text-stroom-black">{v.name}</h3>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {v.area || v.address} • {v.city_name} • Capacity: {v.capacity || 'N/A'}
                      </p>
                      {v.partner_name && (
                        <p className="text-[11px] font-bold text-stroom-charcoal mt-1 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-stroom-orange" />
                          Partner: {v.partner_name} ({v.partner_status || 'Active'})
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        v.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {v.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-stroom-ivory text-xs">
                    <div>
                      <span className="text-stone-500">Upcoming Events:</span>{' '}
                      <span className="font-black text-stroom-black">{v.upcoming_events_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Open Partner Slots:</span>{' '}
                      <span className="font-black text-stroom-black">{v.open_slots_count || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stroom-borderLight">
                    {!v.is_verified ? (
                      <button
                        onClick={() => handleToggleVerifyVenue(v, true, 'active')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify Venue</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleVerifyVenue(v, false, 'inactive')}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Revoke Verification</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PAYMENTS MODE */}
      {mode === 'payments' && (
        <div className="space-y-4">
          {gatewayNotice && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <div>
                <div className="font-black">Gateway Integration Status: Not Configured</div>
                <p className="mt-0.5">{gatewayNotice}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-stroom-borderLight">
            <div className="flex items-center gap-2 text-xs font-black text-stroom-black">
              <CreditCard className="w-4 h-4 text-stroom-orange" />
              <span>Filter Ledger</span>
            </div>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Successful">Successful</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
              <option value="Partially Refunded">Partially Refunded</option>
            </select>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No payment transactions recorded yet. Free events and test records will only appear here when real transactions are stored.
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-stroom-borderLight shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stroom-ivory border-b border-stroom-borderLight text-[10px] font-black uppercase text-stone-500">
                      <th className="py-3 px-4">Transaction ID</th>
                      <th className="py-3 px-4">Member & Event</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroom-borderLight">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-3 px-4 font-mono text-[11px] font-bold">
                          {tx.id}
                          {tx.provider_ref && <div className="text-stone-400">{tx.provider_ref}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-black text-stroom-black">{tx.member_name || 'Guest'}</div>
                          <div className="text-[11px] text-stone-500">{tx.event_title || 'Platform Fee'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-black">
                          ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                          {tx.refund_amount > 0 && (
                            <div className="text-[10px] text-red-600">Refunded: ₹{tx.refund_amount}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              tx.status === 'Successful'
                                ? 'bg-emerald-100 text-emerald-700'
                                : tx.status.includes('Refund')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canRefund && tx.status === 'Successful' && (
                            <button
                              onClick={() => {
                                setRefundTarget(tx);
                                setRefundAmount(tx.amount);
                                setRefundReason('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-black inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Refund</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS MODE */}
      {mode === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            onSubmit={handleBroadcast}
            className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4 text-xs self-start"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-stroom-orange" />
              <h3 className="text-sm font-black text-stroom-black">Compose Platform Announcement</h3>
            </div>
            <div className="p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-[11px] text-stone-600">
              Delivery Channel: <strong>In-App Notification Center</strong> (honors member notification preferences; external Email/SMS provider not configured).
            </div>

            <div>
              <label className="block font-black mb-1">Announcement Title *</label>
              <input
                required
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                placeholder="e.g., Monsoon Cricket Draft Schedule Update"
                className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none focus:border-stroom-orange"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-black mb-1">Target Audience</label>
                <select
                  value={broadcastForm.target_audience}
                  onChange={(e) =>
                    setBroadcastForm({ ...broadcastForm, target_audience: e.target.value, target_filter: '' })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                >
                  <option value="all_members">All Active Members</option>
                  <option value="city">Members in Specific City</option>
                  <option value="community">Specific Community Roster</option>
                  <option value="event">Confirmed Event Attendees</option>
                  <option value="partners">Verified Business Partners</option>
                </select>
              </div>
              <div>
                <label className="block font-black mb-1">Preference Category</label>
                <select
                  value={broadcastForm.category}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                >
                  <option value="system">System Alert</option>
                  <option value="community">Community Update</option>
                  <option value="reminder">Event Reminder</option>
                </select>
              </div>
            </div>

            {broadcastForm.target_audience === 'city' && (
              <div>
                <label className="block font-black mb-1">Select City</label>
                <select
                  required
                  value={broadcastForm.target_filter}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, target_filter: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                >
                  <option value="">Choose city...</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {broadcastForm.target_audience === 'community' && (
              <div>
                <label className="block font-black mb-1">Select Community</label>
                <select
                  required
                  value={broadcastForm.target_filter}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, target_filter: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                >
                  <option value="">Choose community...</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {broadcastForm.target_audience === 'event' && (
              <div>
                <label className="block font-black mb-1">Select Event</label>
                <select
                  required
                  value={broadcastForm.target_filter}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, target_filter: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                >
                  <option value="">Choose event...</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-black mb-1">Message Body *</label>
              <textarea
                required
                rows={4}
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Write clear operational details..."
                className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none focus:border-stroom-orange"
              />
            </div>

            <button
              type="submit"
              disabled={broadcasting}
              className="w-full py-2.5 rounded-2xl bg-stroom-orange hover:bg-stroom-deep text-white font-black flex items-center justify-center gap-2 shadow-brand disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{broadcasting ? 'Sending Broadcast...' : 'Publish In-App Announcement'}</span>
            </button>
          </form>

          {/* Sent Announcements History */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
            <h3 className="text-sm font-black text-stroom-black">Broadcast History ({announcements.length})</h3>
            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-stroom-orange" />
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-xs text-stone-400 py-6">No admin broadcasts sent yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[30rem] overflow-y-auto">
                {announcements.map((a) => (
                  <div key={a.id} className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-stroom-black">{a.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                        {a.recipients_count} Sent
                      </span>
                    </div>
                    <p className="text-stroom-charcoal/80">{a.message}</p>
                    <div className="text-[10px] text-stone-500">
                      Audience: {a.target_audience} {a.target_filter ? `(${a.target_filter})` : ''} • By{' '}
                      {a.created_by_name} • {a.created_at}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-stroom-borderLight shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <h3 className="text-base font-black text-stroom-black">Process Transaction Refund</h3>
              <button onClick={() => setRefundTarget(null)} className="p-1.5 rounded-xl hover:bg-stroom-ivory">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRefundSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-stroom-ivory">
                <div className="font-mono font-bold">{refundTarget.id}</div>
                <div className="text-stone-500">Original Amount: ₹{refundTarget.amount}</div>
              </div>
              <div>
                <label className="block font-black mb-1">Refund Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={refundTarget.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block font-black mb-1">Refund Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefundTarget(null)}
                  className="px-4 py-2 rounded-xl border border-stroom-borderLight font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white font-black disabled:opacity-50"
                >
                  {refunding ? 'Refunding...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
