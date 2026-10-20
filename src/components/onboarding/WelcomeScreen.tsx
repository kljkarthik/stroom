import React from 'react';
import { Compass, Users, Sparkles, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onSkip, isLoading }) => {
  return (
    <div className="min-h-[90vh] flex flex-col justify-between max-w-md mx-auto px-4 py-8 animate-fade-in">
      {/* Top Brand Pill & Skip */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>VIBE ONBOARDING</span>
        </div>
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-800/60"
        >
          Skip for now
        </button>
      </div>

      {/* Hero Visual Card */}
      <div className="relative my-4 rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl">
        <div className="relative h-64 sm:h-72 w-full overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80"
            alt="Friends laughing and connecting at sunset"
            className="w-full h-full object-cover object-center filter brightness-90 hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          
          {/* Floating Vibe Badges */}
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white shadow-lg animate-slide-up">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Over 2,400 active vibes</span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-medium text-white border border-white/10">
              <Users className="w-3 h-3 text-indigo-300" />
              <span>Communities</span>
            </span>
            <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-medium text-white border border-white/10">
              <MapPin className="w-3 h-3 text-rose-300" />
              <span>Social Meetups</span>
            </span>
            <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-medium text-white border border-white/10">
              <Compass className="w-3 h-3 text-amber-300" />
              <span>Travel & Trips</span>
            </span>
          </div>
        </div>

        {/* Copy Section */}
        <div className="p-6 text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Find your <span className="vibe-gradient-text">people.</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Discover communities, meet like-minded people, and find authentic experiences that match your exact vibe.
          </p>
        </div>
      </div>

      {/* Value Proposition Highlights */}
      <div className="grid grid-cols-2 gap-3 my-2 text-left">
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-white">Personalized for you</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Custom feed tailored to your interests</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-white">You're in control</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Update or retake anytime in settings</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 mt-4 text-center">
        <button
          onClick={onStart}
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-2xl vibe-gradient-bg text-white font-bold text-base shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Preparing your quiz...</span>
            </span>
          ) : (
            <>
              <span>Let's find my vibe</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
          <span>Just a few quick questions. You can change your preferences anytime.</span>
        </p>
      </div>
    </div>
  );
};
