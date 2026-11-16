import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StroomLogo } from './StroomLogo';
import { NotificationDropdown } from './NotificationDropdown';
import {
  Compass,
  Shield,
  User as UserIcon,
  Sparkles,
  LogOut,
  ChevronDown,
  Building2,
  Home,
  Menu,
  X,
  Ticket,
  Users,
  Info,
  HelpCircle,
  Award,
  Sliders
} from 'lucide-react';

export type ActiveTab =
  | 'landing'
  | 'discover'
  | 'event_details'
  | 'communities'
  | 'community_details'
  | 'about'
  | 'partner_with_us'
  | 'contact_faq'
  | 'participant'
  | 'partner'
  | 'admin';

interface NavbarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onTriggerQuiz: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onTriggerQuiz,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  return (
    <header className="sticky top-0 z-40 transition-colors bg-stroom-ivory/95 backdrop-blur-xl border-b border-stroom-borderLight text-stroom-black shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo & Full Identity */}
        <div
          onClick={() => onSelectTab('landing')}
          className="flex items-center gap-3 cursor-pointer group select-none py-1.5"
          title="STROOM — Strangers Today. Stories Tomorrow."
        >
          <StroomLogo
            variant="dark"
            size="md"
            showSubtitle={true}
          />
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1 p-1.5 rounded-2xl border bg-white/90 border-stroom-borderLight shadow-xs">
          <button
            onClick={() => onSelectTab('landing')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
              currentTab === 'landing'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => onSelectTab('discover')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
              currentTab === 'discover' || currentTab === 'event_details'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover</span>
          </button>

          <button
            onClick={() => onSelectTab('communities')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
              currentTab === 'communities' || currentTab === 'community_details'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Communities</span>
          </button>

          <button
            onClick={() => onSelectTab('about')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
              currentTab === 'about'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>About</span>
          </button>

          <button
            onClick={() => onSelectTab('partner_with_us')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
              currentTab === 'partner_with_us' || currentTab === 'partner'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Partner With Us</span>
          </button>

          <button
            onClick={() => onSelectTab('contact_faq')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
              currentTab === 'contact_faq'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'text-stroom-charcoal hover:text-stroom-black hover:bg-stroom-cream/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>FAQs</span>
          </button>
        </nav>

        {/* Right Section: User & Account Switcher */}
        <div className="flex items-center gap-2.5">
          {isAuthenticated && (
            <NotificationDropdown dark={false} />
          )}

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl border text-xs font-extrabold transition-colors bg-white border-stroom-borderLight text-stroom-black hover:border-stroom-orange"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || 'Member'}
                    className="w-7 h-7 rounded-xl object-cover border border-stroom-orange/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-stroom-orange text-white flex items-center justify-center font-bold text-xs">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {user?.full_name || 'Member'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-stroom-borderLight shadow-2xl p-2 z-50 text-stroom-black animate-fade-in">
                  <div className="p-2 border-b border-stroom-cream mb-1 flex items-center gap-2.5">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name || 'Member'}
                        className="w-9 h-9 rounded-xl object-cover border border-stroom-orange/40 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-stroom-orange text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {user?.full_name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-stroom-black truncate">{user?.full_name}</p>
                      <p className="text-[10px] text-stroom-charcoal/70 truncate">{user?.email}</p>
                      <span className="inline-block mt-0.5 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">
                        {user?.role === 'admin' ? 'Administrator' : 'Participant'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        onSelectTab('participant');
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-stroom-cream flex items-center gap-2"
                    >
                      <Ticket className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>Participant Hub & Passes</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectTab('participant');
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-stroom-cream flex items-center gap-2"
                    >
                      <Award className="w-3.5 h-3.5 text-stroom-gold" />
                      <span>STROOM Passport</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectTab('participant');
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-stroom-cream flex items-center gap-2"
                    >
                      <Sliders className="w-3.5 h-3.5 text-stroom-charcoal" />
                      <span>Profile Studio</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectTab('partner');
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-stroom-cream flex items-center gap-2"
                    >
                      <Building2 className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>Partner Portal Dashboard</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          onSelectTab('admin');
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-stroom-cream flex items-center gap-2 text-stroom-deep"
                      >
                        <Shield className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>Admin Console</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onTriggerQuiz();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-stroom-cream flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
                      <span>Retake Vibe Quiz</span>
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-bold hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In / Join</span>
              </button>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl border bg-white border-stroom-borderLight text-stroom-black"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t px-4 py-4 space-y-1.5 animate-fade-in bg-stroom-ivory border-stroom-borderLight text-stroom-black">
          <button
            onClick={() => {
              onSelectTab('landing');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
              currentTab === 'landing'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'hover:bg-stroom-cream/60'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('discover');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
              currentTab === 'discover'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'hover:bg-stroom-cream/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Discover Events</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('communities');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
              currentTab === 'communities'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'hover:bg-stroom-cream/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Communities</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('about');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
              currentTab === 'about'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'hover:bg-stroom-cream/60'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>About STROOM</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('partner_with_us');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
              currentTab === 'partner_with_us'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'hover:bg-stroom-cream/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Partner With Us</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('contact_faq');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
              currentTab === 'contact_faq'
                ? 'bg-stroom-orange text-white shadow-brand'
                : 'hover:bg-stroom-cream/60'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>FAQs & Contact</span>
          </button>

          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-1.5">
            <button
              onClick={() => {
                onSelectTab('participant');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
                currentTab === 'participant'
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'hover:bg-stroom-cream/60'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Participant Hub & Passes</span>
            </button>

            <button
              onClick={() => {
                onSelectTab('partner');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
                currentTab === 'partner'
                  ? 'bg-stroom-orange text-white shadow-brand'
                  : 'hover:bg-stroom-cream/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Partner Dashboard</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  onSelectTab('admin');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all ${
                  currentTab === 'admin'
                    ? 'bg-stroom-orange text-white shadow-brand'
                    : 'hover:bg-stroom-cream/60'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
