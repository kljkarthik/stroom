import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Compass, Sparkles, User, Shield } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'discover' | 'admin' | 'profile';
  onSelectTab: (tab: 'discover' | 'admin' | 'profile') => void;
  onTriggerQuiz: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onTriggerQuiz }) => {
  const { isAdmin } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 px-4 py-2 pb-safe flex items-center justify-around shadow-2xl">
      <button
        onClick={() => onSelectTab('discover')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
          currentTab === 'discover' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px]">Discover</span>
      </button>

      <button
        onClick={onTriggerQuiz}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-indigo-300 transition-colors"
      >
        <div className="w-6 h-6 rounded-full vibe-gradient-bg flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px]">Vibe Quiz</span>
      </button>

      {isAdmin && (
        <button
          onClick={() => onSelectTab('admin')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'admin' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="text-[10px]">Admin CMS</span>
        </button>
      )}

      <button
        onClick={() => onSelectTab('profile')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
          currentTab === 'profile' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">Profile</span>
      </button>
    </nav>
  );
};
