import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AdminOverviewAnalytics } from './AdminOverviewAnalytics';
import {
  Users,
  Calendar,
  CheckCircle2,
  Ticket,
  Building2,
  MapPin,
  Trophy,
  Compass,
  Plus,
  ScanLine,
  Bell,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

interface AdminOverviewPanelProps {
  allowedSections: string[];
  permissions: string[];
  onNavigateSection: (section: string) => void;
}

export const AdminOverviewPanel: React.FC<AdminOverviewPanelProps> = ({
  allowedSections,
  permissions,
  onNavigateSection,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminDashboardOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load platform overview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-stone-400">
        <Loader2 className="w-7 h-7 animate-spin text-stroom-orange mb-2" />
        <p className="text-xs font-bold">Loading real-time platform telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-3xl bg-white border border-red-200 text-center space-y-3">
        <p className="text-xs font-bold text-red-600">{error || 'Unable to load overview'}</p>
        <button onClick={loadOverview} className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs">
          Retry
        </button>
      </div>
    );
  }

  const m = data.metrics || {};
  const act = data.activity || {};

  const quickActions = [
    { label: 'Create Event', section: 'events', perm: 'events.create', icon: Plus },
    { label: 'Add Community', section: 'communities', perm: 'communities.manage', icon: Users },
    { label: 'Verify Partners', section: 'partners', perm: 'partners.verify', icon: Building2 },
    { label: 'Manage Venues', section: 'venues', perm: 'venues.manage', icon: MapPin },
    { label: 'Open Door Check-in', section: 'checkin', perm: 'checkin.access', icon: ScanLine },
    { label: 'Publish Announcement', section: 'notifications', perm: 'notifications.manage', icon: Bell },
  ].filter((q) => allowedSections.includes(q.section) && permissions.includes(q.perm));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">Platform Operations Overview</h2>
          <p className="text-xs text-stroom-charcoal/70">
            Live SQLite metrics across members, events, communities, partners, and check-ins. Active members: {m.activePeriodLabel}.
          </p>
        </div>
        <button
          onClick={loadOverview}
          className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-stroom-orange" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* System Alerts */}
      {Array.isArray(act.systemAlerts) && act.systemAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {act.systemAlerts.map((alert: any, idx: number) => (
            <button
              key={idx}
              onClick={() => allowedSections.includes(alert.targetSection) && onNavigateSection(alert.targetSection)}
              className="p-4 rounded-2xl bg-amber-50 border border-amber-200 hover:border-stroom-orange text-left transition-all flex items-start gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-900">{alert.title}</p>
                <p className="text-[11px] text-amber-800/80 mt-0.5">{alert.detail}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* KPI Grid (Strictly Separating Registrations vs Verified Check-ins) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-black uppercase">Members</span>
            <Users className="w-4 h-4 text-stroom-orange" />
          </div>
          <p className="text-2xl font-black text-stroom-black font-display">{m.totalMembers ?? 0}</p>
          <p className="text-[10px] text-stone-500 mt-1">{m.activeMembers30d ?? 0} active (30d)</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-black uppercase">Events</span>
            <Calendar className="w-4 h-4 text-stroom-orange" />
          </div>
          <p className="text-2xl font-black text-stroom-black font-display">{m.totalEvents ?? 0}</p>
          <p className="text-[10px] text-stone-500 mt-1">{m.upcomingEvents ?? 0} live/upcoming • {m.completedEvents ?? 0} done</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-black uppercase">Registrations</span>
            <Ticket className="w-4 h-4 text-stroom-orange" />
          </div>
          <p className="text-2xl font-black text-stroom-deep font-display">{m.totalRegistrations ?? 0}</p>
          <p className="text-[10px] text-stone-500 mt-1">Confirmed event passes</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 mb-1.5">
            <span className="text-[10px] font-black uppercase">Verified Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 font-display">{m.totalVerifiedAttendance ?? 0}</p>
          <p className="text-[10px] text-emerald-700 mt-1">Door scanner check-ins</p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-black uppercase">Ecosystem</span>
            <Building2 className="w-4 h-4 text-stroom-orange" />
          </div>
          <p className="text-2xl font-black text-stroom-black font-display">{m.verifiedPartners ?? 0} Partners</p>
          <p className="text-[10px] text-stone-500 mt-1">{m.activeVenues ?? 0} venues • {m.totalCommunities ?? 0} communities</p>
        </div>
      </div>

      {/* Authorized Quick Actions */}
      {quickActions.length > 0 && (
        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-3">Quick Administrative Shortcuts</h3>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  onClick={() => onNavigateSection(qa.section)}
                  className="px-3.5 py-2 rounded-xl bg-stroom-ivory hover:bg-stroom-orange hover:text-white border border-stroom-borderLight text-xs font-extrabold text-stroom-black transition-all flex items-center gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5 text-stroom-orange group-hover:text-white" />
                  <span>{qa.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Analytics Dashboard (Pie Charts, Bar Graphs, Line Trends) */}
      <AdminOverviewAnalytics />

      {/* Activity Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
            <h4 className="text-sm font-black text-stroom-black font-display">Recent Registrations & Door Check-ins</h4>
            {allowedSections.includes('checkin') && (
              <button onClick={() => onNavigateSection('checkin')} className="text-[11px] font-bold text-stroom-orange hover:underline flex items-center gap-1">
                <span>Check-in Terminal</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="space-y-2 text-xs">
            {(act.recentRegistrations || []).map((r: any) => (
              <div key={r.id} className="p-2.5 rounded-xl bg-stroom-ivory flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-stroom-black truncate">{r.member_name} — {r.event_title}</p>
                  <p className="text-[10px] font-mono text-stone-500">{r.pass_code}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                  r.checkin_status === 'checked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {r.checkin_status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stroom-borderLight">
            <h4 className="text-sm font-black text-stroom-black font-display">Partner Applications</h4>
            {allowedSections.includes('partners') && (
              <button onClick={() => onNavigateSection('partners')} className="text-[11px] font-bold text-stroom-orange hover:underline flex items-center gap-1">
                <span>Partner Queue</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="space-y-2 text-xs">
            {(act.partnerApplications || []).slice(0, 4).map((p: any) => (
              <div key={p.id} className="p-2.5 rounded-xl bg-stroom-ivory flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-stroom-black truncate">{p.business_name}</p>
                  <p className="text-[10px] text-stone-500">{p.category} • {p.city}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep text-[10px] font-black uppercase shrink-0">
                  {p.verification_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
