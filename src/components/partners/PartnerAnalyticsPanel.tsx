import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  Ticket,
  CheckCircle2,
  Percent,
  ShoppingBag,
  Loader2,
  Filter
} from 'lucide-react';

interface PartnerAnalyticsPanelProps {
  partnerId: string;
  venues: any[];
}

export const PartnerAnalyticsPanel: React.FC<PartnerAnalyticsPanelProps> = ({ partnerId, venues }) => {
  const [range, setRange] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [venueFilter, setVenueFilter] = useState('all');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingType, setExportingType] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [partnerId, range, venueFilter]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPartnerAnalytics(partnerId, {
        range: range === 'all' ? undefined : range,
        from: range === 'custom' ? fromDate : undefined,
        to: range === 'custom' ? toDate : undefined,
        venueId: venueFilter !== 'all' ? venueFilter : undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load analytics from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (type: 'events' | 'campaigns' | 'redemptions') => {
    setExportingType(type);
    try {
      const res = await api.exportPartnerReport(partnerId, {
        type,
        range: range === 'all' ? undefined : range,
        from: range === 'custom' ? fromDate : undefined,
        to: range === 'custom' ? toDate : undefined,
      });
      if (res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.filename || `stroom-partner-${type}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExportingType(null);
    }
  };

  const summary = data?.summary || {};
  const eventsPerf = data?.eventsPerformance || [];
  const campaignsPerf = data?.campaignsPerformance || [];
  const checkinsByDate = data?.checkinsByDate || [];
  const maxCheckin = Math.max(1, ...checkinsByDate.map((d: any) => d.checkins || 0));

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-stroom-black font-display">
            Footfall, Campaign & Engagement Analytics
          </h3>
          <p className="text-xs text-stroom-charcoal/70">
            Strictly separates estimated capacity, confirmed passes, verified door check-ins, and verified cashier redemptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!exportingType}
            onClick={() => handleExportCsv('events')}
            className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-extrabold text-stroom-black flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-stroom-orange" />
            <span>{exportingType === 'events' ? 'Exporting...' : 'Export Events CSV'}</span>
          </button>
          <button
            type="button"
            disabled={!!exportingType}
            onClick={() => handleExportCsv('campaigns')}
            className="px-3.5 py-2 rounded-xl bg-white border border-stroom-borderLight hover:border-stroom-orange text-xs font-extrabold text-stroom-black flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-stroom-orange" />
            <span>{exportingType === 'campaigns' ? 'Exporting...' : 'Export Campaigns CSV'}</span>
          </button>
          <button
            type="button"
            disabled={!!exportingType}
            onClick={() => handleExportCsv('redemptions')}
            className="px-3.5 py-2 rounded-xl bg-stroom-black text-white hover:bg-stroom-orange text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingType === 'redemptions' ? 'Exporting...' : 'Export Redemptions CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="p-4 rounded-2xl bg-white border border-stroom-borderLight flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-stroom-orange mr-1" />
          {[
            { id: 'all', label: 'All Time' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: '90d', label: 'Last 90 Days' },
            { id: 'custom', label: 'Custom Range' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                range === opt.id ? 'bg-stroom-orange text-white shadow-xs' : 'bg-stroom-ivory text-stone-600 hover:text-stroom-black'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {range === 'custom' && (
            <>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-stroom-borderLight font-bold"
              />
              <span className="text-stone-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-stroom-borderLight font-bold"
              />
              <button
                type="button"
                onClick={loadAnalytics}
                className="px-3 py-1.5 rounded-xl bg-stroom-black text-white font-bold"
              >
                Apply
              </button>
            </>
          )}

          <select
            value={venueFilter}
            onChange={(e) => setVenueFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-stroom-borderLight font-bold bg-stroom-ivory"
          >
            <option value="all">All Partner Locations</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-stone-400">
          <Loader2 className="w-7 h-7 animate-spin text-stroom-orange" />
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-red-50 border border-red-200 text-center space-y-3">
          <p className="text-xs font-bold text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadAnalytics}
            className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs"
          >
            Retry Loading Analytics
          </button>
        </div>
      ) : (
        <>
          {/* Separated Verified vs Estimated KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
              <div className="flex items-center justify-between text-stone-500 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider">Expected Attendance</span>
                <Users className="w-4 h-4 text-stone-400" />
              </div>
              <p className="text-2xl font-black text-stroom-black font-display">{summary.expectedAttendance ?? 0}</p>
              <p className="text-[10px] text-stone-500 mt-1">Estimated event seat capacity</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
              <div className="flex items-center justify-between text-stone-500 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider">Confirmed Passes</span>
                <Ticket className="w-4 h-4 text-stroom-orange" />
              </div>
              <p className="text-2xl font-black text-stroom-deep font-display">{summary.confirmedRegistrations ?? 0}</p>
              <p className="text-[10px] text-stone-500 mt-1">Active registrations (not footfall)</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between text-emerald-700 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider">Actual Check-Ins</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700 font-display">{summary.actualVerifiedCheckins ?? 0}</p>
              <p className="text-[10px] text-emerald-700 mt-1 font-semibold">
                {typeof summary.attendanceRate === 'number' ? `${summary.attendanceRate}% turnout vs registrations` : 'No verified check-ins yet'}
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
              <div className="flex items-center justify-between text-stone-500 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider">Coupon Redemptions</span>
                <Percent className="w-4 h-4 text-stroom-orange" />
              </div>
              <p className="text-2xl font-black text-stroom-black font-display">{summary.couponRedemptions ?? 0}</p>
              <p className="text-[10px] text-stone-500 mt-1">
                {typeof summary.redemptionRate === 'number' ? `${summary.redemptionRate}% of ${summary.couponsIssued} issued` : 'No coupons issued'}
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm">
              <div className="flex items-center justify-between text-stone-500 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider">Verified Purchases</span>
                <ShoppingBag className="w-4 h-4 text-stroom-gold" />
              </div>
              <p className="text-2xl font-black text-stroom-black font-display">
                {typeof summary.verifiedPurchaseTotal === 'number' ? `₹${summary.verifiedPurchaseTotal.toLocaleString('en-IN')}` : 'Not available'}
              </p>
              <p className="text-[10px] text-stone-500 mt-1">
                {summary.verifiedPurchasesCount > 0 ? `${summary.verifiedPurchasesCount} verified POS bills` : 'Logged only when cashier records bill'}
              </p>
            </div>
          </div>

          {/* Check-ins by Date Visualization */}
          <div className="p-6 rounded-3xl bg-white border border-stroom-borderLight shadow-sm space-y-4">
            <h4 className="text-sm font-black text-stroom-black font-display flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-stroom-orange" />
              <span>Verified Door Check-Ins by Date</span>
            </h4>
            {checkinsByDate.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center bg-stroom-ivory rounded-2xl">
                No verified door check-ins recorded in this date filter yet.
              </p>
            ) : (
              <div className="flex items-end gap-3 h-40 pt-4 px-2 overflow-x-auto">
                {checkinsByDate.map((row: any) => {
                  const heightPct = Math.max(12, Math.round((row.checkins / maxCheckin) * 100));
                  return (
                    <div key={row.date} className="flex flex-col items-center justify-end gap-1.5 min-w-[56px] h-full">
                      <span className="text-xs font-black text-stroom-deep">{row.checkins}</span>
                      <div
                        className="w-8 rounded-t-xl bg-gradient-to-t from-stroom-deep to-stroom-orange transition-all"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[10px] font-mono text-stone-500">{row.date?.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Event-wise Performance Table */}
          <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <h4 className="text-sm font-black text-stroom-black font-display">Event-Wise Performance</h4>
              <span className="text-[10px] font-bold text-stone-500 uppercase">{eventsPerf.length} Events</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stroom-ivory text-[10px] font-extrabold uppercase text-stone-500">
                  <tr>
                    <th className="p-4">Event</th>
                    <th className="p-4">Venue</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Expected Cap</th>
                    <th className="p-4">Registrations</th>
                    <th className="p-4">Verified Check-Ins</th>
                    <th className="p-4">Turnout %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroom-borderLight">
                  {eventsPerf.map((ev: any) => (
                    <tr key={ev.id} className="hover:bg-stroom-ivory/40">
                      <td className="p-4 font-extrabold text-stroom-black">{ev.title}</td>
                      <td className="p-4 text-stone-600">{ev.venue_name}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-[10px] font-black uppercase">{ev.status}</span>
                      </td>
                      <td className="p-4 font-bold">{ev.expected_attendance}</td>
                      <td className="p-4 font-bold text-stroom-deep">{ev.confirmed_registrations}</td>
                      <td className="p-4 font-black text-emerald-700">{ev.actual_checkins}</td>
                      <td className="p-4 font-bold">
                        {typeof ev.attendance_rate === 'number' ? `${ev.attendance_rate}%` : 'Not available'}
                      </td>
                    </tr>
                  ))}
                  {eventsPerf.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-400">No events recorded in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Campaign Performance Table */}
          <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <h4 className="text-sm font-black text-stroom-black font-display">Campaign & Offer Performance</h4>
              <span className="text-[10px] font-bold text-stone-500 uppercase">{campaignsPerf.length} Campaigns</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stroom-ivory text-[10px] font-extrabold uppercase text-stone-500">
                  <tr>
                    <th className="p-4">Code</th>
                    <th className="p-4">Campaign Title</th>
                    <th className="p-4">Approval Status</th>
                    <th className="p-4">Issued Limit</th>
                    <th className="p-4">Redeemed</th>
                    <th className="p-4">Verified Purchases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroom-borderLight">
                  {campaignsPerf.map((c: any) => (
                    <tr key={c.id} className="hover:bg-stroom-ivory/40">
                      <td className="p-4 font-mono font-bold text-stroom-deep">{c.code}</td>
                      <td className="p-4 font-bold text-stroom-black">{c.title}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-stroom-cream text-[10px] font-black uppercase">{c.approval_status}</span>
                      </td>
                      <td className="p-4 font-bold">{c.max_redemptions}</td>
                      <td className="p-4 font-black text-emerald-700">{c.actual_redemptions}</td>
                      <td className="p-4 font-bold">
                        {c.verified_purchases_count > 0 ? `₹${c.verified_purchase_total} (${c.verified_purchases_count})` : 'Not available'}
                      </td>
                    </tr>
                  ))}
                  {campaignsPerf.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-400">No campaigns recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
