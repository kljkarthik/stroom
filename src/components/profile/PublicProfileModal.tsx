import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StroomLogo } from '../common/StroomLogo';
import {
  X,
  Shield,
  Award,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Lock,
  Compass,
  CheckCircle2,
  Share2,
  Trophy,
  Flame,
  Activity,
  Coffee
} from 'lucide-react';

interface PublicProfileModalProps {
  memberIdOrId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  memberIdOrId,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && memberIdOrId) {
      loadProfile(memberIdOrId);
    }
  }, [isOpen, memberIdOrId]);

  const loadProfile = async (id: string) => {
    setLoading(true);
    setError(null);
    setIsPrivate(false);
    try {
      const res = await api.getPublicProfile(id);
      if (res.isPrivate) {
        setIsPrivate(true);
        setProfile({ displayName: res.displayName, memberId: res.memberId });
      } else if (res.profile) {
        setProfile(res.profile);
      }
    } catch (err: any) {
      if (err.status === 403 || err.data?.isPrivate) {
        setIsPrivate(true);
        if (err.data) {
          setProfile({ displayName: err.data.displayName, memberId: err.data.memberId });
        }
      } else {
        setError(err.message || 'Unable to load member profile');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stroom-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-stroom-borderLight shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-4 border-stroom-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-black text-stroom-charcoal uppercase tracking-wider">
              Loading STROOM Member Profile...
            </p>
          </div>
        ) : isPrivate ? (
          <div className="p-8 sm:p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-stroom-cream border border-stroom-orange/30 text-stroom-deep flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">
                {profile?.memberId || 'STROOM MEMBER'}
              </span>
              <h3 className="text-2xl font-black text-stroom-black mt-2 font-display">
                {profile?.displayName || 'STROOM Member'}
              </h3>
              <p className="text-xs font-semibold text-stroom-charcoal/80 max-w-sm mx-auto mt-2 leading-relaxed">
                This STROOM member keeps their public profile private. Personal participation and experiences are reserved for approved circle members.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-stroom-black text-white text-xs font-extrabold"
            >
              Close Preview
            </button>
          </div>
        ) : error || !profile ? (
          <div className="p-8 text-center space-y-3">
            <Shield className="w-10 h-10 text-stone-400 mx-auto" />
            <h4 className="text-sm font-black text-stroom-black">{error || 'Profile Not Available'}</h4>
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-stroom-black text-white text-xs font-bold">
              Close
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            
            {/* Profile Cover & Header */}
            <div className="relative h-36 sm:h-44 bg-gradient-to-r from-stroom-charcoal via-stroom-black to-stone-900 overflow-hidden">
              {profile.coverUrl ? (
                <img src={profile.coverUrl} alt="Cover" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-stroom-orange/20 via-stroom-deep/20 to-black/80" />
              )}
              <div className="absolute top-4 left-4">
                <StroomLogo variant="light" size="sm" showSubtitle={false} />
              </div>
            </div>

            {/* Profile Info Row */}
            <div className="px-6 pb-6 relative -mt-12 space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="w-24 h-24 rounded-2xl bg-white p-1 border-2 border-stroom-orange shadow-lg shrink-0 overflow-hidden">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gradient-to-tr from-stroom-orange to-stroom-deep flex items-center justify-center text-white font-black text-3xl">
                        {profile.displayName?.charAt(0) || 'M'}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1">
                      <span className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-stroom-orange/15 text-stroom-deep border border-stroom-orange/30">
                        {profile.memberId}
                      </span>
                      {profile.city && (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700">
                          {profile.city}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-stroom-black font-display">
                      {profile.displayName}
                    </h2>
                    <p className="text-xs text-stroom-charcoal/70 mt-0.5 flex items-center justify-center sm:justify-start gap-1">
                      <Calendar className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>Member since {profile.memberSince ? new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026'}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Member</span>
                  </span>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight">
                  <p className="text-xs sm:text-sm text-stroom-charcoal font-medium leading-relaxed">
                    "{profile.bio}"
                  </p>
                </div>
              )}

              {/* Interests */}
              {profile.interests && profile.interests.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
                    <span>Shared Interests & Vibes</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-xl bg-stroom-cream text-stroom-deep border border-stroom-orange/20 text-xs font-extrabold capitalize"
                      >
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Event Stamps */}
              {profile.stamps && profile.stamps.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-stroom-borderLight">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>Verified Passport Stamps ({profile.stamps.length})</span>
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {profile.stamps.map((stamp: any) => (
                      <div
                        key={stamp.id}
                        className="p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white border border-stroom-gold/40 flex items-center justify-center text-stroom-gold shrink-0 shadow-xs">
                          {stamp.category?.includes('auction') ? (
                            <Trophy className="w-5 h-5 text-stroom-orange" />
                          ) : stamp.category?.includes('sport') ? (
                            <Flame className="w-5 h-5 text-stroom-deep" />
                          ) : stamp.category?.includes('cafe') ? (
                            <Coffee className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Award className="w-5 h-5 text-stroom-gold" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-stroom-black truncate">{stamp.event_title}</p>
                          <p className="text-[10px] text-stroom-charcoal/70 truncate mt-0.5">
                            {stamp.city_name} • {stamp.verified_at ? new Date(stamp.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unlocked Achievements */}
              {profile.achievements && profile.achievements.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-stroom-borderLight">
                  <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-stroom-orange" />
                    <span>Unlocked Achievements ({profile.achievements.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {profile.achievements.map((ach: any) => (
                      <div
                        key={ach.id}
                        className="p-3 rounded-2xl bg-white border border-stroom-orange/30 flex items-start gap-3 shadow-xs"
                      >
                        <div className="w-9 h-9 rounded-xl bg-stroom-cream text-stroom-deep flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-stroom-orange" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-black text-stroom-black">{ach.title}</h5>
                          <p className="text-[11px] text-stroom-charcoal/80 leading-snug mt-0.5">{ach.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Joined Communities */}
              {profile.communities && profile.communities.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-stroom-borderLight">
                  <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-stroom-orange" />
                    <span>Joined Communities</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.communities.map((c: any) => (
                      <div
                        key={c.id}
                        className="px-3 py-1.5 rounded-xl bg-stroom-cream border border-stroom-borderLight flex items-center gap-2"
                      >
                        <div className="w-5 h-5 rounded-md bg-stroom-orange text-white text-[10px] font-black flex items-center justify-center">
                          {c.name.charAt(0)}
                        </div>
                        <span className="text-xs font-extrabold text-stroom-black">{c.name}</span>
                        <span className="text-[10px] text-stroom-charcoal/70">({c.city_name})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
