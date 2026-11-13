import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { PartnerAccount } from '../../types';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Tag,
  Handshake,
  Eye,
  PlusCircle,
  Loader2,
  X,
  AlertCircle,
  Calendar,
  MapPin
} from 'lucide-react';

export const AdminPartnerManager: React.FC = () => {
  const [partners, setPartners] = useState<PartnerAccount[]>([]);
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([]);
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  // Inspect partner modal
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyTier, setVerifyTier] = useState('Gold Venue Partner');
  const [verifyingAction, setVerifyingAction] = useState(false);

  // Create collaboration proposal modal
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeForm, setProposeForm] = useState({
    venue_id: '',
    event_name: '',
    event_category: 'cafe_meetup',
    description: '',
    proposed_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    proposed_time: '6:00 PM IST',
    expected_attendance: 50,
    commercial_arrangement: 'Zero rental fee; mutual F&B promotion and tracked STROOM member offer.',
  });
  const [proposeSubmitting, setProposeSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadOverview();
  }, [statusFilter, cityFilter]);

  useEffect(() => {
    const t = setTimeout(loadOverview, 220);
    return () => clearTimeout(t);
  }, [search]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminPartnersOverview({
        status: statusFilter,
        city: cityFilter,
        search: search.trim() || undefined,
      });
      setPartners(res.partners || []);
      setPendingCampaigns(res.pendingCampaigns || []);
      setCollaborations(res.collaborations || []);
    } catch (err) {
      console.warn('Error loading admin partners overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const openPartnerDetails = async (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setLoadingDetails(true);
    setFeedback(null);
    try {
      const res = await api.getAdminPartnerDetails(partnerId);
      setDetails(res);
      setVerifyNotes(res.partner?.verification_notes || '');
      setVerifyTier(res.partner?.partnership_tier || 'Gold Venue Partner');
      if (res.venues?.length > 0) {
        setProposeForm((f) => ({ ...f, venue_id: res.venues[0].id }));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load partner details' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVerifyPartner = async (status: 'Verified' | 'Under Review' | 'Rejected' | 'Suspended') => {
    if (!selectedPartnerId) return;
    setVerifyingAction(true);
    setFeedback(null);
    try {
      await api.verifyAdminPartner(selectedPartnerId, {
        status,
        notes: verifyNotes.trim() || undefined,
        partnership_tier: verifyTier,
      });
      setFeedback({ type: 'success', text: `Partner status updated to ${status}.` });
      await openPartnerDetails(selectedPartnerId);
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Verification update failed' });
    } finally {
      setVerifyingAction(false);
    }
  };

  const handleReviewCampaign = async (campaignId: string, decision: 'approve' | 'reject' | 'pause') => {
    try {
      await api.reviewAdminCampaign(campaignId, { decision });
      await loadOverview();
      if (selectedPartnerId) await openPartnerDetails(selectedPartnerId);
    } catch (err: any) {
      alert(err.message || 'Campaign review failed');
    }
  };

  const handleConfirmCollaboration = async (collabId: string) => {
    try {
      const res = await api.confirmAdminCollaboration(collabId);
      alert(`Collaboration confirmed & Event published (${res.eventId})`);
      await loadOverview();
      if (selectedPartnerId) await openPartnerDetails(selectedPartnerId);
    } catch (err: any) {
      alert(err.message || 'Failed to confirm collaboration');
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !proposeForm.venue_id) return;
    setProposeSubmitting(true);
    setFeedback(null);
    try {
      await api.createAdminCollaboration({
        partner_id: selectedPartnerId,
        ...proposeForm,
        expected_attendance: Number(proposeForm.expected_attendance) || 50,
      });
      setShowProposeModal(false);
      setProposeForm((f) => ({ ...f, event_name: '', description: '' }));
      setFeedback({ type: 'success', text: 'Collaboration proposal sent to partner!' });
      await openPartnerDetails(selectedPartnerId);
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to propose collaboration' });
    } finally {
      setProposeSubmitting(false);
    }
  };

  const badgeStyle = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Submitted':
      case 'Under Review':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Rejected':
      case 'Suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-stroom-black font-display">
            Business Partner & Collaboration Administration
          </h3>
          <p className="text-xs text-stroom-charcoal/70">
            Verify business onboarding submissions, approve promotional campaigns, propose venue collaborations, and inspect audit trails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search partner or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-semibold outline-none focus:border-stroom-orange"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-bold"
          >
            <option value="all">All Statuses</option>
            <option value="Submitted">Submitted (Needs Review)</option>
            <option value="Under Review">Under Review</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
            <option value="Suspended">Suspended</option>
            <option value="Draft">Draft</option>
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-bold"
          >
            <option value="all">All Cities</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Pune">Pune</option>
            <option value="Bangalore">Bangalore</option>
            <option value="Mumbai">Mumbai</option>
          </select>
        </div>
      </div>

      {/* Partner Accounts Directory */}
      <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
          </div>
        ) : partners.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-400">No partner accounts matched.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stroom-cream/50 border-b border-stroom-borderLight text-[10px] font-extrabold uppercase text-stone-600">
                <tr>
                  <th className="p-4">Business</th>
                  <th className="p-4">Category & City</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4">Footprint</th>
                  <th className="p-4 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroom-borderLight">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-stroom-cream/20">
                    <td className="p-4">
                      <p className="font-extrabold text-stroom-black">{p.business_name}</p>
                      <p className="text-[11px] text-stone-500">{p.contact_person} • {p.contact_email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-stone-700">{p.category}</p>
                      <p className="text-[11px] text-stone-500">{p.city}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeStyle(p.verification_status)}`}>
                        {p.verification_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">{p.venues_count || 0} Venues</span>
                        <span className="px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">{p.collaborations_count || 0} Collabs</span>
                        {(p.pending_campaigns_count || 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{p.pending_campaigns_count} Pending Offers</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openPartnerDetails(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stroom-black text-white font-bold text-[11px] hover:bg-stroom-orange transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect & Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Campaign Approvals & Accepted Collaborations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 space-y-4">
          <h4 className="text-sm font-black text-stroom-black font-display flex items-center gap-2 pb-3 border-b border-stroom-borderLight">
            <Tag className="w-4 h-4 text-stroom-orange" />
            <span>Campaign Approval Queue ({pendingCampaigns.length})</span>
          </h4>
          {pendingCampaigns.length === 0 ? (
            <p className="text-xs text-stone-400 py-6 text-center">No partner campaigns awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {pendingCampaigns.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-stroom-deep">{c.code}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                      {c.approval_status}
                    </span>
                  </div>
                  <p className="font-extrabold text-stroom-black">{c.title}</p>
                  <p className="text-[11px] text-stone-500">
                    {c.partner_name || c.venue_name} • {c.discount_value} • Valid until {c.valid_until}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleReviewCampaign(c.id, 'approve')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-black text-[11px]"
                    >
                      Approve & Activate
                    </button>
                    <button
                      onClick={() => handleReviewCampaign(c.id, 'reject')}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-bold text-[11px]"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 space-y-4">
          <h4 className="text-sm font-black text-stroom-black font-display flex items-center gap-2 pb-3 border-b border-stroom-borderLight">
            <Handshake className="w-4 h-4 text-stroom-orange" />
            <span>Collaboration Pipeline ({collaborations.length})</span>
          </h4>
          {collaborations.length === 0 ? (
            <p className="text-xs text-stone-400 py-6 text-center">No collaborations tracked yet.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {collaborations.map((col) => (
                <div key={col.id} className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-white border border-stroom-borderLight text-[10px] font-black uppercase text-stroom-deep">
                        {col.status}
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">{col.suggested_date || col.proposed_date}</span>
                    </div>
                    <p className="font-extrabold text-stroom-black mt-1">{col.event_name}</p>
                    <p className="text-[11px] text-stone-500">{col.partner_name} • {col.venue_name}</p>
                  </div>
                  {col.status === 'Approved' && !col.event_id && (
                    <button
                      onClick={() => handleConfirmCollaboration(col.id)}
                      className="px-3 py-1.5 rounded-xl bg-stroom-orange text-white font-black text-[11px] shrink-0"
                    >
                      Confirm & Publish Event
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inspect Partner Modal */}
      {selectedPartnerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-2xl relative space-y-6">
            <button
              onClick={() => {
                setSelectedPartnerId(null);
                setDetails(null);
                setShowProposeModal(false);
              }}
              className="absolute top-5 right-5 p-2 rounded-full bg-stone-100 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingDetails || !details?.partner ? (
              <div className="py-16 flex justify-center text-stone-400">
                <Loader2 className="w-7 h-7 animate-spin text-stroom-orange" />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stroom-borderLight">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeStyle(details.partner.verification_status)}`}>
                        {details.partner.verification_status}
                      </span>
                      <span className="text-xs font-bold text-stone-500">{details.partner.category} • {details.partner.city}</span>
                    </div>
                    <h3 className="text-xl font-black text-stroom-black font-display mt-1">{details.partner.business_name}</h3>
                    <p className="text-xs text-stone-500">{details.partner.contact_person} • {details.partner.contact_email} • {details.partner.contact_phone}</p>
                  </div>
                  <button
                    onClick={() => setShowProposeModal(!showProposeModal)}
                    className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand flex items-center gap-1.5 self-start"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Propose Event Collaboration</span>
                  </button>
                </div>

                {feedback && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{feedback.text}</span>
                  </div>
                )}

                {/* Propose Collaboration Form */}
                {showProposeModal && (
                  <form onSubmit={handleCreateProposal} className="p-5 rounded-2xl bg-stroom-cream/50 border border-stroom-orange/30 space-y-3 text-xs">
                    <h4 className="font-black text-stroom-black uppercase tracking-wider">Send Event Collaboration Proposal</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold uppercase text-stone-500 mb-1">Target Venue *</label>
                        <select
                          value={proposeForm.venue_id}
                          onChange={(e) => setProposeForm({ ...proposeForm, venue_id: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-semibold"
                        >
                          {(details.venues || []).map((v: any) => (
                            <option key={v.id} value={v.id}>{v.name} (Cap: {v.capacity})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold uppercase text-stone-500 mb-1">Proposed Event Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Saturday Strategy Board Games & Coffee"
                          value={proposeForm.event_name}
                          onChange={(e) => setProposeForm({ ...proposeForm, event_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-semibold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold uppercase text-stone-500 mb-1">Proposed Date *</label>
                        <input
                          type="date"
                          required
                          value={proposeForm.proposed_date}
                          onChange={(e) => setProposeForm({ ...proposeForm, proposed_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold uppercase text-stone-500 mb-1">Time</label>
                        <input
                          type="text"
                          value={proposeForm.proposed_time}
                          onChange={(e) => setProposeForm({ ...proposeForm, proposed_time: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold uppercase text-stone-500 mb-1">Target Attendance</label>
                        <input
                          type="number"
                          value={proposeForm.expected_attendance}
                          onChange={(e) => setProposeForm({ ...proposeForm, expected_attendance: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Description & Commercial Arrangement</label>
                      <input
                        type="text"
                        value={proposeForm.description}
                        onChange={(e) => setProposeForm({ ...proposeForm, description: e.target.value })}
                        placeholder="Brief experience overview..."
                        className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white mb-2"
                      />
                      <input
                        type="text"
                        value={proposeForm.commercial_arrangement}
                        onChange={(e) => setProposeForm({ ...proposeForm, commercial_arrangement: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={proposeSubmitting}
                        className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black"
                      >
                        {proposeSubmitting ? 'Sending...' : 'Send Collaboration Proposal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowProposeModal(false)}
                        className="px-4 py-2 rounded-xl bg-white border border-stone-200 font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Verification Decision Controls */}
                <div className="p-5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight space-y-3 text-xs">
                  <h4 className="font-black text-stroom-black uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-stroom-orange" />
                    <span>Partner Verification & Status Controls</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Partnership Tier</label>
                      <select
                        value={verifyTier}
                        onChange={(e) => setVerifyTier(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-bold"
                      >
                        <option value="Community Partner">Community Partner</option>
                        <option value="Gold Venue Partner">Gold Venue Partner</option>
                        <option value="Flagship Sports Arena">Flagship Sports Arena</option>
                        <option value="Heritage Cafe Partner">Heritage Cafe Partner</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Admin Verification Notes</label>
                      <input
                        type="text"
                        value={verifyNotes}
                        onChange={(e) => setVerifyNotes(e.target.value)}
                        placeholder="Verification rationale or requested information..."
                        className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={verifyingAction}
                      onClick={() => handleVerifyPartner('Verified')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black"
                    >
                      Approve & Verify Partner
                    </button>
                    <button
                      disabled={verifyingAction}
                      onClick={() => handleVerifyPartner('Under Review')}
                      className="px-4 py-2 rounded-xl bg-amber-100 text-amber-900 font-bold"
                    >
                      Mark Under Review
                    </button>
                    <button
                      disabled={verifyingAction}
                      onClick={() => handleVerifyPartner('Rejected')}
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-700 font-bold"
                    >
                      Reject Submission
                    </button>
                    <button
                      disabled={verifyingAction}
                      onClick={() => handleVerifyPartner('Suspended')}
                      className="px-4 py-2 rounded-xl bg-stone-800 text-white font-bold"
                    >
                      Suspend Access
                    </button>
                  </div>
                </div>

                {/* Partner Analytics Snapshot + Audit Log */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                    <span className="text-[10px] font-bold uppercase text-stone-500">Registrations</span>
                    <p className="text-lg font-black">{details.analytics?.summary?.confirmedRegistrations ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">Verified Check-Ins</span>
                    <p className="text-lg font-black text-emerald-800">{details.analytics?.summary?.actualVerifiedCheckins ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] font-bold uppercase text-amber-700">Redemptions</span>
                    <p className="text-lg font-black text-amber-800">{details.analytics?.summary?.couponRedemptions ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                    <span className="text-[10px] font-bold uppercase text-stone-500">Venues</span>
                    <p className="text-lg font-black">{details.venues?.length ?? 0}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2">
                    Partner Audit Log ({details.auditLogs?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-[11px]">
                    {(details.auditLogs || []).map((log: any) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-stone-50 flex items-center justify-between gap-2">
                        <span><strong>{log.action}</strong> by {log.actor_name}</span>
                        <span className="font-mono text-stone-400">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
