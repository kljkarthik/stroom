import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StroomLogo } from '../common/StroomLogo';
import { EmptyState } from '../common/EmptyState';
import {
  Shield,
  Award,
  Sparkles,
  Trophy,
  Compass,
  MapPin,
  Calendar,
  QrCode,
  Download,
  Share2,
  Lock,
  CheckCircle2,
  Flame,
  Coffee,
  Activity,
  Users,
  Sun,
  Moon,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  User as UserIcon,
  Eye,
  Sliders
} from 'lucide-react';
import { isUploadedPhoto } from '../../utils/avatarUtils';

interface StroomPassportViewProps {
  onExploreEvents?: () => void;
  onOpenProfileStudio?: () => void;
  onPreviewPublicProfile?: (memberId: string) => void;
}

export const StroomPassportView: React.FC<StroomPassportViewProps> = ({
  onExploreEvents,
  onOpenProfileStudio,
  onPreviewPublicProfile,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [passportData, setPassportData] = useState<any | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'stamps' | 'achievements'>('stamps');

  // Share privacy toggles
  const [shareShowCity, setShareShowCity] = useState<boolean>(true);
  const [shareShowStamps, setShareShowStamps] = useState<boolean>(true);
  const [shareShowBadges, setShareShowBadges] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    loadPassport();
  }, []);

  const loadPassport = async () => {
    setLoading(true);
    try {
      const res = await api.getPassport();
      if (res && res.passport) {
        setPassportData(res.passport);
      }
    } catch (err) {
      console.warn('Failed to load passport:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!passportData?.card?.memberId) return;
    const url = `${window.location.origin}/#member=${passportData.card.memberId}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-stroom-orange animate-spin mx-auto mb-3" />
        <p className="text-xs font-black uppercase tracking-wider text-stroom-charcoal">
          Loading Official STROOM Passport...
        </p>
      </div>
    );
  }

  const card = passportData?.card || {};
  const stats = passportData?.stats || {};
  const stamps: any[] = passportData?.stamps || [];
  const achievements: any[] = passportData?.achievements || [];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. TOP HERO: DIGITAL PASSPORT CARD & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* LEFT: THE OFFICIAL STROOM DIGITAL PASSPORT CARD (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center sm:items-start">
          <div className="flex items-center justify-between w-full max-w-md mb-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-stroom-charcoal/70 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-stroom-orange" />
              <span>Official Digital Community ID</span>
            </span>

            {/* Theme switcher for card */}
            <button
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              className="p-1.5 rounded-xl border border-stroom-borderLight bg-white hover:bg-stroom-cream text-stroom-black text-xs font-bold flex items-center gap-1 transition-all"
              title="Toggle Light/Dark Passport Style"
            >
              {isDarkTheme ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-stroom-charcoal" />}
              <span className="text-[10px]">{isDarkTheme ? 'Light Card' : 'Dark Card'}</span>
            </button>
          </div>

          {/* THE PASSPORT CARD ELEMENT */}
          <div
            className={`w-full max-w-md rounded-3xl p-6 sm:p-7 border-2 relative overflow-hidden shadow-2xl transition-all duration-300 ${
              isDarkTheme
                ? 'bg-gradient-to-br from-stroom-black via-stroom-charcoal to-stone-900 border-stroom-gold/40 text-white'
                : 'bg-gradient-to-br from-stroom-ivory via-stroom-cream to-white border-stroom-gold/60 text-stroom-black'
            }`}
          >
            {/* Watermark Infinity Emblem in Background */}
            <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none select-none">
              <span className="text-[200px] font-black text-stroom-orange leading-none">∞</span>
            </div>

            {/* Top Bar: Brand Logo & Status Tag */}
            <div className="flex items-center justify-between pb-4 border-b border-stroom-gold/30 relative z-10">
              <StroomLogo variant={isDarkTheme ? 'light' : 'dark'} size="sm" showSubtitle={true} />
              
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-gold/20 border border-stroom-gold/50 text-[10px] font-black uppercase tracking-wider text-stroom-gold">
                <Shield className="w-3 h-3 fill-current" />
                <span>{card.status || 'Verified Member'}</span>
              </div>
            </div>

            {/* Middle Section: Member Photo, Details & QR */}
            <div className="py-5 flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1 bg-gradient-to-tr from-stroom-orange to-stroom-gold shrink-0 shadow-brand overflow-hidden">
                  {isUploadedPhoto(card.avatarUrl) ? (
                    <img src={card.avatarUrl} alt={card.displayName} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400">
                      <UserIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-xl sm:text-2xl font-black font-display tracking-tight leading-tight">
                    {card.displayName || 'Pioneer Member'}
                  </h3>
                  <p className="text-[11px] font-bold text-stroom-orange flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{card.homeCity || 'Hyderabad'} Chapter</span>
                  </p>
                  <p className={`text-[10px] font-medium ${isDarkTheme ? 'text-stone-400' : 'text-stroom-charcoal/70'}`}>
                    Since {card.memberSince ? new Date(card.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026'}
                  </p>
                </div>
              </div>

              {/* Secure Verification QR Code */}
              <div className="text-center shrink-0">
                <div className={`p-2 rounded-2xl border ${isDarkTheme ? 'bg-white text-black border-stroom-gold/50' : 'bg-stroom-charcoal text-white border-stroom-gold/50'} shadow-sm`}>
                  <QrCode className="w-12 h-12 sm:w-14 sm:h-14" />
                </div>
                <span className="text-[8px] font-mono tracking-widest block mt-1 font-bold opacity-75">
                  SCAN VERIFY
                </span>
              </div>
            </div>

            {/* Bottom Bar: Unique Member ID & Tagline */}
            <div className="pt-3 border-t border-stroom-gold/25 flex items-center justify-between relative z-10 text-[10px]">
              <div>
                <span className="text-[9px] uppercase tracking-wider block opacity-70">Member ID</span>
                <span className="font-mono font-black text-xs text-stroom-gold tracking-widest">
                  {card.memberId}
                </span>
              </div>

              <div className="text-right italic opacity-80 text-[10px] font-medium">
                "Strangers Today. Stories Tomorrow."
              </div>
            </div>
          </div>

          {/* Quick Actions Under Card */}
          <div className="flex flex-wrap items-center gap-2.5 mt-3 w-full max-w-md">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Digital Passport</span>
            </button>

            {onPreviewPublicProfile && card.memberId && (
              <button
                onClick={() => onPreviewPublicProfile(card.memberId)}
                className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-stroom-cream border border-stroom-borderLight text-stroom-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-stroom-orange" />
                <span>Public View</span>
              </button>
            )}

            {onOpenProfileStudio && (
              <button
                onClick={onOpenProfileStudio}
                className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-stroom-cream border border-stroom-borderLight text-stroom-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Sliders className="w-3.5 h-3.5 text-stroom-charcoal" />
                <span>Studio</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: REAL PASSPORT STATS & COMMUNITY SUMMARY (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-stroom-orange" />
                <span>Passport Impact Summary</span>
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">
                {stats.totalPoints || 0} PTS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-center">
                <Award className="w-5 h-5 text-stroom-gold mx-auto mb-1" />
                <p className="text-xl font-black text-stroom-black">{stats.totalVerifiedExperiences || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stroom-charcoal/70">Verified Experiences</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-center">
                <Compass className="w-5 h-5 text-stroom-orange mx-auto mb-1" />
                <p className="text-xl font-black text-stroom-black">{stats.categoriesExplored || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stroom-charcoal/70">Categories Explored</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-center">
                <MapPin className="w-5 h-5 text-stroom-deep mx-auto mb-1" />
                <p className="text-xl font-black text-stroom-black">{stats.citiesExplored || 1}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stroom-charcoal/70">Cities Visited</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-center">
                <Trophy className="w-5 h-5 text-stroom-gold mx-auto mb-1" />
                <p className="text-xl font-black text-stroom-black">{stats.achievementsEarned || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stroom-charcoal/70">Badges Unlocked</p>
              </div>
            </div>

            <div className="pt-2 text-center">
              <p className="text-xs text-stroom-charcoal/80 font-medium">
                Every verified door check-in at a STROOM event adds an authentic stamp to your permanent passport record.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TABS: EVENT STAMPS vs ACHIEVEMENT SYSTEM */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('stamps')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'stamps'
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'bg-white hover:bg-stroom-cream text-stroom-charcoal border border-stroom-borderLight'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Event Stamps ({stamps.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('achievements')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'achievements'
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'bg-white hover:bg-stroom-cream text-stroom-charcoal border border-stroom-borderLight'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Achievements ({achievements.filter(a => a.is_unlocked).length}/{achievements.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: VERIFIED EVENT STAMPS */}
        {activeTab === 'stamps' && (
          <div>
            {stamps.length === 0 ? (
              <EmptyState
                icon={Award}
                title="Your Passport is Ready For Its First Stamp!"
                description="Whenever you attend a STROOM meetup, sports blitz, or community gathering and check in at the door, an authentic digital stamp will appear here permanently."
                actionText={onExploreEvents ? "Browse Upcoming Events" : undefined}
                onAction={onExploreEvents}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stamps.map((stamp: any) => (
                  <div
                    key={stamp.id}
                    className="p-5 rounded-3xl bg-white border-2 border-stroom-gold/30 hover:border-stroom-gold hover:shadow-md transition-all relative overflow-hidden group"
                  >
                    {/* Passport Stamp Postmark Ring Overlay */}
                    <div className="absolute top-2 right-2 w-16 h-16 rounded-full border-2 border-dashed border-stroom-gold/40 flex items-center justify-center pointer-events-none select-none rotate-12">
                      <span className="text-[7px] font-black uppercase tracking-widest text-stroom-gold/70 text-center">
                        VERIFIED<br />STAMP
                      </span>
                    </div>

                    <div className="flex items-start gap-3.5 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-stroom-cream to-white border border-stroom-gold/50 flex items-center justify-center text-stroom-gold shrink-0 shadow-sm">
                        {stamp.category?.includes('sport') ? (
                          <Flame className="w-6 h-6 text-stroom-deep" />
                        ) : stamp.category?.includes('cafe') ? (
                          <Coffee className="w-6 h-6 text-amber-600" />
                        ) : (
                          <Award className="w-6 h-6 text-stroom-gold" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">
                          {stamp.category || 'Experience'}
                        </span>
                        <h4 className="text-sm font-black text-stroom-black leading-snug mt-1.5 truncate">
                          {stamp.event_title}
                        </h4>
                        <p className="text-[11px] text-stroom-charcoal/80 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-stroom-orange shrink-0" />
                          <span className="truncate">{stamp.venue_name} ({stamp.city_name})</span>
                        </p>
                        <p className="text-[10px] text-stroom-charcoal/60 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>{stamp.verified_at ? new Date(stamp.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACHIEVEMENT SYSTEM */}
        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((ach: any) => {
              const isUnlocked = Boolean(ach.is_unlocked);

              return (
                <div
                  key={ach.id}
                  className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                    isUnlocked
                      ? 'bg-white border-stroom-orange/40 shadow-sm'
                      : 'bg-stone-50/70 border-stone-200 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        isUnlocked
                          ? 'bg-gradient-to-tr from-stroom-cream to-white border border-stroom-orange/30 text-stroom-deep shadow-xs'
                          : 'bg-stone-200 text-stone-400'
                      }`}>
                        {isUnlocked ? (
                          <Sparkles className="w-6 h-6 text-stroom-orange" />
                        ) : (
                          <Lock className="w-5 h-5 text-stone-400" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isUnlocked ? 'bg-stroom-orange text-white' : 'bg-stone-200 text-stone-600'
                        }`}>
                          +{ach.points} PTS
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-black text-stroom-black leading-snug">
                      {ach.title}
                    </h4>
                    <p className="text-xs text-stroom-charcoal/80 leading-relaxed mt-1">
                      {ach.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stroom-borderLight/60 flex items-center justify-between text-[10px]">
                    <span className="font-extrabold uppercase text-stroom-charcoal/70">
                      {ach.category}
                    </span>
                    {isUnlocked ? (
                      <span className="text-emerald-700 font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Unlocked</span>
                      </span>
                    ) : (
                      <span className="text-stone-500 font-bold">
                        Requirement: {ach.requirement_threshold} {ach.requirement_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 3. SHAREABLE PASSPORT MODAL WITH PRIVACY SETTINGS */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-stroom-borderLight shadow-2xl p-6 sm:p-7 space-y-6">
            
            <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-stroom-orange" />
                <h3 className="text-base font-black text-stroom-black font-display">
                  Share Your STROOM Passport
                </h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stroom-ivory hover:bg-stroom-cream text-stroom-black flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Privacy Controls for Sharing */}
            <div className="space-y-3 p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight">
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black">
                Customise Shared Details
              </h4>
              <div className="space-y-2 text-xs font-bold text-stroom-charcoal">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Display Home City ({card.homeCity})</span>
                  <input
                    type="checkbox"
                    checked={shareShowCity}
                    onChange={(e) => setShareShowCity(e.target.checked)}
                    className="rounded text-stroom-orange focus:ring-stroom-orange"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Include Verified Event Stamps ({stamps.length})</span>
                  <input
                    type="checkbox"
                    checked={shareShowStamps}
                    onChange={(e) => setShareShowStamps(e.target.checked)}
                    className="rounded text-stroom-orange focus:ring-stroom-orange"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Include Unlocked Badges ({achievements.filter(a => a.is_unlocked).length})</span>
                  <input
                    type="checkbox"
                    checked={shareShowBadges}
                    onChange={(e) => setShareShowBadges(e.target.checked)}
                    className="rounded text-stroom-orange focus:ring-stroom-orange"
                  />
                </label>
              </div>
            </div>

            {/* Public Link Share Box */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stroom-charcoal">Public Member Link</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/#member=${card.memberId}`}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-mono font-bold text-stroom-black"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="px-4 py-2.5 rounded-xl bg-stroom-black text-white text-xs font-extrabold hover:bg-stone-800 transition-colors"
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Download and Done */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  alert(`Digital Passport for ${card.displayName} (${card.memberId}) generated as High-Res Card!`);
                  setIsShareModalOpen(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black uppercase tracking-wider shadow-brand hover:brightness-105"
              >
                Download Passport Image
              </button>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-5 py-3 rounded-2xl bg-stroom-cream hover:bg-stroom-cream/80 text-stroom-black text-xs font-black"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
