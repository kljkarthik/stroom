import React, { useState } from 'react';
import { api } from '../../services/api';
import {
  Building2,
  Coffee,
  Trophy,
  Film,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Users,
  Shield,
  Clock,
  Send,
  Loader2,
  Calendar,
  MapPin,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface PartnerWithUsPageProps {
  onGoToPartnerPortal?: () => void;
  onGoToContact?: () => void;
}

export const PartnerWithUsPage: React.FC<PartnerWithUsPageProps> = ({
  onGoToPartnerPortal,
  onGoToContact,
}) => {
  const [formData, setFormData] = useState({
    proposer_name: '',
    proposer_email: '',
    proposer_phone: '',
    venue_name: '',
    city: 'Hyderabad',
    event_type: 'Cafe / Social Mixer',
    proposed_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    expected_attendees: '30-50 Guests',
    perks_offered: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedProposalId, setSubmittedProposalId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.proposer_name.trim() || !formData.proposer_email.trim() || !formData.venue_name.trim()) {
      setErrorMessage('Please fill in your name, email, and venue name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitProposal({
        proposer_name: formData.proposer_name.trim(),
        proposer_email: formData.proposer_email.trim(),
        proposer_phone: formData.proposer_phone.trim(),
        venue_name: formData.venue_name.trim(),
        city: formData.city,
        event_type: formData.event_type,
        proposed_date: formData.proposed_date,
        expected_attendees: parseInt(formData.expected_attendees) || 40,
        perks_offered: formData.perks_offered.trim() || 'Exclusive space reservation and special menu rates for STROOM members',
      });

      if (res && res.proposalId) {
        setSubmittedProposalId(res.proposalId);
      } else {
        setSubmittedProposalId(`PROP-${Date.now().toString().slice(-6)}`);
      }
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      setErrorMessage(err.message || 'Failed to submit proposal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-stroom-cream to-stroom-ivory border-b border-stroom-borderLight pt-14 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stroom-orange/10 border border-stroom-orange/30 text-stroom-deep text-xs font-black uppercase tracking-wider mb-4">
            <Building2 className="w-3.5 h-3.5 text-stroom-orange" />
            <span>Venue & Hospitality Partnerships</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stroom-black uppercase tracking-tight leading-tight">
            Let’s Create <span className="text-stroom-orange">Experiences</span> Together.
          </h1>

          <p className="mt-4 text-stroom-charcoal/80 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Turn your café, sports arena, or event venue into a bustling community hub. We handle registrations, marketing, and on-ground hosting.
          </p>

          {onGoToPartnerPortal && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={onGoToPartnerPortal}
                className="px-5 py-2.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black shadow-md transition-all flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-stroom-orange" />
                <span>Access Existing Partner Portal</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3 Main Value Props */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-stroom-black uppercase">Off-Peak Footfalls</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              Monetize slow hours. We host weekend mornings, weekday evenings, and sunday afternoons, bringing 30-80 engaged guests directly to your venue.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-stroom-black uppercase">High-Spending Patrons</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              Our community members love specialty coffee, craft food, and sports rentals. Partner venues see strong average order values and repeat independent visits.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-stroom-black uppercase">Zero Effort Operations</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              STROOM manages ticket sales, attendee support, verified QR pass check-in, and provides a trained on-ground lead to coordinate the experience.
            </p>
          </div>
        </div>
      </section>

      {/* Who We Work With */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <h2 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight text-center mb-8">
          Spaces We Partner With
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-stroom-borderLight flex items-start gap-3">
            <Coffee className="w-6 h-6 text-stroom-orange flex-shrink-0" />
            <div>
              <h4 className="text-sm font-black text-stroom-black">Cafés & Bistros</h4>
              <p className="text-xs text-stone-500 mt-1">Coffee tastings, book exchanges, board games, and acoustic mixers.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stroom-borderLight flex items-start gap-3">
            <Trophy className="w-6 h-6 text-stroom-orange flex-shrink-0" />
            <div>
              <h4 className="text-sm font-black text-stroom-black">Sports Turfs & Arenas</h4>
              <p className="text-xs text-stone-500 mt-1">Box cricket leagues, pickleball tournaments, and badminton meets.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stroom-borderLight flex items-start gap-3">
            <Film className="w-6 h-6 text-stroom-orange flex-shrink-0" />
            <div>
              <h4 className="text-sm font-black text-stroom-black">Screening Lounges</h4>
              <p className="text-xs text-stone-500 mt-1">Indie cinema screenings, sports watch parties, and gaming tournaments.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stroom-borderLight flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-stroom-orange flex-shrink-0" />
            <div>
              <h4 className="text-sm font-black text-stroom-black">Studios & Workspaces</h4>
              <p className="text-xs text-stone-500 mt-1">Pottery, art workshops, photography clubs, and founder circles.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Inquiry Form Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-stroom-orange/30 shadow-xl">
          {submittedProposalId ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-stroom-black uppercase">Partnership Proposal Received!</h2>
              <p className="mt-2 text-sm text-stroom-charcoal/80 font-medium max-w-lg mx-auto">
                Thank you for proposing your venue. Our City Partnership Manager will review your space and connect within <strong>24 to 48 hours</strong>.
              </p>
              <div className="mt-6 p-4 rounded-2xl bg-stroom-ivory inline-block border border-stroom-borderLight text-xs font-mono font-bold text-stroom-deep">
                Proposal ID: {submittedProposalId}
              </div>
              <div className="mt-8">
                <button
                  onClick={() => {
                    setSubmittedProposalId(null);
                    setFormData({
                      proposer_name: '',
                      proposer_email: '',
                      proposer_phone: '',
                      venue_name: '',
                      city: 'Hyderabad',
                      event_type: 'Cafe / Social Mixer',
                      proposed_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      expected_attendees: '30-50 Guests',
                      perks_offered: '',
                    });
                  }}
                  className="px-6 py-2.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black shadow-md transition-all"
                >
                  Submit Another Proposal
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-8">
                <span className="text-[10px] font-black uppercase tracking-wider text-stroom-deep bg-stroom-cream px-3 py-1 rounded-full border border-stroom-orange/30">
                  Venue Application
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight mt-3">
                  Submit Your Venue For Collaboration
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-stone-500 font-medium">
                  Fill in details below and our team will schedule an on-ground walkthrough.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={formData.proposer_name}
                      onChange={(e) => setFormData({ ...formData, proposer_name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Business Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rahul@cafeblend.in"
                      value={formData.proposer_email}
                      onChange={(e) => setFormData({ ...formData, proposer_email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Phone / WhatsApp Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={formData.proposer_phone}
                      onChange={(e) => setFormData({ ...formData, proposer_phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Venue / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. The Roastery Café"
                      value={formData.venue_name}
                      onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      City *
                    </label>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    >
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Pune">Pune</option>
                      <option value="Bangalore">Bangalore</option>
                      <option value="Mumbai">Mumbai</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Space / Event Type *
                    </label>
                    <select
                      value={formData.event_type}
                      onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    >
                      <option value="Cafe / Social Mixer">Café / Social Mixer</option>
                      <option value="Box Cricket / Sports Turf">Box Cricket / Sports Turf</option>
                      <option value="Screening / Watch Party">Screening / Watch Party</option>
                      <option value="Board Games / Trivia">Board Games / Trivia</option>
                      <option value="Creative Workshop">Creative Workshop</option>
                      <option value="Flagship Sports Tournament">Flagship Sports Tournament</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Expected Capacity
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 50"
                      value={formData.expected_attendees}
                      onChange={(e) => setFormData({ ...formData, expected_attendees: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                    Proposed Date / Preferred Timings *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.proposed_date}
                    onChange={(e) => setFormData({ ...formData, proposed_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                    Special Offers / Venue Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe seating layout, amenities (projector, sound system, turf lighting), or food/beverage combos offered..."
                    value={formData.perks_offered}
                    onChange={(e) => setFormData({ ...formData, perks_offered: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-sm uppercase tracking-wider shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Proposal...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Partnership Inquiry</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
