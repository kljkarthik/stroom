import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { PartnerCampaign } from '../../types';
import {
  Tag,
  PlusCircle,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Loader2,
  QrCode,
  PauseCircle,
  PlayCircle,
  Send,
  X,
  Check,
  Clock,
  Receipt
} from 'lucide-react';

interface PartnerCampaignsRedemptionPanelProps {
  partnerId: string;
  mode: 'campaigns' | 'redemption';
  venues: any[];
  events: any[];
  onUpdated?: () => void;
}

const OFFER_CATEGORIES = [
  { id: 'percentage', label: 'Percentage Discount' },
  { id: 'fixed', label: 'Fixed-Value Discount' },
  { id: 'complimentary', label: 'Complimentary Item' },
  { id: 'event_special', label: 'Special Event Offer' },
  { id: 'group', label: 'Group Offer' },
  { id: 'member_exclusive', label: 'Exclusive Member Offer' },
];

export const PartnerCampaignsRedemptionPanel: React.FC<PartnerCampaignsRedemptionPanelProps> = ({
  partnerId,
  mode,
  venues,
  events,
  onUpdated,
}) => {
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Campaign creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    venue_id: venues[0]?.id || '',
    code: '',
    title: '',
    description: '',
    offer_category: 'percentage',
    discount_value: '20%',
    min_purchase: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    max_redemptions: 100,
    eligible_event_id: '',
    eligible_audience: 'all_members',
    terms_conditions: 'Valid once per STROOM verified attendee on active meetup dates.',
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrPreviewCampaign, setQrPreviewCampaign] = useState<PartnerCampaign | null>(null);

  // Redemption terminal 2-step state
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemVenueId, setRedeemVenueId] = useState(venues[0]?.id || '');
  const [redeemPassCode, setRedeemPassCode] = useState('');
  const [redeemOrderAmount, setRedeemOrderAmount] = useState('');
  const [redeemNotes, setRedeemNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedOffer, setVerifiedOffer] = useState<any | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemReceipt, setRedeemReceipt] = useState<any | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  useEffect(() => {
    if (venues.length > 0) {
      if (!campaignForm.venue_id) setCampaignForm((f) => ({ ...f, venue_id: venues[0].id }));
      if (!redeemVenueId) setRedeemVenueId(venues[0].id);
    }
  }, [venues]);

  useEffect(() => {
    loadData();
  }, [partnerId, mode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const campRes = await api.getPartnerCampaigns(partnerId);
      setCampaigns(campRes.campaigns || []);
      if (mode === 'redemption') {
        const redRes = await api.getPartnerRedemptions(partnerId);
        setRedemptions(redRes.redemptions || []);
      }
    } catch (err) {
      console.warn('Error loading campaigns/redemptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (submitForApproval: boolean) => {
    setFormError(null);
    if (!campaignForm.venue_id || !campaignForm.code.trim() || !campaignForm.title.trim()) {
      setFormError('Venue, coupon code, and campaign name are required.');
      return;
    }
    setCreating(true);
    try {
      await api.createPartnerCampaign(partnerId, {
        ...campaignForm,
        discount_type: campaignForm.offer_category,
        submit_for_approval: submitForApproval,
      });
      setIsModalOpen(false);
      setCampaignForm((f) => ({ ...f, code: '', title: '', description: '' }));
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleCampaignAction = async (campaignId: string, action: 'submit' | 'pause' | 'resume') => {
    try {
      await api.updatePartnerCampaign(partnerId, campaignId, { action });
      await loadData();
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  // Step 1: Verify coupon eligibility WITHOUT redeeming
  const handleVerifyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setVerifying(true);
    setVerifiedOffer(null);
    setRedeemReceipt(null);
    setRedeemError(null);
    try {
      const res = await api.verifyCoupon({
        coupon_code: redeemCode.trim().toUpperCase(),
        venue_id: redeemVenueId || undefined,
        pass_code: redeemPassCode.trim() || undefined,
        order_amount: redeemOrderAmount ? Number(redeemOrderAmount) : undefined,
      });
      if (res.valid && res.coupon) {
        setVerifiedOffer(res.coupon);
      }
    } catch (err: any) {
      setRedeemError(err.message || 'Coupon verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // Step 2: Confirm actual backend redemption
  const handleConfirmRedemption = async () => {
    if (!verifiedOffer) return;
    setRedeeming(true);
    setRedeemError(null);
    try {
      const res = await api.redeemCoupon({
        coupon_code: verifiedOffer.code,
        venue_id: redeemVenueId || undefined,
        pass_code: redeemPassCode.trim() || undefined,
        order_amount: redeemOrderAmount ? Number(redeemOrderAmount) : undefined,
        notes: redeemNotes.trim() || undefined,
      });
      if (res.result) {
        setRedeemReceipt(res.result);
        setVerifiedOffer(null);
        setRedeemCode('');
        setRedeemPassCode('');
        setRedeemOrderAmount('');
        setRedeemNotes('');
        await loadData();
        onUpdated?.();
      }
    } catch (err: any) {
      setRedeemError(err.message || 'Redemption failed');
    } finally {
      setRedeeming(false);
    }
  };

  const approvalBadge = (status?: string) => {
    switch (status) {
      case 'Active':
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Submitted':
        return 'bg-stroom-orange/15 text-stroom-deep border border-stroom-orange/30';
      case 'Paused':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Rejected':
      case 'Expired':
        return 'bg-red-50 text-red-700 border border-red-200';
      default:
        return 'bg-stone-100 text-stone-700 border border-stone-200';
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-stone-400">
        <Loader2 className="w-7 h-7 animate-spin text-stroom-orange mb-2" />
        <p className="text-xs font-bold">Loading {mode === 'campaigns' ? 'campaigns & offers' : 'redemption terminal'}...</p>
      </div>
    );
  }

  if (mode === 'campaigns') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-stroom-black font-display">
              Offers, Promotional Campaigns & Digital Vouchers
            </h3>
            <p className="text-xs text-stroom-charcoal/70">
              Propose member offers for your business. Partner campaigns remain inactive until approved by STROOM administrators.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Offer Campaign</span>
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs text-stone-500">
            No promotional campaigns created yet. Click <strong>Create Offer Campaign</strong> to launch your first STROOM offer.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {campaigns.map((c) => {
              const pct = c.max_redemptions > 0 ? Math.min(100, Math.round((c.actual_redemptions / c.max_redemptions) * 100)) : 0;
              return (
                <div key={c.id} className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-xs text-stroom-deep bg-stroom-cream px-2.5 py-1 rounded-lg border border-stroom-orange/30">
                        {c.code}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${approvalBadge(c.approval_status)}`}>
                        {c.approval_status || c.status}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-stroom-black font-display">{c.title}</h4>
                    <p className="text-xs text-stroom-charcoal/80">{c.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-stroom-ivory p-3 rounded-2xl border border-stroom-borderLight">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Offer Value</span>
                        <strong className="text-stroom-black">{c.discount_value} ({c.offer_category || c.discount_type})</strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Location</span>
                        <strong className="text-stroom-black truncate block">{c.venue_name}</strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Valid Until</span>
                        <strong className="text-stroom-black">{c.valid_until}</strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Min Purchase</span>
                        <strong className="text-stroom-black">{c.min_purchase ? `₹${c.min_purchase}` : 'None'}</strong>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-stone-500">Verified Redemptions</span>
                        <span className="text-stroom-black">{c.actual_redemptions} / {c.max_redemptions} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-stroom-orange rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stroom-borderLight flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setQrPreviewCampaign(c)}
                      className="px-3 py-1.5 rounded-xl bg-stroom-ivory hover:bg-stroom-cream text-stroom-black font-bold flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>QR Voucher Pass</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {c.approval_status === 'Draft' && (
                        <button
                          type="button"
                          onClick={() => handleCampaignAction(c.id, 'submit')}
                          className="px-3 py-1.5 rounded-xl bg-stroom-orange text-white font-black flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Submit for Review</span>
                        </button>
                      )}
                      {c.approval_status === 'Active' && (
                        <button
                          type="button"
                          onClick={() => handleCampaignAction(c.id, 'pause')}
                          className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-bold flex items-center gap-1"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                      )}
                      {c.approval_status === 'Paused' && (
                        <button
                          type="button"
                          onClick={() => handleCampaignAction(c.id, 'resume')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Campaign Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="text-lg font-black text-stroom-black font-display">
                Create Promotional Campaign
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Submitted campaigns require STROOM Admin approval before becoming active for redemptions.
              </p>

              {formError && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div className="mt-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Location *</label>
                    <select
                      value={campaignForm.venue_id}
                      onChange={(e) => setCampaignForm({ ...campaignForm, venue_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold bg-white outline-none"
                    >
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Offer Type</label>
                    <select
                      value={campaignForm.offer_category}
                      onChange={(e) => setCampaignForm({ ...campaignForm, offer_category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold bg-white outline-none"
                    >
                      {OFFER_CATEGORIES.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Coupon Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. STROOMBREW25"
                      value={campaignForm.code}
                      onChange={(e) => setCampaignForm({ ...campaignForm, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-mono font-bold uppercase outline-none focus:border-stroom-orange"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Discount / Perk *</label>
                    <input
                      type="text"
                      placeholder="e.g. 25% or ₹200 Off"
                      value={campaignForm.discount_value}
                      onChange={(e) => setCampaignForm({ ...campaignForm, discount_value: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-bold outline-none focus:border-stroom-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Campaign Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Matchday Cold Brew & Snack Combo"
                    value={campaignForm.title}
                    onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-medium outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Min Bill (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={campaignForm.min_purchase}
                      onChange={(e) => setCampaignForm({ ...campaignForm, min_purchase: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Valid Until *</label>
                    <input
                      type="date"
                      value={campaignForm.valid_until}
                      onChange={(e) => setCampaignForm({ ...campaignForm, valid_until: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl border border-stroom-borderLight font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Max Limit</label>
                    <input
                      type="number"
                      min={1}
                      value={campaignForm.max_redemptions}
                      onChange={(e) => setCampaignForm({ ...campaignForm, max_redemptions: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Eligible Event (Optional)</label>
                  <select
                    value={campaignForm.eligible_event_id}
                    onChange={(e) => setCampaignForm({ ...campaignForm, eligible_event_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold bg-white"
                  >
                    <option value="">All STROOM Members at this Location</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Terms & Conditions</label>
                  <input
                    type="text"
                    value={campaignForm.terms_conditions}
                    onChange={(e) => setCampaignForm({ ...campaignForm, terms_conditions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-medium"
                  />
                </div>

                <div className="pt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => handleCreateCampaign(false)}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => handleCreateCampaign(true)}
                    className="flex-1 py-2.5 rounded-xl bg-stroom-orange text-white font-black shadow-brand hover:brightness-105"
                  >
                    {creating ? 'Submitting...' : 'Submit Campaign for Approval'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Pass Modal */}
        {qrPreviewCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4 relative shadow-2xl">
              <button
                onClick={() => setQrPreviewCampaign(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
                STROOM Verified Partner Offer
              </span>
              <h4 className="text-lg font-black text-stroom-black font-display">{qrPreviewCampaign.title}</h4>
              <div className="mx-auto w-40 h-40 rounded-2xl bg-stroom-ivory border-2 border-stroom-orange/40 flex flex-col items-center justify-center p-4">
                <QrCode className="w-24 h-24 text-stroom-black" />
                <span className="font-mono font-black text-xs text-stroom-deep mt-2">{qrPreviewCampaign.code}</span>
              </div>
              <p className="text-xs text-stone-600">{qrPreviewCampaign.terms_conditions || qrPreviewCampaign.description}</p>
              <p className="text-[10px] text-stone-400">
                Scan or enter code at Partner Cashier Redemption Terminal • Valid until {qrPreviewCampaign.valid_until}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'redemption': Two-step Verified Cashier Redemption Terminal + Audited Ledger
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-stroom-black font-display">
          Partner QR Coupon & Cashier Redemption Terminal
        </h3>
        <p className="text-xs text-stroom-charcoal/70">
          Verify coupon eligibility, validity dates, and member pass duplication checks before confirming redemption.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 2-Step Verification & Redemption Terminal */}
        <div className="lg:col-span-5">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-stroom-charcoal via-stroom-black to-stroom-cardDark text-white border border-stroom-orange/30 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stroom-borderDark">
              <ScanLine className="w-5 h-5 text-stroom-orange" />
              <h4 className="text-base font-black text-white font-display">
                Cashier Verification & Redemption
              </h4>
            </div>

            {redeemError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{redeemError}</span>
              </div>
            )}

            {redeemReceipt && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-100 text-xs space-y-1">
                <div className="flex items-center gap-2 font-extrabold text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Redemption Confirmed & Recorded!</span>
                </div>
                <p>Coupon: <strong className="font-mono text-stroom-orange">{redeemReceipt.code}</strong> — {redeemReceipt.title}</p>
                <p className="text-[11px] text-emerald-300">
                  Receipt ID: {redeemReceipt.redemptionId} • Purchase Verified: {redeemReceipt.purchaseVerified ? 'Yes' : 'No bill entered'}
                </p>
              </div>
            )}

            <form onSubmit={handleVerifyCoupon} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-stroom-cream/70 mb-1">Business Location</label>
                <select
                  value={redeemVenueId}
                  onChange={(e) => {
                    setRedeemVenueId(e.target.value);
                    setVerifiedOffer(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-semibold outline-none"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id} className="text-black">{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stroom-cream/70 mb-1">Coupon / QR Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STROOMJUBILEE20"
                  value={redeemCode}
                  onChange={(e) => {
                    setRedeemCode(e.target.value);
                    setVerifiedOffer(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 focus:border-stroom-orange text-white font-mono font-bold uppercase outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stroom-cream/70 mb-1">Member Pass Code</label>
                  <input
                    type="text"
                    placeholder="e.g. STR-HYD-7821"
                    value={redeemPassCode}
                    onChange={(e) => {
                      setRedeemPassCode(e.target.value);
                      setVerifiedOffer(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-mono uppercase outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stroom-cream/70 mb-1">Verified Bill (₹)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Optional e.g. 850"
                    value={redeemOrderAmount}
                    onChange={(e) => setRedeemOrderAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stroom-cream/70 mb-1">Cashier Notes</label>
                <input
                  type="text"
                  placeholder="Optional register reference"
                  value={redeemNotes}
                  onChange={(e) => setRedeemNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4 text-stroom-orange" />}
                <span>Step 1: Verify Coupon Eligibility</span>
              </button>
            </form>

            {/* Step 2: Offer Details & Confirm Redemption */}
            {verifiedOffer && (
              <div className="p-4 rounded-2xl bg-stroom-cream text-stroom-black space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Eligible Offer Verified
                  </span>
                  <span className="font-mono font-black text-xs text-stroom-deep">{verifiedOffer.code}</span>
                </div>
                <h5 className="text-sm font-black">{verifiedOffer.title}</h5>
                <p className="text-xs text-stroom-charcoal/80">
                  Discount: <strong>{verifiedOffer.discount_value}</strong> • Remaining Uses: <strong>{verifiedOffer.remaining_redemptions}</strong>
                </p>
                {verifiedOffer.terms_conditions && (
                  <p className="text-[10px] text-stone-500">{verifiedOffer.terms_conditions}</p>
                )}

                <button
                  type="button"
                  disabled={redeeming}
                  onClick={handleConfirmRedemption}
                  className="w-full py-3 rounded-xl bg-stroom-orange text-white font-black text-xs uppercase tracking-wider shadow-brand hover:brightness-105 flex items-center justify-center gap-1.5"
                >
                  {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Step 2: Confirm & Record Redemption</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Audited Redemption History */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
            <h4 className="text-base font-black text-stroom-black font-display flex items-center gap-2">
              <Receipt className="w-4 h-4 text-stroom-orange" />
              <span>Audited Redemption Ledger</span>
            </h4>
            <span className="text-[10px] font-bold text-stone-500 uppercase">
              {redemptions.length} Verified Entries
            </span>
          </div>

          {redemptions.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
              No verified coupon redemptions logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stroom-ivory text-[10px] font-extrabold uppercase text-stone-500">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Pass Ref</th>
                    <th className="p-3">Verified Purchase</th>
                    <th className="p-3">Staff</th>
                    <th className="p-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroom-borderLight">
                  {redemptions.map((r) => (
                    <tr key={r.id} className="hover:bg-stroom-ivory/50">
                      <td className="p-3 font-mono font-bold text-stroom-deep">{r.coupon_code}</td>
                      <td className="p-3 font-mono text-stone-600">{r.pass_code || 'Walk-in Pass'}</td>
                      <td className="p-3 font-bold text-stroom-black">
                        {r.order_amount ? `₹${r.order_amount}` : <span className="text-stone-400 font-normal">Not available</span>}
                      </td>
                      <td className="p-3 text-stone-600">{r.verified_by_staff || 'Authorized Staff'}</td>
                      <td className="p-3 text-[11px] text-stone-500">{new Date(r.redeemed_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
