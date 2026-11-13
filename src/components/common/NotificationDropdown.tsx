import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Check,
  CheckCheck,
  Ticket,
  Trophy,
  Award,
  Users,
  Sparkles,
  Info,
  Clock,
  X
} from 'lucide-react';

interface NotificationDropdownProps {
  dark?: boolean;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ dark = false }) => {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      // Poll every 30 seconds for live updates
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      const res = await api.getNotifications();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      // Quiet fail for polling
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  };

  if (!isAuthenticated) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'achievement':
        return <Trophy className="w-4 h-4 text-stroom-gold" />;
      case 'checkin':
        return <Award className="w-4 h-4 text-emerald-500" />;
      case 'registration':
        return <Ticket className="w-4 h-4 text-stroom-orange" />;
      case 'community':
        return <Users className="w-4 h-4 text-sky-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-stroom-orange" />;
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className={`relative p-2 rounded-2xl border transition-all ${
          dark
            ? 'bg-stroom-surfaceDark border-stroom-borderDark text-stone-300 hover:text-white hover:border-stroom-orange'
            : 'bg-white border-stroom-borderLight text-stroom-black hover:border-stroom-orange shadow-xs'
        }`}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-stroom-orange text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white border border-stroom-borderLight shadow-2xl p-3 z-50 animate-fade-in text-stroom-black">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 px-1 border-b border-stroom-borderLight">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-stroom-orange" />
              <h4 className="text-xs font-black uppercase tracking-wider text-stroom-black">
                Notifications
              </h4>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-stroom-orange/15 text-stroom-deep text-[10px] font-black">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-extrabold text-stroom-deep hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-stroom-borderLight/60 mt-1">
            {notifications.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Bell className="w-8 h-8 mx-auto text-stone-300" />
                <p className="text-xs font-bold text-stroom-black">You're all caught up!</p>
                <p className="text-[11px] text-stroom-charcoal/60 max-w-[200px] mx-auto">
                  Event updates, door stamps, and badge achievements will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                  className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 my-1 ${
                    n.is_read
                      ? 'bg-transparent hover:bg-stroom-ivory'
                      : 'bg-stroom-cream/60 hover:bg-stroom-cream border border-stroom-orange/20 shadow-xs'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white border border-stroom-borderLight flex items-center justify-center shrink-0 shadow-xs">
                    {getIcon(n.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className={`text-xs font-black truncate leading-tight ${n.is_read ? 'text-stroom-black' : 'text-stroom-deep'}`}>
                        {n.title}
                      </h5>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-stroom-orange shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-stroom-charcoal/80 leading-snug mt-1">
                      {n.message}
                    </p>
                    <span className="text-[9px] font-bold text-stroom-charcoal/60 mt-1.5 block">
                      {formatTime(n.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
