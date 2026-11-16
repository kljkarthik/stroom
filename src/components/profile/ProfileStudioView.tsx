import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  User as UserIcon,
  Sparkles,
  Camera,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  Bell,
  Heart,
  Globe,
  Key,
  Compass,
  ArrowRight,
  Phone,
  Mail,
  Sliders,
  Check,
  Trash2,
  Upload,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react';
import ImageUpload from '../common/ImageUpload';
import { isUploadedPhoto } from '../../utils/avatarUtils';

interface ProfileStudioViewProps {
  onTriggerQuiz?: () => void;
  onPreviewPublicProfile?: (memberId: string) => void;
  onBackToDashboard?: () => void;
  onProfileUpdated?: () => void;
}

const OFFICIAL_INTERESTS = [
  { id: 'cricket', label: 'Cricket', icon: '🏏' },
  { id: 'football', label: 'Football', icon: '⚽' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'movies', label: 'Movies & Cinema', icon: '🎬' },
  { id: 'music', label: 'Music & Gigs', icon: '🎵' },
  { id: 'travel', label: 'Travel & Trips', icon: '✈️' },
  { id: 'fitness', label: 'Fitness & Gym', icon: '💪' },
  { id: 'cycling', label: 'Cycling', icon: '🚴' },
  { id: 'adventure', label: 'Adventure', icon: '🧗' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'entrepreneurship', label: 'Entrepreneurship', icon: '🚀' },
  { id: 'networking', label: 'Networking', icon: '🤝' },
  { id: 'creative_activities', label: 'Creative Activities', icon: '🎨' },
  { id: 'social_meetups', label: 'Social Meetups', icon: '☕' },
  { id: 'food_cafe', label: 'Food & Café Experiences', icon: '🍔' },
];

const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
];

export const ProfileStudioView: React.FC<ProfileStudioViewProps> = ({
  onTriggerQuiz,
  onPreviewPublicProfile,
  onBackToDashboard,
  onProfileUpdated,
}) => {
  const { user, refreshUser } = useAuth();

  // Form states
  const [fullName, setFullName] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [city, setCity] = useState<string>('Hyderabad');
  const [bio, setBio] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState<boolean>(true);

  // Privacy toggles
  const [privacySettings, setPrivacySettings] = useState({
    showCommunities: true,
    showAchievements: true,
    showStamps: true,
    showCity: true,
  });

  // Notification toggles
  const [notificationSettings, setNotificationSettings] = useState({
    eventReminders: true,
    communityUpdates: true,
    achievementAlerts: true,
    marketing: false,
  });

  // Password change states
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordStatus, setPasswordStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Submission status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completionPct, setCompletionPct] = useState<number>(60);

  const handleAvatarChange = async (url: string) => {
    setAvatarUrl(url);
    try {
      await api.updateUserProfile({ avatar_url: url });
      await refreshUser();
      if (onProfileUpdated) onProfileUpdated();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.warn('Avatar auto-save note:', err);
    }
  };

  // Profile Photo Upload State & Handlers
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number>(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs on unmount or URL replacement
  useEffect(() => {
    return () => {
      if (tempPreviewUrl) {
        URL.revokeObjectURL(tempPreviewUrl);
      }
    };
  }, [tempPreviewUrl]);

  const handleAvatarFileUpload = async (file: File) => {
    setAvatarError(null);

    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!validMimes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
      setAvatarError('Unsupported format. Please select a JPG, JPEG, PNG, or WebP photo.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(`Photo exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose an image under 5MB.`);
      return;
    }

    // 1. Generate immediate local preview using object URL from the selected device file
    const objectUrl = URL.createObjectURL(file);
    setTempPreviewUrl(objectUrl);
    setImageLoadError(false);
    setIsUploadingAvatar(true);
    setAvatarUploadProgress(15);

    const progressTimer = setInterval(() => {
      setAvatarUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
    }, 200);

    try {
      // 2. Upload actual file buffer to backend / Cloudinary
      const res = await api.uploadImage(file, 'avatars');
      clearInterval(progressTimer);
      setAvatarUploadProgress(100);

      const confirmedUrl = res.secure_url || res.url;
      if (!confirmedUrl) {
        throw new Error('Upload succeeded but no valid image URL was returned.');
      }

      // 3. Persist confirmed URL through backend
      await handleAvatarChange(confirmedUrl);

      // 4. Revoke temporary preview now that confirmed URL is active
      URL.revokeObjectURL(objectUrl);
      setTempPreviewUrl(null);
    } catch (err: any) {
      clearInterval(progressTimer);
      URL.revokeObjectURL(objectUrl);
      setTempPreviewUrl(null);
      setAvatarError(err?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      setAvatarUploadProgress(0);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setImageLoadError(false);
    if (tempPreviewUrl) {
      URL.revokeObjectURL(tempPreviewUrl);
      setTempPreviewUrl(null);
    }
    await handleAvatarChange('');
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.getUserProfile();
      if (res && res.user) {
        const u = res.user;
        setFullName(u.full_name || '');
        setDisplayName(u.display_name || u.full_name || '');
        setFirstName(u.first_name || '');
        setLastName(u.last_name || '');
        setCity(u.city || 'Hyderabad');
        setBio(u.bio || '');
        setPhone(u.phone || '');
        setAvatarUrl(isUploadedPhoto(u.avatar_url) ? u.avatar_url : '');
        setCoverUrl(u.cover_url || '');
        setInterests(u.interests || []);
        setIsPublic(u.is_public !== 0);
        if (u.privacySettings) setPrivacySettings(u.privacySettings);
        if (u.notificationSettings) setNotificationSettings(u.notificationSettings);
        if (res.stats?.completionPercentage) {
          setCompletionPct(res.stats.completionPercentage);
        }
      }
    } catch (err) {
      console.warn('Failed to load profile for studio:', err);
    }
  };

  const handleToggleInterest = (id: string) => {
    if (interests.includes(id)) {
      setInterests(interests.filter((i) => i !== id));
    } else {
      setInterests([...interests, id]);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await api.updateUserProfile({
        full_name: fullName,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        city,
        bio,
        phone,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        interests,
        is_public: isPublic,
        privacy_settings: privacySettings,
        notification_settings: notificationSettings,
      });

      if (res && res.success) {
        setSaveSuccess(true);
        if (res.completionPercentage) {
          setCompletionPct(res.completionPercentage);
        }
        await refreshUser();
        if (onProfileUpdated) onProfileUpdated();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ success: false, message: 'New passwords do not match' });
      return;
    }

    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (res && res.success) {
        setPasswordStatus({ success: true, message: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordStatus({ success: false, message: err.message || 'Failed to change password' });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      
      {/* 1. STUDIO HEADER WITH COMPLETION PROGRESS */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-stroom-orange/15 text-stroom-deep border border-stroom-orange/30">
            PROFILE STUDIO
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stroom-black font-display mt-1">
            Member Identity & Studio
          </h2>
          <p className="text-xs text-stroom-charcoal/80 mt-1 max-w-md">
            Manage your personal STROOM brand, curated interests, privacy visibility, and community account settings.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Completion Ring / Progress */}
          <div className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-center sm:text-right shrink-0">
            <span className="text-[10px] font-black uppercase text-stroom-charcoal/70 block">
              Profile Completeness
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-28 sm:w-36 h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-stroom-orange to-stroom-deep rounded-full transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="text-sm font-black text-stroom-black">{completionPct}%</span>
            </div>
          </div>

          <button
            onClick={() => handleSaveProfile()}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs uppercase tracking-wider shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Profile changes saved and synchronized across STROOM ecosystem!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* 2. MAIN 2-COLUMN STUDIO EDITORS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: IDENTITY & VISUAL BRAND (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Visual Identity: Profile Photo & Cover */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-2 pb-2 border-b border-stroom-borderLight">
              <Camera className="w-4 h-4 text-stroom-orange" />
              <span>PROFILE PHOTO</span>
            </h3>

            {avatarError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                  <span>{avatarError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarError(null)}
                  className="text-red-400 hover:text-red-700 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Profile Photo Uploader */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Circular Current Profile Photo */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="relative">
                  {(tempPreviewUrl || (isUploadedPhoto(avatarUrl) && !imageLoadError)) ? (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-stroom-orange p-1 shadow-md bg-white overflow-hidden">
                      <img
                        src={tempPreviewUrl || avatarUrl}
                        alt="Current Profile Photo"
                        className="w-full h-full rounded-full object-cover object-center"
                        onError={() => setImageLoadError(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 shadow-md">
                      <UserIcon className="w-12 h-12 text-stone-500" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                  {tempPreviewUrl ? 'Uploading...' : isUploadedPhoto(avatarUrl) && !imageLoadError ? 'Active Avatar' : 'No Photo Set'}
                </span>
              </div>

              {/* Upload Actions & Compact Preview */}
              <div className="flex-1 w-full space-y-4">
                {/* Hidden File Input */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  disabled={isUploadingAvatar}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAvatarFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {(tempPreviewUrl || (isUploadedPhoto(avatarUrl) && !imageLoadError)) ? (
                  /* Photo Present or Uploading: Compact Rectangular Preview + Actions */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-stroom-charcoal">
                        Uploaded Photo Preview
                      </span>
                      {isUploadingAvatar ? (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          <span>Uploading {avatarUploadProgress}%</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Saved & Live
                        </span>
                      )}
                    </div>

                    {/* Compact Rectangular Image Preview — 100% Filled, ZERO grey empty blocks! */}
                    <div className="w-full max-w-xs h-36 rounded-2xl overflow-hidden border border-stroom-borderLight bg-stone-100 shadow-sm relative group">
                      <img
                        src={tempPreviewUrl || avatarUrl}
                        alt="Uploaded Profile Photo Preview"
                        className="w-full h-full object-cover object-center block"
                        onError={() => setImageLoadError(true)}
                      />
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-3">
                          <Loader2 className="w-6 h-6 animate-spin text-stroom-orange mb-1.5" />
                          <span className="text-xs font-bold">Uploading to Cloudinary...</span>
                          <span className="text-[11px] font-mono text-amber-300 font-bold">{avatarUploadProgress}%</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Replace Photo & Remove Photo */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="px-4 py-2 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>Replace Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar}
                        className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Remove Photo</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-stone-500 font-medium">
                      Supports JPG, JPEG, PNG, or WebP up to 5MB. Synchronized with Cloudinary across your profile, dashboard, and navigation.
                    </p>
                  </div>
                ) : (
                  /* No Photo: Upload New Photo Action */
                  <div className="space-y-3">
                    <p className="text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
                      Upload an authentic photo of yourself. If no photo is uploaded, a simple neutral profile circle is displayed.
                    </p>

                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-brand hover:brightness-105 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload New Photo</span>
                    </button>

                    <p className="text-[11px] text-stone-500 font-medium">
                      Select JPG, JPEG, PNG, or WebP directly from your device (max 5MB).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cover Image Picker */}
            <div className="pt-3 border-t border-stroom-borderLight space-y-3">
              <span className="text-xs font-bold text-stroom-charcoal block">Profile Banner Cover</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_COVERS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCoverUrl(url)}
                    className={`h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      coverUrl === url ? 'border-stroom-orange ring-1 ring-stroom-orange' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Cover ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <ImageUpload
                value={coverUrl}
                onChange={(url) => setCoverUrl(url)}
                folder="banners"
                aspectRatio="banner"
                maxSizeMB={8}
                label="Upload Custom Banner"
                helperText="Upload a high-resolution banner image (max 8MB)."
                allowManualUrl={false}
              />
            </div>
          </div>

          {/* Personal Information Form */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5 pb-2 border-b border-stroom-borderLight">
              <UserIcon className="w-4 h-4 text-stroom-orange" />
              <span>Personal Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-stroom-charcoal block mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-extrabold focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stroom-charcoal block mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-extrabold focus:outline-none focus:border-stroom-orange"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-stroom-charcoal block mb-1">Public Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-extrabold focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stroom-charcoal block mb-1">Home Chapter / City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-black focus:outline-none focus:border-stroom-orange"
                >
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Pune">Pune</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Mumbai">Mumbai</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stroom-charcoal block mb-1">Bio / Member Story</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your interests, favorite sports, or what kind of meetups you enjoy..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-medium focus:outline-none focus:border-stroom-orange"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stroom-charcoal block mb-1">Contact Phone (Private / Pass delivery)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-mono focus:outline-none focus:border-stroom-orange"
              />
            </div>
          </div>

          {/* INTERESTS SELECTION (15 Official Categories) */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
              <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-stroom-orange" />
                <span>Interests & Discovery Tags ({interests.length} Selected)</span>
              </h3>
            </div>

            <p className="text-xs text-stroom-charcoal/70">
              Select what moves you. STROOM connects your choices directly to upcoming experiences, events, and community recommendations.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OFFICIAL_INTERESTS.map((item) => {
                const isSelected = interests.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleInterest(item.id)}
                    className={`p-2.5 rounded-2xl text-left border transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-stroom-orange text-white border-stroom-orange shadow-brand'
                        : 'bg-stroom-ivory text-stroom-charcoal border-stroom-borderLight hover:bg-stroom-cream/60'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="text-xs font-extrabold truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: VIBE QUIZ, PRIVACY, SECURITY (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* PERSONALITY & VIBE PROFILE CARD */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-stroom-ivory to-stroom-cream/70 border border-stroom-orange/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-stroom-orange" />
                <span>Personality & Vibe Profile</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-stroom-orange text-white text-[9px] font-black uppercase">
                {user?.onboarding_status === 'COMPLETED' ? 'Quiz Completed' : 'Quiz Pending'}
              </span>
            </div>

            <p className="text-xs text-stroom-charcoal/80 leading-relaxed">
              Your personalized recommendations and discovery feed reflect your Vibe Quiz selections.
            </p>

            {onTriggerQuiz && (
              <button
                type="button"
                onClick={onTriggerQuiz}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stroom-cream border border-stroom-orange/40 text-stroom-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
                <span>Retake / Update Vibe Quiz</span>
              </button>
            )}
          </div>

          {/* PRIVACY & PROFILE VISIBILITY */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
              <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-stroom-orange" />
                <span>Privacy & Public Profile</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs font-bold text-stroom-charcoal">
              {/* Master Public Toggle */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight cursor-pointer">
                <div>
                  <span className="text-xs font-black text-stroom-black block">Make Profile Public</span>
                  <span className="text-[10px] text-stroom-charcoal/70 font-medium">Allow other STROOM members to view your community card</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded text-stroom-orange focus:ring-stroom-orange w-4 h-4"
                />
              </label>

              {/* Sub-controls */}
              {isPublic && (
                <div className="space-y-2 pt-1 pl-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px]">Show Joined Communities</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.showCommunities}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, showCommunities: e.target.checked })}
                      className="rounded text-stroom-orange"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px]">Show Verified Event Stamps</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.showStamps}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, showStamps: e.target.checked })}
                      className="rounded text-stroom-orange"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px]">Show Unlocked Achievements</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.showAchievements}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, showAchievements: e.target.checked })}
                      className="rounded text-stroom-orange"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px]">Show Home City</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.showCity}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, showCity: e.target.checked })}
                      className="rounded text-stroom-orange"
                    />
                  </label>
                </div>
              )}
            </div>

            {onPreviewPublicProfile && user?.member_id && (
              <button
                type="button"
                onClick={() => onPreviewPublicProfile(user.member_id!)}
                className="w-full py-2 rounded-xl bg-stroom-ivory hover:bg-stroom-cream text-stroom-black text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-stroom-orange" />
                <span>Preview Public Profile as Others See It</span>
              </button>
            )}
          </div>

          {/* NOTIFICATION PREFERENCES */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5 pb-2 border-b border-stroom-borderLight">
              <Bell className="w-4 h-4 text-stroom-orange" />
              <span>Notification Preferences</span>
            </h3>

            <div className="space-y-2.5 text-xs font-bold text-stroom-charcoal">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Event Entry & Reminder Alerts</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.eventReminders}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, eventReminders: e.target.checked })}
                  className="rounded text-stroom-orange"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Community Circle Updates</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.communityUpdates}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, communityUpdates: e.target.checked })}
                  className="rounded text-stroom-orange"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Passport & Badge Unlock Alerts</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.achievementAlerts}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, achievementAlerts: e.target.checked })}
                  className="rounded text-stroom-orange"
                />
              </label>
            </div>
          </div>

          {/* CHANGE PASSWORD & ACCOUNT SECURITY */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5 pb-2 border-b border-stroom-borderLight">
              <Key className="w-4 h-4 text-stroom-orange" />
              <span>Account Security</span>
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-stroom-charcoal block mb-0.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs outline-none focus:border-stroom-orange"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stroom-orange"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stroom-charcoal block mb-0.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs outline-none focus:border-stroom-orange"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stroom-orange"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-stroom-charcoal/70 mt-1">At least 6 characters.</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stroom-charcoal block mb-0.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs outline-none focus:border-stroom-orange"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stroom-orange"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {passwordStatus && (
                <p className={`text-[11px] font-bold ${passwordStatus.success ? 'text-emerald-700' : 'text-red-700'}`}>
                  {passwordStatus.message}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-stroom-black text-white text-xs font-extrabold hover:bg-stone-800 transition-colors"
              >
                Update Password
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
};
