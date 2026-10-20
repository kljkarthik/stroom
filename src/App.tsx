import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { OnboardingGuard } from './components/onboarding/OnboardingGuard';
import { Navbar } from './components/common/Navbar';
import { BottomNav } from './components/common/BottomNav';
import { DiscoveryFeed } from './components/discovery/DiscoveryFeed';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ProfileView } from './components/profile/ProfileView';
import { Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<'discover' | 'admin' | 'profile'>('discover');
  const [isForceQuiz, setIsForceQuiz] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl vibe-gradient-bg flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 animate-pulse">
            <Sparkles className="w-8 h-8 fill-white" />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-400 tracking-wider uppercase animate-pulse">
          Loading Stroom...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <OnboardingGuard
        forceQuiz={isForceQuiz}
        onQuizDismiss={() => setIsForceQuiz(false)}
      >
        <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onTriggerQuiz={() => setIsForceQuiz(true)}
        />

        <main className="flex-1">
          {currentTab === 'discover' && (
            <DiscoveryFeed onStartQuiz={() => setIsForceQuiz(true)} />
          )}

          {currentTab === 'admin' && (
            isAdmin ? <AdminDashboard /> : <DiscoveryFeed onStartQuiz={() => setIsForceQuiz(true)} />
          )}

          {currentTab === 'profile' && (
            <ProfileView onRetakeQuiz={() => setIsForceQuiz(true)} />
          )}
        </main>

        <BottomNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onTriggerQuiz={() => setIsForceQuiz(true)}
        />
      </OnboardingGuard>
    </div>
  );
};
