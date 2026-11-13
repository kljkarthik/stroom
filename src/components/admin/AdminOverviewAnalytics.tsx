import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { api } from '../../services/api';
import {
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  Calendar,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

type RangeKey = 'today' | '7d' | '30d' | '90d' | 'year' | '12m' | 'custom';
type LineMetricKey = 'all' | 'newMembers' | 'registrations' | 'checkins' | 'eventsPublished';

// STROOM consistent semantic chart palette
const STROOM_PALETTE = [
  '#FF6900', // Primary Orange
  '#17120F', // Deep Black
  '#D9A441', // Gold
  '#8C4315', // Warm Terracotta
  '#241A14', // Dark Brown
  '#756B63', // Secondary Taupe
  '#C45100', // Deep Orange
];

const SEMANTIC_COLORS: Record<string, string> = {
  // Categories
  'Cricket & Sports': '#FF6900',
  'Cricket & Auctions': '#FF6900',
  'Cricket Auctions': '#C45100',
  Gaming: '#17120F',
  'Café Meetups': '#D9A441',
  Movies: '#8C4315',
  'Travel & Getaways': '#241A14',
  'Fitness & Wellness': '#2E7D5B',
  'Social Mixers': '#E58E26',
  // Cities
  Hyderabad: '#FF6900',
  Pune: '#17120F',
  Bangalore: '#D9A441',
  Mumbai: '#8C4315',
  // Registration statuses
  Confirmed: '#FF6900',
  'Checked In': '#10B981',
  Pending: '#D9A441',
  Cancelled: '#756B63',
  // Partner statuses
  Verified: '#10B981',
  Submitted: '#FF6900',
  'Under Review': '#D9A441',
  Rejected: '#DC2626',
  Suspended: '#241A14',
  Draft: '#756B63',
};

function getSegmentColor(label: string, index: number): string {
  return SEMANTIC_COLORS[label] || STROOM_PALETTE[index % STROOM_PALETTE.length];
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

interface DonutCardProps {
  title: string;
  subtitle: string;
  data: { name: string; count: number; percentage: number }[];
  reducedMotion: boolean;
}

const DonutChartCard: React.FC<DonutCardProps> = ({ title, subtitle, data, reducedMotion }) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = useMemo(() => data.reduce((s, d) => s + (d.count || 0), 0), [data]);

  return (
    <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm flex flex-col justify-between gap-3 min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-black text-stroom-black font-display truncate">{title}</h4>
          <p className="text-[11px] text-stroom-charcoal/70 truncate">{subtitle}</p>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-[10px] font-black text-stroom-black shrink-0">
          Total: {total}
        </span>
      </div>

      {data.length === 0 || total === 0 ? (
        <div className="h-56 rounded-2xl bg-stroom-ivory/70 border border-dashed border-stroom-borderLight flex flex-col items-center justify-center text-center p-4">
          <PieChartIcon className="w-6 h-6 text-stone-300 mb-1.5" />
          <p className="text-xs font-bold text-stone-500">No records in selected period</p>
          <p className="text-[10px] text-stone-400 mt-0.5">Try expanding the date range filter above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div className="h-48 w-full min-w-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={2}
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                  isAnimationActive={!reducedMotion}
                  animationDuration={550}
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={getSegmentColor(entry.name, idx)}
                      fillOpacity={activeIndex === undefined || activeIndex === idx ? 1 : 0.45}
                      stroke="#FFFFFF"
                      strokeWidth={activeIndex === idx ? 3 : 2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, props: any) => [
                    `${value} (${props?.payload?.percentage ?? 0}%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: '14px',
                    border: '1px solid #EDE3D8',
                    backgroundColor: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black text-stroom-black font-display leading-none">{total}</span>
              <span className="text-[9px] font-bold uppercase text-stone-400 mt-0.5">Records</span>
            </div>
          </div>

          {/* Wrapped Accessible Legend */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {data.map((entry, idx) => {
              const color = getSegmentColor(entry.name, idx);
              const isActive = activeIndex === idx;
              return (
                <button
                  key={entry.name}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between gap-2 text-[11px] transition-colors ${
                    isActive ? 'bg-stroom-cream border border-stroom-orange/40' : 'bg-stroom-ivory/70 hover:bg-stroom-ivory'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-bold text-stroom-black truncate">{entry.name}</span>
                  </span>
                  <span className="font-mono font-black text-stroom-deep shrink-0">
                    {entry.count} <span className="text-stone-400 font-semibold">({entry.percentage}%)</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface BarCardProps {
  title: string;
  subtitle: string;
  isEmpty: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

const ChartCardShell: React.FC<BarCardProps> = ({ title, subtitle, isEmpty, headerRight, children }) => (
  <div className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm flex flex-col gap-3 min-w-0 overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 className="text-sm font-black text-stroom-black font-display">{title}</h4>
        <p className="text-[11px] text-stroom-charcoal/70">{subtitle}</p>
      </div>
      {headerRight}
    </div>
    {isEmpty ? (
      <div className="h-60 rounded-2xl bg-stroom-ivory/70 border border-dashed border-stroom-borderLight flex flex-col items-center justify-center text-center p-4">
        <BarChart3 className="w-6 h-6 text-stone-300 mb-1.5" />
        <p className="text-xs font-bold text-stone-500">Insufficient database records for this period</p>
        <p className="text-[10px] text-stone-400 mt-0.5">Real data will appear automatically as activity occurs.</p>
      </div>
    ) : (
      <div className="h-64 w-full min-w-0">{children}</div>
    )}
  </div>
);

export const AdminOverviewAnalytics: React.FC = () => {
  const reducedMotion = useReducedMotion();

  const [range, setRange] = useState<RangeKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lineMetric, setLineMetric] = useState<LineMetricKey>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);

  useEffect(() => {
    if (range !== 'custom') {
      loadAnalytics(range);
    }
  }, [range]);

  const loadAnalytics = async (targetRange: RangeKey = range, fromVal = customFrom, toVal = customTo) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminOverviewAnalytics({
        range: targetRange,
        from: targetRange === 'custom' ? fromVal : undefined,
        to: targetRange === 'custom' ? toVal : undefined,
      });
      setAnalytics(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load interactive analytics');
    } finally {
      setLoading(false);
    }
  };

  const charts = analytics?.charts || {};
  const period = analytics?.period || {};
  const filteredSummary = analytics?.filteredSummary || {};

  const tooltipStyle = {
    borderRadius: '14px',
    border: '1px solid #EDE3D8',
    backgroundColor: '#FFFFFF',
    fontSize: '11px',
    fontWeight: 700,
    boxShadow: '0 8px 24px rgba(23,18,15,0.08)',
  };

  return (
    <section className="space-y-5" aria-label="Interactive Platform Analytics Dashboard">
      {/* Global Analytics Filter Header */}
      <div className="p-5 rounded-3xl bg-stroom-cream/70 border border-stroom-borderLight space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-stroom-orange" />
              <h3 className="text-base font-black text-stroom-black font-display">
                Interactive Platform Analytics
              </h3>
            </div>
            <p className="text-[11px] text-stroom-charcoal/75 mt-0.5">
              Real-time database distributions and trends •{' '}
              <span className="font-bold text-stroom-deep">
                Reporting Period: {period.label || 'Loading...'}
              </span>
            </p>
          </div>

          {/* Global Date Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'today', label: 'Today' },
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: '90d', label: 'Last 90 Days' },
              { key: 'year', label: 'This Year' },
              { key: '12m', label: '12 Months' },
              { key: 'custom', label: 'Custom Range' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key as RangeKey)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                  range === opt.key
                    ? 'bg-stroom-orange text-white shadow-brand'
                    : 'bg-white border border-stroom-borderLight text-stroom-charcoal hover:border-stroom-orange'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stroom-borderLight text-xs">
            <Calendar className="w-4 h-4 text-stroom-orange" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Start date"
              className="px-3 py-1.5 rounded-xl bg-white border border-stroom-borderLight font-semibold"
            />
            <span className="text-stone-500 font-bold">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="End date"
              className="px-3 py-1.5 rounded-xl bg-white border border-stroom-borderLight font-semibold"
            />
            <button
              type="button"
              onClick={() => loadAnalytics('custom', customFrom, customTo)}
              className="px-4 py-1.5 rounded-xl bg-stroom-black text-white font-black"
            >
              Apply Range
            </button>
          </div>
        )}

        {/* Filtered Period Summary Strip (explicitly scoped to selected period) */}
        {analytics && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
            {[
              { label: 'Events Created (Period)', value: filteredSummary.eventsCreated ?? 0 },
              { label: 'New Members (Period)', value: filteredSummary.newMembers ?? 0 },
              { label: 'Pass Registrations (Period)', value: filteredSummary.registrations ?? 0 },
              { label: 'Verified Check-ins (Period)', value: filteredSummary.verifiedCheckins ?? 0 },
              { label: 'Active Verified Partners', value: filteredSummary.activePartners ?? 0 },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-2xl bg-white border border-stroom-borderLight">
                <span className="text-[10px] font-bold text-stone-500 block truncate">{item.label}</span>
                <span className="text-base font-black text-stroom-black font-display">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading / Error State */}
      {loading && !analytics ? (
        <div className="p-14 rounded-3xl bg-white border border-stroom-borderLight flex flex-col items-center justify-center text-stone-400">
          <Loader2 className="w-7 h-7 animate-spin text-stroom-orange mb-2" />
          <p className="text-xs font-bold">Compiling interactive analytics from SQLite...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-white border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-red-700 text-xs font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadAnalytics()}
            className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs flex items-center gap-1.5 self-start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Analytics</span>
          </button>
        </div>
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          {/* ROW 1: 4 Interactive Donut / Pie Charts (1 col mobile -> 2 col tablet/desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DonutChartCard
              title="Event Distribution by Category"
              subtitle={`Active & draft events created (${period.label})`}
              data={charts.eventCategoryDistribution || []}
              reducedMotion={reducedMotion}
            />
            <DonutChartCard
              title="Event Distribution by City"
              subtitle={`City spread (${period.label})`}
              data={charts.eventCityDistribution || []}
              reducedMotion={reducedMotion}
            />
            <DonutChartCard
              title="Event Registration Status"
              subtitle={`Confirmed vs Checked In vs Cancelled (${period.label})`}
              data={charts.registrationStatusDistribution || []}
              reducedMotion={reducedMotion}
            />
            <DonutChartCard
              title="Partner Status Distribution"
              subtitle={`Business partner onboarding states (${period.label})`}
              data={charts.partnerStatusDistribution || []}
              reducedMotion={reducedMotion}
            />
          </div>

          {/* ROW 2: Bar Charts — Event Growth & Member Growth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCardShell
              title="Event Growth Over Time"
              subtitle={`Events created per ${period.groupByMonth ? 'month' : 'day'} (${period.label})`}
              isEmpty={(charts.eventGrowth || []).length === 0}
              headerRight={
                <div className="flex items-center gap-1">
                  {(['7d', '30d', '90d', '12m'] as RangeKey[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRange(r)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        range === r ? 'bg-stroom-orange text-white' : 'bg-stroom-ivory text-stone-600 hover:text-stroom-black'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.eventGrowth || []} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DC" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    name="Events Created"
                    fill="#FF6900"
                    radius={[8, 8, 0, 0]}
                    isAnimationActive={!reducedMotion}
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardShell>

            <ChartCardShell
              title="Member Growth Over Time"
              subtitle={`New STROOM signups per ${period.groupByMonth ? 'month' : 'day'} (${period.label})`}
              isEmpty={(charts.memberGrowth || []).length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.memberGrowth || []} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DC" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    name="New Members"
                    fill="#17120F"
                    radius={[8, 8, 0, 0]}
                    isAnimationActive={!reducedMotion}
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardShell>
          </div>

          {/* ROW 3: Bar Charts — City-wise Comparison & Attendance vs Registrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCardShell
              title="City-wise Event & Registration Comparison"
              subtitle="Side-by-side activity across STROOM cities"
              isEmpty={(charts.cityEventComparison || []).every((c: any) => c.events === 0 && c.registrations === 0)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.cityEventComparison || []} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DC" vertical={false} />
                  <XAxis dataKey="city" tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="events" name="Events" fill="#FF6900" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                  <Bar dataKey="registrations" name="Registrations" fill="#D9A441" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                  <Bar dataKey="checkins" name="Verified Check-ins" fill="#10B981" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardShell>

            <ChartCardShell
              title="Event Attendance vs Registrations"
              subtitle="Clearly compares confirmed passes against actual door scanner check-ins"
              isEmpty={(charts.attendanceComparison || []).length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.attendanceComparison || []} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DC" vertical={false} />
                  <XAxis dataKey="shortTitle" tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.eventTitle || ''}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="registrations" name="Registered Passes" fill="#FF6900" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                  <Bar dataKey="checkedIn" name="Verified Check-ins" fill="#10B981" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardShell>
          </div>

          {/* ROW 4: Partner Performance Bar Chart + Platform Activity Line Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCardShell
              title="Partner Performance (Real Activity)"
              subtitle="Verified partner venues, hosted events, and actual coupon redemptions"
              isEmpty={(charts.partnerPerformance || []).length === 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.partnerPerformance || []} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DC" vertical={false} />
                  <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload ? `${payload[0].payload.partnerName} (${payload[0].payload.city})` : ''
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="venuesCount" name="Venues" fill="#241A14" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                  <Bar dataKey="hostedEvents" name="Hosted Events" fill="#FF6900" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                  <Bar dataKey="couponRedemptions" name="Coupon Redemptions" fill="#D9A441" radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardShell>

            <ChartCardShell
              title="Platform Activity Over Time"
              subtitle={`Chronological trend across ${period.label}`}
              isEmpty={(charts.activityTimeline || []).length === 0}
              headerRight={
                <select
                  value={lineMetric}
                  onChange={(e) => setLineMetric(e.target.value as LineMetricKey)}
                  aria-label="Select platform activity metric"
                  className="px-2.5 py-1 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-[11px] font-black text-stroom-black outline-none focus:border-stroom-orange"
                >
                  <option value="all">All Activity Metrics</option>
                  <option value="newMembers">New Members</option>
                  <option value="registrations">Event Registrations</option>
                  <option value="checkins">Verified Check-ins</option>
                  <option value="eventsPublished">Events Published</option>
                </select>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.activityTimeline || []} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE6DC" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#756B63', fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  {(lineMetric === 'all' || lineMetric === 'newMembers') && (
                    <Line
                      type="monotone"
                      dataKey="newMembers"
                      name="New Members"
                      stroke="#17120F"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={!reducedMotion}
                    />
                  )}
                  {(lineMetric === 'all' || lineMetric === 'registrations') && (
                    <Line
                      type="monotone"
                      dataKey="registrations"
                      name="Registrations"
                      stroke="#FF6900"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={!reducedMotion}
                    />
                  )}
                  {(lineMetric === 'all' || lineMetric === 'checkins') && (
                    <Line
                      type="monotone"
                      dataKey="checkins"
                      name="Verified Check-ins"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={!reducedMotion}
                    />
                  )}
                  {(lineMetric === 'all' || lineMetric === 'eventsPublished') && (
                    <Line
                      type="monotone"
                      dataKey="eventsPublished"
                      name="Events Published"
                      stroke="#D9A441"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={!reducedMotion}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartCardShell>
          </div>
        </div>
      )}
    </section>
  );
};
