import React, { useState } from 'react';
import { QuizData, QuizSession } from '../../types';
import { api } from '../../services/api';
import { QuizProgress } from './QuizProgress';
import { QuizQuestion } from './QuizQuestion';
import { QuizOptionCard } from './QuizOptionCard';
import { QuizNavigation } from './QuizNavigation';
import { AlertCircle } from 'lucide-react';

interface QuizContainerProps {
  session: QuizSession;
  quizData: QuizData;
  initialResponses: Record<string, string[]>;
  onComplete: (preferences: string[]) => void;
  onSkip: () => void;
}

export const QuizContainer: React.FC<QuizContainerProps> = ({
  session,
  quizData,
  initialResponses,
  onComplete,
  onSkip
}) => {
  const questions = quizData.questions;

  // Determine initial question: first unanswered question or 0
  const findFirstUnanswered = () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.is_required && (!initialResponses[q.id] || initialResponses[q.id].length === 0)) {
        return i;
      }
    }
    return 0;
  };

  const [currentIndex, setCurrentIndex] = useState<number>(findFirstUnanswered);
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialResponses || {});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No questions found in this quiz version.</p>
        <button onClick={onSkip} className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-white">
          Continue to Home
        </button>
      </div>
    );
  }

  const selectedOptions = answers[currentQuestion.id] || [];

  // Toggle or select option
  const handleToggleOption = async (optionId: string) => {
    setErrorMessage(null);
    let updatedOptions: string[];

    if (currentQuestion.question_type === 'single') {
      updatedOptions = [optionId];
    } else {
      // Multiple selection
      if (selectedOptions.includes(optionId)) {
        updatedOptions = selectedOptions.filter((id) => id !== optionId);
      } else {
        if (selectedOptions.length >= currentQuestion.max_selections) {
          setErrorMessage(`You can select up to ${currentQuestion.max_selections} options.`);
          return;
        }
        updatedOptions = [...selectedOptions, optionId];
      }
    }

    // Update local state immediately for instant feedback
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: updatedOptions,
    }));

    // Auto-persist response to backend
    setIsSaving(true);
    try {
      await api.saveResponse(session.id, currentQuestion.id, updatedOptions);
    } catch (err: any) {
      console.error('Failed to auto-save response:', err);
      // Non-blocking: will retry or save on Continue
    } finally {
      setIsSaving(false);
    }
  };

  // Validation
  const isValid = () => {
    if (!currentQuestion.is_required) return true;
    if (selectedOptions.length === 0) return false;
    if (currentQuestion.question_type === 'multiple' && selectedOptions.length < currentQuestion.min_selections) {
      return false;
    }
    return true;
  };

  // Navigation handlers
  const handleNext = async () => {
    setErrorMessage(null);

    // Validate requirements
    if (currentQuestion.is_required && selectedOptions.length === 0) {
      setErrorMessage('Please select an option to continue.');
      return;
    }

    if (
      currentQuestion.is_required &&
      currentQuestion.question_type === 'multiple' &&
      selectedOptions.length < currentQuestion.min_selections
    ) {
      setErrorMessage(`Please select at least ${currentQuestion.min_selections} options.`);
      return;
    }

    // If last question, complete the quiz
    if (currentIndex === questions.length - 1) {
      setIsSubmitting(true);
      try {
        // Ensure final question response is explicitly saved
        await api.saveResponse(session.id, currentQuestion.id, selectedOptions);
        const res = await api.completeSession(session.id);
        onComplete(res.preferences);
      } catch (err: any) {
        console.error('Failed to complete quiz:', err);
        setErrorMessage(err.message || 'Failed to complete quiz. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkipAction = async () => {
    setIsSubmitting(true);
    try {
      await api.skipSession(session.id);
      onSkip();
    } catch (err: any) {
      console.error('Failed to skip quiz:', err);
      onSkip(); // Graceful fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex flex-col justify-between max-w-md mx-auto px-4 py-6 animate-fade-in">
      {/* Top Progress Bar */}
      <div>
        <QuizProgress
          currentStep={currentIndex}
          totalSteps={questions.length}
          onSkip={handleSkipAction}
          isSaving={isSaving}
        />

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Question Header */}
        <QuizQuestion question={currentQuestion} />

        {/* Options List */}
        <div className="space-y-3 mt-4">
          {currentQuestion.options.map((option) => (
            <QuizOptionCard
              key={option.id}
              option={option}
              isSelected={selectedOptions.includes(option.id)}
              onSelect={() => handleToggleOption(option.id)}
              disabled={isSubmitting}
            />
          ))}
        </div>
      </div>

      {/* Navigation Footer */}
      <QuizNavigation
        onBack={handleBack}
        onNext={handleNext}
        canGoBack={currentIndex > 0}
        isLastQuestion={currentIndex === questions.length - 1}
        isValid={isValid()}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
