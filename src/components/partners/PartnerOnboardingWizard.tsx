import React, { useState } from 'react';
import { api } from '../../services/api';
import { PartnerAccount } from '../../types';
import {
  Building2,
  User,
  MapPin,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  Send,
  Shield,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface PartnerOnboardingWizardProps {
  existingDraft?: PartnerAccount | null;
  onComplete: (partner: PartnerAccount) => void;
  onCancel?: () => void;
}

const BUSINESS_CATEGORIES = [
  'Café & Restaurant',
  'Cricket & Sports Venue',
  'Gaming Zone',
  'College & Educational Institution',
  'Event Space',
  'Co-working Space',
  'Fitness Studio',
  'Entertainment Venue',
  'Travel & Adventure',
  'Local Brand',
];

const FACILITY_OPTIONS = [
  'High-Speed Wi-Fi',
  'Projector & HDMI',
  'Acoustic Mic Setup',
  'Dedicated Event Space',
  'Valet Parking',
  'Outdoor Seating',
  'Floodlit Turf',
  'Locker & Showers',
  'First Aid Support',
  'Full Kitchen / Café Bar',
];

const COLLABORATION_INTERESTS = [
  'Host community events',
  'Café meetups',
  'Sports activities',
  'Cricket auctions',
  'Gaming events',
  'Movie experiences',
  'Fitness activities',
  'Travel and outdoor experiences',
  'College collaborations',
  'Brand promotions',
  'Special campaigns',
];

export const PartnerOnboardingWizard: React.FC<PartnerOnboardingWizardProps> = ({
  existingDraft,
  onComplete,
  onCancel,
}) => {
  const parseArr = (raw?: string) => {
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const parseObj = (raw?: string) => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const [step, setStep] = useState<number>(Math.min(5, Math.max(1, existingDraft?.onboarding_step || 1)));
  const [partnerId, setPartnerId] = useState<string | undefined>(existingDraft?.id);
  const [businessName, setBusinessName] = useState(existingDraft?.business_name || '');
  const [category, setCategory] = useState(existingDraft?.category || BUSINESS_CATEGORIES[0]);
  const [city, setCity] = useState(existingDraft?.city || 'Hyderabad');
  const [address, setAddress] = useState(existingDraft?.address || '');
  const [description, setDescription] = useState(existingDraft?.description || '');
  const [contactPerson, setContactPerson] = useState(existingDraft?.contact_person || '');
  const [contactEmail, setContactEmail] = useState(existingDraft?.contact_email || '');
  const [contactPhone, setContactPhone] = useState(existingDraft?.contact_phone || '');
  const [website, setWebsite] = useState(existingDraft?.website || '');
  const [mapsUrl, setMapsUrl] = useState(existingDraft?.maps_url || '');
  const [capacity, setCapacity] = useState<number>(existingDraft?.capacity || 60);
  const [facilities, setFacilities] = useState<string[]>(parseArr(existingDraft?.facilities_json));
  const [weekdayHours, setWeekdayHours] = useState<string>(parseObj(existingDraft?.operating_hours_json).mon_fri || '09:00 AM - 11:00 PM');
  const [weekendHours, setWeekendHours] = useState<string>(parseObj(existingDraft?.operating_hours_json).sat_sun || '08:00 AM - 11:30 PM');
  const [interests, setInterests] = useState<string[]>(parseArr(existingDraft?.collaboration_interests_json));

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const saveProgress = async (nextStep?: number) => {
    if (!businessName.trim()) {
      setMessage({ type: 'error', text: 'Please enter your business name before saving.' });
      return null;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.savePartnerOnboarding({
        partner_id: partnerId,
        business_name: businessName.trim(),
        category,
        city,
        address: address.trim(),
        description: description.trim(),
        contact_person: contactPerson.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        website: website.trim(),
        maps_url: mapsUrl.trim(),
        capacity: Number(capacity) || 50,
        facilities,
        operating_hours: { mon_fri: weekdayHours, sat_sun: weekendHours },
        collaboration_interests: interests,
        onboarding_step: nextStep || step,
      });
      if (res.partner?.id) {
        setPartnerId(res.partner.id);
        setMessage({ type: 'success', text: 'Draft progress saved securely.' });
        if (nextStep) setStep(nextStep);
        return res.partner;
      }
      return null;
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save progress' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitVerification = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const saved = await saveProgress(5);
      const idToSubmit = saved?.id || partnerId;
      if (!idToSubmit) {
        setSubmitting(false);
        return;
      }
      const res = await api.submitPartnerOnboarding(idToSubmit);
      if (res.partner) {
        onComplete(res.partner);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Business Info', icon: Building2 },
    { num: 2, label: 'Contact Details', icon: User },
    { num: 3, label: 'Venue Details', icon: MapPin },
    { num: 4, label: 'Interests', icon: Sparkles },
    { num: 5, label: 'Verify & Submit', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-stroom-borderLight shadow-xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stroom-borderLight">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
            STROOM Business Onboarding
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-stroom-black font-display mt-0.5">
            Register Your Venue or Brand Partner Account
          </h2>
          <p className="text-xs text-stroom-charcoal/70 mt-0.5">
            Save your draft anytime. Accounts remain in review until verified by a STROOM administrator.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 self-start sm:self-auto"
          >
            Back to Portal
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-5 gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.num;
          const done = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col sm:flex-row items-center gap-2 ${
                active
                  ? 'bg-stroom-orange/10 border-stroom-orange text-stroom-deep'
                  : done
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-stroom-ivory border-stroom-borderLight text-stone-500'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                active ? 'bg-stroom-orange text-white' : done ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <span className="text-[10px] sm:text-[11px] font-extrabold leading-tight text-center sm:text-left">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {message && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Step 1: Business Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Business / Venue Name *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Roastery Coffee House Banjara Hills"
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Business Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              >
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Primary City *
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              >
                <option value="Hyderabad">Hyderabad</option>
                <option value="Pune">Pune</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Mumbai">Mumbai</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Full Business Address *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, Area, Pincode"
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
              Business Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your ambiance, seating layout, specialty menu, or event experience capabilities..."
              className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-medium outline-none"
            />
          </div>
        </div>
      )}

      {/* Step 2: Contact Info */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Primary Contact Person *
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Full Name & Designation"
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Business Email *
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="events@yourbusiness.com"
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Contact Phone Number
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98XXX XXXXX"
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Website / Instagram Link
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourbusiness.in"
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Venue Details */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Guest Capacity
              </label>
              <input
                type="number"
                min={10}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-bold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Weekday Hours
              </label>
              <input
                type="text"
                value={weekdayHours}
                onChange={(e) => setWeekdayHours(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
                Weekend Hours
              </label>
              <input
                type="text"
                value={weekendHours}
                onChange={(e) => setWeekendHours(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-1">
              Google Maps Location URL (Optional)
            </label>
            <input
              type="text"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/?q=..."
              className="w-full px-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stroom-charcoal mb-2">
              Available Facilities & Equipment
            </label>
            <div className="flex flex-wrap gap-2">
              {FACILITY_OPTIONS.map((fac) => {
                const selected = facilities.includes(fac);
                return (
                  <button
                    key={fac}
                    type="button"
                    onClick={() => toggleItem(facilities, setFacilities, fac)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      selected
                        ? 'bg-stroom-orange text-white border-stroom-orange shadow-xs'
                        : 'bg-stroom-ivory text-stroom-charcoal border-stroom-borderLight hover:border-stroom-orange'
                    }`}
                  >
                    {fac}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Collaboration Interests */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-xs text-stroom-charcoal/80 font-medium">
            Select all experience formats and community collaborations you would like to host or sponsor with STROOM:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {COLLABORATION_INTERESTS.map((item) => {
              const selected = interests.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(interests, setInterests, item)}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold flex items-center justify-between transition-all ${
                    selected
                      ? 'bg-stroom-orange/10 border-stroom-orange text-stroom-deep'
                      : 'bg-stroom-ivory border-stroom-borderLight text-stroom-charcoal hover:border-stroom-orange/50'
                  }`}
                >
                  <span>{item}</span>
                  {selected && <CheckCircle2 className="w-4 h-4 text-stroom-orange shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-stroom-cream/60 border border-stroom-orange/30 space-y-2 text-xs">
            <h4 className="font-black text-stroom-black uppercase tracking-wider">
              Submission Summary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stroom-charcoal">
              <p><strong>Business:</strong> {businessName || 'Not provided'}</p>
              <p><strong>Category:</strong> {category}</p>
              <p><strong>City:</strong> {city}</p>
              <p><strong>Capacity:</strong> {capacity} guests</p>
              <p><strong>Contact:</strong> {contactPerson} ({contactEmail})</p>
              <p><strong>Selected Formats:</strong> {interests.length} collaboration types</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-1">
            <p className="font-extrabold text-stroom-black flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-stroom-orange" />
              <span>STROOM Verification & Collaboration Policy</span>
            </p>
            <p>
              Submitting creates an application under status <strong>Submitted</strong>. Your business and venues will not appear as Verified until reviewed and approved by a STROOM administrator.
            </p>
            <p>
              STROOM never guarantees a fixed number of attendees, purchases, or sales; all collaborations track actual registrations, verified door check-ins, and confirmed coupon redemptions transparently.
            </p>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="pt-5 border-t border-stroom-borderLight flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => saveProgress()}
            className="px-4 py-2.5 rounded-xl bg-stroom-cream hover:bg-stroom-cream/80 text-stroom-deep text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </button>
        </div>

        <div>
          {step < 5 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => saveProgress(step + 1)}
              className="px-5 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 flex items-center gap-1.5"
            >
              <span>Save & Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || saving}
              onClick={handleSubmitVerification}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black shadow-brand hover:brightness-105 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Submit for Admin Verification</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
