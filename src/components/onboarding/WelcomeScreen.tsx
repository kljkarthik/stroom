import React from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { Compass, Users, Sparkles, MapPin, ArrowRight, Trophy, Heart } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onSkip, isLoading }) => {
  return (
    <div className="min-h-[85vh] flex flex-col justify-between max-w-md mx-auto px-4 py-6 animate-fade-in text-stroom-black">
      {/* Top Brand Pill & Skip */}
      <div className="flex items-center justify-between mb-3">
        <StroomLogo variant="dark" size="xs" showSubtitle={false} />
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="text-xs font-bold text-stroom-charcoal/70 hover:text-stroom-black transition-colors py-1.5 px-3 rounded-xl hover:bg-stroom-cream/60"
        >
          Skip for now
        </button>
      </div>

      {/* Hero Visual Card Inspired by Poster */}
      <div className="relative my-2 rounded-3xl overflow-hidden border border-stroom-borderLight bg-white shadow-brand">
        <div className="relative h-60 sm:h-64 w-full overflow-hidden bg-stroom-cream">
          <img
            src="/brand/stroom-community-hero.jpg"
            alt="STROOM Community Friends Meetup"
            className="w-full h-full object-cover object-center filter hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stroom-black/85 via-stroom-black/30 to-transparent" />

          {/* Floating Vibe Badges */}
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-stroom-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-stroom-orange/30 text-[11px] font-black text-stroom-orange shadow-lg">
            <span className="w-2 h-2 rounded-full bg-stroom-orange animate-ping" />
            <span>Real Connections • Zero Small Talk</span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-xl text-[11px] font-extrabold text-white border border-white/20">
              <Trophy className="w-3 h-3 text-stroom-orange" />
              <span>Turf Sports</span>
            </span>
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-xl text-[11px] font-extrabold text-white border border-white/20">
              <Users className="w-3 h-3 text-stroom-cream" />
              <span>Meetups</span>
            </span>
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-xl text-[11px] font-extrabold text-white border border-white/20">
              <Compass className="w-3 h-3 text-amber-300" />
              <span>Trips</span>
            </span>
          </div>
        </div>

        {/* Copy Section */}
        <div className="p-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-stroom-deep">
            Welcome to STROOM
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-stroom-black mt-1 font-display leading-tight">
            Strangers Today.<br />
            <span className="text-stroom-orange">Stories Tomorrow.</span>
          </h2>
          <p className="text-xs sm:text-sm text-stroom-charcoal/80 mt-2 leading-relaxed">
            Answer 4 quick vibe questions to personalize your sports leagues, creative workshops, and weekend cafe mixers.
          </p>

          <div className="mt-4 pt-3 border-t border-stroom-borderLight flex items-center justify-between text-[11px] text-stroom-charcoal/70">
            <span>⏱ Takes under 60 seconds</span>
            <span className="font-bold text-stroom-deep">100% Real People</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="space-y-2 mt-4">
        <button
          onClick={onStart}
          disabled={isLoading}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm shadow-brand hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>{isLoading ? 'Calibrating Vibes...' : 'Start My Vibe Quiz'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10px] text-stroom-charcoal/50 text-center font-medium">
          You can update or retake your quiz preferences at any time from your profile.
        </p>
      </div>
    </div>
  );
};
