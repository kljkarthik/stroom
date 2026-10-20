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
    <div className="flex items-center justify-between gap-3 pt-6 mt-4 border-t border-slate-800/80">
      {/* Back Button */}
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="py-3 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" />
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
        className={`flex-1 max-w-xs py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${
          isValid && !isSubmitting
            ? 'vibe-gradient-bg text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer'
            : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed shadow-none'
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
