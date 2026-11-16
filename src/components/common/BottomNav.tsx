import React from 'react';
import { Home, Compass, Calendar, Users, User } from 'lucide-react';
import { ActiveTab } from './Navbar';
import { useAuth } from '../../context/AuthContext';

interface BottomNavProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onTriggerQuiz?: () => void;
  onOpenAuth?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
}) => {
  const { user, isAuthenticated } = useAuth();

  const handleProfileClick = () => {
    if (isAuthenticated) {
      onSelectTab('participant');
    } else if (onOpenAuth) {
      onOpenAuth();
    } else {
      onSelectTab('participant');
    }
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 xl:hidden border-t px-1 py-1 flex items-center justify-around transition-colors bg-white/95 border-stroom-borderLight text-stroom-black backdrop-blur-lg shadow-lg"
    >
      {/* 1. Home */}
      <button
        type="button"
        onClick={() => onSelectTab('landing')}
        className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition-colors min-w-[56px] ${
          currentTab === 'landing' ? 'text-stroom-orange' : 'text-stone-400 hover:text-stroom-black'
        }`}
      >
        <Home className="w-4 h-4 mb-0.5" />
        <span>Home</span>
      </button>

      {/* 2. Discover */}
      <button
        type="button"
        onClick={() => onSelectTab('discover')}
        className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition-colors min-w-[56px] ${
          currentTab === 'discover' ? 'text-stroom-orange' : 'text-stone-400 hover:text-stroom-black'
        }`}
      >
        <Compass className="w-4 h-4 mb-0.5" />
        <span>Discover</span>
      </button>

      {/* 3. Events */}
      <button
        type="button"
        onClick={() => onSelectTab('discover')}
        className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition-colors min-w-[56px] ${
          currentTab === 'event_details' ? 'text-stroom-orange' : 'text-stone-400 hover:text-stroom-black'
        }`}
      >
        <Calendar className="w-4 h-4 mb-0.5" />
        <span>Events</span>
      </button>

      {/* 4. Communities */}
      <button
        type="button"
        onClick={() => onSelectTab('communities')}
        className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition-colors min-w-[56px] ${
          currentTab === 'communities' || currentTab === 'community_details'
            ? 'text-stroom-orange'
            : 'text-stone-400 hover:text-stroom-black'
        }`}
      >
        <Users className="w-4 h-4 mb-0.5" />
        <span>Communities</span>
      </button>

      {/* 5. Profile */}
      <button
        type="button"
        onClick={handleProfileClick}
        className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition-colors min-w-[56px] ${
          currentTab === 'participant' ? 'text-stroom-orange' : 'text-stone-400 hover:text-stroom-black'
        }`}
      >
        {isAuthenticated && user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.full_name || 'Profile'}
            className={`w-4 h-4 mb-0.5 rounded-full object-cover border ${
              currentTab === 'participant' ? 'border-stroom-orange' : 'border-stone-300'
            }`}
          />
        ) : (
          <User className="w-4 h-4 mb-0.5" />
        )}
        <span>Profile</span>
      </button>
    </nav>
  );
};
export default BottomNav;
