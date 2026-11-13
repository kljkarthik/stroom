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
      <div className="flex items-center justify-between text-xs font-bold text-stroom-charcoal/70 mb-2">
        <span className="text-stroom-deep uppercase tracking-wider text-[11px] font-black">
          Question {currentStep + 1} of {totalSteps}
        </span>
        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="text-[11px] text-stroom-orange flex items-center gap-1 font-bold">
              <span className="w-2 h-2 rounded-full bg-stroom-orange animate-ping" />
              Saving...
            </span>
          )}
          <button
            onClick={onSkip}
            className="text-stroom-charcoal/60 hover:text-stroom-black transition-colors hover:underline text-xs font-semibold"
          >
            Skip for now
          </button>
        </div>
      </div>

      {/* Progress Track & Bar */}
      <div className="h-2 w-full bg-stroom-cream rounded-full overflow-hidden p-0.5 border border-stroom-orange/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-stroom-orange to-stroom-deep transition-all duration-500 ease-out shadow-sm"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Micro Step Indicators */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={`h-1 flex-1 mx-0.5 rounded-full transition-colors duration-300 ${
              idx <= currentStep ? 'bg-stroom-orange' : 'bg-stroom-borderLight'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
