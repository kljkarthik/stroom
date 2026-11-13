import React, { useState } from 'react';
import { useAuth, isDemoAuthEnabled } from '../../context/AuthContext';
import { StroomLogo } from '../common/StroomLogo';
import {
  Sparkles,
  Shield,
  User,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  Building2,
  Trophy,
  ArrowLeft
} from 'lucide-react';

interface AuthViewProps {
  onBackToHome?: () => void;
  intendedDestination?: string | null;
}

export const AuthView: React.FC<AuthViewProps> = ({ onBackToHome, intendedDestination }) => {
  const { login, register, loginAsDemoUser } = useAuth();
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        if (!fullName.trim()) {
          setErrorMessage('Please enter your full name');
          setIsLoading(false);
          return;
        }
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stroom-ivory relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-stroom-orange/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-stroom-deep/10 rounded-full blur-3xl pointer-events-none" />

      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="absolute top-6 left-6 px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight text-xs font-bold text-stroom-charcoal hover:text-stroom-black flex items-center gap-1.5 shadow-sm transition-colors z-20"
        >
          <ArrowLeft className="w-4 h-4 text-stroom-orange" />
          <span>Back to STROOM Home</span>
        </button>
      )}

      <div className="max-w-md w-full relative z-10 animate-fade-in text-left my-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <StroomLogo variant="dark" size="lg" showSubtitle={true} showTagline={true} />
          <p className="text-xs text-stroom-charcoal/80 mt-2 font-medium">
            Meet New People. Discover Common Interests. Build Real Connections.
          </p>
          {intendedDestination === 'partner' && (
            <div className="mt-3 px-4 py-2 rounded-xl bg-stroom-cream border border-stroom-orange/40 text-stroom-deep text-xs font-bold inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stroom-orange" />
              <span>Sign in to continue to the STROOM Partner Portal</span>
            </div>
          )}
        </div>

        {/* Demo Fast-Login Cards (strictly gated for dev/demo environments) */}
        {isDemoAuthEnabled && (
          <div className="mb-6 space-y-2.5">
            <p className="text-[10px] font-black text-stroom-charcoal/60 uppercase tracking-widest text-center">
              One-Click Instant Testing Access
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => loginAsDemoUser('user')}
                className="p-2.5 rounded-2xl bg-white hover:bg-stroom-cream/60 border border-stroom-orange/30 text-left transition-all hover:scale-[1.02] shadow-sm group"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-stroom-cream flex items-center justify-center text-stroom-deep group-hover:bg-stroom-orange group-hover:text-white transition-colors shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-stroom-black truncate">Participant</span>
                </div>
                <p className="text-[10px] text-stroom-charcoal/70 leading-tight">
                  Member & Bidder
                </p>
              </button>

              <button
                type="button"
                onClick={() => loginAsDemoUser('partner')}
                className="p-2.5 rounded-2xl bg-white hover:bg-stroom-cream/60 border border-stroom-orange/30 text-left transition-all hover:scale-[1.02] shadow-sm group"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-stroom-cream flex items-center justify-center text-stroom-deep group-hover:bg-stroom-orange group-hover:text-white transition-colors shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-stroom-black truncate">Partner</span>
                </div>
                <p className="text-[10px] text-stroom-charcoal/70 leading-tight">
                  Venue & Café Host
                </p>
              </button>

              <button
                type="button"
                onClick={() => loginAsDemoUser('admin')}
                className="p-2.5 rounded-2xl bg-white hover:bg-stroom-cream/60 border border-stroom-orange/30 text-left transition-all hover:scale-[1.02] shadow-sm group"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-stroom-cream flex items-center justify-center text-stroom-deep group-hover:bg-stroom-orange group-hover:text-white transition-colors shrink-0">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-stroom-black truncate">Admin</span>
                </div>
                <p className="text-[10px] text-stroom-charcoal/70 leading-tight">
                  Operations & CMS
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Auth Form Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-brand">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-stroom-black font-display">
              {isRegistering ? 'Join STROOM' : 'Sign In to STROOM'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMessage(null);
              }}
              className="text-xs font-bold text-stroom-orange hover:text-stroom-deep transition-colors"
            >
              {isRegistering ? 'Have an account? Sign In' : 'Need an account? Register'}
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maya Krishnan"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stroom-orange absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight focus:border-stroom-orange focus:ring-2 focus:ring-stroom-orange/20 text-sm font-semibold text-stroom-black outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm shadow-brand hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span>{isLoading ? 'Processing...' : isRegistering ? 'Create STROOM Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-stroom-charcoal/60 text-center mt-6">
          "Strangers Today. Stories Tomorrow." • STROOM Community Platform
        </p>
      </div>
    </div>
  );
};
