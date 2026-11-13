import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FaqCategory } from '../../types';
import {
  HelpCircle,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Sparkles,
  LifeBuoy
} from 'lucide-react';

interface ContactFaqPageProps {
  initialTab?: 'faqs' | 'contact';
}

export const ContactFaqPage: React.FC<ContactFaqPageProps> = ({
  initialTab = 'faqs',
}) => {
  const [activeTab, setActiveTab] = useState<'faqs' | 'contact'>(initialTab);
  
  // FAQs State
  const [faqCategories, setFaqCategories] = useState<FaqCategory[]>([]);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState<boolean>(true);
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedInquiryId, setSubmittedInquiryId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const fetchFaqs = async () => {
      setIsLoadingFaqs(true);
      try {
        const res = await api.getFaqs();
        if (res && res.faqs) {
          setFaqCategories(res.faqs);
          // Expand first FAQ by default
          if (res.faqs[0]?.items[0]) {
            setExpandedFaqId(res.faqs[0].items[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching FAQs:', err);
      } finally {
        setIsLoadingFaqs(false);
      }
    };

    fetchFaqs();
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      setSubmitError('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitContactInquiry(contactForm);
      if (res && res.inquiryId) {
        setSubmittedInquiryId(res.inquiryId);
      } else {
        setSubmittedInquiryId(`INQ-${Date.now().toString().slice(-6)}`);
      }
    } catch (err: any) {
      console.error('Contact inquiry error:', err);
      setSubmitError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter FAQs based on search
  const filteredCategories = faqCategories.map((cat) => {
    const filteredItems = cat.items.filter(
      (item) =>
        item.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
        item.answer.toLowerCase().includes(faqSearch.toLowerCase())
    );
    return { ...cat, items: filteredItems };
  }).filter((cat) => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Header Banner */}
      <section className="bg-gradient-to-b from-stroom-cream to-stroom-ivory border-b border-stroom-borderLight pt-14 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stroom-orange/10 border border-stroom-orange/30 text-stroom-deep text-xs font-black uppercase tracking-wider mb-4">
            <LifeBuoy className="w-3.5 h-3.5 text-stroom-orange" />
            <span>Community Help & Communication</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-stroom-black uppercase tracking-tight">
            How Can We <span className="text-stroom-orange">Help You</span>?
          </h1>

          <p className="mt-3 text-stroom-charcoal/80 text-sm sm:text-base font-medium max-w-xl mx-auto">
            Find immediate answers in our FAQs or get in touch directly with our city experience leads.
          </p>

          {/* Tab Switcher */}
          <div className="mt-8 inline-flex p-1.5 bg-white border border-stroom-borderLight rounded-2xl shadow-xs">
            <button
              onClick={() => setActiveTab('faqs')}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
                activeTab === 'faqs'
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'text-stroom-charcoal hover:text-stroom-black'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Frequently Asked Questions</span>
            </button>

            <button
              onClick={() => setActiveTab('contact')}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${
                activeTab === 'contact'
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'text-stroom-charcoal hover:text-stroom-black'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Contact Us</span>
            </button>
          </div>
        </div>
      </section>

      {/* FAQs Tab View */}
      {activeTab === 'faqs' && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          {/* FAQ Search */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search questions (e.g. auction, pass, refunds, solo attendees)..."
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-stroom-borderLight rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange shadow-xs"
            />
            {faqSearch && (
              <button
                onClick={() => setFaqSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stroom-black"
              >
                Clear
              </button>
            )}
          </div>

          {isLoadingFaqs ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-stroom-orange animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-stone-500">Loading verified FAQs...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-stroom-borderLight p-8">
              <p className="text-sm font-bold text-stroom-charcoal">No questions matched your search.</p>
              <button
                onClick={() => setFaqSearch('')}
                className="mt-4 px-4 py-2 bg-stroom-orange text-white text-xs font-bold rounded-xl"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredCategories.map((category, catIdx) => (
                <div key={catIdx} className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs">
                  <h3 className="text-base font-black text-stroom-black uppercase tracking-wider mb-4 pb-3 border-b border-stroom-borderLight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-stroom-orange" />
                    <span>{category.category}</span>
                  </h3>

                  <div className="space-y-3">
                    {category.items.map((item) => {
                      const isExpanded = expandedFaqId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="border border-stroom-borderLight/80 rounded-2xl overflow-hidden transition-all bg-stroom-ivory/30"
                        >
                          <button
                            onClick={() => setExpandedFaqId(isExpanded ? null : item.id)}
                            className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-black text-xs sm:text-sm text-stroom-black hover:text-stroom-orange transition-colors"
                          >
                            <span>{item.question}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-stroom-orange flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-stroom-charcoal/90 leading-relaxed font-medium border-t border-stroom-borderLight/60">
                              {item.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Contact Tab View */}
      {activeTab === 'contact' && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Direct Contact Info Cards */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-stroom-black text-white rounded-3xl p-6 sm:p-8 border border-stone-800 space-y-6">
                <div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange text-white">
                    Direct Channels
                  </span>
                  <h2 className="text-2xl font-black text-white mt-3 uppercase">We’re Here For You</h2>
                  <p className="mt-1 text-xs text-stone-300 font-medium">
                    Reach out for event inquiries, host collaborations, or general questions.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-stone-800 text-xs">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Community Inquiries</p>
                      <a href="mailto:community@stroom.club" className="font-bold text-white hover:text-stroom-orange">
                        community@stroom.club
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Venue Partnerships</p>
                      <a href="mailto:partners@stroom.club" className="font-bold text-white hover:text-stroom-orange">
                        partners@stroom.club
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Community Hotline / WhatsApp</p>
                      <span className="font-bold text-white">+91 80 4920 8800</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-stroom-orange flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase">Headquarters</p>
                      <span className="font-bold text-white">STROOM Community Hub, Madhapur, Hyderabad, TS 500081</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Response Time Guarantee */}
              <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center font-bold">
                    24h
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-stroom-black uppercase">Fast Human Response</h4>
                    <p className="text-[11px] text-stone-500 font-medium">All inquiries are reviewed and answered by our city team within 24 business hours.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-stroom-orange/30 shadow-xl">
                {submittedInquiryId ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-stroom-black uppercase">Message Received!</h3>
                    <p className="mt-2 text-xs sm:text-sm text-stroom-charcoal/80 font-medium max-w-md mx-auto">
                      Thank you for reaching out. We have received your inquiry and our team will get back to you promptly.
                    </p>
                    <div className="mt-6 p-3 rounded-xl bg-stroom-ivory inline-block border border-stroom-borderLight text-xs font-mono font-bold text-stroom-deep">
                      Reference ID: {submittedInquiryId}
                    </div>
                    <div className="mt-8">
                      <button
                        onClick={() => {
                          setSubmittedInquiryId(null);
                          setContactForm({
                            name: '',
                            email: '',
                            subject: 'General Inquiry',
                            message: '',
                          });
                        }}
                        className="px-6 py-2.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black shadow-md transition-all"
                      >
                        Send Another Message
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-black text-stroom-black uppercase tracking-tight">
                      Send a Message
                    </h3>
                    <p className="mt-1 text-xs text-stone-500 font-medium">
                      Fill out the form and our experience coordinators will respond.
                    </p>

                    {submitError && (
                      <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Your Name"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="your.email@domain.com"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1">
                          Topic / Subject *
                        </label>
                        <select
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                        >
                          <option value="General Inquiry">General Inquiry</option>
                          <option value="Event Registration & Pass Help">Event Registration & Pass Help</option>
                          <option value="Cricket Auction Arena Assistance">Cricket Auction Arena Assistance</option>
                          <option value="Community Chapter Leadership">Community Chapter Leadership</option>
                          <option value="Venue Partnership">Venue Partnership</option>
                          <option value="Feedback / Suggestions">Feedback / Suggestions</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1">
                          Message *
                        </label>
                        <textarea
                          rows={4}
                          required
                          placeholder="How can we assist you today? Provide any relevant event or registration details..."
                          value={contactForm.message}
                          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-stroom-ivory/50 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending Message...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Send Inquiry</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>
      )}
    </div>
  );
};
