import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Users,
  Search,
  Shield,
  Eye,
  Award,
  Ban,
  CheckCircle2,
  Loader2,
  X,
  Ticket,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface AdminMembersRolesPanelProps {
  permissions: string[];
  currentUserId?: string;
  currentUserRole?: string;
}

const ROLE_OPTIONS = [
  { value: 'participant', label: 'Participant' },
  { value: 'user', label: 'Member (Legacy)' },
  { value: 'checkin_staff', label: 'Door Check-in Staff' },
  { value: 'auctioneer', label: 'Auctioneer' },
  { value: 'auction_manager', label: 'Auction Manager' },
  { value: 'event_manager', label: 'Event Manager' },
  { value: 'community_manager', label: 'Community Manager' },
  { value: 'partner_manager', label: 'Partner Manager' },
  { value: 'support_staff', label: 'Support Staff' },
  { value: 'venue_partner', label: 'Venue Partner' },
  { value: 'platform_admin', label: 'Platform Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const BADGE_OPTIONS = [
  { key: 'FIRST_EXPERIENCE', label: 'First Experience' },
  { key: 'THREE_EVENTS', label: 'Three Events Veteran' },
  { key: 'CITY_EXPLORER', label: 'City Explorer' },
  { key: 'AUCTION_PLAYER', label: 'Auction Player' },
  { key: 'COMMUNITY_BUILDER', label: 'Community Builder' },
  { key: 'AUCTION_CHAMPION', label: 'Auction Champion' },
  { key: 'VERIFIED_MEMBER', label: 'Verified STROOM Member' },
];

export const AdminMembersRolesPanel: React.FC<AdminMembersRolesPanelProps> = ({
  permissions,
  currentUserId,
  currentUserRole,
}) => {
  const [subTab, setSubTab] = useState<'directory' | 'matrix'>('directory');
  const [members, setMembers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 15;

  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('created_at');
  const [cities, setCities] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inspection modal state
  const [inspectMemberId, setInspectMemberId] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState('FIRST_EXPERIENCE');
  const [awarding, setAwarding] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  // Roles matrix state
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const canManageMembers = permissions.includes('members.manage');
  const canAssignRoles = permissions.includes('roles.assign');

  useEffect(() => {
    api.getCities().then((r) => setCities(r.cities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (subTab === 'directory') {
      loadDirectory();
    } else {
      loadMatrix();
    }
  }, [subTab, page, city, roleFilter, statusFilter, sort]);

  const loadDirectory = async (overrideSearch?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminMembersDirectory({
        search: overrideSearch !== undefined ? overrideSearch : search,
        city,
        role: roleFilter,
        status: statusFilter,
        sort,
        page,
        limit,
      });
      setMembers(res.members || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load members directory');
    } finally {
      setLoading(false);
    }
  };

  const loadMatrix = async () => {
    setLoadingMatrix(true);
    try {
      const res = await api.getAdminRolesMatrix();
      setMatrix(res.matrix || {});
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load permissions matrix' });
    } finally {
      setLoadingMatrix(false);
    }
  };

  const openInspect = async (memberId: string) => {
    setInspectMemberId(memberId);
    setInspectData(null);
    setSuspendReason('');
    setLoadingInspect(true);
    try {
      const res = await api.getAdminMemberDetails(memberId);
      setInspectData(res);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Unable to inspect member profile' });
      setInspectMemberId(null);
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setBanner(null);
    try {
      await api.assignAdminMemberRole(memberId, newRole);
      setBanner({ type: 'success', message: `Updated role to ${newRole}.` });
      loadDirectory();
      if (inspectMemberId === memberId) openInspect(memberId);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Role update denied' });
    }
  };

  const handleToggleStatus = async (memberId: string, currentStatus: string, customReason?: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    setActionBusy(true);
    setBanner(null);
    try {
      await api.updateAdminMemberStatus(
        memberId,
        nextStatus,
        customReason || (nextStatus === 'suspended' ? 'Suspended by administrator' : 'Reactivated by administrator')
      );
      setBanner({
        type: 'success',
        message: nextStatus === 'suspended' ? 'Member account suspended cleanly.' : 'Member account reactivated.',
      });
      loadDirectory();
      if (inspectMemberId === memberId) openInspect(memberId);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to update member status' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleAwardBadge = async () => {
    if (!inspectMemberId) return;
    setAwarding(true);
    setBanner(null);
    try {
      const res = await api.awardAdminAchievement(inspectMemberId, selectedBadge);
      setBanner({ type: 'success', message: res.message || 'Achievement badge awarded!' });
      openInspect(inspectMemberId);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to award achievement badge' });
    } finally {
      setAwarding(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const allPermsList = Array.from(new Set(Object.values(matrix).flat())).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">Members, Accounts & Access Roles</h2>
          <p className="text-xs text-stroom-charcoal/70">
            Search members, inspect passport stamps and passes, award badges, manage suspensions, and audit RBAC permissions.
          </p>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-stroom-borderLight self-start">
          <button
            onClick={() => setSubTab('directory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              subTab === 'directory' ? 'bg-stroom-orange text-white shadow-brand' : 'text-stroom-charcoal hover:text-stroom-black'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Member Directory ({total})</span>
          </button>
          <button
            onClick={() => setSubTab('matrix')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              subTab === 'matrix' ? 'bg-stroom-orange text-white shadow-brand' : 'text-stroom-charcoal hover:text-stroom-black'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Role & Permission Matrix</span>
          </button>
        </div>
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

      {subTab === 'directory' && (
        <>
          {/* Filters Bar */}
          <div className="p-4 rounded-3xl bg-white border border-stroom-borderLight shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    loadDirectory(e.currentTarget.value);
                  }
                }}
                placeholder="Search name, email, or STROOM ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-semibold outline-none focus:border-stroom-orange"
              />
            </div>

            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none focus:border-stroom-orange"
            >
              <option value="all">All Cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none focus:border-stroom-orange"
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none focus:border-stroom-orange"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            <div className="flex gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none focus:border-stroom-orange"
              >
                <option value="created_at">Newest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="attendance">Top Attended</option>
              </select>
              <button
                onClick={() => {
                  setPage(1);
                  loadDirectory();
                }}
                className="px-3 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs hover:bg-stroom-deep transition-colors"
                title="Apply search"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Directory Table */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange mb-2" />
              <p className="text-xs font-bold">Loading members directory...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-3xl bg-white border border-red-200 text-xs font-bold text-red-600">{error}</div>
          ) : members.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No members matched the selected filters.
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-stroom-borderLight shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stroom-ivory border-b border-stroom-borderLight text-[10px] font-black uppercase tracking-wider text-stone-500">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">City & Status</th>
                      <th className="py-3 px-4">Activity</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroom-borderLight text-xs">
                    {members.map((m) => {
                      const isSelf = m.id === currentUserId;
                      const isTargetPrivileged = ['super_admin', 'admin', 'platform_admin'].includes(m.role);
                      const canEditThisRole = canAssignRoles && !isSelf && (!isTargetPrivileged || currentUserRole === 'super_admin');
                      return (
                        <tr key={m.id} className="hover:bg-stroom-ivory/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-stroom-cream border border-stroom-orange/30 flex items-center justify-center font-black text-stroom-deep text-xs shrink-0">
                                {(m.full_name || 'U').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-black text-stroom-black flex items-center gap-1.5">
                                  <span>{m.full_name}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 rounded bg-stroom-orange/10 text-stroom-deep text-[9px] font-black">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500 font-mono">
                                  {m.member_id} • {m.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-stroom-black">{m.city || 'Not set'}</div>
                            <span
                              className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                m.account_status === 'suspended'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {m.account_status || 'active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-stroom-charcoal font-semibold">
                            <div>{m.registrations_count || 0} Passes</div>
                            <div>{m.attended_count || 0} Stamps • {m.communities_count || 0} Clubs</div>
                          </td>
                          <td className="py-3 px-4">
                            {canEditThisRole ? (
                              <select
                                value={m.role}
                                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-[11px] font-black outline-none focus:border-stroom-orange"
                              >
                                {ROLE_OPTIONS.map((r) => (
                                  <option
                                    key={r.value}
                                    value={r.value}
                                    disabled={['super_admin', 'admin', 'platform_admin'].includes(r.value) && currentUserRole !== 'super_admin'}
                                  >
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-100 text-stone-700 text-[11px] font-mono font-bold">
                                <Lock className="w-3 h-3 text-stone-400" />
                                {m.role}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openInspect(m.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-[11px] font-black flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5 text-stroom-orange" />
                                <span>Inspect</span>
                              </button>
                              {canManageMembers && !isSelf && (!isTargetPrivileged || currentUserRole === 'super_admin') && (
                                <button
                                  onClick={() => handleToggleStatus(m.id, m.account_status || 'active')}
                                  disabled={actionBusy}
                                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-colors ${
                                    m.account_status === 'suspended'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                  }`}
                                >
                                  {m.account_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 bg-stroom-ivory border-t border-stroom-borderLight flex items-center justify-between text-xs font-bold text-stone-600">
                <span>
                  Page {page} of {totalPages} ({total} total accounts)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-stroom-borderLight bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-stroom-borderLight bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {subTab === 'matrix' && (
        <div className="rounded-3xl bg-white border border-stroom-borderLight shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stroom-borderLight">
            <h3 className="text-sm font-black text-stroom-black">Backend RBAC Permission Matrix</h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Every administrative route enforces these exact permissions server-side. Only Super Admins can assign privileged Admin roles.
            </p>
          </div>
          {loadingMatrix ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-stroom-ivory border-b border-stroom-borderLight font-black text-stone-600">
                    <th className="py-3 px-4 sticky left-0 bg-stroom-ivory">Permission Key</th>
                    {Object.keys(matrix)
                      .filter((r) => !['participant', 'user'].includes(r))
                      .map((roleKey) => (
                        <th key={roleKey} className="py-3 px-3 font-mono whitespace-nowrap text-center">
                          {roleKey}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroom-borderLight">
                  {allPermsList.map((perm) => (
                    <tr key={perm} className="hover:bg-stroom-ivory/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-stroom-black sticky left-0 bg-white">
                        {perm}
                      </td>
                      {Object.keys(matrix)
                        .filter((r) => !['participant', 'user'].includes(r))
                        .map((roleKey) => {
                          const has = (matrix[roleKey] || []).includes(perm);
                          return (
                            <td key={roleKey} className="py-2.5 px-3 text-center">
                              {has ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Member Inspection Modal */}
      {inspectMemberId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-stroom-borderLight shadow-2xl">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-black text-stroom-black font-display">Member Inspection & Controls</h3>
                <p className="text-[11px] text-stone-500">
                  Real passport history, passes, badges, role & suspension controls
                </p>
              </div>
              <button
                onClick={() => setInspectMemberId(null)}
                className="p-2 rounded-xl hover:bg-stroom-ivory text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingInspect || !inspectData ? (
              <div className="p-16 flex flex-col items-center justify-center text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin text-stroom-orange mb-2" />
                <p className="text-xs font-bold">Loading member dossier...</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Identity Summary */}
                <div className="p-4 rounded-2xl bg-stroom-ivory border border-stroom-borderLight flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-black text-stroom-black">{inspectData.member?.full_name}</h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          inspectData.member?.account_status === 'suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {inspectData.member?.account_status || 'active'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5 font-mono">
                      {inspectData.member?.member_id} • {inspectData.member?.email} • Role: {inspectData.member?.role}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      City: {inspectData.member?.city || 'Not set'} • Vibe Archetype:{' '}
                      {inspectData.member?.vibe_archetype || 'Pending Quiz'}
                    </p>
                  </div>

                  {canManageMembers && inspectData.member?.id !== currentUserId && (
                    <div className="flex flex-col gap-2">
                      {inspectData.member?.account_status !== 'suspended' && (
                        <input
                          type="text"
                          value={suspendReason}
                          onChange={(e) => setSuspendReason(e.target.value)}
                          placeholder="Suspension reason..."
                          className="px-3 py-1.5 rounded-xl border border-stroom-borderLight bg-white text-xs outline-none"
                        />
                      )}
                      <button
                        onClick={() =>
                          handleToggleStatus(
                            inspectData.member.id,
                            inspectData.member.account_status || 'active',
                            suspendReason
                          )
                        }
                        disabled={actionBusy}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
                          inspectData.member?.account_status === 'suspended'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>
                          {inspectData.member?.account_status === 'suspended' ? 'Reactivate Account' : 'Suspend Account'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Award Achievement Badge */}
                {canManageMembers && (
                  <div className="p-4 rounded-2xl border border-stroom-borderLight bg-white space-y-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-stroom-orange" />
                      <h5 className="text-xs font-black uppercase tracking-wider text-stroom-black">
                        Award Achievement Badge
                      </h5>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedBadge}
                        onChange={(e) => setSelectedBadge(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none"
                      >
                        {BADGE_OPTIONS.map((b) => (
                          <option key={b.key} value={b.key}>
                            {b.label} ({b.key})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAwardBadge}
                        disabled={awarding}
                        className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs hover:bg-stroom-deep disabled:opacity-50"
                      >
                        {awarding ? 'Awarding...' : 'Award Badge'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Unlocked Achievements & Passport Stamps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-stroom-borderLight space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
                      Achievements ({(inspectData.achievements || []).length})
                    </h5>
                    {(inspectData.achievements || []).length === 0 ? (
                      <p className="text-xs text-stone-400">No achievements unlocked yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {inspectData.achievements.map((a: any) => (
                          <div key={a.id || a.badge_key} className="p-2 rounded-xl bg-stroom-ivory text-xs font-bold">
                            {a.title || a.badge_key}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl border border-stroom-borderLight space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Passport Stamps ({(inspectData.stamps || []).length})
                    </h5>
                    {(inspectData.stamps || []).length === 0 ? (
                      <p className="text-xs text-stone-400">No verified event stamps yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {inspectData.stamps.map((s: any) => (
                          <div key={s.id} className="p-2 rounded-xl bg-stroom-ivory text-xs">
                            <span className="font-bold text-stroom-black">{s.event_title || s.event_id}</span>
                            <span className="block text-[10px] text-stone-500">{s.city_name || s.stamped_at}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Registrations / Passes */}
                <div className="p-4 rounded-2xl border border-stroom-borderLight space-y-2">
                  <h5 className="text-xs font-black uppercase tracking-wider text-stroom-black flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-stroom-orange" />
                    Event Passes ({(inspectData.registrations || []).length})
                  </h5>
                  {(inspectData.registrations || []).length === 0 ? (
                    <p className="text-xs text-stone-400">No event passes registered.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {inspectData.registrations.map((r: any) => (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-xl bg-stroom-ivory flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-stroom-black">{r.event_title || r.event_id}</div>
                            <div className="text-[11px] font-mono text-stone-500">{r.pass_code}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-stroom-borderLight text-[10px] font-black uppercase">
                            {r.checkin_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
