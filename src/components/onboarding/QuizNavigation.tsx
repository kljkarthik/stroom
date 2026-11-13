import React from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface QuizNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  isLastQuestion: boolean;
  isValid: boolean;
  isSubmitting?: boolean;
}

export const QuizNavigation: React.FC<QuizNavigationProps> = ({
  onBack,
  onNext,
  canGoBack,
  isLastQuestion,
  isValid,
  isSubmitting
}) => {
  return (
    <div className="flex items-center justify-between gap-3 pt-6 mt-4 border-t border-stroom-borderLight">
      {/* Back Button */}
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="py-3 px-4 rounded-xl border border-stroom-borderLight bg-white hover:bg-stroom-cream text-stroom-charcoal hover:text-stroom-black font-extrabold text-sm flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4 text-stroom-orange" />
          <span>Back</span>
        </button>
      ) : (
        <div className="w-20" /> // Spacer for balanced centering
      )}

      {/* Primary Continue / Finish Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!isValid || isSubmitting}
        className={`flex-1 max-w-xs py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-brand ${
          isValid && !isSubmitting
            ? 'bg-gradient-to-r from-stroom-orange to-stroom-deep text-white hover:brightness-105 cursor-pointer'
            : 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed shadow-none'
        }`}
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>{isLastQuestion ? 'Saving preferences...' : 'Saving...'}</span>
          </span>
        ) : isLastQuestion ? (
          <>
            <span>Complete My Vibe</span>
            <Check className="w-4 h-4 stroke-[3]" />
          </>
        ) : (
          <>
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
};
