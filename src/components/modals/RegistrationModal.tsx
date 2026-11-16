import React, { useState, useEffect } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  X,
  CheckCircle2,
  QrCode,
  Calendar,
  MapPin,
  User,
  Mail,
  Phone,
  Ticket,
  Download,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react';

export interface EventDetails {
  id: string;
  title: string;
  city: string;
  date: string;
  time: string;
  venue: string;
  seatsLeft: number;
  category: string;
  entryFee: string;
  image_url?: string;
  description?: string;
}

interface RegistrationModalProps {
  event: EventDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onRegistrationSuccess?: () => void;
  onOpenAuth?: (eventId?: string) => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  event,
  isOpen,
  onClose,
  onRegistrationSuccess,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    experienceLevel: 'Active Participant',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [passData, setPassData] = useState<{
    passCode: string;
    qrToken: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.full_name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
      }));
    }
  }, [user]);

  if (!isOpen || !event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!isAuthenticated || !user) {
      setErrorMessage('Please sign in or create an account to register for this event.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.registerForEvent(event.id, {
        user_id: user?.id,
        attendee_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.experienceLevel,
      });

      if (res && res.success && res.registration) {
        setPassData({
          passCode: res.registration.pass_code,
          qrToken: res.registration.qr_token,
          status: res.registration.status,
        });
        setIsSuccess(true);
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        }
      } else {
        setErrorMessage(res?.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please verify your connection and try again.');
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
      <div className="relative w-full max-w-xl bg-stroom-ivory rounded-3xl border border-stroom-orange/20 shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-stroom-black via-stroom-charcoal to-stroom-black p-6 text-white relative">
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
              Official STROOM Event Pass
            </span>
          </div>
          <h3 className="text-xl font-extrabold mt-3 text-white">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-stroom-cream/80">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-stroom-orange" /> {event.date} • {event.time}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-stroom-orange" /> {event.venue}, {event.city}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isAuthenticated ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-stroom-cream border border-stroom-orange/30 flex items-center justify-center text-stroom-orange mx-auto shadow-sm">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-xl font-black text-stroom-black font-display">
                  Sign In Required to Register
                </h4>
                <p className="text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
                  Please sign in or create an account to claim your verified entry pass and reserve your spot for this experience.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth(event.id);
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm shadow-brand hover:brightness-105 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
              >
                <span>Sign In / Join STROOM</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : !isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
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
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  How do you want to participate?
                </label>
                <select
                  value={formData.experienceLevel}
                  onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
                >
                  <option value="Active Participant">Active Participant</option>
                  <option value="Team / Group Captain">Team / Group Captain</option>
                  <option value="Community Audience">Community Fan & Supporter</option>
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-stroom-cream/50 border border-stroom-orange/20 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-stroom-black">Entry Registration</p>
                  <p className="text-stroom-charcoal/70">Includes STROOM Welcome Drink & Badge</p>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-stroom-deep">{event.entryFee}</span>
                  <p className="text-[10px] text-emerald-700 font-bold">100% Community Guaranteed</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm shadow-brand hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Reserving Seat & Generating Pass...</span>
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    <span>Confirm Registration & Get Instant QR Pass</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Digital QR Pass Result */
            <div className="text-center space-y-5 animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-stroom-black">You're In! Welcome to STROOM</h4>
                <p className="text-xs text-stroom-charcoal/80 mt-1">
                  Your seat is reserved in the official attendance registry. Show this pass at the reception desk on arrival.
                </p>
              </div>

              {/* Pass Card */}
              <div className="p-5 rounded-3xl bg-white border-2 border-dashed border-stroom-orange/40 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-stroom-cream pb-3 mb-3">
                  <StroomLogo variant="dark" size="xs" showSubtitle={false} />
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] uppercase tracking-wider">
                    CONFIRMED PASS
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-left mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-stroom-charcoal/60 uppercase">Attendee</span>
                    <p className="text-xs font-extrabold text-stroom-black truncate">{formData.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stroom-charcoal/60 uppercase">Pass Code</span>
                    <p className="text-xs font-mono font-extrabold text-stroom-deep">{passData?.passCode}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stroom-charcoal/60 uppercase">City Hub</span>
                    <p className="text-xs font-extrabold text-stroom-black">{event.city}</p>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="w-36 h-36 mx-auto bg-stroom-ivory border-2 border-stroom-charcoal rounded-2xl flex flex-col items-center justify-center p-3 shadow-inner">
                  <QrCode className="w-24 h-24 text-stroom-black" />
                  <span className="text-[9px] font-mono font-bold tracking-widest text-stroom-charcoal mt-1">
                    {passData?.passCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => alert(`Official STROOM pass (${passData?.passCode}) saved to device and WhatsApp!`)}
                  className="flex-1 py-3 rounded-xl bg-stroom-charcoal text-white font-bold text-xs hover:bg-stroom-black transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-stroom-orange" />
                  Save / Download Pass
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl bg-stroom-cream text-stroom-deep font-bold text-xs hover:bg-stroom-cream/70 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
