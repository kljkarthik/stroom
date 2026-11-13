import React, { useState } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { api } from '../../services/api';
import {
  X,
  Building2,
  MapPin,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Mail,
  Phone,
  User,
  Coffee,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface PartnerProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PartnerProposalModal: React.FC<PartnerProposalModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    venueType: 'Artisanal Cafe & Lounge',
    city: 'Hyderabad',
    cityId: 'city-hyd',
    address: '',
    capacity: 60,
    contactPerson: '',
    email: '',
    phone: '',
    proposalNotes: '',
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
        business_name: formData.businessName,
        venue_type: formData.venueType,
        city_id: cityId,
        address: formData.address,
        capacity: Number(formData.capacity),
        contact_person: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        proposal_notes: formData.proposalNotes,
      });

      if (res && (res.proposalId || (res as any).success)) {
        setIsSuccess(true);
      } else {
        setErrorMessage((res as any)?.error || 'Failed to submit proposal.');
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
              Café & Venue Partnership
            </span>
          </div>
          <h3 className="text-xl font-extrabold mt-3 text-white">
            Partner With STROOM
          </h3>
          <p className="text-xs text-stroom-cream/80 mt-1">
            Turn your space into a high-energy community hub. Host verified cricket auctions, gaming nights, and social mixers.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Venue / Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Third Wave Coffee Roasters"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Venue Type
                  </label>
                  <select
                    value={formData.venueType}
                    onChange={(e) => setFormData({ ...formData, venueType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                  >
                    <option value="Artisanal Cafe & Lounge">Artisanal Cafe & Lounge</option>
                    <option value="Sports Turf & Arena">Sports Turf & Arena</option>
                    <option value="Microbrewery / Bistro">Microbrewery / Bistro</option>
                    <option value="Coworking Social Amphitheatre">Coworking Social Amphitheatre</option>
                    <option value="Auditorium / Screening Lounge">Auditorium / Screening Lounge</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Launch City
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                  >
                    <option value="Hyderabad">Hyderabad (Flagship Launch)</option>
                    <option value="Pune">Pune (Phase 2 Hub)</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mumbai">Mumbai</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Seating / Max Capacity
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="number"
                      required
                      min={10}
                      max={1000}
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Full Venue Address / Area
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Road No. 36, Jubilee Hills, Hyderabad"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Contact Person
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="Manager Name"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="events@venue.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange text-sm font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Phone / WhatsApp
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
                  Collaboration Notes / Amenities Available (AV, Projector, Sound, Food Menu)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your audio-visual setup, high-speed Wi-Fi, projector screens, or special community discounts you would like to offer..."
                  value={formData.proposalNotes}
                  onChange={(e) => setFormData({ ...formData, proposalNotes: e.target.value })}
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
                    <span>Submitting Official Proposal...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Submit Collaboration Inquiry</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-xl font-extrabold text-stroom-black">Partnership Proposal Received!</h4>
              <p className="text-xs sm:text-sm text-stroom-charcoal/80 max-w-md mx-auto leading-relaxed">
                Thank you, <strong>{formData.contactPerson}</strong>. Our city partnership team in <strong>{formData.city}</strong> has received your venue profile for <strong>{formData.businessName}</strong>. We will review your space and schedule a walkthrough within 24 hours.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="px-8 py-3 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 transition-all"
                >
                  Close & Return
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
