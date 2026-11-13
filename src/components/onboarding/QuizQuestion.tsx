import React from 'react';
import { QuizQuestion as IQuizQuestion } from '../../types';
import { CheckCircle2, ListChecks, HelpCircle } from 'lucide-react';

interface QuizQuestionProps {
  question: IQuizQuestion;
}

export const QuizQuestion: React.FC<QuizQuestionProps> = ({ question }) => {
  return (
    <div className="text-left mb-6 animate-fade-in">
      {/* Requirement & Type Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {question.question_type === 'multiple' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-stroom-cream text-stroom-deep border border-stroom-orange/30">
            <ListChecks className="w-3 h-3 text-stroom-orange" />
            <span>Select up to {question.max_selections}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-stroom-cream text-stroom-deep border border-stroom-orange/30">
            <CheckCircle2 className="w-3 h-3 text-stroom-orange" />
            <span>Single choice</span>
          </span>
        )}

        {question.is_required ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
            Required
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
            Optional
          </span>
        )}
      </div>

      {/* Main Question Title */}
      <h2 className="text-2xl sm:text-3xl font-black text-stroom-black tracking-tight leading-snug font-display">
        {question.question_text}
      </h2>

      {/* Helper Description */}
      {question.description && (
        <p className="mt-2 text-sm text-stroom-charcoal/80 flex items-start gap-1.5 leading-relaxed font-medium">
          <HelpCircle className="w-4 h-4 text-stroom-orange mt-0.5 flex-shrink-0" />
          <span>{question.description}</span>
        </p>
      )}
    </div>
  );
};
