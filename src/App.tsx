import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar, ActiveTab } from './components/common/Navbar';
import { BottomNav } from './components/common/BottomNav';
import { LandingPage } from './components/landing/LandingPage';
import { AuthView } from './components/auth/AuthView';
import { OnboardingGuard } from './components/onboarding/OnboardingGuard';
import { StroomLogo } from './components/common/StroomLogo';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Route-level code splitting for secondary pages & role portals
const DiscoverEventsPage = lazy(() => import('./components/events/DiscoverEventsPage').then((m) => ({ default: m.DiscoverEventsPage })));
const EventDetailsPage = lazy(() => import('./components/events/EventDetailsPage').then((m) => ({ default: m.EventDetailsPage })));
const CommunitiesPage = lazy(() => import('./components/communities/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })));
const CommunityDetailsPage = lazy(() => import('./components/communities/CommunityDetailsPage').then((m) => ({ default: m.CommunityDetailsPage })));
const AboutPage = lazy(() => import('./components/about/AboutPage').then((m) => ({ default: m.AboutPage })));
const PartnerWithUsPage = lazy(() => import('./components/partners/PartnerWithUsPage').then((m) => ({ default: m.PartnerWithUsPage })));
const ContactFaqPage = lazy(() => import('./components/contact/ContactFaqPage').then((m) => ({ default: m.ContactFaqPage })));
const ParticipantDashboard = lazy(() => import('./components/dashboard/ParticipantDashboard').then((m) => ({ default: m.ParticipantDashboard })));
const PartnerDashboard = lazy(() => import('./components/dashboard/PartnerDashboard').then((m) => ({ default: m.PartnerDashboard })));
const AdminHub = lazy(() => import('./components/dashboard/AdminHub').then((m) => ({ default: m.AdminHub })));

const RouteSuspenseFallback: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
    <div className="w-9 h-9 rounded-full border-3 border-stroom-orange border-t-transparent animate-spin mb-3" />
    <p className="text-xs font-extrabold uppercase tracking-wider text-stroom-charcoal/70">Loading STROOM Experience...</p>
  </div>
);

function parseRouteFromPath(pathname: string): { tab: ActiveTab; resourceId?: string; isLogin?: boolean } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/home') return { tab: 'landing' };
  if (clean === '/login' || clean === '/signin') return { tab: 'landing', isLogin: true };
  if (clean === '/discover' || clean === '/events') return { tab: 'discover' };
  if (clean.startsWith('/events/')) return { tab: 'event_details', resourceId: clean.replace('/events/', '') };
  if (clean === '/communities') return { tab: 'communities' };
  if (clean.startsWith('/communities/')) return { tab: 'community_details', resourceId: clean.replace('/communities/', '') };
  if (clean === '/about') return { tab: 'about' };
  if (clean === '/partner-with-us') return { tab: 'partner_with_us' };
  if (clean === '/partner' || clean === '/partner-portal') return { tab: 'partner' };
  if (clean === '/contact' || clean === '/faq' || clean === '/faqs') return { tab: 'contact_faq' };
  if (clean === '/participant' || clean === '/dashboard' || clean === '/passport') return { tab: 'participant' };
  if (clean === '/admin') return { tab: 'admin' };
  // Safe redirection for any legacy auction URLs -> redirect cleanly to discover
  if (clean === '/auction' || clean.startsWith('/auction/') || clean === '/auctions' || clean.startsWith('/auctions/')) {
    return { tab: 'discover' };
  }
  return { tab: 'landing' };
}

function getPathForTab(tab: ActiveTab, resourceId?: string): string {
  switch (tab) {
    case 'landing':
      return '/';
    case 'discover':
      return '/discover';
    case 'event_details':
      return resourceId ? `/events/${resourceId}` : '/discover';
    case 'communities':
      return '/communities';
    case 'community_details':
      return resourceId ? `/communities/${resourceId}` : '/communities';
    case 'about':
      return '/about';
    case 'partner_with_us':
      return '/partner-with-us';
    case 'partner':
      return '/partner';
    case 'contact_faq':
      return '/contact';
    case 'participant':
      return '/participant';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

export const App: React.FC = () => {
  const { isLoading, isAuthenticated, user } = useAuth();
  const initialRoute = parseRouteFromPath(window.location.pathname);

  const [currentTab, setCurrentTab] = useState<ActiveTab>(initialRoute.tab);
  const [isForceQuiz, setIsForceQuiz] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(Boolean(initialRoute.isLogin));
  const [intendedTab, setIntendedTab] = useState<ActiveTab | null>(
    initialRoute.tab === 'partner' || initialRoute.tab === 'participant' || initialRoute.tab === 'admin'
      ? initialRoute.tab
      : null
  );
  const prevAuthRef = useRef<boolean>(isAuthenticated);

  // Sub-resource state
  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialRoute.tab === 'event_details' && initialRoute.resourceId ? initialRoute.resourceId : 'evt_hyd_sports_03'
  );
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>(
    initialRoute.tab === 'community_details' && initialRoute.resourceId ? initialRoute.resourceId : 'comm_hyd_cricket'
  );
  const [discoverCategory, setDiscoverCategory] = useState<string>('all');
  const [contactInitialTab, setContactInitialTab] = useState<'faqs' | 'contact'>('faqs');

  const navigateToTab = (tab: ActiveTab, resourceId?: string) => {
    if (tab === 'event_details' && resourceId) {
      setSelectedEventId(resourceId);
    }
    if (tab === 'community_details' && resourceId) {
      setSelectedCommunityId(resourceId);
    }

    // Redirect unauthenticated users requesting protected Partner Portal -> preserve destination
    if (!isLoading && !isAuthenticated && tab === 'partner') {
      setIntendedTab('partner');
      setShowAuthModal(true);
      const targetPath = getPathForTab('partner');
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab: 'partner' }, '', targetPath);
      }
      setCurrentTab('partner');
      return;
    }

    setCurrentTab(tab);
    const nextPath = getPathForTab(tab, resourceId);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ tab, resourceId }, '', nextPath);
    }
  };

  // Handle direct route access to protected Partner Portal when logged out
  useEffect(() => {
    if (!isLoading && !isAuthenticated && currentTab === 'partner' && !prevAuthRef.current && intendedTab === 'partner') {
      setShowAuthModal(true);
    }
  }, [isLoading, isAuthenticated, currentTab, intendedTab]);

  // Handle login completion & logout cleanup
  useEffect(() => {
    if (isAuthenticated && showAuthModal) {
      setShowAuthModal(false);
      if (intendedTab) {
        const dest = intendedTab;
        setIntendedTab(null);
        if (dest === 'event_details') {
          navigateToTab('event_details', selectedEventId);
        } else {
          navigateToTab(dest);
        }
      } else if (user?.role === 'venue_partner') {
        navigateToTab('partner');
      }
    }

    if (prevAuthRef.current && !isAuthenticated) {
      // User logged out: block protected views immediately
      if (['partner', 'participant', 'admin'].includes(currentTab)) {
        navigateToTab('landing');
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, showAuthModal, user?.role]);

  // Browser Back / Forward navigation sync
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromPath(window.location.pathname);
      if (parsed.tab === 'event_details' && parsed.resourceId) {
        setSelectedEventId(parsed.resourceId);
      }
      if (parsed.tab === 'community_details' && parsed.resourceId) {
        setSelectedCommunityId(parsed.resourceId);
      }
      setShowAuthModal(Boolean(parsed.isLogin));
      setCurrentTab(parsed.tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Scroll to top upon tab switch
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab, selectedEventId, selectedCommunityId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stroom-ivory flex flex-col items-center justify-center p-4">
        <StroomLogo variant="dark" size="xl" showSubtitle={true} className="animate-pulse" />
        <p className="mt-4 text-xs font-black text-stroom-deep tracking-widest uppercase animate-pulse">
          Strangers Today. Stories Tomorrow.
        </p>
      </div>
    );
  }

  // If user requested Auth view (or redirected from protected Partner Portal)
  if (showAuthModal) {
    return (
      <AuthView
        intendedDestination={intendedTab}
        onBackToHome={() => {
          setShowAuthModal(false);
          const wasPartnerRedirect = intendedTab === 'partner' || currentTab === 'partner';
          setIntendedTab(null);
          if (wasPartnerRedirect && !isAuthenticated) {
            navigateToTab('partner_with_us');
          } else if (['participant', 'admin'].includes(currentTab) && !isAuthenticated) {
            navigateToTab('landing');
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black flex flex-col font-sans selection:bg-stroom-orange selection:text-white">
      <OnboardingGuard
        forceQuiz={isForceQuiz}
        onQuizDismiss={() => setIsForceQuiz(false)}
      >
        {/* Navigation Bar */}
        <Navbar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'contact_faq') {
              setContactInitialTab('faqs');
            }
            navigateToTab(tab);
          }}
          onTriggerQuiz={() => setIsForceQuiz(true)}
          onOpenAuth={() => {
            setIntendedTab(null);
            setShowAuthModal(true);
          }}
        />

        {/* Main Routed Content Area */}
        <main className="flex-1">
          <Suspense fallback={<RouteSuspenseFallback />}>
          {/* 1. Public Landing / Home */}
          {currentTab === 'landing' && (
            <LandingPage
              onGoToAuth={() => {
                setIntendedTab(null);
                setShowAuthModal(true);
              }}
              onGoToParticipant={() => navigateToTab('participant')}
              onGoToDiscover={(category?: string) => {
                setDiscoverCategory(category || 'all');
                navigateToTab('discover');
              }}
              onGoToEventDetails={(eventId: string) => navigateToTab('event_details', eventId)}
              onGoToCommunities={() => navigateToTab('communities')}
              onGoToCommunityDetails={(communityId: string) => navigateToTab('community_details', communityId)}
              onGoToAbout={() => navigateToTab('about')}
              onGoToPartnerWithUs={() => navigateToTab('partner_with_us')}
              onGoToContact={() => {
                setContactInitialTab('contact');
                navigateToTab('contact_faq');
              }}
              onGoToFaqs={() => {
                setContactInitialTab('faqs');
                navigateToTab('contact_faq');
              }}
            />
          )}

          {/* 2. Discover Events Page */}
          {currentTab === 'discover' && (
            <DiscoverEventsPage
              initialCategory={discoverCategory}
              onSelectEvent={(eventId: string) => navigateToTab('event_details', eventId)}
              onGoToCommunities={() => navigateToTab('communities')}
              onOpenAuth={(eventId) => {
                setIntendedTab('event_details');
                if (eventId) setSelectedEventId(eventId);
                setShowAuthModal(true);
              }}
            />
          )}

          {/* 3. Event Details Page */}
          {currentTab === 'event_details' && (
            <EventDetailsPage
              eventId={selectedEventId}
              onBack={() => navigateToTab('discover')}
              onGoToParticipant={() => navigateToTab('participant')}
              onOpenAuth={(evId) => {
                setIntendedTab('event_details');
                if (evId) setSelectedEventId(evId);
                setShowAuthModal(true);
              }}
            />
          )}

          {/* 4. Communities Page */}
          {currentTab === 'communities' && (
            <CommunitiesPage
              onSelectCommunity={(communityId: string) => navigateToTab('community_details', communityId)}
              onOpenAuth={() => {
                setIntendedTab(null);
                setShowAuthModal(true);
              }}
              onGoToEvents={() => navigateToTab('discover')}
            />
          )}

          {/* 5. Community Details Page */}
          {currentTab === 'community_details' && (
            <CommunityDetailsPage
              communityId={selectedCommunityId}
              onBack={() => navigateToTab('communities')}
              onSelectEvent={(eventId: string) => navigateToTab('event_details', eventId)}
              onOpenAuth={() => {
                setIntendedTab(null);
                setShowAuthModal(true);
              }}
            />
          )}

          {/* 6. About STROOM Page */}
          {currentTab === 'about' && (
            <AboutPage
              onGoToDiscover={() => navigateToTab('discover')}
              onGoToCommunities={() => navigateToTab('communities')}
              onGoToPartner={() => navigateToTab('partner_with_us')}
            />
          )}

          {/* 7. Partner With Us Page */}
          {currentTab === 'partner_with_us' && (
            <PartnerWithUsPage
              onGoToPartnerPortal={() => navigateToTab('partner')}
              onGoToContact={() => {
                setContactInitialTab('contact');
                navigateToTab('contact_faq');
              }}
            />
          )}

          {/* 8. FAQs & Contact Us Page */}
          {currentTab === 'contact_faq' && (
            <ContactFaqPage
              initialTab={contactInitialTab}
            />
          )}

          {/* 9. Participant Dashboard & Passes */}
          {currentTab === 'participant' && (
            <ErrorBoundary
              fallbackTitle="Participant Hub"
              fallbackMessage="Your Participant Hub encountered an unexpected display issue. Click Reload to restore your passes and passport."
              onReset={() => navigateToTab('participant')}
            >
              <ParticipantDashboard
                onExploreEvents={() => navigateToTab('discover')}
                onTriggerQuiz={() => setIsForceQuiz(true)}
                onGoToCommunities={() => navigateToTab('communities')}
                onGoToEventDetails={(eventId) => navigateToTab('event_details', eventId)}
                onGoToCommunityDetails={(communityId) => navigateToTab('community_details', communityId)}
              />
            </ErrorBoundary>
          )}

          {/* 10. Partner Dashboard */}
          {currentTab === 'partner' && (
            <ErrorBoundary
              fallbackTitle="STROOM Business Partner Portal"
              fallbackMessage="The Business Partner Portal encountered an unexpected rendering issue. Click Reload to restore your workspace."
              onReset={() => navigateToTab('partner')}
            >
              <PartnerDashboard
                onOpenAuth={() => {
                  setIntendedTab('partner');
                  setShowAuthModal(true);
                }}
                onBackToPublic={() => navigateToTab('partner_with_us')}
              />
            </ErrorBoundary>
          )}

          {/* 11. Admin Console */}
          {currentTab === 'admin' && (
            <ErrorBoundary
              fallbackTitle="STROOM Admin Control Center"
              fallbackMessage="The Admin Console encountered an unexpected rendering issue. Click Reload to restore."
              onReset={() => navigateToTab('admin')}
            >
              <AdminHub />
            </ErrorBoundary>
          )}
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => navigateToTab(tab)}
          onTriggerQuiz={() => setIsForceQuiz(true)}
          onOpenAuth={() => {
            setIntendedTab('participant');
            setShowAuthModal(true);
          }}
        />
      </OnboardingGuard>
    </div>
  );
};
