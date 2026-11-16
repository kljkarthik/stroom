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
  AlertCircle,
  User as UserIcon
} from 'lucide-react';
import { isUploadedPhoto } from '../../utils/avatarUtils';

interface ProfileViewProps {
  onRetakeQuiz: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onRetakeQuiz }) => {
  const { user, logout, refreshUser } = useAuth();
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
    <div className="max-w-xl mx-auto px-4 py-8 pb-24 animate-fade-in text-left text-stroom-black">
      {/* Profile Header */}
      <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm mb-6">
        <div className="flex items-center gap-4">
          {isUploadedPhoto(user?.avatar_url) ? (
            <img
              src={user!.avatar_url!}
              alt={user?.full_name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-stroom-orange shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 shadow-md">
              <UserIcon className="w-8 h-8" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-stroom-black truncate font-display">{user?.full_name}</h2>
              {user?.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-stroom-cream text-stroom-deep border border-stroom-orange/30">
                  <Shield className="w-3 h-3 text-stroom-orange" />
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-xs text-stroom-charcoal/70 truncate">{user?.email}</p>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-bold text-stroom-charcoal/70">Onboarding Status:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                  user?.onboarding_status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : user?.onboarding_status === 'SKIPPED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-stroom-cream text-stroom-deep border border-stroom-orange/30'
                }`}
              >
                {user?.onboarding_status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Retake Vibe Quiz CTA */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-stroom-charcoal via-stroom-black to-stroom-cardDark text-white border border-stroom-orange/30 shadow-lg mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-stroom-orange text-xs font-black mb-1">
            <Sparkles className="w-4 h-4 fill-stroom-orange" />
            <span>DYNAMIC VIBE ONBOARDING</span>
          </div>
          <h3 className="text-base font-black text-white">Retake the Vibe Quiz</h3>
          <p className="text-xs text-stroom-cream/70 mt-0.5">
            Recalibrate your community discovery and meetup recommendations.
          </p>
        </div>
        <button
          onClick={onRetakeQuiz}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs shadow-brand hover:brightness-105 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retake Quiz</span>
        </button>
      </div>

      {/* Preferences Management */}
      <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-black text-stroom-black">Your Vibe Preferences</h3>
            <p className="text-xs text-stroom-charcoal/70 mt-0.5">
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stroom-cream border border-stroom-orange/30 text-stroom-deep text-xs font-bold"
              >
                <span>#{tag.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-600 transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))
          ) : (
            <p className="text-xs text-stone-400 italic">No preferences saved yet. Retake the quiz or add tags below.</p>
          )}
        </div>

        {/* Add Tag Input */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-stroom-borderLight">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="e.g. box_cricket, cafe_hopping, futsal"
            className="flex-1 px-3.5 py-2.5 bg-stroom-ivory border border-stroom-borderLight rounded-xl text-xs font-semibold text-stroom-black placeholder-stone-400 focus:outline-none focus:border-stroom-orange"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 bg-stroom-cream hover:bg-stroom-orange hover:text-white text-stroom-black rounded-xl text-xs font-extrabold flex items-center gap-1 transition-colors border border-stroom-orange/30"
          >
            <Plus className="w-3.5 h-3.5 text-stroom-orange" />
            <span>Add</span>
          </button>
        </div>

        <div className="mt-4 pt-3 flex justify-end">
          <button
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs shadow-brand hover:brightness-105 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
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

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full py-3 px-4 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out of STROOM</span>
      </button>
    </div>
  );
};
