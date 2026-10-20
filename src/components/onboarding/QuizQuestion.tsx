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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <ListChecks className="w-3 h-3" />
            <span>Select up to {question.max_selections}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Single choice</span>
          </span>
        )}

        {question.is_required ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
            Required
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Optional
          </span>
        )}
      </div>

      {/* Main Question Title */}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
        {question.question_text}
      </h2>

      {/* Helper Description */}
      {question.description && (
        <p className="mt-2 text-sm text-slate-300 flex items-start gap-1.5 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <span>{question.description}</span>
        </p>
      )}
    </div>
  );
};
