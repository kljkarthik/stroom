import React, { useState, useEffect, useRef } from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { AdminDashboard as QuizAdminCMS } from '../admin/AdminDashboard';
import { AdminPartnerManager } from '../admin/AdminPartnerManager';
import { AdminOverviewPanel } from '../admin/AdminOverviewPanel';
import { AdminEventsCitiesPanel } from '../admin/AdminEventsCitiesPanel';
import { AdminMembersRolesPanel } from '../admin/AdminMembersRolesPanel';
import { AdminCommunitiesModerationPanel } from '../admin/AdminCommunitiesModerationPanel';
import { AdminAuctionsCheckinPanel } from '../admin/AdminAuctionsCheckinPanel';
import { AdminVenuesFinancePanel } from '../admin/AdminVenuesFinancePanel';
import { AdminAnalyticsSettingsAuditPanel } from '../admin/AdminAnalyticsSettingsAuditPanel';
import { useAuth, isDemoAuthEnabled } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  BarChart3,
  Calendar,
  Users,
  Compass,
  Trophy,
  Building2,
  MapPin,
  ScanLine,
  Sparkles,
  MessageSquareWarning,
  CreditCard,
  Bell,
  PieChart,
  Sliders,
  FileText,
  Search,
  Lock,
  Shield,
  LogOut,
  Menu,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface AdminHubProps {
  onGoToLiveAuction?: (auctionId?: string) => void;
}

interface NavItemConfig {
  key: string;
  label: string;
  group: 'Core Operations' | 'Ecosystem & Venue' | 'Governance & System';
  icon: React.FC<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItemConfig[] = [
  { key: 'overview', label: 'Platform Overview', group: 'Core Operations', icon: BarChart3 },
  { key: 'events', label: 'Events & Cities', group: 'Core Operations', icon: Calendar },
  { key: 'members', label: 'Members & Roles', group: 'Core Operations', icon: Users },
  { key: 'communities', label: 'Communities', group: 'Core Operations', icon: Compass },
  { key: 'auctions', label: 'Auction Management', group: 'Core Operations', icon: Trophy },
  { key: 'partners', label: 'Partner Management', group: 'Ecosystem & Venue', icon: Building2 },
  { key: 'venues', label: 'Venue Management', group: 'Ecosystem & Venue', icon: MapPin },
  { key: 'checkin', label: 'Door Check-in', group: 'Ecosystem & Venue', icon: ScanLine },
  { key: 'quiz_cms', label: 'Vibe Quiz CMS', group: 'Ecosystem & Venue', icon: Sparkles },
  { key: 'moderation', label: 'Feed Moderation', group: 'Governance & System', icon: MessageSquareWarning },
  { key: 'payments', label: 'Payments & Refunds', group: 'Governance & System', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', group: 'Governance & System', icon: Bell },
  { key: 'analytics', label: 'Analytics & Reports', group: 'Governance & System', icon: PieChart },
  { key: 'settings', label: 'Platform Settings', group: 'Governance & System', icon: Sliders },
  { key: 'audit_logs', label: 'Audit Logs', group: 'Governance & System', icon: FileText },
];

export const AdminHub: React.FC<AdminHubProps> = ({ onGoToLiveAuction }) => {
  const { user, isAuthenticated, loginAsDemoUser, logout } = useAuth();

  const [loadingPerms, setLoadingPerms] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string>(user?.role || '');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [allowedSections, setAllowedSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<string>('overview');

  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global search state
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPermissions();
  }, [user?.id, user?.role, isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchResults(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPermissions = async () => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setAllowedSections([]);
      setLoadingPerms(false);
      return;
    }
    setLoadingPerms(true);
    setPermError(null);
    try {
      const res = await api.getAdminPermissions();
      const allowed = res.allowedSections || [];
      setRoleName(res.role || user.role);
      setPermissions(res.permissions || []);
      setAllowedSections(allowed);
      if (allowed.length > 0 && !allowed.includes(activeSection)) {
        setActiveSection(allowed[0]);
      }
    } catch (err: any) {
      setPermissions([]);
      setAllowedSections([]);
      setPermError(err.message || 'Your account is not authorized for the Admin Control Center.');
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleGlobalSearch = async (value: string) => {
    setGlobalQuery(value);
    if (value.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearchingGlobal(true);
    try {
      const res = await api.adminGlobalSearch(value.trim());
      setSearchResults(res.results || null);
    } catch {
      setSearchResults(null);
    } finally {
      setSearchingGlobal(false);
    }
  };

  const navigateSection = (sectionKey: string) => {
    setActiveSection(sectionKey);
    setMobileMenuOpen(false);
    setSearchResults(null);
  };

  if (loadingPerms) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex flex-col items-center justify-center p-6 text-stone-500">
        <Loader2 className="w-8 h-8 animate-spin text-stroom-orange mb-3" />
        <p className="text-xs font-black uppercase tracking-wider">Verifying Admin RBAC Session...</p>
      </div>
    );
  }

  // Unauthorized or unauthenticated guard
  if (!isAuthenticated || allowedSections.length === 0) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex items-center justify-center p-4">
        <div className="max-w-lg w-full p-8 rounded-3xl bg-white border border-stroom-borderLight shadow-xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-stroom-cream border border-stroom-orange/30 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-stroom-orange" />
          </div>
          <div>
            <h2 className="text-xl font-black text-stroom-black font-display">
              STROOM Admin Control Center — Access Restricted
            </h2>
            <p className="text-xs text-stroom-charcoal/75 mt-2">
              {permError ||
                'This workspace requires an authorized STROOM administrator, manager, auctioneer, or door staff role.'}
            </p>
            {user && (
              <p className="text-[11px] font-mono text-stone-500 mt-2">
                Signed in as: {user.full_name} ({user.role})
              </p>
            )}
          </div>

          {isDemoAuthEnabled && (
            <div className="pt-2 border-t border-stroom-borderLight space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                Quick Demo Staff Access (Development Environment)
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => loginAsDemoUser('admin')}
                  className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs hover:bg-stroom-deep transition-colors"
                >
                  Sign in as Demo Admin
                </button>
                <button
                  onClick={() => loginAsDemoUser('auctioneer')}
                  className="px-4 py-2 rounded-xl bg-stroom-black text-white font-black text-xs hover:bg-stroom-charcoal transition-colors"
                >
                  Demo Auctioneer
                </button>
                <button
                  onClick={() => loginAsDemoUser('checkin')}
                  className="px-4 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-stroom-black font-black text-xs hover:border-stroom-orange transition-colors"
                >
                  Demo Door Staff
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) => allowedSections.includes(item.key));
  const groups: Array<'Core Operations' | 'Ecosystem & Venue' | 'Governance & System'> = [
    'Core Operations',
    'Ecosystem & Venue',
    'Governance & System',
  ];

  const isSectionAuthorized = allowedSections.includes(activeSection);

  const renderSection = () => {
    if (!isSectionAuthorized) {
      return (
        <div className="p-10 rounded-3xl bg-white border border-red-200 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-base font-black text-stroom-black">Permission Denied</h3>
          <p className="text-xs text-stone-500">
            Your current role ({roleName}) does not hold permission to access this module.
          </p>
        </div>
      );
    }

    switch (activeSection) {
      case 'overview':
        return (
          <AdminOverviewPanel
            allowedSections={allowedSections}
            permissions={permissions}
            onNavigateSection={navigateSection}
          />
        );
      case 'events':
        return <AdminEventsCitiesPanel permissions={permissions} />;
      case 'members':
        return (
          <AdminMembersRolesPanel
            permissions={permissions}
            currentUserId={user?.id}
            currentUserRole={roleName}
          />
        );
      case 'communities':
        return <AdminCommunitiesModerationPanel mode="communities" permissions={permissions} />;
      case 'moderation':
        return <AdminCommunitiesModerationPanel mode="moderation" permissions={permissions} />;
      case 'auctions':
        return (
          <AdminAuctionsCheckinPanel
            mode="auctions"
            permissions={permissions}
            onGoToLiveAuction={onGoToLiveAuction}
          />
        );
      case 'checkin':
        return <AdminAuctionsCheckinPanel mode="checkin" permissions={permissions} />;
      case 'partners':
        return <AdminPartnerManager />;
      case 'venues':
        return <AdminVenuesFinancePanel mode="venues" permissions={permissions} />;
      case 'payments':
        return <AdminVenuesFinancePanel mode="payments" permissions={permissions} />;
      case 'notifications':
        return <AdminVenuesFinancePanel mode="notifications" permissions={permissions} />;
      case 'quiz_cms':
        return <QuizAdminCMS />;
      case 'analytics':
        return <AdminAnalyticsSettingsAuditPanel mode="analytics" permissions={permissions} />;
      case 'settings':
        return <AdminAnalyticsSettingsAuditPanel mode="settings" permissions={permissions} />;
      case 'audit_logs':
        return <AdminAnalyticsSettingsAuditPanel mode="audit_logs" permissions={permissions} />;
      default:
        return null;
    }
  };

  const renderSidebarBody = (collapsed: boolean) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stroom-borderLight flex items-center justify-between gap-2">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <StroomLogo variant="dark" size="sm" showSubtitle={false} />
            <span className="px-2 py-0.5 rounded-full bg-stroom-cream border border-stroom-orange/30 text-[10px] font-black uppercase text-stroom-deep truncate">
              Control
            </span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-stroom-orange text-white font-black flex items-center justify-center mx-auto text-xs">
            ST
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="hidden lg:flex p-1.5 rounded-xl hover:bg-stroom-ivory text-stone-500"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {groups.map((grp) => {
          const items = visibleNavItems.filter((i) => i.group === grp);
          if (items.length === 0) return null;
          return (
            <div key={grp} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-stone-400">
                  {grp}
                </div>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigateSection(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-black transition-all ${
                      active
                        ? 'bg-stroom-orange text-white shadow-brand'
                        : 'text-stroom-charcoal hover:bg-stroom-ivory hover:text-stroom-black'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-stroom-borderLight space-y-2">
        {!collapsed && (
          <div className="p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-[11px]">
            <div className="font-black text-stroom-black truncate">{user?.full_name}</div>
            <div className="font-mono text-[10px] text-stroom-deep font-bold mt-0.5 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>{roleName}</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-1">{permissions.length} Active Permissions</div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-stroom-borderLight sticky top-0 h-screen transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderSidebarBody(sidebarCollapsed)}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 bg-white h-full shadow-2xl border-r border-stroom-borderLight">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-xl bg-stroom-ivory"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stroom-borderLight px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight"
              aria-label="Open admin navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-black text-stroom-black font-display">
                {ADMIN_NAV_ITEMS.find((i) => i.key === activeSection)?.label || 'Admin Control Center'}
              </h1>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                STROOM Operations • {visibleNavItems.length} Authorized Modules
              </p>
            </div>
          </div>

          {/* Global Search & Actions */}
          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
            {allowedSections.includes('overview') && (
              <div ref={searchBoxRef} className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalQuery}
                  onChange={(e) => handleGlobalSearch(e.target.value)}
                  placeholder="Global search: members, events, venues..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-semibold outline-none focus:border-stroom-orange"
                />
                {searchingGlobal && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stroom-orange absolute right-3 top-1/2 -translate-y-1/2" />
                )}

                {searchResults && (
                  <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-stroom-borderLight shadow-2xl p-3 space-y-2.5 max-h-96 overflow-y-auto z-50 text-xs">
                    {Object.entries(searchResults).every(([, arr]) => !Array.isArray(arr) || arr.length === 0) ? (
                      <p className="text-stone-400 text-center py-2">No authorized matches found.</p>
                    ) : (
                      <>
                        {searchResults.members?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-stone-400 px-2 mb-1">Members</div>
                            {searchResults.members.map((m: any) => (
                              <button
                                key={m.id}
                                onClick={() => navigateSection('members')}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-stroom-ivory flex justify-between"
                              >
                                <span className="font-bold">{m.full_name}</span>
                                <span className="font-mono text-[10px] text-stone-500">{m.member_id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.events?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-stone-400 px-2 mb-1">Events</div>
                            {searchResults.events.map((ev: any) => (
                              <button
                                key={ev.id}
                                onClick={() => navigateSection('events')}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-stroom-ivory flex justify-between"
                              >
                                <span className="font-bold">{ev.title}</span>
                                <span className="text-[10px] uppercase text-stroom-orange font-black">{ev.status}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.communities?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-stone-400 px-2 mb-1">Communities</div>
                            {searchResults.communities.map((c: any) => (
                              <button
                                key={c.id}
                                onClick={() => navigateSection('communities')}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-stroom-ivory flex justify-between"
                              >
                                <span className="font-bold">{c.name}</span>
                                <span className="text-[10px] text-stone-500">{c.category}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.partners?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-stone-400 px-2 mb-1">Partners</div>
                            {searchResults.partners.map((p: any) => (
                              <button
                                key={p.id}
                                onClick={() => navigateSection('partners')}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-stroom-ivory flex justify-between"
                              >
                                <span className="font-bold">{p.business_name}</span>
                                <span className="text-[10px] text-stone-500">{p.verification_status}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.venues?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-stone-400 px-2 mb-1">Venues</div>
                            {searchResults.venues.map((v: any) => (
                              <button
                                key={v.id}
                                onClick={() => navigateSection('venues')}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-stroom-ivory flex justify-between"
                              >
                                <span className="font-bold">{v.name}</span>
                                <span className="text-[10px] text-stone-500">{v.area}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.auctions?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black uppercase text-stone-400 px-2 mb-1">Auctions</div>
                            {searchResults.auctions.map((a: any) => (
                              <button
                                key={a.id}
                                onClick={() => navigateSection('auctions')}
                                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-stroom-ivory flex justify-between"
                              >
                                <span className="font-bold">{a.title}</span>
                                <span className="text-[10px] text-stroom-orange font-black">{a.status}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {allowedSections.includes('notifications') && (
              <button
                onClick={() => navigateSection('notifications')}
                className="p-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-stroom-charcoal"
                title="Notifications & Broadcasts"
              >
                <Bell className="w-4 h-4 text-stroom-orange" />
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stroom-cream border border-stroom-orange/30 text-[11px] font-black text-stroom-deep">
              <Shield className="w-3.5 h-3.5" />
              <span>{roleName}</span>
            </div>
          </div>
        </header>

        {/* Active Module Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};
