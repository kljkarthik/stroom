import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { QuizData, QuizSession } from '../../types';
import { WelcomeScreen } from './WelcomeScreen';
import { QuizContainer } from './QuizContainer';
import { QuizCompletionScreen } from './QuizCompletionScreen';

type OnboardingStep = 'welcome' | 'quiz' | 'completion' | 'none';

interface OnboardingGuardProps {
  children: React.ReactNode;
  forceQuiz?: boolean;
  onQuizDismiss?: () => void;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({
  children,
  forceQuiz = false,
  onQuizDismiss,
}) => {
  const { user, refreshUser, updateUserStatus } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('none');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [responses, setResponses] = useState<Record<string, string[]>>({});
  const [completedPreferences, setCompletedPreferences] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check onboarding eligibility whenever user or forceQuiz changes
  useEffect(() => {
    if (!user) {
      setStep('none');
      return;
    }

    if (forceQuiz) {
      startQuizFlow();
      return;
    }

    if (user.onboarding_status === 'NOT_STARTED') {
      setStep('welcome');
    } else if (user.onboarding_status === 'IN_PROGRESS') {
      // Resume interrupted session
      startQuizFlow();
    } else {
      setStep('none');
    }
  }, [user?.id, user?.onboarding_status, forceQuiz]);

  const startQuizFlow = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.createOrResumeSession();
      setSession(res.session);
      setQuizData(res.quiz);
      setResponses(res.responses || {});
      setStep('quiz');
    } catch (err: any) {
      console.error('Failed to start quiz session:', err);
      setError(err.message || 'Unable to load quiz. Navigating to discovery feed.');
      setStep('none');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFromWelcome = () => {
    startQuizFlow();
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      if (session) {
        await api.skipSession(session.id);
      } else {
        // Fallback: create session and skip
        const res = await api.createOrResumeSession();
        await api.skipSession(res.session.id);
      }
      updateUserStatus('SKIPPED');
      await refreshUser();
    } catch (err) {
      console.error('Failed to skip onboarding:', err);
      updateUserStatus('SKIPPED');
    } finally {
      setIsLoading(false);
      setStep('none');
      if (onQuizDismiss) onQuizDismiss();
    }
  };

  const handleComplete = (preferences: string[]) => {
    setCompletedPreferences(preferences);
    updateUserStatus('COMPLETED');
    refreshUser();
    setStep('completion');
  };

  const handleFinishCompletion = () => {
    setStep('none');
    if (onQuizDismiss) onQuizDismiss();
  };

  // Render Onboarding Views
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-stroom-ivory text-stroom-black py-4">
        <WelcomeScreen
          onStart={handleStartFromWelcome}
          onSkip={handleSkip}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (step === 'quiz' && quizData && session) {
    return (
      <div className="min-h-screen bg-stroom-ivory text-stroom-black py-4">
        <QuizContainer
          session={session}
          quizData={quizData}
          initialResponses={responses}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  if (step === 'completion') {
    return (
      <div className="min-h-screen bg-stroom-ivory text-stroom-black py-4">
        <QuizCompletionScreen
          preferences={completedPreferences}
          onFinish={handleFinishCompletion}
        />
      </div>
    );
  }

  // Otherwise render children (Main app views)
  return <>{children}</>;
};
