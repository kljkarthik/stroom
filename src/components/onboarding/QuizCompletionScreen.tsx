import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, CheckCircle, Compass, Users, Heart } from 'lucide-react';

interface QuizCompletionScreenProps {
  preferences: string[];
  onFinish: () => void;
}

export const QuizCompletionScreen: React.FC<QuizCompletionScreenProps> = ({
  preferences,
  onFinish
}) => {
  useEffect(() => {
    // Launch celebratory confetti burst
    const end = Date.now() + 1500;
    const colors = ['#6366f1', '#a855f7', '#f43f5e', '#10b981'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  return (
    <div className="min-h-[85vh] flex flex-col justify-between max-w-md mx-auto px-4 py-8 animate-fade-in text-center">
      {/* Celebration Header */}
      <div className="pt-4">
        {/* Animated Badge */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full vibe-gradient-bg opacity-30 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-full vibe-gradient-bg flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
            <CheckCircle className="w-10 h-10 stroke-[2.5]" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>VIBE PROFILE UNLOCKED</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
          Your vibe, <span className="vibe-gradient-text">your people.</span>
        </h1>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-sm mx-auto">
          Your preferences are ready. Let's discover something new and connect with communities made for you.
        </p>
      </div>

      {/* Captured Vibe Tags Card */}
      <div className="my-6 p-5 rounded-3xl bg-slate-900/70 border border-white/10 text-left shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Preference Tags ({preferences.length})
          </span>
          <span className="text-[11px] text-indigo-400 font-medium">Auto-synced</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {preferences.length > 0 ? (
            preferences.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/15 border border-indigo-500/30 text-indigo-200"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>{tag.replace(/_/g, ' ')}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">Exploring all communities</span>
          )}
        </div>

        <div className="mt-4 pt-3.5 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-slate-300">
          <div className="p-2 rounded-xl bg-slate-800/40">
            <Users className="w-4 h-4 mx-auto mb-1 text-indigo-400" />
            <p className="text-[11px] font-medium">Clubs Matched</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/40">
            <Compass className="w-4 h-4 mx-auto mb-1 text-rose-400" />
            <p className="text-[11px] font-medium">Trips Ranked</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/40">
            <Heart className="w-4 h-4 mx-auto mb-1 text-amber-400" />
            <p className="text-[11px] font-medium">People Ready</p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="space-y-3">
        <button
          onClick={onFinish}
          className="w-full py-4 px-6 rounded-2xl vibe-gradient-bg text-white font-bold text-base shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <span>Explore my vibe</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-xs text-slate-400">
          Preferences saved securely. You can retake or adjust them anytime from Profile.
        </p>
      </div>
    </div>
  );
};
