import React, { useState, useEffect } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PartnerAccount, PartnerCommunication } from '../../types';
import { PartnerOnboardingWizard } from '../partners/PartnerOnboardingWizard';
import { PartnerVenueCalendarPanel } from '../partners/PartnerVenueCalendarPanel';
import { PartnerOperationsPanel } from '../partners/PartnerOperationsPanel';
import { PartnerCampaignsRedemptionPanel } from '../partners/PartnerCampaignsRedemptionPanel';
import { PartnerAnalyticsPanel } from '../partners/PartnerAnalyticsPanel';
import {
  Building2,
  LayoutDashboard,
  UserCheck,
  MapPin,
  Handshake,
  Calendar,
  Tag,
  ScanLine,
  BarChart3,
  MessageSquare,
  Settings,
  Bell,
  Users,
  Ticket,
  CheckCircle2,
  Percent,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  Loader2,
  PlusCircle,
  Send,
  Shield,
  Clock,
  Globe,
  Save,
  ArrowRight
} from 'lucide-react';
import ImageUpload from '../common/ImageUpload';

type PartnerTab =
  | 'overview'
  | 'profile'
  | 'venues'
  | 'collaborations'
  | 'events'
  | 'campaigns'
  | 'redemption'
  | 'analytics'
  | 'communications'
  | 'settings';

interface PartnerDashboardProps {
  onOpenAuth?: () => void;
  onBackToPublic?: () => void;
}

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({ onOpenAuth, onBackToPublic }) => {
  const { user, isAuthenticated } = useAuth();
  const [accounts, setAccounts] = useState<PartnerAccount[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PartnerTab>('overview');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);
  const [loadingDash, setLoadingDash] = useState<boolean>(false);
  const [accountsError, setAccountsError] = useState<{ status?: number; message: string } | null>(null);
  const [dashError, setDashError] = useState<{ status?: number; message: string } | null>(null);

  // Business Profile editor state
  const [profileForm, setProfileForm] = useState<any>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Communications state
  const [comms, setComms] = useState<PartnerCommunication[]>([]);
  const [commSubject, setCommSubject] = useState('');
  const [commMessage, setCommMessage] = useState('');
  const [sendingComm, setSendingComm] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts();
    } else {
      setLoadingAccounts(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (selectedPartnerId) {
      loadDashboard(selectedPartnerId);
    }
  }, [selectedPartnerId]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const res = await api.getMyPartnerAccounts();
      const list = res.accounts || [];
      setAccounts(list);
      if (list.length > 0) {
        const preferred = list.find((a: any) => a.id === selectedPartnerId) || list[0];
        setSelectedPartnerId(preferred.id);
        setShowOnboarding(false);
      } else {
        setSelectedPartnerId('');
        setDashboardData(null);
      }
    } catch (err: any) {
      setAccountsError({
        status: err.status,
        message: err.message || 'Unable to load partner accounts from server.',
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadDashboard = async (partnerId: string) => {
    setLoadingDash(true);
    setDashError(null);
    setDashboardData(null);
    try {
      const res = await api.getPartnerDashboard(partnerId);
      setDashboardData(res);
      setComms(res.communications || []);
      if (res.partner) {
        let social: any = {};
        let hours: any = {};
        let facilities: string[] = [];
        try { social = JSON.parse(res.partner.social_links_json || '{}'); } catch {}
        try { hours = JSON.parse(res.partner.operating_hours_json || '{}'); } catch {}
        try { facilities = JSON.parse(res.partner.facilities_json || '[]'); } catch {}
        setProfileForm({
          business_name: res.partner.business_name || '',
          business_logo: res.partner.business_logo || '',
          cover_url: res.partner.cover_url || '',
          category: res.partner.category || 'Café & Restaurant',
          description: res.partner.description || '',
          contact_person: res.partner.contact_person || '',
          contact_email: res.partner.contact_email || '',
          contact_phone: res.partner.contact_phone || '',
          website: res.partner.website || '',
          instagram: social.instagram || '',
          city: res.partner.city || 'Hyderabad',
          address: res.partner.address || '',
          maps_url: res.partner.maps_url || '',
          capacity: res.partner.capacity || 60,
          facilitiesText: facilities.join(', '),
          weekdayHours: hours.mon_fri || '09:00 AM - 11:00 PM',
          weekendHours: hours.sat_sun || '08:00 AM - 12:00 AM',
        });
      }
    } catch (err: any) {
      setDashError({
        status: err.status,
        message: err.message || 'Unable to load partner dashboard.',
      });
    } finally {
      setLoadingDash(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId) return;
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      await api.updatePartnerProfile(selectedPartnerId, {
        business_name: profileForm.business_name,
        business_logo: profileForm.business_logo,
        cover_url: profileForm.cover_url,
        category: profileForm.category,
        description: profileForm.description,
        contact_person: profileForm.contact_person,
        contact_email: profileForm.contact_email,
        contact_phone: profileForm.contact_phone,
        website: profileForm.website,
        social_links: { instagram: profileForm.instagram },
        city: profileForm.city,
        address: profileForm.address,
        maps_url: profileForm.maps_url,
        capacity: Number(profileForm.capacity) || 60,
        facilities: String(profileForm.facilitiesText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        operating_hours: {
          mon_fri: profileForm.weekdayHours,
          sat_sun: profileForm.weekendHours,
        },
      });
      setProfileFeedback({ type: 'success', text: 'Business profile saved cleanly.' });
      loadDashboard(selectedPartnerId);
      loadAccounts();
    } catch (err: any) {
      setProfileFeedback({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!selectedPartnerId) return;
    try {
      await api.submitPartnerOnboarding(selectedPartnerId);
      setProfileFeedback({ type: 'success', text: 'Submitted to STROOM Administrators for verification review!' });
      loadDashboard(selectedPartnerId);
      loadAccounts();
    } catch (err: any) {
      setProfileFeedback({ type: 'error', text: err.message || 'Submission failed' });
    }
  };

  const handleSendComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !commSubject.trim() || !commMessage.trim()) return;
    setSendingComm(true);
    try {
      const res = await api.sendPartnerCommunication(selectedPartnerId, {
        subject: commSubject.trim(),
        message: commMessage.trim(),
        type: 'coordinator_message',
      });
      if (res.communication) {
        setComms((prev) => [res.communication, ...prev]);
        setCommSubject('');
        setCommMessage('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSendingComm(false);
    }
  };

  const handleMarkCommRead = async (msgId: string) => {
    if (!selectedPartnerId) return;
    try {
      await api.markPartnerCommunicationRead(selectedPartnerId, msgId);
      setComms((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_read: 1 } : m)));
      loadDashboard(selectedPartnerId);
    } catch {}
  };

  const verificationBadgeStyle = (status?: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Submitted':
      case 'Under Review':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Rejected':
      case 'Suspended':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  // Case A: Unauthenticated view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-stroom-borderLight shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-stroom-cream border border-stroom-orange/30 flex items-center justify-center mx-auto text-stroom-orange">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
              STROOM Business Partner Portal
            </span>
            <h2 className="text-2xl font-black text-stroom-black font-display mt-1">
              Sign In to Access Partner Portal
            </h2>
            <p className="text-xs text-stroom-charcoal/80 mt-2 leading-relaxed">
              Sign in with your STROOM Partner account to manage venue spaces, respond to event collaborations, run promotional campaigns, verify QR coupons, and track real event footfall.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="px-6 py-3 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 flex items-center justify-center gap-2"
              >
                <span>Sign In / Register Business</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          {onBackToPublic && (
            <button
              onClick={onBackToPublic}
              className="text-xs font-bold text-stone-500 hover:text-stroom-black underline pt-1"
            >
              Return to Partner With Us
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loadingAccounts) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-stroom-orange mb-3" />
        <p className="text-xs font-bold text-stroom-charcoal">Loading STROOM Business Partner Portal...</p>
      </div>
    );
  }

  if (accountsError) {
    const isForbidden = accountsError.status === 403;
    return (
      <div className="min-h-screen bg-stroom-ivory flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-stroom-borderLight shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-stroom-black font-display">
            {isForbidden ? 'Partner Access Denied' : 'Unable to Reach Partner Services'}
          </h2>
          <p className="text-xs text-stroom-charcoal/80 leading-relaxed">{accountsError.message}</p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {!isForbidden && (
              <button
                onClick={loadAccounts}
                className="px-5 py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand"
              >
                Retry Connection
              </button>
            )}
            {onBackToPublic && (
              <button
                onClick={onBackToPublic}
                className="px-5 py-2.5 rounded-xl bg-stone-100 text-stone-800 font-bold text-xs"
              >
                Return to Public Website
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Onboarding wizard when user explicitly opens onboarding
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-stroom-ivory py-10 px-4 sm:px-6 lg:px-8">
        <PartnerOnboardingWizard
          existingDraft={accounts.find((a) => a.verification_status === 'Draft') || null}
          onComplete={(createdPartner) => {
            setShowOnboarding(false);
            setSelectedPartnerId(createdPartner.id);
            loadAccounts();
          }}
          onCancel={() => setShowOnboarding(false)}
        />
      </div>
    );
  }

  // Case B: Logged in, but no business partner account exists yet
  if (accounts.length === 0) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-stroom-borderLight shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-stroom-cream border border-stroom-orange/30 flex items-center justify-center mx-auto text-stroom-orange">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
              Partner Access Notice
            </span>
            <h2 className="text-2xl font-black text-stroom-black font-display mt-1">
              No Business Partner Account Found
            </h2>
            <p className="text-xs text-stroom-charcoal/80 mt-2 leading-relaxed">
              You are currently signed in as <strong>{user?.email}</strong> ({user?.role}), which does not manage an existing STROOM partner business yet. Apply to register your café, venue, sports facility, or brand as a STROOM partner.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-6 py-3 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Apply as a STROOM Partner</span>
            </button>
            {onBackToPublic && (
              <button
                onClick={onBackToPublic}
                className="px-5 py-3 rounded-xl bg-stone-100 text-stone-800 font-bold text-xs hover:bg-stone-200 transition-colors"
              >
                Back to Partner With Us
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const partner = dashboardData?.partner || accounts.find((a) => a.id === selectedPartnerId);

  // Case E: Suspended Partner Account -> Access Restricted View
  if (partner?.verification_status === 'Suspended') {
    return (
      <div className="min-h-screen bg-stroom-ivory flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-red-200 shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-black uppercase">
            Account Suspended
          </span>
          <h2 className="text-xl font-black text-stroom-black font-display">
            Partner Portal Access Restricted
          </h2>
          <p className="text-xs text-stroom-charcoal/80 leading-relaxed">
            Access for <strong>{partner.business_name}</strong> is currently suspended.{' '}
            {partner.verification_notes || 'Please contact STROOM Partnerships for reinstatement details.'}
          </p>
          {onBackToPublic && (
            <button
              onClick={onBackToPublic}
              className="px-5 py-2.5 rounded-xl bg-stroom-black text-white font-bold text-xs"
            >
              Return to Public Website
            </button>
          )}
        </div>
      </div>
    );
  }
  const venues = dashboardData?.venues || [];
  const summary = dashboardData?.summary || {};
  const recentEvents = dashboardData?.recentEvents || [];
  const collaborations = dashboardData?.collaborations || [];
  const recentRedemptions = dashboardData?.recentRedemptions || [];
  const unreadCount = dashboardData?.unreadCommsCount || 0;

  const navItems: { id: PartnerTab; label: string; icon: any; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'Business Profile', icon: Building2 },
    { id: 'venues', label: 'Venues', icon: MapPin },
    { id: 'collaborations', label: 'Collaborations', icon: Handshake, badge: collaborations.filter((c: any) => c.status === 'Proposal Sent').length },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'campaigns', label: 'Offers & Campaigns', icon: Tag },
    { id: 'redemption', label: 'Coupon Redemption', icon: ScanLine },
    { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'communications', label: 'Communications', icon: MessageSquare, badge: unreadCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-20">
      {/* Top Partner Workspace Header */}
      <div className="bg-white border-b border-stroom-borderLight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {partner?.business_logo ? (
              <img
                src={partner.business_logo}
                alt={partner.business_name}
                className="w-14 h-14 rounded-2xl object-cover border border-stroom-orange/30 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-stroom-cream border border-stroom-orange/30 flex items-center justify-center text-stroom-orange shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
                  Welcome to STROOM Partners
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${verificationBadgeStyle(partner?.verification_status)}`}>
                  {partner?.verification_status || 'Draft'}
                </span>
                {partner?.partnership_start_date && (
                  <span className="text-[10px] font-bold text-stone-400">
                    Partner since {partner.partnership_start_date}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stroom-black font-display mt-0.5">
                {partner?.business_name || 'Partner Workspace'}
              </h1>
              <p className="text-xs text-stroom-charcoal/70">
                {partner?.category} • {partner?.city} — Turn community connections into meaningful experiences.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {accounts.length > 1 && (
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-extrabold text-stroom-black outline-none focus:border-stroom-orange"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.business_name} ({acc.city})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('communications')}
              className="relative px-3.5 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold flex items-center gap-1.5"
            >
              <Bell className="w-4 h-4 text-stroom-orange" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-stroom-orange text-white text-[10px] font-black">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-2 rounded-xl bg-stroom-black text-white hover:bg-stroom-orange text-xs font-black transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Business</span>
            </button>
          </div>
        </div>

        {/* Verification Status Banner when not Verified */}
        {partner && partner.verification_status !== 'Verified' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Verification Status: {partner.verification_status}.</strong>{' '}
                  {partner.verification_notes || 'Your business profile is pending verification. Restricted partner functions (accepting event collaborations and activating public offer campaigns) remain locked until approved by STROOM administrators.'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {partner.verification_status === 'Draft' && (
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-400 text-amber-900 font-black text-[11px]"
                  >
                    Resume Onboarding
                  </button>
                )}
                {['Draft', 'Rejected'].includes(partner.verification_status) && (
                  <button
                    onClick={handleSubmitForReview}
                    className="px-3.5 py-1.5 rounded-xl bg-stroom-orange text-white font-black text-[11px]"
                  >
                    Submit for Verification
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 10-Module Partner Navigation Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-stroom-orange text-white shadow-brand'
                      : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      active ? 'bg-white text-stroom-deep' : 'bg-stroom-orange text-white'
                    }`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {dashError ? (
          <div className="p-8 rounded-3xl bg-white border border-red-200 shadow-sm text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="text-base font-black text-stroom-black">
              {dashError.status === 403 ? 'Access Denied' : 'Failed to Load Partner Dashboard'}
            </h3>
            <p className="text-xs text-stone-600">{dashError.message}</p>
            <div className="flex justify-center gap-2">
              {dashError.status !== 403 && selectedPartnerId && (
                <button
                  onClick={() => loadDashboard(selectedPartnerId)}
                  className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs"
                >
                  Retry
                </button>
              )}
              {onBackToPublic && (
                <button
                  onClick={onBackToPublic}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                >
                  Return to Public Site
                </button>
              )}
            </div>
          </div>
        ) : loadingDash || !dashboardData ? (
          <div className="py-16 flex flex-col items-center justify-center text-stone-400">
            <Loader2 className="w-7 h-7 animate-spin text-stroom-orange mb-2" />
            <p className="text-xs font-bold">Loading verified business metrics...</p>
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Separated Authentic Overview Cards */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-500">
                      Audited Partnership Metrics (Strictly Separated Estimates vs Verified Activity)
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
                      <div className="flex items-center justify-between text-stone-500 mb-2">
                        <span className="text-[11px] font-bold uppercase">Total Collaborations</span>
                        <Handshake className="w-4 h-4 text-stroom-orange" />
                      </div>
                      <p className="text-3xl font-black text-stroom-black font-display">{summary.totalCollaborations ?? 0}</p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        {summary.upcomingHostedEvents ?? 0} upcoming • {summary.completedEvents ?? 0} completed
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
                      <div className="flex items-center justify-between text-stone-500 mb-2">
                        <span className="text-[11px] font-bold uppercase">Confirmed Registrations</span>
                        <Ticket className="w-4 h-4 text-stroom-orange" />
                      </div>
                      <p className="text-3xl font-black text-stroom-deep font-display">{summary.confirmedRegistrations ?? 0}</p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Out of {summary.expectedAttendance ?? 0} expected seat capacity
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm">
                      <div className="flex items-center justify-between text-emerald-700 mb-2">
                        <span className="text-[11px] font-bold uppercase">Actual Attendee Check-Ins</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-3xl font-black text-emerald-700 font-display">{summary.actualVerifiedCheckins ?? 0}</p>
                      <p className="text-[11px] text-emerald-700 mt-1 font-semibold">
                        Verified at door scanner ({typeof summary.attendanceRate === 'number' ? `${summary.attendanceRate}% turnout` : 'No check-ins yet'})
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
                      <div className="flex items-center justify-between text-stone-500 mb-2">
                        <span className="text-[11px] font-bold uppercase">Coupons & Verified Sales</span>
                        <Percent className="w-4 h-4 text-stroom-orange" />
                      </div>
                      <p className="text-3xl font-black text-stroom-black font-display">{summary.couponRedemptions ?? 0}</p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        {summary.activeCampaigns ?? 0} active campaigns • Purchases:{' '}
                        <strong>{typeof summary.verifiedPurchaseTotal === 'number' ? `₹${summary.verifiedPurchaseTotal.toLocaleString('en-IN')}` : 'Not available'}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Activity Split */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Recent Events & Collaborations */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
                        <h3 className="text-sm font-black text-stroom-black font-display">
                          Pending & Recent Collaborations
                        </h3>
                        <button
                          onClick={() => setActiveTab('collaborations')}
                          className="text-xs font-extrabold text-stroom-orange hover:underline"
                        >
                          Manage Collaborations →
                        </button>
                      </div>
                      {collaborations.length === 0 ? (
                        <p className="text-xs text-stone-400 py-4 text-center">No collaborations scheduled yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {collaborations.slice(0, 4).map((c: any) => (
                            <div key={c.id} className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex items-center justify-between gap-3">
                              <div>
                                <span className="text-[10px] font-black uppercase text-stroom-orange">{c.status}</span>
                                <p className="text-xs font-extrabold text-stroom-black">{c.event_name}</p>
                                <p className="text-[11px] text-stone-500">{c.venue_name} • {c.proposed_date} (~{c.expected_attendance} target)</p>
                              </div>
                              <button
                                onClick={() => setActiveTab('collaborations')}
                                className="px-3 py-1.5 rounded-xl bg-white border border-stroom-borderLight text-[11px] font-bold hover:border-stroom-orange"
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
                        <h3 className="text-sm font-black text-stroom-black font-display">
                          Hosted Events Attendance Summary
                        </h3>
                        <button
                          onClick={() => setActiveTab('events')}
                          className="text-xs font-extrabold text-stroom-orange hover:underline"
                        >
                          Operations →
                        </button>
                      </div>
                      {recentEvents.length === 0 ? (
                        <p className="text-xs text-stone-400 py-4 text-center">No events hosted yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {recentEvents.slice(0, 4).map((ev: any) => (
                            <div key={ev.id} className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-extrabold text-stroom-black">{ev.title}</p>
                                <p className="text-[11px] text-stone-500">{ev.event_date} • {ev.venue_name}</p>
                              </div>
                              <div className="flex items-center gap-3 text-[11px]">
                                <span>Reg: <strong className="text-stroom-deep">{ev.confirmed_registrations}</strong></span>
                                <span>Check-Ins: <strong className="text-emerald-700">{ev.actual_checkins}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Recent Redemptions + Partnership Model Explainer */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-stroom-borderLight">
                        <h3 className="text-sm font-black text-stroom-black font-display">
                          Latest Voucher Redemptions
                        </h3>
                        <button
                          onClick={() => setActiveTab('redemption')}
                          className="text-xs font-extrabold text-stroom-orange hover:underline"
                        >
                          Open Scanner →
                        </button>
                      </div>
                      {recentRedemptions.length === 0 ? (
                        <p className="text-xs text-stone-400 py-4 text-center">No voucher redemptions logged yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {recentRedemptions.slice(0, 4).map((r: any) => (
                            <div key={r.id} className="p-3 rounded-xl bg-stroom-ivory border border-stroom-borderLight flex items-center justify-between text-xs">
                              <div>
                                <span className="font-mono font-black text-stroom-deep">{r.coupon_code}</span>
                                <p className="text-[10px] text-stone-500">{new Date(r.redeemed_at).toLocaleDateString()}</p>
                              </div>
                              <span className="font-bold text-stroom-black">
                                {r.order_amount ? `₹${r.order_amount}` : 'Verified'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 11: Partner Benefits & Collaboration Model */}
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-stroom-charcoal to-stroom-black text-white border border-stroom-orange/30 space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stroom-orange">
                        STROOM Partnership Model
                      </span>
                      <h4 className="text-base font-black font-display">
                        Transparent Community Collaboration
                      </h4>
                      <ul className="text-xs text-stroom-cream/80 space-y-1.5 list-disc pl-4">
                        <li>Connect with local students, founders & interest communities across curated group visits.</li>
                        <li>STROOM handles ticketing, marketing & QR check-ins; you control venue slots & offers.</li>
                        <li>Example group events target ~50 participants, strictly subject to actual registrations & door turnout.</li>
                        <li>Commercial terms are mutually recorded in each collaboration—STROOM never guarantees fixed footfall or sales.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BUSINESS PROFILE MANAGEMENT */}
            {activeTab === 'profile' && (
              <div className="max-w-4xl bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stroom-borderLight">
                  <div>
                    <h3 className="text-lg font-black text-stroom-black font-display">Business Profile & Verification</h3>
                    <p className="text-xs text-stone-500">Keep your brand assets, venue details, and contact channels current.</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${verificationBadgeStyle(partner?.verification_status)}`}>
                    Status: {partner?.verification_status}
                  </span>
                </div>

                {profileFeedback && (
                  <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    profileFeedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{profileFeedback.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Business Name *</label>
                      <input
                        type="text"
                        required
                        value={profileForm.business_name || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold outline-none focus:border-stroom-orange"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Business Category</label>
                      <input
                        type="text"
                        value={profileForm.category || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, category: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={profileForm.description || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-medium outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Contact Person *</label>
                      <input
                        type="text"
                        required
                        value={profileForm.contact_person || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, contact_person: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Business Email *</label>
                      <input
                        type="email"
                        required
                        value={profileForm.contact_email || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, contact_email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={profileForm.contact_phone || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, contact_phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">City</label>
                      <select
                        value={profileForm.city || 'Hyderabad'}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      >
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Pune">Pune</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="Mumbai">Mumbai</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Capacity</label>
                      <input
                        type="number"
                        value={profileForm.capacity || 60}
                        onChange={(e) => setProfileForm({ ...profileForm, capacity: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Website URL</label>
                      <input
                        type="text"
                        value={profileForm.website || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Full Address</label>
                      <input
                        type="text"
                        value={profileForm.address || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Google Maps Link</label>
                      <input
                        type="text"
                        value={profileForm.maps_url || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, maps_url: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <ImageUpload
                        label="Business Logo"
                        value={profileForm.business_logo || ''}
                        onChange={(url) => setProfileForm({ ...profileForm, business_logo: url })}
                        folder="partners/logos"
                        aspectRatio="square"
                        maxSizeMB={5}
                        helperText="Upload official brand logo (square, max 5MB)."
                      />
                    </div>
                    <div>
                      <ImageUpload
                        label="Venue Cover Banner"
                        value={profileForm.cover_url || ''}
                        onChange={(url) => setProfileForm({ ...profileForm, cover_url: url })}
                        folder="partners/covers"
                        aspectRatio="banner"
                        maxSizeMB={8}
                        helperText="Upload venue cover banner (max 8MB)."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-stone-500 mb-1">Facilities (comma separated)</label>
                    <input
                      type="text"
                      value={profileForm.facilitiesText || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, facilitiesText: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold"
                    />
                  </div>

                  <div className="pt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-6 py-2.5 rounded-xl bg-stroom-orange text-white font-black shadow-brand hover:brightness-105 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingProfile ? 'Saving...' : 'Save Business Profile'}</span>
                    </button>
                    {['Draft', 'Rejected'].includes(partner?.verification_status) && (
                      <button
                        type="button"
                        onClick={handleSubmitForReview}
                        className="px-5 py-2.5 rounded-xl bg-stroom-black text-white font-black flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4 text-stroom-orange" />
                        <span>Submit for Admin Verification</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* 3. VENUES & AVAILABILITY */}
            {activeTab === 'venues' && selectedPartnerId && (
              <PartnerVenueCalendarPanel
                partnerId={selectedPartnerId}
                venues={venues}
                onVenuesChanged={() => loadDashboard(selectedPartnerId)}
              />
            )}

            {/* 4. COLLABORATIONS */}
            {activeTab === 'collaborations' && selectedPartnerId && (
              <PartnerOperationsPanel
                partnerId={selectedPartnerId}
                mode="collaborations"
                verificationStatus={partner?.verification_status || 'Draft'}
              />
            )}

            {/* 5. EVENTS & OPERATIONS */}
            {activeTab === 'events' && selectedPartnerId && (
              <PartnerOperationsPanel
                partnerId={selectedPartnerId}
                mode="events"
                verificationStatus={partner?.verification_status || 'Draft'}
              />
            )}

            {/* 6. OFFERS & CAMPAIGNS */}
            {activeTab === 'campaigns' && selectedPartnerId && (
              <PartnerCampaignsRedemptionPanel
                partnerId={selectedPartnerId}
                mode="campaigns"
                venues={venues}
                events={recentEvents}
                onUpdated={() => loadDashboard(selectedPartnerId)}
              />
            )}

            {/* 7. COUPON REDEMPTION */}
            {activeTab === 'redemption' && selectedPartnerId && (
              <PartnerCampaignsRedemptionPanel
                partnerId={selectedPartnerId}
                mode="redemption"
                venues={venues}
                events={recentEvents}
                onUpdated={() => loadDashboard(selectedPartnerId)}
              />
            )}

            {/* 8. ANALYTICS & REPORTS */}
            {activeTab === 'analytics' && selectedPartnerId && (
              <PartnerAnalyticsPanel partnerId={selectedPartnerId} venues={venues} />
            )}

            {/* 9. COMMUNICATIONS */}
            {activeTab === 'communications' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 space-y-4">
                  <h3 className="text-base font-black text-stroom-black font-display">
                    Message STROOM Coordinator Desk
                  </h3>
                  <p className="text-xs text-stone-500">
                    Send coordination updates, event logistics questions, or collaboration inquiries linked directly to {partner?.business_name}.
                  </p>
                  <form onSubmit={handleSendComm} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Subject *</label>
                      <input
                        type="text"
                        required
                        value={commSubject}
                        onChange={(e) => setCommSubject(e.target.value)}
                        placeholder="e.g. Table layout confirmation for Dec meetup"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-semibold outline-none focus:border-stroom-orange"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-stone-500 mb-1">Message *</label>
                      <textarea
                        rows={4}
                        required
                        value={commMessage}
                        onChange={(e) => setCommMessage(e.target.value)}
                        placeholder="Write to your STROOM partnership coordinator..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight font-medium outline-none focus:border-stroom-orange"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sendingComm}
                      className="w-full py-2.5 rounded-xl bg-stroom-orange text-white font-black shadow-brand hover:brightness-105 flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingComm ? 'Sending...' : 'Send Message'}</span>
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 space-y-4">
                  <h3 className="text-base font-black text-stroom-black font-display pb-3 border-b border-stroom-borderLight">
                    Announcements, Coordinator Updates & Operational Notes
                  </h3>
                  {comms.length === 0 ? (
                    <p className="text-xs text-stone-400 py-8 text-center">No partner communications yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {comms.map((m) => (
                        <div
                          key={m.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            m.is_read ? 'bg-stroom-ivory/50 border-stroom-borderLight' : 'bg-stroom-cream/50 border-stroom-orange/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-white border border-stroom-borderLight text-[9px] font-black uppercase text-stroom-deep">
                                {m.type.replace('_', ' ')}
                              </span>
                              <span className="text-[11px] font-bold text-stone-600">{m.sender_name}</span>
                            </div>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(m.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-stroom-black">{m.subject}</h4>
                          <p className="text-xs text-stone-700 mt-1 leading-relaxed">{m.message}</p>
                          {!m.is_read && (
                            <button
                              type="button"
                              onClick={() => handleMarkCommRead(m.id)}
                              className="mt-2 text-[11px] font-extrabold text-stroom-orange hover:underline"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 10. SETTINGS */}
            {activeTab === 'settings' && (
              <div className="max-w-3xl bg-white rounded-3xl border border-stroom-borderLight shadow-sm p-6 sm:p-8 space-y-5 text-xs">
                <h3 className="text-lg font-black text-stroom-black font-display border-b border-stroom-borderLight pb-3">
                  Partner Portal Account & Permissions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stroom-ivory p-4 rounded-2xl border border-stroom-borderLight">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-400 block">Signed In Account</span>
                    <strong className="text-stroom-black">{user?.full_name}</strong>
                    <p className="text-stone-500">{user?.email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-400 block">Partner Access Role</span>
                    <strong className="text-stroom-deep uppercase">{dashboardData?.partnerRole || 'owner'}</strong>
                    <p className="text-stone-500">Tier: {partner?.partnership_tier || 'Community Partner'}</p>
                  </div>
                </div>
                <div className="space-y-2 text-stone-600">
                  <p>
                    <strong>Data Privacy & Isolation:</strong> Your business calendar, collaboration financials, and campaign redemption ledgers are strictly scoped to authorized team members of <strong>{partner?.business_name}</strong>.
                  </p>
                  <p>
                    <strong>Member Privacy Protection:</strong> Attendee personal contact records (email, phone, personal profiles) are never exposed to partner businesses; only aggregate registrations and verified door/coupon counts are shared.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="px-4 py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105"
                >
                  Onboard Another Business Location
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
