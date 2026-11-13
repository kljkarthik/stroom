import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { VenueAvailabilitySlot } from '../../types';
import {
  MapPin,
  Users,
  PlusCircle,
  Edit3,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  Loader2,
  X
} from 'lucide-react';

interface PartnerVenueCalendarPanelProps {
  partnerId: string;
  venues: any[];
  onVenuesChanged: () => void;
}

export const PartnerVenueCalendarPanel: React.FC<PartnerVenueCalendarPanelProps> = ({
  partnerId,
  venues,
  onVenuesChanged,
}) => {
  const [selectedVenueId, setSelectedVenueId] = useState<string>(venues[0]?.id || '');
  const [availability, setAvailability] = useState<VenueAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Add/Edit Venue Modal
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<any | null>(null);
  const [venueForm, setVenueForm] = useState({
    name: '',
    city: 'Hyderabad',
    area: '',
    address: '',
    partner_type: 'cafe',
    capacity: 60,
    operating_hours: '09:00 AM - 11:00 PM',
    accessibility_info: 'Wheelchair accessible ground entrance',
    facilities: 'Wi-Fi, Projector, Acoustic Mic',
    event_spaces: 'Main Hall (60 pax)',
    maps_url: '',
  });
  const [savingVenue, setSavingVenue] = useState(false);

  // Availability form
  const [slotDate, setSlotDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [slotTime, setSlotTime] = useState<'full_day' | 'morning' | 'afternoon' | 'evening'>('evening');
  const [slotStatus, setSlotStatus] = useState<'available' | 'unavailable'>('available');
  const [slotNotes, setSlotNotes] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotAlert, setSlotAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (venues.length > 0 && (!selectedVenueId || !venues.find((v) => v.id === selectedVenueId))) {
      setSelectedVenueId(venues[0].id);
    }
  }, [venues]);

  useEffect(() => {
    if (selectedVenueId && partnerId) {
      loadAvailability(selectedVenueId);
    }
  }, [selectedVenueId, partnerId]);

  const loadAvailability = async (vId: string) => {
    setLoadingSlots(true);
    try {
      const res = await api.getVenueAvailability(partnerId, vId);
      setAvailability(res.availability || []);
    } catch {
      setAvailability([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const openCreateModal = () => {
    setEditingVenue(null);
    setVenueForm({
      name: '',
      city: 'Hyderabad',
      area: '',
      address: '',
      partner_type: 'cafe',
      capacity: 60,
      operating_hours: '09:00 AM - 11:00 PM',
      accessibility_info: 'Wheelchair accessible ground entrance',
      facilities: 'Wi-Fi, Projector, Acoustic Mic',
      event_spaces: 'Main Floor (60 pax)',
      maps_url: '',
    });
    setIsVenueModalOpen(true);
  };

  const openEditModal = (v: any) => {
    setEditingVenue(v);
    let facStr = '';
    let spaceStr = '';
    try {
      facStr = JSON.parse(v.facilities_json || '[]').join(', ');
    } catch {}
    try {
      spaceStr = JSON.parse(v.event_spaces_json || '[]').join(', ');
    } catch {}
    setVenueForm({
      name: v.name || '',
      city: v.city_name || 'Hyderabad',
      area: v.area || '',
      address: v.address || '',
      partner_type: v.partner_type || 'cafe',
      capacity: v.capacity || 60,
      operating_hours: v.operating_hours || '09:00 AM - 11:00 PM',
      accessibility_info: v.accessibility_info || '',
      facilities: facStr,
      event_spaces: spaceStr,
      maps_url: v.maps_url || '',
    });
    setIsVenueModalOpen(true);
  };

  const handleSaveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVenue(true);
    try {
      const payload = {
        ...venueForm,
        capacity: Number(venueForm.capacity) || 50,
        facilities: venueForm.facilities.split(',').map((s) => s.trim()).filter(Boolean),
        event_spaces: venueForm.event_spaces.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (editingVenue) {
        await api.updatePartnerVenue(partnerId, editingVenue.id, payload);
      } else {
        await api.createPartnerVenue(partnerId, payload);
      }
      setIsVenueModalOpen(false);
      onVenuesChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to save venue');
    } finally {
      setSavingVenue(false);
    }
  };

  const handleSetAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenueId) return;
    setSavingSlot(true);
    setSlotAlert(null);
    try {
      const res = await api.setVenueAvailability(partnerId, selectedVenueId, {
        date: slotDate,
        time_slot: slotTime,
        status: slotStatus,
        notes: slotNotes.trim(),
      });
      setAvailability(res.availability || []);
      setSlotNotes('');
      setSlotAlert({ type: 'success', text: `Calendar updated for ${slotDate} (${slotTime.replace('_', ' ')}).` });
    } catch (err: any) {
      setSlotAlert({ type: 'error', text: err.message || 'Failed to update availability' });
    } finally {
      setSavingSlot(false);
    }
  };

  const parseJsonList = (raw?: string): string[] => {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-stroom-black font-display">
            Venue Locations & Availability Calendar
          </h3>
          <p className="text-xs text-stroom-charcoal/70">
            Maintain venue spaces, operating hours, accessibility info, and private calendar availability.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Venue Location</span>
        </button>
      </div>

      {/* Venues Grid */}
      {venues.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs text-stone-500">
          No venues registered under this partner account yet. Click <strong>Add Venue Location</strong> to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {venues.map((v) => {
            const facilities = parseJsonList(v.facilities_json);
            const spaces = parseJsonList(v.event_spaces_json);
            const isSelected = v.id === selectedVenueId;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedVenueId(v.id)}
                className={`p-5 rounded-3xl bg-white border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-stroom-orange shadow-brand ring-1 ring-stroom-orange/30'
                    : 'border-stroom-borderLight shadow-sm hover:border-stroom-orange/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        v.is_verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {v.is_verified ? 'Verified Venue' : 'Pending Verification'}
                      </span>
                      <span className="text-[10px] font-bold text-stone-500 uppercase">{v.partner_type}</span>
                    </div>
                    <h4 className="text-base font-black text-stroom-black font-display mt-1.5">{v.name}</h4>
                    <p className="text-xs text-stroom-charcoal/70 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-stroom-orange shrink-0" />
                      <span>{v.address} • {v.city_name}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(v);
                    }}
                    className="p-2 rounded-xl bg-stroom-ivory hover:bg-stroom-cream text-stroom-deep transition-colors"
                    title="Edit Venue Details"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-stone-600 bg-stroom-ivory/70 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-stroom-orange" />
                    <span>Capacity: <strong>{v.capacity} guests</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-stroom-orange" />
                    <span className="truncate">{v.operating_hours || '09:00 AM - 11:00 PM'}</span>
                  </div>
                </div>

                {spaces.length > 0 && (
                  <p className="text-[11px] text-stone-600 mt-3">
                    <strong>Event Spaces:</strong> {spaces.join(' • ')}
                  </p>
                )}

                {facilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {facilities.map((f, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep text-[10px] font-bold">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {v.accessibility_info && (
                  <p className="text-[10px] text-stone-500 mt-2">
                    <strong>Accessibility:</strong> {v.accessibility_info}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Private Venue Availability Calendar */}
      {selectedVenueId && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-stroom-orange" />
              <h4 className="text-sm font-black text-stroom-black uppercase tracking-wider">
                Manage Availability Slots
              </h4>
            </div>
            <p className="text-xs text-stone-500">
              Your availability calendar is private to your team and STROOM coordinators. Double-booking over confirmed or proposed dates is automatically blocked.
            </p>

            {slotAlert && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                slotAlert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {slotAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{slotAlert.text}</span>
              </div>
            )}

            <form onSubmit={handleSetAvailability} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight text-xs font-bold outline-none focus:border-stroom-orange"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Time Slot</label>
                  <select
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight text-xs font-bold outline-none focus:border-stroom-orange bg-white"
                  >
                    <option value="morning">Morning (8 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                    <option value="evening">Evening (5 PM - 11 PM)</option>
                    <option value="full_day">Full Day</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Slot Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSlotStatus('available')}
                    className={`py-2 rounded-xl text-xs font-extrabold border ${
                      slotStatus === 'available'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    Mark Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotStatus('unavailable')}
                    className={`py-2 rounded-xl text-xs font-extrabold border ${
                      slotStatus === 'unavailable'
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    Block / Unavailable
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={slotNotes}
                  onChange={(e) => setSlotNotes(e.target.value)}
                  placeholder="e.g. Open for 40-seat evening meetup"
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight text-xs font-medium outline-none focus:border-stroom-orange"
                />
              </div>

              <button
                type="submit"
                disabled={savingSlot}
                className="w-full py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 disabled:opacity-50"
              >
                {savingSlot ? 'Saving Slot...' : 'Update Venue Calendar'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-stroom-black flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-stroom-orange" />
                <span>Calendar Schedule — {venues.find((v) => v.id === selectedVenueId)?.name}</span>
              </h4>
            </div>

            {loadingSlots ? (
              <div className="py-12 flex justify-center text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
              </div>
            ) : availability.length === 0 ? (
              <div className="p-8 rounded-2xl bg-stroom-ivory text-center text-xs text-stone-500">
                No calendar slots recorded for this venue yet. Add open or blocked dates on the left.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {availability.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl bg-stroom-ivory/70 border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-stroom-black">{s.date}</span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-stroom-borderLight text-[10px] font-bold uppercase text-stone-600">
                          {s.time_slot.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-stroom-charcoal/80 mt-1">
                        {s.collaboration_event_name || s.event_title || s.notes || 'Partner schedule slot'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider self-start sm:self-auto ${
                      s.status === 'booked'
                        ? 'bg-stroom-orange text-white'
                        : s.status === 'proposed'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : s.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-stone-200 text-stone-700'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Venue Modal */}
      {isVenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setIsVenueModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-lg font-black text-stroom-black font-display">
              {editingVenue ? 'Update Venue Details' : 'Add New Business Location'}
            </h4>

            <form onSubmit={handleSaveVenue} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Venue Name *</label>
                <input
                  type="text"
                  required
                  value={venueForm.name}
                  onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none focus:border-stroom-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">City</label>
                  <select
                    value={venueForm.city}
                    onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none bg-white"
                  >
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Pune">Pune</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mumbai">Mumbai</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Venue Type</label>
                  <select
                    value={venueForm.partner_type}
                    onChange={(e) => setVenueForm({ ...venueForm, partner_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none bg-white"
                  >
                    <option value="cafe">Café / Roastery</option>
                    <option value="sports_turf">Cricket / Sports Arena</option>
                    <option value="lounge">Lounge / Event Space</option>
                    <option value="gaming_zone">Gaming Zone</option>
                    <option value="coworking">Co-working Hub</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Area / Locality</label>
                  <input
                    type="text"
                    value={venueForm.area}
                    onChange={(e) => setVenueForm({ ...venueForm, area: e.target.value })}
                    placeholder="e.g. Jubilee Hills"
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Capacity</label>
                  <input
                    type="number"
                    min={10}
                    value={venueForm.capacity}
                    onChange={(e) => setVenueForm({ ...venueForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Full Address *</label>
                <input
                  type="text"
                  required
                  value={venueForm.address}
                  onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Event Spaces (comma separated)</label>
                <input
                  type="text"
                  value={venueForm.event_spaces}
                  onChange={(e) => setVenueForm({ ...venueForm, event_spaces: e.target.value })}
                  placeholder="Mezzanine Loft (60 pax), Patio Deck (20 pax)"
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-stone-500 mb-1">Facilities (comma separated)</label>
                <input
                  type="text"
                  value={venueForm.facilities}
                  onChange={(e) => setVenueForm({ ...venueForm, facilities: e.target.value })}
                  placeholder="Wi-Fi, Projector, Mic Setup, Valet Parking"
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Operating Hours</label>
                  <input
                    type="text"
                    value={venueForm.operating_hours}
                    onChange={(e) => setVenueForm({ ...venueForm, operating_hours: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-stone-500 mb-1">Accessibility Info</label>
                  <input
                    type="text"
                    value={venueForm.accessibility_info}
                    onChange={(e) => setVenueForm({ ...venueForm, accessibility_info: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingVenue}
                  className="flex-1 py-2.5 rounded-xl bg-stroom-orange text-white font-black shadow-brand hover:brightness-105 disabled:opacity-50"
                >
                  {savingVenue ? 'Saving...' : editingVenue ? 'Save Venue Changes' : 'Create Venue Location'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsVenueModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 font-bold text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
