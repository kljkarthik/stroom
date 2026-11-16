import React, { useState } from 'react';
import { api } from '../../services/api';
import { ImageUpload } from '../common/ImageUpload';
import {
  Sparkles,
  CheckCircle2,
  Users,
  Shield,
  Send,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  HelpCircle,
  AlertCircle,
  FolderPlus,
  Coffee,
  Palette,
  Gamepad2,
  Dumbbell,
  BookOpen,
  Camera,
  GraduationCap,
  Layers,
  ArrowRight
} from 'lucide-react';

interface PartnerWithUsPageProps {
  onGoToPartnerPortal?: () => void;
  onGoToContact?: () => void;
}

const EVENT_CATEGORIES = [
  'Social Mixer',
  'Tech & Startups',
  'Art & Culture',
  'Music & Performance',
  'Board Games & Trivia',
  'Fitness & Wellness',
  'Food & Drinks',
  'Book Club & Literature',
  'Photography & Film',
  'Workshops & Learning',
  'Other',
];

const CITIES = [
  'Hyderabad',
  'Pune',
  'Bangalore',
  'Mumbai',
  'Delhi NCR',
  'Chennai',
  'Kolkata',
  'Goa',
  'Other / Online'
];

export const PartnerWithUsPage: React.FC<PartnerWithUsPageProps> = ({
  onGoToPartnerPortal,
  onGoToContact,
}) => {
  const [formData, setFormData] = useState({
    // Section A: Organizer Details
    organizer_name: '',
    organizer_email: '',
    organizer_phone: '',
    organization_name: '',

    // Section B: Event Details
    title: '',
    category: 'Social Mixer',
    short_description: '',
    detailed_description: '',
    format: 'Physical',
    city: 'Hyderabad',
    venue: '',
    proposed_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '20:30',
    expected_capacity: '40',
    age_group: 'Open to all (18+)',

    // Section C: Images & Logistics
    cover_image_url: '',
    ticketing_details: 'Free Entry',
    estimated_budget: '',
    sponsorship_requirements: '',
    additional_notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const resetForm = () => {
    setFormData({
      organizer_name: '',
      organizer_email: '',
      organizer_phone: '',
      organization_name: '',
      title: '',
      category: 'Social Mixer',
      short_description: '',
      detailed_description: '',
      format: 'Physical',
      city: 'Hyderabad',
      venue: '',
      proposed_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '20:30',
      expected_capacity: '40',
      age_group: 'Open to all (18+)',
      cover_image_url: '',
      ticketing_details: 'Free Entry',
      estimated_budget: '',
      sponsorship_requirements: '',
      additional_notes: '',
    });
    setSubmissionSuccess(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form validation
    if (!formData.organizer_name.trim() || !formData.organizer_email.trim() || !formData.organizer_phone.trim()) {
      setErrorMessage('Please provide your name, email, and phone number.');
      return;
    }

    if (!formData.title.trim()) {
      setErrorMessage('Please provide an event title.');
      return;
    }

    if (!formData.short_description.trim() || !formData.detailed_description.trim()) {
      setErrorMessage('Please fill in both a short tagline and the detailed event description.');
      return;
    }

    if (!formData.proposed_date || !formData.start_time) {
      setErrorMessage('Please specify the proposed date and start time.');
      return;
    }

    const capacityNum = parseInt(formData.expected_capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setErrorMessage('Expected attendee capacity must be a valid number greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitEventProposal({
        organizer_name: formData.organizer_name.trim(),
        organizer_email: formData.organizer_email.trim(),
        organizer_phone: formData.organizer_phone.trim(),
        organization_name: formData.organization_name.trim() || undefined,
        title: formData.title.trim(),
        category: formData.category,
        short_description: formData.short_description.trim(),
        detailed_description: formData.detailed_description.trim(),
        format: formData.format,
        city: formData.city,
        venue: formData.venue.trim() || undefined,
        proposed_date: formData.proposed_date,
        start_time: formData.start_time,
        end_time: formData.end_time || undefined,
        expected_capacity: capacityNum,
        age_group: formData.age_group.trim() || undefined,
        cover_image_url: formData.cover_image_url.trim() || undefined,
        ticketing_details: formData.ticketing_details.trim() || undefined,
        estimated_budget: formData.estimated_budget.trim() || undefined,
        sponsorship_requirements: formData.sponsorship_requirements.trim() || undefined,
        additional_notes: formData.additional_notes.trim() || undefined,
      });

      if (res && res.success) {
        setSubmissionSuccess({
          id: res.submissionId,
          message: res.message || 'Event proposal submitted successfully!',
        });
      } else {
        throw new Error(res?.message || 'Failed to submit proposal.');
      }
    } catch (err: any) {
      console.error('Error submitting event proposal:', err);
      setErrorMessage(err.message || 'Failed to submit your event proposal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-28">
      {/* Hero Header */}
      <section className="bg-gradient-to-b from-stroom-cream to-stroom-ivory border-b border-stroom-borderLight pt-16 pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-stroom-orange/10 border border-stroom-orange/30 text-stroom-deep text-xs font-black uppercase tracking-wider mb-5">
            <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
            <span>Community Experience Curation</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stroom-black uppercase tracking-tight leading-tight">
            SUBMIT YOUR EVENT TO <span className="text-stroom-orange">STROOM</span>
          </h1>

          <p className="mt-5 text-stroom-charcoal/80 text-sm sm:text-base max-w-2xl mx-auto font-medium leading-relaxed">
            Have an experience worth sharing? Submit your event and let’s bring people together. Our team will review your proposal and get back to you.
          </p>

          {onGoToPartnerPortal && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onGoToPartnerPortal}
                className="px-4 py-2 rounded-xl bg-stroom-black/5 hover:bg-stroom-black/10 text-stroom-charcoal text-xs font-bold transition-all flex items-center gap-2"
              >
                <span>Looking for Venue Partnerships?</span>
                <ArrowRight className="w-3.5 h-3.5 text-stroom-orange" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3 Core Benefits */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Built-in Audience</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              Tap into a growing community of young professionals and curious locals eager to try new experiences beyond digital screens.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-4">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Seamless Operations</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              We handle event listings, digital QR ticketing, automated reminders, and instant on-ground check-ins with zero technical friction.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Curation & Production</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              Get dedicated guidance from the STROOM team on venues, agenda timing, member safety, and experiential storytelling.
            </p>
          </div>
        </div>
      </section>

      {/* Main Submission Form Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="bg-white rounded-3xl p-6 sm:p-10 lg:p-12 border-2 border-stroom-orange/30 shadow-xl">
          {submissionSuccess ? (
            /* Success confirmation screen */
            <div className="text-center py-10 px-4">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
                Proposal Received
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight mt-3">
                Event Proposal Submitted!
              </h2>
              <p className="mt-3 text-sm text-stroom-charcoal/80 font-medium max-w-lg mx-auto leading-relaxed">
                Thank you for submitting your event idea. Our curation team will review your proposal within <strong>24–48 hours</strong> and get in touch with you.
              </p>

              <div className="mt-6 p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight inline-flex flex-col sm:flex-row items-center gap-2">
                <span className="text-xs uppercase font-bold text-stone-500">Submission Tracking ID:</span>
                <span className="text-sm font-mono font-black text-stroom-orange tracking-wider bg-white px-3 py-1 rounded-lg border border-stroom-orange/30">
                  {submissionSuccess.id}
                </span>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black uppercase tracking-wider shadow-md transition-all"
                >
                  Submit Another Proposal
                </button>
                {onGoToContact && (
                  <button
                    type="button"
                    onClick={onGoToContact}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-stroom-charcoal hover:bg-stroom-cream text-xs font-bold transition-all"
                  >
                    Questions? Contact Us
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Form Header */}
              <div className="border-b border-stroom-borderLight pb-6 mb-8">
                <span className="text-[10px] font-black uppercase tracking-wider text-stroom-deep bg-stroom-cream px-3 py-1 rounded-full border border-stroom-orange/30">
                  Experience Proposal
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight mt-3">
                  Submit Your Event Proposal
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-stone-500 font-medium">
                  Provide details about your proposed experience. Fields marked with <span className="text-red-500 font-bold">*</span> are required.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-semibold flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-10">
                {/* SECTION 1: Organizer Details */}
                <div className="bg-stroom-ivory/40 rounded-2xl p-6 sm:p-7 border border-stroom-borderLight space-y-5">
                  <div className="flex items-center gap-3 border-b border-stroom-borderLight pb-3">
                    <div className="w-7 h-7 rounded-xl bg-stroom-orange text-white flex items-center justify-center font-black text-xs">
                      1
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-stroom-black uppercase tracking-wide">
                        Organizer Details
                      </h3>
                      <p className="text-[11px] text-stone-500">Who is organizing or hosting this event?</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Vikram Reddy"
                        value={formData.organizer_name}
                        onChange={(e) => setFormData({ ...formData, organizer_name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. vikram@community.in"
                        value={formData.organizer_email}
                        onChange={(e) => setFormData({ ...formData, organizer_email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Phone / WhatsApp Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +91 98765 43210"
                        value={formData.organizer_phone}
                        onChange={(e) => setFormData({ ...formData, organizer_phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Organization / Collective Name <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hyderabad Book Club / Freelancer Collective"
                        value={formData.organization_name}
                        onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Event Details */}
                <div className="bg-stroom-ivory/40 rounded-2xl p-6 sm:p-7 border border-stroom-borderLight space-y-5">
                  <div className="flex items-center gap-3 border-b border-stroom-borderLight pb-3">
                    <div className="w-7 h-7 rounded-xl bg-stroom-orange text-white flex items-center justify-center font-black text-xs">
                      2
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-stroom-black uppercase tracking-wide">
                        Event Details
                      </h3>
                      <p className="text-[11px] text-stone-500">What is the experience about and how is it structured?</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Event Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sunset Acoustic Mixer & Coffee Tasting"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      >
                        {EVENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Short Tagline / Summary <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      placeholder="e.g. An intimate evening of live indie sets, specialty filter brews, and relaxed conversations."
                      value={formData.short_description}
                      onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                    <p className="mt-1 text-[10px] text-stone-500 text-right">{formData.short_description.length}/140 chars</p>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Detailed Description & Agenda <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe what guests can expect: flow of the event, itinerary, takeaways, equipment needed, and special elements..."
                      value={formData.detailed_description}
                      onChange={(e) => setFormData({ ...formData, detailed_description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-medium text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Event Format <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.format}
                        onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      >
                        <option value="Physical">Physical (In-Person)</option>
                        <option value="Online">Online (Virtual)</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        City <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      >
                        {CITIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Proposed Venue / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Roastery Coffee House or TBD"
                        value={formData.venue}
                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Proposed Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.proposed_date}
                        onChange={(e) => setFormData({ ...formData, proposed_date: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        End Time <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Expected Capacity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        required
                        placeholder="e.g. 40"
                        value={formData.expected_capacity}
                        onChange={(e) => setFormData({ ...formData, expected_capacity: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Target Audience / Age Group
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Open to all (18+) / Young Professionals"
                        value={formData.age_group}
                        onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Event Images & Logistics */}
                <div className="bg-stroom-ivory/40 rounded-2xl p-6 sm:p-7 border border-stroom-borderLight space-y-6">
                  <div className="flex items-center gap-3 border-b border-stroom-borderLight pb-3">
                    <div className="w-7 h-7 rounded-xl bg-stroom-orange text-white flex items-center justify-center font-black text-xs">
                      3
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-stroom-black uppercase tracking-wide">
                        Visuals & Logistics
                      </h3>
                      <p className="text-[11px] text-stone-500">Banner artwork, ticketing model, and collaboration requirements.</p>
                    </div>
                  </div>

                  {/* Cloudinary Image Upload */}
                  <div className="pt-2">
                    <ImageUpload
                      value={formData.cover_image_url}
                      onChange={(url) => setFormData({ ...formData, cover_image_url: url })}
                      folder="events"
                      aspectRatio="video"
                      label="Event Banner / Cover Image"
                      helperText="Upload a high-resolution banner (16:9 recommended). Direct Cloudinary upload with real-time preview."
                      allowManualUrl={true}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Ticketing Details
                      </label>
                      <select
                        value={formData.ticketing_details}
                        onChange={(e) => setFormData({ ...formData, ticketing_details: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      >
                        <option value="Free Entry">Free Entry</option>
                        <option value="Paid Entry (Fixed Ticket)">Paid Entry (Fixed Ticket)</option>
                        <option value="Cover Charge (Includes F&B)">Cover Charge (Includes F&B)</option>
                        <option value="Split Revenue / Profit Share">Split Revenue / Profit Share</option>
                        <option value="To Be Decided / Flexible">To Be Decided / Flexible</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                        Estimated Budget / Commercials <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ₹299 per pass / ₹15,000 production budget"
                        value={formData.estimated_budget}
                        onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Sponsorship / Equipment Needs <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Need venue partner in Jubilee Hills, projector + sound setup, coffee sponsor"
                      value={formData.sponsorship_requirements}
                      onChange={(e) => setFormData({ ...formData, sponsorship_requirements: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-semibold text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                      Additional Notes / Special Requests <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Any co-hosts, special safety protocols, or details you'd like our curation team to know..."
                      value={formData.additional_notes}
                      onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-medium text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange leading-relaxed"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-sm uppercase tracking-wider shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Submitting Event Proposal...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Submit Event Proposal to STROOM</span>
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-stone-500 font-medium">
                  By submitting, you agree to collaborate with STROOM Curation guidelines and maintain community safety standards.
                </p>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
