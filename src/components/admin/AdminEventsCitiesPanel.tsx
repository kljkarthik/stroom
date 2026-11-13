import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Calendar,
  MapPin,
  Plus,
  Edit3,
  Copy,
  Archive,
  XCircle,
  CheckCircle2,
  Ticket,
  Download,
  Search,
  Loader2,
  X,
  Star,
  MoreVertical,
  Eye,
  Trash2,
  Users,
  AlertTriangle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface AdminEventsCitiesPanelProps {
  permissions: string[];
}

export const AdminEventsCitiesPanel: React.FC<AdminEventsCitiesPanelProps> = ({ permissions }) => {
  const [subTab, setSubTab] = useState<'events' | 'registrations' | 'cities'>('events');
  const [events, setEvents] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [eventSearch, setEventSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regEventFilter, setRegEventFilter] = useState('all');
  const [regSearch, setRegSearch] = useState('');

  // Three-dot action menu & inspect/delete modals
  const [openMenuEventId, setOpenMenuEventId] = useState<string | null>(null);
  const [viewingEvent, setViewingEvent] = useState<any | null>(null);
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<any | null>(null);
  const [deleteDepsLoading, setDeleteDepsLoading] = useState(false);
  const [deleteDepsData, setDeleteDepsData] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Event modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    category: 'cricket_auction',
    city_id: 'city_hyd',
    venue_id: 'ven_hyd_thirdwave',
    event_date: 'Saturday, Dec 12, 2026',
    event_time: '5:00 PM IST',
    end_time: '8:30 PM IST',
    organizer_name: 'STROOM Experiences',
    seats_total: 60,
    entry_fee: 'Free Entry',
    visibility: 'public',
    status: 'draft',
    image_url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
  });
  const [savingEvent, setSavingEvent] = useState(false);

  // City modal
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<any | null>(null);
  const [cityForm, setCityForm] = useState({
    name: '',
    state: '',
    tagline: '',
    description: '',
    image_url: '',
    is_featured: false,
    is_active: true,
  });

  const canCreate = permissions.includes('events.create');
  const canEdit = permissions.includes('events.edit');
  const canPublish = permissions.includes('events.publish');
  const canDelete = permissions.includes('events.delete');
  const canCities = permissions.includes('cities.manage');
  const canRegManage = permissions.includes('registrations.manage');

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const closeMenus = () => setOpenMenuEventId(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuEventId(null);
        setDeleteConfirmEvent(null);
        setViewingEvent(null);
      }
    };
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', closeMenus);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (subTab === 'registrations') loadRegistrations();
  }, [subTab, regEventFilter, regSearch]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [evRes, cityRes, venRes] = await Promise.all([
        api.getAdminEvents({ status: statusFilter, search: eventSearch }),
        api.getAdminCities(),
        api.getPartnerVenues(),
      ]);
      setEvents(evRes.events || []);
      setCities(cityRes.cities || []);
      setVenues(venRes.venues || []);
    } catch (err) {
      console.warn('Error loading events/cities:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEventsFiltered = async () => {
    try {
      const res = await api.getAdminEvents({ status: statusFilter, search: eventSearch });
      setEvents(res.events || []);
    } catch {}
  };

  const loadRegistrations = async () => {
    try {
      const res = await api.getAdminRegistrations({ event_id: regEventFilter, search: regSearch });
      setRegistrations(res.registrations || []);
    } catch {}
  };

  const openCreateEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      description: '',
      category: 'cricket_auction',
      city_id: cities[0]?.id || 'city_hyd',
      venue_id: venues[0]?.id || 'ven_hyd_thirdwave',
      event_date: 'Saturday, Dec 12, 2026',
      event_time: '5:00 PM IST',
      end_time: '8:30 PM IST',
      organizer_name: 'STROOM Experiences',
      seats_total: 60,
      entry_fee: 'Free Entry',
      visibility: 'public',
      status: 'draft',
      image_url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
    });
    setIsEventModalOpen(true);
  };

  const openEditEvent = (ev: any) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title || '',
      description: ev.description || '',
      category: ev.category || 'cricket_auction',
      city_id: ev.city_id || 'city_hyd',
      venue_id: ev.venue_id || 'ven_hyd_thirdwave',
      event_date: ev.event_date || '',
      event_time: ev.event_time || '',
      end_time: ev.end_time || '',
      organizer_name: ev.organizer_name || 'STROOM Experiences',
      seats_total: ev.seats_total || 60,
      entry_fee: ev.entry_fee || 'Free Entry',
      visibility: ev.visibility || 'public',
      status: ev.status || 'draft',
      image_url: ev.image_url || '',
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEvent(true);
    setBanner(null);
    try {
      if (editingEvent) {
        await api.updateAdminEvent(editingEvent.id, eventForm);
        setBanner({ type: 'success', message: `Updated event "${eventForm.title}".` });
      } else {
        await api.createAdminEvent(eventForm);
        setBanner({ type: 'success', message: `Created event "${eventForm.title}".` });
      }
      setIsEventModalOpen(false);
      await loadEventsFiltered();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to save event' });
    } finally {
      setSavingEvent(false);
    }
  };

  const handleEventStatusAction = async (ev: any, next: { status?: string; is_archived?: boolean }) => {
    setBanner(null);
    try {
      await api.updateAdminEvent(ev.id, next);
      setBanner({
        type: 'success',
        message: next.is_archived ? `Archived "${ev.title}".` : `Event "${ev.title}" marked as ${next.status}.`,
      });
      await loadEventsFiltered();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to update event status' });
    }
  };

  const handleDuplicate = async (evId: string) => {
    setBanner(null);
    try {
      const res = await api.duplicateAdminEvent(evId);
      setBanner({ type: 'success', message: `Duplicated event as "${res.event?.title || 'Draft Copy'}".` });
      await loadEventsFiltered();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to duplicate event' });
    }
  };

  const handleManageRegistrations = (evId: string) => {
    setOpenMenuEventId(null);
    setRegEventFilter(evId);
    setSubTab('registrations');
  };

  const openDeleteDialog = async (ev: any) => {
    setDeleteConfirmEvent(ev);
    setDeleteDepsData(null);
    setDeleteReason('');
    setDeleteDepsLoading(true);
    try {
      const res = await api.getAdminEventDependencies(ev.id);
      setDeleteDepsData(res);
    } catch {
      setDeleteDepsData(null);
    } finally {
      setDeleteDepsLoading(false);
    }
  };

  const handleConfirmDeleteAction = async (mode: 'archive' | 'cancel' | 'delete') => {
    if (!deleteConfirmEvent || deletingEventId) return;
    const target = deleteConfirmEvent;
    setDeletingEventId(target.id);
    setBanner(null);
    try {
      const res = await api.deleteAdminEvent(target.id, {
        mode,
        reason: deleteReason.trim() || undefined,
      });
      setBanner({
        type: 'success',
        message:
          res.message ||
          (res.action === 'archived'
            ? `Safely archived "${target.title}".`
            : res.action === 'cancelled'
            ? `Safely cancelled "${target.title}".`
            : `Deleted "${target.title}".`),
      });
      setDeleteConfirmEvent(null);
      setDeleteDepsData(null);
      await loadEventsFiltered();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to execute action. Event remains unchanged.' });
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleExportRegistrationsCsv = async () => {
    try {
      const res = await api.exportAdminReport('registrations');
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || 'stroom-registrations.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const handleCancelRegistration = async (regId: string) => {
    try {
      await api.updateAdminRegistration(regId, { checkin_status: 'cancelled' });
      await loadRegistrations();
    } catch (err: any) {
      alert(err.message || 'Unable to cancel registration');
    }
  };

  const openCityModal = (c?: any) => {
    setEditingCity(c || null);
    setCityForm({
      name: c?.name || '',
      state: c?.state || '',
      tagline: c?.tagline || '',
      description: c?.description || '',
      image_url: c?.image_url || '',
      is_featured: Boolean(c?.is_featured),
      is_active: c ? Boolean(c.is_active) : true,
    });
    setIsCityModalOpen(true);
  };

  const handleSaveCity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCity) {
        await api.updateAdminCity(editingCity.id, cityForm);
      } else {
        await api.createAdminCity(cityForm);
      }
      setIsCityModalOpen(false);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to save city');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">Events, Registrations & Cities</h2>
          <p className="text-xs text-stroom-charcoal/70">Create, publish, duplicate, archive events, manage attendee registrations, and expand STROOM cities.</p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-stroom-borderLight">
          {[
            { id: 'events', label: 'Events' },
            { id: 'registrations', label: 'Registrations' },
            ...(canCities ? [{ id: 'cities', label: 'Cities' }] : []),
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                subTab === t.id ? 'bg-stroom-orange text-white shadow-xs' : 'text-stroom-charcoal hover:text-stroom-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
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
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-[11px] underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* SUB-TAB 1: EVENTS */}
      {subTab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadEventsFiltered()}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-semibold outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setTimeout(loadEventsFiltered, 50); }}
                className="px-3 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-bold"
              >
                <option value="all">All Active Statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="archived">Archived</option>
              </select>
              <button onClick={loadEventsFiltered} className="px-3 py-2 rounded-xl bg-stroom-cream text-stroom-deep text-xs font-bold">
                Filter
              </button>
            </div>

            {canCreate && (
              <button
                onClick={openCreateEvent}
                className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Event</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-stroom-orange" /></div>
          ) : events.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No events matched your search or status filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {events.map((ev) => {
                const isMenuOpen = openMenuEventId === ev.id;
                const fillPct = ev.seats_total > 0 ? Math.min(100, Math.round(((ev.confirmed_count || 0) / ev.seats_total) * 100)) : 0;
                return (
                  <div
                    key={ev.id}
                    className={`p-5 rounded-3xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 h-full relative ${
                      ev.is_archived ? 'border-stone-300 opacity-90' : 'border-stroom-borderLight hover:border-stroom-orange/40'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Card Header: Status + City + Fee + Top-Right Three-Dot Action Menu */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              ev.is_archived
                                ? 'bg-stone-200 text-stone-700'
                                : ev.status === 'live'
                                ? 'bg-red-100 text-red-700'
                                : ev.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ev.status === 'cancelled'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ev.is_archived ? `Archived (${ev.status})` : ev.status}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stroom-ivory border border-stroom-borderLight text-[10px] font-black text-stroom-charcoal uppercase">
                            <MapPin className="w-2.5 h-2.5 text-stroom-orange" />
                            {ev.city_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-stroom-cream/80 text-[10px] font-black text-stroom-deep">
                            {ev.entry_fee}
                          </span>
                        </div>

                        {/* Top-right accessible Three-Dot Action Menu */}
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setOpenMenuEventId(isMenuOpen ? null : ev.id)}
                            aria-label={`Event actions for ${ev.title}`}
                            aria-expanded={isMenuOpen}
                            className="w-9 h-9 rounded-xl border border-stroom-borderLight bg-stroom-ivory hover:border-stroom-orange hover:bg-stroom-cream flex items-center justify-center text-stroom-black transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div
                              role="menu"
                              className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white border border-stroom-borderLight shadow-xl py-1.5 z-30 text-xs font-bold"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuEventId(null);
                                  setViewingEvent(ev);
                                }}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-stroom-ivory flex items-center gap-2.5 text-stroom-black"
                              >
                                <Eye className="w-3.5 h-3.5 text-stroom-orange" />
                                <span>View Event</span>
                              </button>

                              {canEdit && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuEventId(null);
                                    openEditEvent(ev);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-stroom-ivory flex items-center gap-2.5 text-stroom-black"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-stroom-orange" />
                                  <span>Edit Event</span>
                                </button>
                              )}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleManageRegistrations(ev.id)}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-stroom-ivory flex items-center gap-2.5 text-stroom-black"
                              >
                                <Users className="w-3.5 h-3.5 text-stroom-orange" />
                                <span>Manage Registrations</span>
                              </button>

                              {canCreate && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuEventId(null);
                                    handleDuplicate(ev.id);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-stroom-ivory flex items-center gap-2.5 text-stroom-black"
                                >
                                  <Copy className="w-3.5 h-3.5 text-stroom-orange" />
                                  <span>Duplicate Event</span>
                                </button>
                              )}

                              {canDelete && (
                                <>
                                  <div className="my-1 border-t border-stroom-borderLight" />
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuEventId(null);
                                      openDeleteDialog(ev);
                                    }}
                                    className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 flex items-center gap-2.5 text-red-600 font-black"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Event</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Event Title & Venue Schedule */}
                      <div>
                        <h4 className="text-base font-black text-stroom-black font-display leading-snug line-clamp-2">
                          {ev.title}
                        </h4>
                        <p className="text-xs text-stone-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stroom-orange" />
                            {ev.event_date} • {ev.event_time}
                          </span>
                          <span className="text-stone-400">•</span>
                          <span className="font-semibold text-stroom-charcoal">{ev.venue_name}</span>
                        </p>
                      </div>

                      {/* Readable Capacity & Attendance Telemetry */}
                      <div className="p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight/70 space-y-2">
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                          <div>
                            <span className="text-stone-500 block font-bold uppercase">Capacity</span>
                            <strong className="text-xs font-black text-stroom-black">{ev.seats_total}</strong>
                          </div>
                          <div>
                            <span className="text-stone-500 block font-bold uppercase">Registered</span>
                            <strong className="text-xs font-black text-stroom-deep">{ev.confirmed_count}</strong>
                          </div>
                          <div>
                            <span className="text-stone-500 block font-bold uppercase">Check-In</span>
                            <strong className="text-xs font-black text-emerald-700">{ev.checked_in_count}</strong>
                          </div>
                          <div>
                            <span className="text-stone-500 block font-bold uppercase">Turnout</span>
                            <strong className="text-xs font-black text-stroom-black">
                              {ev.attendance_rate !== null ? `${ev.attendance_rate}%` : '—'}
                            </strong>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white overflow-hidden">
                          <div
                            className="h-full bg-stroom-orange rounded-full transition-all"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Compact Footer Quick Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stroom-borderLight text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canEdit && (
                          <button
                            onClick={() => openEditEvent(ev)}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {canPublish && ev.status === 'draft' && !ev.is_archived && (
                          <button
                            onClick={() => handleEventStatusAction(ev, { status: 'published' })}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Publish
                          </button>
                        )}
                        {canPublish && ev.status === 'published' && !ev.is_archived && (
                          <button
                            onClick={() => handleEventStatusAction(ev, { status: 'draft' })}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold"
                          >
                            Unpublish
                          </button>
                        )}
                        {canEdit && !ev.is_archived && (
                          <button
                            onClick={() => handleEventStatusAction(ev, { is_archived: true })}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold flex items-center gap-1"
                          >
                            <Archive className="w-3 h-3" /> Archive
                          </button>
                        )}
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => openDeleteDialog(ev)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-black flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: REGISTRATIONS */}
      {subTab === 'registrations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search attendee or pass code..."
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-semibold outline-none w-56"
              />
              <select
                value={regEventFilter}
                onChange={(e) => setRegEventFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-bold"
              >
                <option value="all">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
            {canRegManage && (
              <button
                onClick={handleExportRegistrationsCsv}
                className="px-4 py-2 rounded-xl bg-stroom-black text-white font-black text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-stroom-orange" />
                <span>Export Attendee CSV</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stroom-ivory text-[10px] font-extrabold uppercase text-stone-500">
                <tr>
                  <th className="p-4">Participant</th>
                  <th className="p-4">Pass Code</th>
                  <th className="p-4">Event</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Check-in Status</th>
                  {canRegManage && <th className="p-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroom-borderLight">
                {registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-stroom-ivory/40">
                    <td className="p-4">
                      <p className="font-bold text-stroom-black">{r.participant_name}</p>
                      <p className="text-[10px] text-stone-400">{r.participant_member_id || r.id}</p>
                    </td>
                    <td className="p-4 font-mono font-bold text-stroom-deep">{r.pass_code}</td>
                    <td className="p-4">{r.event_title}</td>
                    <td className="p-4">{r.payment_status ? `${r.payment_status} (₹${r.payment_amount})` : 'Free / Desk'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        r.checkin_status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' :
                        r.checkin_status === 'cancelled' ? 'bg-stone-200 text-stone-500' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {r.checkin_status}
                      </span>
                    </td>
                    {canRegManage && (
                      <td className="p-4 text-right">
                        {r.checkin_status === 'confirmed' && (
                          <button onClick={() => handleCancelRegistration(r.id)} className="text-red-600 font-bold hover:underline">
                            Cancel Pass
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CITIES */}
      {subTab === 'cities' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openCityModal()} className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Add Launch City</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map((c) => (
              <div key={c.id} className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${c.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-500'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {Boolean(c.is_featured) && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Featured
                      </span>
                    )}
                  </div>
                  <button onClick={() => openCityModal(c)} className="text-xs font-bold text-stroom-orange hover:underline">Edit</button>
                </div>
                <h4 className="text-base font-black text-stroom-black font-display">{c.name}, {c.state}</h4>
                <p className="text-xs text-stone-500">{c.tagline || c.description}</p>
                <p className="text-[11px] font-bold text-stroom-deep pt-1">{c.events_count || 0} Events • {c.communities_count || 0} Communities</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Create/Edit Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setIsEventModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 text-stone-500"><X className="w-4 h-4" /></button>
            <h4 className="text-lg font-black text-stroom-black font-display">{editingEvent ? 'Edit Event' : 'Create Event'}</h4>
            <form onSubmit={handleSaveEvent} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Event Name *</label>
                <input type="text" required value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">City</label>
                  <select value={eventForm.city_id} onChange={(e) => setEventForm({ ...eventForm, city_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-semibold">
                    {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Venue</label>
                  <select value={eventForm.venue_id} onChange={(e) => setEventForm({ ...eventForm, venue_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-white font-semibold">
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Category</label>
                  <select value={eventForm.category} onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })} className="w-full px-2 py-2 rounded-xl border border-stroom-borderLight bg-white font-semibold">
                    <option value="cricket_auction">Cricket Auction</option>
                    <option value="sports">Sports</option>
                    <option value="cafe_meetup">Café Meetup</option>
                    <option value="gaming">Gaming</option>
                    <option value="movies">Movies</option>
                    <option value="travel">Travel</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Date</label>
                  <input type="text" required value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} className="w-full px-2.5 py-2 rounded-xl border border-stroom-borderLight font-semibold" />
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Start Time</label>
                  <input type="text" required value={eventForm.event_time} onChange={(e) => setEventForm({ ...eventForm, event_time: e.target.value })} className="w-full px-2.5 py-2 rounded-xl border border-stroom-borderLight font-semibold" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Capacity</label>
                  <input type="number" min={5} value={eventForm.seats_total} onChange={(e) => setEventForm({ ...eventForm, seats_total: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-bold" />
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Ticket Price</label>
                  <input type="text" value={eventForm.entry_fee} onChange={(e) => setEventForm({ ...eventForm, entry_fee: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold" />
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Status</label>
                  <select value={eventForm.status} disabled={!canPublish} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })} className="w-full px-2 py-2 rounded-xl border border-stroom-borderLight bg-white font-bold">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Description</label>
                <textarea rows={2} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight" />
              </div>
              <button type="submit" disabled={savingEvent} className="w-full py-2.5 rounded-xl bg-stroom-orange text-white font-black">
                {savingEvent ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* City Modal */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl relative">
            <button onClick={() => setIsCityModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 text-stone-500"><X className="w-4 h-4" /></button>
            <h4 className="text-lg font-black text-stroom-black font-display">{editingCity ? 'Edit City' : 'Add Launch City'}</h4>
            <form onSubmit={handleSaveCity} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">City Name *</label>
                  <input type="text" required value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold" />
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">State *</label>
                  <input type="text" required value={cityForm.state} onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold" />
                </div>
              </div>
              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Tagline</label>
                <input type="text" value={cityForm.tagline} onChange={(e) => setCityForm({ ...cityForm, tagline: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight" />
              </div>
              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Description</label>
                <textarea rows={2} value={cityForm.description} onChange={(e) => setCityForm({ ...cityForm, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight" />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 font-bold">
                  <input type="checkbox" checked={cityForm.is_active} onChange={(e) => setCityForm({ ...cityForm, is_active: e.target.checked })} /> Active
                </label>
                <label className="flex items-center gap-1.5 font-bold">
                  <input type="checkbox" checked={cityForm.is_featured} onChange={(e) => setCityForm({ ...cityForm, is_featured: e.target.checked })} /> Featured Hub
                </label>
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-stroom-orange text-white font-black">
                {editingCity ? 'Update City' : 'Add City'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Event Preview Modal */}
      {viewingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setViewingEvent(null)}
              aria-label="Close event preview"
              className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-1 pr-8">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-stroom-cream text-stroom-deep text-[10px] font-black uppercase">
                  {viewingEvent.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-stroom-ivory border border-stroom-borderLight text-[10px] font-black uppercase">
                  {viewingEvent.is_archived ? `Archived (${viewingEvent.status})` : viewingEvent.status}
                </span>
              </div>
              <h4 className="text-lg font-black text-stroom-black font-display pt-1">{viewingEvent.title}</h4>
              <p className="text-xs text-stone-500">
                {viewingEvent.city_name} • {viewingEvent.venue_name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-stroom-ivory text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-stone-400 block">Schedule</span>
                <span className="font-bold text-stroom-black">{viewingEvent.event_date}</span>
                <span className="block text-[11px] text-stone-600">
                  {viewingEvent.event_time}
                  {viewingEvent.end_time ? ` – ${viewingEvent.end_time}` : ''}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-stone-400 block">Pricing & Organizer</span>
                <span className="font-black text-stroom-deep">{viewingEvent.entry_fee}</span>
                <span className="block text-[11px] text-stone-600">
                  {viewingEvent.organizer_name || 'STROOM Experiences'}
                </span>
              </div>
            </div>

            <div className="text-xs text-stroom-charcoal leading-relaxed">
              {viewingEvent.description || 'No description provided for this event.'}
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-stone-50 border border-stroom-borderLight text-center text-xs">
              <div>
                <span className="text-[10px] text-stone-500 block">Registered</span>
                <strong className="font-black text-stroom-deep">
                  {viewingEvent.confirmed_count} / {viewingEvent.seats_total}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 block">Verified Check-ins</span>
                <strong className="font-black text-emerald-700">{viewingEvent.checked_in_count}</strong>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 block">Cancelled Passes</span>
                <strong className="font-black text-stone-600">{viewingEvent.cancelled_count || 0}</strong>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-stroom-borderLight text-xs">
              <button
                onClick={() => {
                  const id = viewingEvent.id;
                  setViewingEvent(null);
                  handleManageRegistrations(id);
                }}
                className="px-4 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-black"
              >
                Manage Registrations
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    const ev = viewingEvent;
                    setViewingEvent(null);
                    openEditEvent(ev);
                  }}
                  className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black"
                >
                  Edit Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safe Event Delete / Archive Confirmation Dialog */}
      {deleteConfirmEvent && (() => {
        const deps = deleteDepsData?.dependencies;
        const regCount = deps ? deps.registrationsTotal : (deleteConfirmEvent.confirmed_count || 0) + (deleteConfirmEvent.cancelled_count || 0);
        const activeRegCount = deps ? deps.activeRegistrations : (deleteConfirmEvent.confirmed_count || 0);
        const checkedInCount = deps ? deps.checkedInCount : (deleteConfirmEvent.checked_in_count || 0);
        const stampCount = deps ? deps.attendanceStamps : 0;
        const paymentsCount = deps?.paymentsCount;
        const paymentsAuthorized = Boolean(deleteDepsData?.paymentsAuthorized);
        const canPermanent = Boolean(deleteDepsData?.canDeletePermanently);
        const hasDeps = deps
          ? deps.hasProtectedDependencies
          : regCount > 0 || checkedInCount > 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-modal-title"
          >
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-red-200 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 id="delete-event-modal-title" className="text-lg font-black text-stroom-black font-display">
                      Delete or Archive Event?
                    </h4>
                    <p className="text-[11px] font-bold text-red-700">Data-Safety Guard Active</p>
                  </div>
                </div>
                <button
                  onClick={() => !deletingEventId && setDeleteConfirmEvent(null)}
                  disabled={Boolean(deletingEventId)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-stroom-charcoal leading-relaxed">
                Are you sure you want to delete or retire this event? Historical registrations, attendance stamps, and financial transaction records are strictly protected by database rules.
              </p>

              {/* Target Event & Live Dependency Summary */}
              <div className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500 font-bold">Event Name</span>
                  <span className="font-black text-stroom-black text-right">{deleteConfirmEvent.title}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500 font-bold">City</span>
                  <span className="font-bold text-stroom-black">{deleteConfirmEvent.city_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500 font-bold">Event Date</span>
                  <span className="font-bold text-stroom-black">
                    {deleteConfirmEvent.event_date} • {deleteConfirmEvent.event_time}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500 font-bold">Registration Count</span>
                  <span className="font-black text-stroom-deep">
                    {deleteDepsLoading ? 'Checking...' : `${regCount} total (${activeRegCount} active)`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500 font-bold">Attendance Records</span>
                  <span className="font-black text-emerald-700">
                    {deleteDepsLoading ? 'Checking...' : `${checkedInCount} check-ins • ${stampCount} passport stamps`}
                  </span>
                </div>
                {paymentsAuthorized && (
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500 font-bold">Payment / Transaction Records</span>
                    <span className="font-black text-stroom-black">
                      {deleteDepsLoading ? 'Checking...' : `${paymentsCount ?? 0} linked transaction(s)`}
                    </span>
                  </div>
                )}
              </div>

              {deleteDepsLoading ? (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stroom-borderLight text-xs flex items-center gap-2 text-stone-600 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-stroom-orange" />
                  <span>Inspecting backend database foreign-key dependencies...</span>
                </div>
              ) : hasDeps ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <p className="font-black">Permanent Deletion Disabled — Protected Historical Records Found</p>
                  <p>
                    This event has linked registrations, attendance stamps, payment records, or auction/partner records. You can safely <strong>Archive Event</strong> or <strong>Cancel Event</strong> while preserving 100% of participant, QR check-in, and financial records.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-[11px] text-red-800 space-y-1">
                  <p className="font-black">Zero Dependent Records Found</p>
                  <p>
                    No registrations, attendance stamps, payment records, or linked auction/partner dependencies exist on this event. You may safely archive, cancel, or <strong>Delete Permanently</strong>.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black uppercase text-stone-500 mb-1">
                  Audit Reason (Optional)
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g., Duplicate schedule or venue unavailable..."
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs outline-none focus:border-stroom-orange"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-stroom-borderLight">
                <button
                  type="button"
                  disabled={Boolean(deletingEventId)}
                  onClick={() => setDeleteConfirmEvent(null)}
                  className="px-4 py-2 rounded-xl border border-stroom-borderLight bg-white hover:bg-stroom-ivory text-xs font-black text-stroom-black disabled:opacity-50"
                >
                  Cancel
                </button>

                {!deleteConfirmEvent.is_archived && (
                  <button
                    type="button"
                    disabled={Boolean(deletingEventId) || deleteDepsLoading}
                    onClick={() => handleConfirmDeleteAction('archive')}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive Event</span>
                  </button>
                )}

                {!['cancelled', 'completed'].includes(deleteConfirmEvent.status) && (
                  <button
                    type="button"
                    disabled={Boolean(deletingEventId) || deleteDepsLoading}
                    onClick={() => handleConfirmDeleteAction('cancel')}
                    className="px-4 py-2 rounded-xl bg-stroom-orange hover:bg-stroom-deep text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Event</span>
                  </button>
                )}

                {!deleteDepsLoading && canPermanent && (
                  <button
                    type="button"
                    disabled={Boolean(deletingEventId)}
                    onClick={() => handleConfirmDeleteAction('delete')}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {deletingEventId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Permanently</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
