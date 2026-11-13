import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { PartnerCollaboration } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  FileText,
  AlertCircle,
  Send,
  Loader2,
  ClipboardCheck,
  Shield
} from 'lucide-react';

interface PartnerOperationsPanelProps {
  partnerId: string;
  mode: 'collaborations' | 'events';
  verificationStatus: string;
}

export const PartnerOperationsPanel: React.FC<PartnerOperationsPanelProps> = ({
  partnerId,
  mode,
  verificationStatus,
}) => {
  const [collaborations, setCollaborations] = useState<PartnerCollaboration[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollabId, setSelectedCollabId] = useState<string | null>(null);

  // Partner collaboration response state
  const [commentText, setCommentText] = useState('');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('6:00 PM IST');
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Operational notes state for events
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    loadData();
  }, [partnerId, mode]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (mode === 'collaborations') {
        const res = await api.getPartnerCollaborations(partnerId);
        const list = res.collaborations || [];
        setCollaborations(list);
        if (list.length > 0 && (!selectedCollabId || !list.find((c) => c.id === selectedCollabId))) {
          setSelectedCollabId(list[0].id);
        }
      } else {
        const res = await api.getPartnerHostedEvents(partnerId);
        setEvents(res.events || []);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (
    collabId: string,
    action: 'accept' | 'reject' | 'request_changes' | 'suggest_date' | 'comment'
  ) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const payload: any = {
        action,
        message: commentText.trim() || undefined,
      };
      if (action === 'suggest_date') {
        if (!suggestedDate) {
          setFeedback({ type: 'error', text: 'Please select an alternate date first.' });
          setActionLoading(false);
          return;
        }
        payload.suggested_date = suggestedDate;
        payload.suggested_time = suggestedTime;
      }
      const res = await api.respondToCollaboration(partnerId, collabId, payload);
      if (res.collaboration) {
        setCollaborations((prev) =>
          prev.map((c) => (c.id === collabId ? { ...c, ...res.collaboration } : c))
        );
        setCommentText('');
        setShowSuggestForm(false);
        setFeedback({ type: 'success', text: `Collaboration updated (${res.collaboration.status}).` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveOperationalNotes = async (eventId: string) => {
    setSavingNotes(true);
    setFeedback(null);
    try {
      await api.updatePartnerEventOperations(partnerId, eventId, notesDraft);
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, partner_operational_notes: notesDraft } : ev))
      );
      setEditingNotesId(null);
      setFeedback({ type: 'success', text: 'Operational logistics notes saved.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save operational notes' });
    } finally {
      setSavingNotes(false);
    }
  };

  const statusPill = (status: string) => {
    switch (status) {
      case 'Scheduled':
      case 'Approved':
      case 'Live':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Proposal Sent':
      case 'Under Review':
        return 'bg-stroom-orange/15 text-stroom-deep border border-stroom-orange/30';
      case 'Negotiation':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Rejected':
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border border-red-200';
      default:
        return 'bg-stone-100 text-stone-700 border border-stone-200';
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-stone-400">
        <Loader2 className="w-7 h-7 animate-spin text-stroom-orange mb-2" />
        <p className="text-xs font-bold">Loading {mode === 'collaborations' ? 'collaboration proposals' : 'hosted events'}...</p>
      </div>
    );
  }

  if (mode === 'collaborations') {
    const selected = collaborations.find((c) => c.id === selectedCollabId) || collaborations[0];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-black text-stroom-black font-display">
            Event Collaboration Proposals & Workflow
          </h3>
          <p className="text-xs text-stroom-charcoal/70">
            Review STROOM event proposals, commercial arrangements, and coordinate event dates. Viewing a proposal never auto-confirms it.
          </p>
        </div>

        {feedback && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {collaborations.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs text-stone-500">
            No collaboration proposals received yet. Keep your venue availability updated so STROOM coordinators can propose experiences!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: List */}
            <div className="lg:col-span-5 space-y-3">
              {collaborations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCollabId(c.id);
                    setShowSuggestForm(false);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selected?.id === c.id
                      ? 'bg-white border-stroom-orange shadow-brand'
                      : 'bg-white/70 border-stroom-borderLight hover:border-stroom-orange/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${statusPill(c.status)}`}>
                      {c.status}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-stone-500">
                      {c.suggested_date || c.proposed_date}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-stroom-black line-clamp-1">{c.event_name}</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stroom-orange shrink-0" />
                    <span className="truncate">{c.venue_name}</span>
                    <span>• Target ~{c.expected_attendance} pax</span>
                  </p>
                </button>
              ))}
            </div>

            {/* Right: Detailed Proposal Inspector */}
            {selected && (
              <div className="lg:col-span-7 bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 space-y-5">
                <div className="pb-4 border-b border-stroom-borderLight">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${statusPill(selected.status)}`}>
                      {selected.status}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500 uppercase">
                      Category: {selected.event_category}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-stroom-black font-display mt-2">
                    {selected.event_name}
                  </h4>
                  <p className="text-xs text-stroom-charcoal/80 mt-1">{selected.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stroom-ivory p-4 rounded-2xl border border-stroom-borderLight">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-500 block">Proposed Schedule</span>
                    <strong className="text-stroom-black">{selected.suggested_date || selected.proposed_date}</strong>
                    <p className="text-[11px] text-stone-600">{selected.suggested_time || selected.proposed_time}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-500 block">Proposed Target Group</span>
                    <strong className="text-stroom-black">~{selected.expected_attendance} guests</strong>
                    <p className="text-[10px] text-stone-500">Subject to registrations & check-ins</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-500 block">STROOM Organizer</span>
                    <strong className="text-stroom-black">{selected.organizer_name}</strong>
                    <p className="text-[11px] text-stone-600 truncate">{selected.venue_name}</p>
                  </div>
                </div>

                {/* Responsibilities & Arrangement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                    <span className="text-[10px] font-black uppercase text-stroom-deep">Partner Responsibilities</span>
                    <p className="text-stone-700 leading-relaxed">{selected.partner_responsibilities || 'Provide host area & coordinate entry.'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                    <span className="text-[10px] font-black uppercase text-stroom-orange">STROOM Responsibilities</span>
                    <p className="text-stone-700 leading-relaxed">{selected.stroom_responsibilities || 'Ticketing, host lead & QR door verification.'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stroom-cream/40 border border-stroom-borderLight space-y-1">
                    <span className="text-[10px] font-black uppercase text-stone-600">Commercial Arrangement</span>
                    <p className="text-stone-800 font-medium">{selected.commercial_arrangement || 'Mutually agreed non-guaranteed partnership terms.'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stroom-cream/40 border border-stroom-borderLight space-y-1">
                    <span className="text-[10px] font-black uppercase text-stone-600">Marketing & Target Audience</span>
                    <p className="text-stone-700">{selected.marketing_plan}</p>
                    {selected.target_audience && <p className="text-[11px] text-stone-500 mt-1">Audience: {selected.target_audience}</p>}
                  </div>
                </div>

                {selected.special_requirements && (
                  <p className="text-xs text-stone-600 bg-amber-50/70 border border-amber-200 p-3 rounded-xl">
                    <strong>Special Requirements:</strong> {selected.special_requirements}
                  </p>
                )}

                {/* Partner Action Buttons */}
                {!['Scheduled', 'Live', 'Completed', 'Rejected', 'Cancelled'].includes(selected.status) && (
                  <div className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                      Partner Decision & Negotiation
                    </p>
                    {verificationStatus !== 'Verified' && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl font-bold">
                        Your business must be Verified before accepting collaborations. You can still comment or ask questions below.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionLoading || verificationStatus !== 'Verified'}
                        onClick={() => handleRespond(selected.id, 'accept')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept Proposal</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setShowSuggestForm(!showSuggestForm)}
                        className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Suggest Another Date</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleRespond(selected.id, 'request_changes')}
                        className="px-4 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-stroom-black font-bold text-xs"
                      >
                        Request Changes
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleRespond(selected.id, 'reject')}
                        className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>

                    {showSuggestForm && (
                      <div className="p-3 rounded-xl bg-white border border-stroom-borderLight grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Alternate Date</label>
                          <input
                            type="date"
                            value={suggestedDate}
                            onChange={(e) => setSuggestedDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-stroom-borderLight text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Preferred Time</label>
                          <input
                            type="text"
                            value={suggestedTime}
                            onChange={(e) => setSuggestedTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-stroom-borderLight text-xs font-semibold"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleRespond(selected.id, 'suggest_date')}
                          className="py-1.5 px-3 rounded-lg bg-stroom-orange text-white font-black text-xs"
                        >
                          Send Alternate Date
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Auditable Comment Thread */}
                <div className="space-y-3 pt-2 border-t border-stroom-borderLight">
                  <h5 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-stroom-orange" />
                    <span>Auditable Discussion & Decision Log</span>
                  </h5>

                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {(selected.comments || []).length === 0 ? (
                      <p className="text-[11px] text-stone-400 italic">No comments recorded yet.</p>
                    ) : (
                      (selected.comments || []).map((cm) => (
                        <div key={cm.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-0.5">
                            <strong className="text-stroom-black">{cm.sender_name} ({cm.sender_role})</strong>
                            <span>{new Date(cm.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-stone-700">{cm.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add operational note, question, or counter-comment..."
                      className="flex-1 px-3 py-2 rounded-xl border border-stroom-borderLight text-xs outline-none focus:border-stroom-orange"
                    />
                    <button
                      type="button"
                      disabled={actionLoading || !commentText.trim()}
                      onClick={() => handleRespond(selected.id, 'comment')}
                      className="px-4 py-2 rounded-xl bg-stroom-black text-white font-bold text-xs hover:bg-stroom-orange transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // MODE === 'events': Event Hosting & Operations
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-stroom-black font-display">
          Approved Event Hosting & Operations
        </h3>
        <p className="text-xs text-stroom-charcoal/70">
          Track live registration counts, verified door check-ins, event timelines, and operational instructions. (Private attendee identities remain protected.)
        </p>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {events.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs text-stone-500">
          No approved or scheduled events hosted at your venues yet.
        </div>
      ) : (
        <div className="space-y-5">
          {events.map((ev) => {
            const regPct = ev.seats_total > 0 ? Math.min(100, Math.round((ev.confirmed_registrations / ev.seats_total) * 100)) : 0;
            const checkinPct = ev.confirmed_registrations > 0 ? Math.min(100, Math.round((ev.actual_checkins / ev.confirmed_registrations) * 100)) : 0;
            const timelineSteps = [
              'Collaboration Approved',
              'Event Published',
              'Registrations Opened',
              'Event Reminders Sent',
              'Event Started',
              'Check-in Completed',
              'Event Closed',
              'Performance Report Generated',
            ];

            return (
              <div key={ev.id} className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stroom-borderLight">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-stroom-orange/15 text-stroom-deep text-[10px] font-black uppercase">
                        {ev.status}
                      </span>
                      <span className="text-[11px] font-bold text-stone-500">{ev.venue_name} • {ev.city_name}</span>
                    </div>
                    <h4 className="text-lg font-black text-stroom-black font-display mt-1">{ev.title}</h4>
                    <p className="text-xs text-stone-500 flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-stroom-orange" /> {ev.event_date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-stroom-orange" /> {ev.event_time}</span>
                    </p>
                  </div>

                  {/* Attendance Progress Summary */}
                  <div className="grid grid-cols-3 gap-3 bg-stroom-ivory p-3.5 rounded-2xl border border-stroom-borderLight text-center shrink-0">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-stone-500 block">Expected Cap</span>
                      <strong className="text-base font-black text-stroom-black">{ev.seats_total}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-stone-500 block">Registered</span>
                      <strong className="text-base font-black text-stroom-deep">{ev.confirmed_registrations}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-emerald-700 block">Checked-In</span>
                      <strong className="text-base font-black text-emerald-700">{ev.actual_checkins}</strong>
                    </div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-stone-600">Registration Fill Rate</span>
                      <span className="text-stroom-deep">{regPct}%</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-stroom-orange rounded-full" style={{ width: `${regPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-stone-600">Verified Door Attendance Rate</span>
                      <span className="text-emerald-700">{ev.confirmed_registrations > 0 ? `${checkinPct}%` : 'No check-ins yet'}</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${checkinPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Event Lifecycle Timeline */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-500 mb-2">
                    Event Operational Timeline
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {timelineSteps.map((stepName, idx) => {
                      const done =
                        idx <= 1 ||
                        (idx === 2 && ev.confirmed_registrations > 0) ||
                        (idx <= 4 && (ev.status === 'live' || ev.status === 'completed')) ||
                        (idx >= 5 && ev.status === 'completed');
                      return (
                        <div
                          key={stepName}
                          className={`p-2 rounded-xl border text-[10px] font-bold ${
                            done
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-stone-50 border-stone-200 text-stone-400'
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <CheckCircle2 className={`w-3 h-3 shrink-0 ${done ? 'text-emerald-600' : 'text-stone-300'}`} />
                            <span>Step {idx + 1}</span>
                          </div>
                          <p className="leading-tight">{stepName}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Partner Operational Logistics Notes */}
                <div className="p-4 rounded-2xl bg-stroom-cream/40 border border-stroom-borderLight space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-stroom-black uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardCheck className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>Venue Operational Instructions & Staff Notes</span>
                    </span>
                    {editingNotesId !== ev.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNotesId(ev.id);
                          setNotesDraft(ev.partner_operational_notes || '');
                        }}
                        className="text-stroom-orange font-extrabold hover:underline"
                      >
                        Edit Operational Notes
                      </button>
                    )}
                  </div>
                  {editingNotesId === ev.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Add staff readiness notes, reception desk location, Wi-Fi code for organizer..."
                        className="w-full p-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs outline-none focus:border-stroom-orange"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={savingNotes}
                          onClick={() => handleSaveOperationalNotes(ev.id)}
                          className="px-3 py-1.5 rounded-lg bg-stroom-orange text-white font-black text-xs"
                        >
                          {savingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 font-bold text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-stone-600">
                      {ev.partner_operational_notes || 'No venue-specific logistics instructions entered yet.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
