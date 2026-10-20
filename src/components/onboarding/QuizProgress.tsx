import React from 'react';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
  onSkip: () => void;
  isSaving?: boolean;
}

export const QuizProgress: React.FC<QuizProgressProps> = ({
  currentStep,
  totalSteps,
  onSkip,
  isSaving
}) => {
  const percentage = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
        <span className="text-indigo-400 uppercase tracking-wider text-[11px]">
          Question {currentStep + 1} of {totalSteps}
        </span>
        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              Saving...
            </span>
          )}
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-slate-200 transition-colors hover:underline text-xs"
          >
            Skip for now
          </button>
        </div>
      </div>

      {/* Progress Track & Bar */}
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full rounded-full vibe-gradient-bg transition-all duration-500 ease-out shadow-sm shadow-indigo-500/50"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Micro Step Indicators */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={`h-1 flex-1 mx-0.5 rounded-full transition-colors duration-300 ${
              idx <= currentStep ? 'bg-indigo-500/60' : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
