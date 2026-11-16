import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  BarChart3,
  Download,
  Sliders,
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Shield,
  Lock,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AdminAnalyticsSettingsAuditPanelProps {
  mode: 'analytics' | 'settings' | 'audit_logs';
  permissions: string[];
}

const REPORT_EXPORTS = [
  { type: 'events', label: 'Events Report (CSV)' },
  { type: 'registrations', label: 'Registrations (CSV)' },
  { type: 'attendance', label: 'Attendance & Check-ins (CSV)' },
  { type: 'members', label: 'Members Directory (CSV)' },
  { type: 'partners', label: 'Partners List (CSV)' },
  { type: 'campaigns', label: 'Campaign Redemptions (CSV)' },
];

export const AdminAnalyticsSettingsAuditPanel: React.FC<AdminAnalyticsSettingsAuditPanelProps> = ({
  mode,
}) => {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Analytics state
  const [cities, setCities] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [range, setRange] = useState('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportingType, setExportingType] = useState<string | null>(null);

  // Settings state
  const [settingsMap, setSettingsMap] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Audit logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'analytics') {
      api.getCities().then((r) => setCities(r.cities || [])).catch(() => {});
      loadAnalytics();
    } else if (mode === 'settings') {
      loadSettings();
    } else {
      loadAuditLogs();
    }
  }, [mode, range, cityFilter, categoryFilter, statusFilter]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAnalytics({
        range,
        from: range === 'custom' ? fromDate : undefined,
        to: range === 'custom' ? toDate : undefined,
        city: cityFilter,
        category: categoryFilter,
        status: statusFilter,
      });
      setAnalytics(res);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load analytics' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (type: string) => {
    setExportingType(type);
    setBanner(null);
    try {
      const res = await api.exportAdminReport(type);
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `stroom-${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBanner({ type: 'success', message: `Downloaded ${res.filename}.` });
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Export failed' });
    } finally {
      setExportingType(null);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminSettings();
      setSettingsMap(res.settings || {});
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load platform settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (settingKey: string, fieldKey: string, newVal: any) => {
    setSettingsMap((prev) => ({
      ...prev,
      [settingKey]: {
        ...prev[settingKey],
        value: {
          ...(prev[settingKey]?.value || {}),
          [fieldKey]: newVal,
        },
      },
    }));
  };

  const handleSaveSettingGroup = async (settingKey: string) => {
    const entry = settingsMap[settingKey];
    if (!entry) return;
    setSavingKey(settingKey);
    setBanner(null);
    try {
      const res = await api.updateAdminSettings(settingKey, entry.value);
      setBanner({ type: 'success', message: res.message || `Saved ${entry.category}` });
      loadSettings();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to update settings' });
    } finally {
      setSavingKey(null);
    }
  };

  const loadAuditLogs = async (overrideActor?: string) => {
    setLoading(true);
    try {
      const res = await api.getAdminAuditLogs({
        action: actionFilter,
        entity_type: entityFilter,
        actor: overrideActor !== undefined ? overrideActor : actorFilter,
      });
      setLogs(res.logs || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load audit logs' });
    } finally {
      setLoading(false);
    }
  };

  const formatFieldLabel = (key: string) =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">
            {mode === 'analytics'
              ? 'Platform Analytics & CSV Exports'
              : mode === 'settings'
              ? 'Platform Operational Settings'
              : 'Immutable Admin Audit Trail'}
          </h2>
          <p className="text-xs text-stroom-charcoal/70">
            {mode === 'analytics'
              ? 'Real SQLite breakdowns across cities, categories, attendance rates, member growth, and partners.'
              : mode === 'settings'
              ? 'Configure operational rules for General, Events, Members, Partners, and Notifications.'
              : 'Read-only chronological trail of every privileged login, role change, moderation decision, check-in, and setting update.'}
          </p>
        </div>

        <button
          onClick={() =>
            mode === 'analytics' ? loadAnalytics() : mode === 'settings' ? loadSettings() : loadAuditLogs()
          }
          className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 text-stroom-orange" />
          <span>Refresh</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ANALYTICS MODE */}
      {mode === 'analytics' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="p-4 rounded-3xl bg-white border border-stroom-borderLight grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
            >
              <option value="all">All Cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
            >
              <option value="all">All Categories</option>
              <option value="cricket">Cricket</option>
              <option value="social">Social</option>
              <option value="gaming">Gaming</option>
              <option value="cafe">Cafe</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
            >
              <option value="all">All Event Statuses</option>
              <option value="published">Published</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {range === 'custom' ? (
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-1/2 px-2 py-1.5 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-[11px]"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-1/2 px-2 py-1.5 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-[11px]"
                />
              </div>
            ) : (
              <button
                onClick={loadAnalytics}
                className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black"
              >
                Apply Filters
              </button>
            )}
          </div>

          {range === 'custom' && (
            <div className="flex justify-end">
              <button
                onClick={loadAnalytics}
                className="px-5 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs"
              >
                Run Custom Date Query
              </button>
            </div>
          )}

          {/* CSV Report Exports */}
          <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-stroom-orange" />
              <h3 className="text-sm font-black text-stroom-black">Export Operational Reports (CSV)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {REPORT_EXPORTS.map((r) => (
                <button
                  key={r.type}
                  disabled={exportingType === r.type}
                  onClick={() => handleExportCsv(r.type)}
                  className="px-3.5 py-2 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-stroom-orange" />
                  <span>{exportingType === r.type ? 'Exporting...' : r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {loading || !analytics ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* City Activity */}
              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
                <h3 className="text-sm font-black text-stroom-black flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-stroom-orange" />
                  <span>City Performance Breakdown</span>
                </h3>
                <div className="space-y-2.5">
                  {(analytics.cityActivity || []).map((c: any) => (
                    <div key={c.city_name} className="p-3 rounded-2xl bg-stroom-ivory text-xs flex items-center justify-between">
                      <div>
                        <div className="font-black text-stroom-black">{c.city_name}</div>
                        <div className="text-[11px] text-stone-500">
                          {c.events_count} Events • {c.communities_count} Clubs
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-stroom-orange">{c.registrations_count} Regs</div>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          {c.verified_checkins_count} Checked In
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Performance */}
              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
                <h3 className="text-sm font-black text-stroom-black">Category Engagement</h3>
                {(analytics.categoryPerformance || []).length === 0 ? (
                  <p className="text-xs text-stone-400">No events match current filters.</p>
                ) : (
                  <div className="space-y-2.5">
                    {analytics.categoryPerformance.map((cat: any) => {
                      const pct =
                        cat.registrations_count > 0
                          ? Math.round((cat.verified_checkins_count / cat.registrations_count) * 100)
                          : 0;
                      return (
                        <div key={cat.category} className="p-3 rounded-2xl bg-stroom-ivory text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-black">
                            <span className="uppercase">{cat.category}</span>
                            <span>
                              {cat.events_count} Events • {cat.registrations_count} Passes ({pct}% attended)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-white overflow-hidden">
                            <div
                              className="h-full bg-stroom-orange rounded-full"
                              style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ecosystem & Partner Summary */}
              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
                <h3 className="text-sm font-black text-stroom-black">Partners & Campaigns</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-stroom-ivory">
                    <div className="text-stone-500 font-bold">Verified Partners</div>
                    <div className="text-xl font-black text-stroom-black mt-1">
                      {analytics.partnerAndCampaignStats?.verifiedPartners ?? 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stroom-ivory">
                    <div className="text-stone-500 font-bold">Active Collaborations</div>
                    <div className="text-xl font-black text-stroom-black mt-1">
                      {analytics.partnerAndCampaignStats?.activeCollaborations ?? 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stroom-ivory">
                    <div className="text-stone-500 font-bold">Coupon Redemptions</div>
                    <div className="text-xl font-black text-stroom-black mt-1">
                      {analytics.partnerAndCampaignStats?.totalCouponRedemptions ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Growth & Registration Trends */}
              <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-3">
                <h3 className="text-sm font-black text-stroom-black">Recent Daily Activity Trend</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[11px] font-black uppercase text-stone-500 mb-2">Member Signups</div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {(analytics.memberGrowth || []).length === 0 ? (
                        <p className="text-stone-400">No signups in range.</p>
                      ) : (
                        analytics.memberGrowth.map((g: any) => (
                          <div key={g.date} className="flex justify-between p-2 rounded-xl bg-stroom-ivory">
                            <span className="font-mono">{g.date}</span>
                            <span className="font-black text-stroom-orange">+{g.signups}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase text-stone-500 mb-2">Pass Registrations</div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {(analytics.registrationTrends || []).length === 0 ? (
                        <p className="text-stone-400">No passes in range.</p>
                      ) : (
                        analytics.registrationTrends.map((t: any) => (
                          <div key={t.date} className="flex justify-between p-2 rounded-xl bg-stroom-ivory">
                            <span className="font-mono">{t.date}</span>
                            <span className="font-black text-emerald-700">
                              {t.registrations} ({t.checkins} in)
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS MODE */}
      {mode === 'settings' && (
        <>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Object.entries(settingsMap).map(([key, group]: [string, any]) => (
                <div
                  key={key}
                  className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm flex flex-col justify-between gap-4 text-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-stroom-orange" />
                          <h3 className="text-sm font-black text-stroom-black">{group.category || key}</h3>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">{group.description}</p>
                      </div>
                      {group.updated_by && (
                        <span className="text-[10px] text-stone-400 font-mono">By {group.updated_by}</span>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-stroom-borderLight">
                      {Object.entries(group.value || {}).map(([fieldKey, val]) => (
                        <div key={fieldKey}>
                          {typeof val === 'boolean' ? (
                            <label className="flex items-center justify-between p-2.5 rounded-xl bg-stroom-ivory cursor-pointer">
                              <span className="font-bold text-stroom-black">{formatFieldLabel(fieldKey)}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                onChange={(e) => handleFieldChange(key, fieldKey, e.target.checked)}
                                className="w-4 h-4 accent-stroom-orange"
                              />
                            </label>
                          ) : typeof val === 'number' ? (
                            <div>
                              <label className="block font-bold text-stroom-black mb-1">
                                {formatFieldLabel(fieldKey)}
                              </label>
                              <input
                                type="number"
                                value={val}
                                onChange={(e) => handleFieldChange(key, fieldKey, Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none focus:border-stroom-orange"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block font-bold text-stroom-black mb-1">
                                {formatFieldLabel(fieldKey)}
                              </label>
                              <input
                                type="text"
                                value={String(val ?? '')}
                                onChange={(e) => handleFieldChange(key, fieldKey, e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none focus:border-stroom-orange"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSaveSettingGroup(key)}
                    disabled={savingKey === key}
                    className="w-full py-2.5 rounded-2xl bg-stroom-black hover:bg-stroom-orange text-white font-black flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingKey === key ? 'Saving...' : `Save ${group.category || key}`}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* AUDIT LOGS MODE */}
      {mode === 'audit_logs' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-stroom-cream/70 border border-stroom-orange/30 text-xs flex items-center gap-2 text-stroom-black font-bold">
            <Lock className="w-4 h-4 text-stroom-orange shrink-0" />
            <span>
              Immutability Guarantee: Audit records cannot be edited or deleted via any API endpoint. All privileged logins, overrides, and rejections are preserved chronologically.
            </span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-stroom-borderLight grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadAuditLogs(e.currentTarget.value);
                }}
                placeholder="Filter by actor name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
            >
              <option value="all">All Action Types</option>
              <option value="ADMIN_LOGIN">Admin Logins</option>
              <option value="PRIVILEGE_ESCALATION_BLOCKED">Blocked Escalations</option>
              <option value="MEMBER_ROLE_CHANGED">Role Changes</option>
              <option value="MEMBER_SUSPENDED">Suspensions</option>
              <option value="EVENT_">Event Changes</option>
              <option value="DOOR_CHECKIN">Door Check-ins & Overrides</option>
              <option value="PARTNER_">Partner Approvals</option>
              <option value="POST_MODERATION">Post Moderation</option>
              <option value="PAYMENT_REFUNDED">Payment Refunds</option>
              <option value="PLATFORM_SETTINGS_UPDATED">Settings Changes</option>
            </select>

            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
            >
              <option value="all">All Target Entities</option>
              <option value="user">Users / Members</option>
              <option value="event">Events</option>
              <option value="registration">Registrations / Passes</option>
              <option value="community">Communities</option>
              <option value="community_post">Moderation Posts</option>
              <option value="partner">Partners</option>
              <option value="venue">Venues</option>
              <option value="platform_settings">Settings</option>
            </select>

            <button
              onClick={() => loadAuditLogs()}
              className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black"
            >
              Filter Audit Logs
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No audit events matched the selected filters.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-white border border-stroom-borderLight shadow-sm text-xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            log.result === 'denied'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {log.result || 'success'}
                        </span>
                        <span className="font-mono font-black text-stroom-black">{log.action}</span>
                        <span className="text-stone-400">•</span>
                        <span className="font-bold text-stroom-orange">
                          {log.entity_type}:{log.entity_id || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500">
                        <Shield className="w-3.5 h-3.5 text-stroom-orange" />
                        <span className="font-bold text-stroom-black">{log.resolved_actor_name}</span>
                        {log.actor_role && <span className="font-mono">({log.actor_role})</span>}
                        <span>• {log.created_at}</span>
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="p-1 rounded hover:bg-stroom-ivory"
                          title="Inspect payload diff"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-stroom-borderLight font-mono text-[11px]">
                        <div className="p-2.5 rounded-xl bg-stroom-ivory overflow-x-auto">
                          <div className="font-black text-stone-500 mb-1">Before</div>
                          <pre className="whitespace-pre-wrap">{log.before_json || 'null'}</pre>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stroom-ivory overflow-x-auto">
                          <div className="font-black text-stone-500 mb-1">After</div>
                          <pre className="whitespace-pre-wrap">{log.after_json || 'null'}</pre>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stroom-ivory overflow-x-auto">
                          <div className="font-black text-stone-500 mb-1">Metadata</div>
                          <pre className="whitespace-pre-wrap">{log.details || 'null'}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
