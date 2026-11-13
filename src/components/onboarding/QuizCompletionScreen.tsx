import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { StroomLogo } from '../common/StroomLogo';
import { Sparkles, ArrowRight, CheckCircle, Trophy, Users, Heart } from 'lucide-react';

interface QuizCompletionScreenProps {
  preferences: string[];
  onFinish: () => void;
}

export const QuizCompletionScreen: React.FC<QuizCompletionScreenProps> = ({
  preferences,
  onFinish,
}) => {
  useEffect(() => {
    // Launch celebratory confetti burst in official STROOM brand colors
    const end = Date.now() + 1600;
    const colors = ['#FF7100', '#E94B0B', '#FFF0D9', '#E9A34A', '#FFFFFF'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  return (
    <div className="min-h-[85vh] flex flex-col justify-between max-w-md mx-auto px-4 py-8 animate-fade-in text-center text-stroom-black">
      {/* Celebration Header */}
      <div className="pt-2">
        <StroomLogo variant="dark" size="sm" showSubtitle={true} className="mb-4" />

        {/* Animated Badge */}
        <div className="relative mx-auto w-18 h-18 mb-4">
          <div className="absolute inset-0 rounded-full bg-stroom-orange/30 blur-xl animate-pulse" />
          <div className="relative w-18 h-18 rounded-full bg-gradient-to-r from-stroom-orange to-stroom-deep flex items-center justify-center text-white shadow-brand">
            <CheckCircle className="w-9 h-9 stroke-[2.5]" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-cream border border-stroom-orange/30 text-stroom-deep text-xs font-black mb-2">
          <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
          <span>VIBE PROFILE CALIBRATED</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-stroom-black tracking-tight mb-2 font-display">
          Your Vibe. <span className="text-stroom-orange">Your Squad.</span>
        </h1>

        <p className="text-xs sm:text-sm text-stroom-charcoal/80 max-w-sm mx-auto leading-relaxed">
          We've personalized your STROOM feed. Discover live cricket auction tables, sports matches, and social mixers matching your passions.
        </p>
      </div>

      {/* Generated Preferences Cards */}
      <div className="my-6 p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm text-left">
        <p className="text-[10px] font-black text-stroom-deep uppercase tracking-widest mb-3">
          Your Matched Interest Badges ({preferences.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {preferences.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-xl bg-stroom-cream border border-stroom-orange/30 text-stroom-black text-xs font-extrabold flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-stroom-orange" />
              <span>#{tag.replace(/_/g, ' ')}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Action CTA */}
      <div className="space-y-2">
        <button
          onClick={onFinish}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-sm shadow-brand hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>Explore My Community Feed</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[10px] text-stroom-charcoal/60">
          "Strangers Today. Stories Tomorrow."
        </p>
      </div>
    </div>
  );
};
