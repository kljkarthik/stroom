import React from 'react';
import { Home, Trophy, Ticket, Compass, Users } from 'lucide-react';
import { ActiveTab } from './Navbar';

interface BottomNavProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onTriggerQuiz: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const isAuction = currentTab === 'auction';

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-40 xl:hidden border-t px-2 py-1.5 flex items-center justify-around transition-colors ${
        isAuction
          ? 'bg-stroom-black/95 border-stroom-borderDark text-white backdrop-blur-lg'
          : 'bg-white/95 border-stroom-borderLight text-stroom-black backdrop-blur-lg'
      }`}
    >
      <button
        onClick={() => onSelectTab('landing')}
        className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-colors ${
          currentTab === 'landing' ? 'text-stroom-orange' : 'text-stone-400'
        }`}
      >
        <Home className="w-4 h-4 mb-0.5" />
        <span>Home</span>
      </button>

      <button
        onClick={() => onSelectTab('discover')}
        className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-colors ${
          currentTab === 'discover' || currentTab === 'event_details' ? 'text-stroom-orange' : 'text-stone-400'
        }`}
      >
        <Compass className="w-4 h-4 mb-0.5" />
        <span>Discover</span>
      </button>

      <button
        onClick={() => onSelectTab('auction')}
        className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-colors ${
          currentTab === 'auction' ? 'text-stroom-orange' : 'text-stone-400'
        }`}
      >
        <Trophy className="w-4 h-4 mb-0.5" />
        <span>Auction</span>
      </button>

      <button
        onClick={() => onSelectTab('communities')}
        className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-colors ${
          currentTab === 'communities' || currentTab === 'community_details' ? 'text-stroom-orange' : 'text-stone-400'
        }`}
      >
        <Users className="w-4 h-4 mb-0.5" />
        <span>Communities</span>
      </button>

      <button
        onClick={() => onSelectTab('participant')}
        className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-extrabold transition-colors ${
          currentTab === 'participant' ? 'text-stroom-orange' : 'text-stone-400'
        }`}
      >
        <Ticket className="w-4 h-4 mb-0.5" />
        <span>Passes</span>
      </button>
    </div>
  );
};
