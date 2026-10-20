import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Sparkles,
  RotateCcw,
  Shield,
  LogOut,
  Check,
  Plus,
  X,
  AlertCircle
} from 'lucide-react';

interface ProfileViewProps {
  onRetakeQuiz: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onRetakeQuiz }) => {
  const { user, logout, loginAsDemoUser, refreshUser } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [user?.id, user?.onboarding_status]);

  const loadPreferences = async () => {
    try {
      const data = await api.getUserPreferences();
      setTags(data.tags || []);
    } catch (err) {
      console.error('Failed to load user preferences:', err);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleAddTag = () => {
    const formatted = newTagInput.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (formatted && !tags.includes(formatted)) {
      setTags((prev) => [...prev, formatted]);
      setNewTagInput('');
    }
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.updateUserPreferences(tags);
      setSaveSuccess(true);
      await refreshUser();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 animate-fade-in text-left">
      {/* Profile Header */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl mb-6">
        <div className="flex items-center gap-4">
          <img
            src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={user?.full_name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white truncate">{user?.full_name}</h2>
              {user?.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <Shield className="w-3 h-3" />
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Onboarding Status:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  user?.onboarding_status === 'COMPLETED'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : user?.onboarding_status === 'SKIPPED'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {user?.onboarding_status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Retake Vibe Quiz CTA */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 shadow-lg mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>DYNAMIC VIBE ONBOARDING</span>
          </div>
          <h3 className="text-base font-bold text-white">Retake the Vibe Quiz</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Recalibrate your community discovery and meetup recommendations.
          </p>
        </div>
        <button
          onClick={onRetakeQuiz}
          className="py-2.5 px-4 rounded-xl vibe-gradient-bg text-white font-bold text-xs shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retake Quiz</span>
        </button>
      </div>

      {/* Preferences Management */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-white">Your Vibe Preferences</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These tags match you with communities, events, and people.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Preferences successfully updated!</span>
          </div>
        )}

        {/* Tag Chips */}
        <div className="flex flex-wrap gap-2 my-4">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
              >
                <span>#{tag.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-400 transition-colors ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic">No preferences saved yet. Retake the quiz or add tags below.</p>
          )}
        </div>

        {/* Add Tag Input */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="e.g. food_culture, bouldering"
            className="flex-1 px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        <div className="mt-4 pt-3 flex justify-end">
          <button
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive QA & Demo Testing Panel */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/5 shadow-md mb-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          One-Click QA Testing Switcher
        </h4>
        <p className="text-[11px] text-slate-400 mb-3">
          Instantly simulate every user state for testing the onboarding flow:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => loginAsDemoUser('newUser')}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 text-left transition-colors flex items-center justify-between"
          >
            <span>Simulate First-Time Login (NOT_STARTED)</span>
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
          </button>
          <button
            onClick={() => loginAsDemoUser('completedUser')}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 text-left transition-colors flex items-center justify-between"
          >
            <span>Simulate Returning User (COMPLETED)</span>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out of Stroom</span>
      </button>
    </div>
  );
};
