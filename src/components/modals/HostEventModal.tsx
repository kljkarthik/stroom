import React, { useState } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { api } from '../../services/api';
import {
  X,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Sparkles,
  Trophy,
  Coffee,
  Gamepad2,
  Film,
  Mail,
  Phone,
  User,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface HostEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HostEventModal: React.FC<HostEventModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    category: 'Sports & Turf League',
    city: 'Hyderabad',
    expectedAttendees: 30,
    preferredDate: '',
    organizerName: '',
    email: '',
    phone: '',
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const cityId = formData.city === 'Hyderabad' ? 'city-hyd' : formData.city === 'Pune' ? 'city-pune' : 'city-blr';
      const res = await api.submitProposal({
        business_name: `Community Host: ${formData.title}`,
        venue_type: `Community Event - ${formData.category}`,
        city_id: cityId,
        address: `${formData.city} Area`,
        capacity: Number(formData.expectedAttendees),
        contact_person: formData.organizerName,
        email: formData.email,
        phone: formData.phone,
        proposal_notes: `Target Date: ${formData.preferredDate}. Category: ${formData.category}. Details: ${formData.description}`,
      });

      if (res && (res.proposalId || (res as any).success)) {
        setIsSuccess(true);
      } else {
        setErrorMessage((res as any)?.error || 'Failed to submit event proposal.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-stroom-ivory rounded-3xl border border-stroom-orange/20 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-stroom-black via-stroom-charcoal to-stroom-black p-6 text-white relative shrink-0">
          <button
            onClick={handleReset}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <StroomLogo variant="light" size="sm" showSubtitle={false} />
            <div className="h-5 w-px bg-white/20" />
            <span className="text-xs font-bold uppercase tracking-wider text-stroom-orange">
              Community Host Incubator
            </span>
          </div>
          <h3 className="text-xl font-extrabold mt-3 text-white">
            Host an Event with STROOM
          </h3>
          <p className="text-xs text-stroom-cream/80 mt-1">
            Have a brilliant idea for a cricket draft, gaming night, or rooftop social? STROOM provides the verified community, ticketing passes, and venue support.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Event Title / Concept
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hyderabad Gachibowli Box Cricket & Biryani Mixer"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                  >
                    <option value="Sports & Turf League">Sports & Turf League</option>
                    <option value="Board Games & Gaming">Board Games & Gaming</option>
                    <option value="Cafe Meetup">Cafe Meetup</option>
                    <option value="Movie Screening">Movie Screening</option>
                    <option value="Outdoor & Trekking">Outdoor & Trekking</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    City Hub
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                  >
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Pune">Pune</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mumbai">Mumbai</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Expected Attendees
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={formData.expectedAttendees}
                    onChange={(e) => setFormData({ ...formData, expectedAttendees: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="Organizer Name"
                      value={formData.organizerName}
                      onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    WhatsApp Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 00000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Event Format, Rules & Icebreaker Ideas
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your meetup idea, how you plan to engage strangers, and any special equipment or venue needs..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-medium outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm shadow-brand hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Event Application...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Submit Event Proposal for Verification</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-xl font-extrabold text-stroom-black">Event Proposal Submitted!</h4>
              <p className="text-xs sm:text-sm text-stroom-charcoal/80 max-w-md mx-auto leading-relaxed">
                Awesome, <strong>{formData.organizerName}</strong>! Your event pitch <strong>"{formData.title}"</strong> has been logged into the STROOM Event Curator Queue for <strong>{formData.city}</strong>. Our city host team will connect with you on WhatsApp within 24 hours.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="px-8 py-3 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 transition-all"
                >
                  Close & Explore Events
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
