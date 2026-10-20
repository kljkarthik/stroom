import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  Shield,
  User as UserIcon,
  Sparkles,
  LogOut,
  ChevronDown,
  RotateCcw,
  Check
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'discover' | 'admin' | 'profile';
  onSelectTab: (tab: 'discover' | 'admin' | 'profile') => void;
  onTriggerQuiz: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onTriggerQuiz }) => {
  const { user, isAdmin, logout, loginAsDemoUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('discover')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-2xl vibe-gradient-bg flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-indigo-400 transition-colors">
              stroom
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              SOCIAL VIBES
            </span>
          </div>
        </div>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-white/5">
          <button
            onClick={() => onSelectTab('discover')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'discover'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Discover</span>
          </button>

          <button
            onClick={onTriggerQuiz}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-300 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Vibe Quiz</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentTab === 'admin'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin CMS</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile</span>
          </button>
        </nav>

        {/* Right Section: User & Quick Switcher */}
        <div className="flex items-center gap-3">
          {/* Demo User Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-medium text-slate-200 transition-colors"
            >
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={user?.full_name}
                className="w-7 h-7 rounded-xl object-cover border border-indigo-500/40"
              />
              <span className="max-w-[100px] truncate hidden sm:inline-block font-semibold">
                {user?.full_name?.split(' ')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-slide-up text-left">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    <span>STATUS: {user?.onboarding_status}</span>
                  </div>
                </div>

                <div className="py-1">
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Testing Simulation:
                  </p>
                  <button
                    onClick={() => {
                      loginAsDemoUser('newUser');
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <span>Simulate 1st Login (Sam)</span>
                    <RotateCcw className="w-3 h-3 text-indigo-400" />
                  </button>
                  <button
                    onClick={() => {
                      loginAsDemoUser('admin');
                      setDropdownOpen(false);
                      onSelectTab('admin');
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-amber-300 hover:bg-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <span>Switch to Admin (Alex)</span>
                    <Shield className="w-3 h-3 text-amber-400" />
                  </button>
                  <button
                    onClick={() => {
                      loginAsDemoUser('completedUser');
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <span>Simulate Completed User</span>
                    <Check className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
