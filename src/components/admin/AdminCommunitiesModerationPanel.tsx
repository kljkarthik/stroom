import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Users,
  Plus,
  Edit3,
  CheckCircle2,
  X,
  Loader2,
  ShieldAlert,
  Search,
  Eye,
  Trash2,
  Archive,
  AlertCircle,
  MessageSquareWarning,
  Ban,
} from 'lucide-react';
import ImageUpload from '../common/ImageUpload';

interface AdminCommunitiesModerationPanelProps {
  mode: 'communities' | 'moderation';
  permissions: string[];
}

export const AdminCommunitiesModerationPanel: React.FC<AdminCommunitiesModerationPanelProps> = ({
  mode,
  permissions,
}) => {
  const [communities, setCommunities] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Community form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingComm, setEditingComm] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city_id: 'city_hyd',
    category: 'Sports & Cricket',
    organizer_name: '',
    meeting_schedule: 'Every Weekend',
    description: '',
    guidelines: '',
    status: 'published',
    image_url: '',
    organizer_avatar: '',
  });

  // Community members modal
  const [membersModalComm, setMembersModalComm] = useState<any | null>(null);
  const [commMembers, setCommMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Moderation posts state
  const [posts, setPosts] = useState<any[]>([]);
  const [postStatusFilter, setPostStatusFilter] = useState('all');
  const [postSearch, setPostSearch] = useState('');
  const [reviewingPost, setReviewingPost] = useState<any | null>(null);
  const [moderationNotes, setModerationNotes] = useState('');
  const [suspendAuthor, setSuspendAuthor] = useState(false);
  const [moderating, setModerating] = useState(false);

  const canSuspendMembers = permissions.includes('members.manage');

  useEffect(() => {
    api.getCities().then((r) => setCities(r.cities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'communities') {
      loadCommunities();
    } else {
      loadPosts();
    }
  }, [mode, postStatusFilter]);

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCommunities();
      setCommunities(res.communities || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load communities' });
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async (overrideSearch?: string) => {
    setLoading(true);
    try {
      const res = await api.getAdminModerationPosts({
        status: postStatusFilter,
        search: overrideSearch !== undefined ? overrideSearch : postSearch,
      });
      setPosts(res.posts || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load moderation queue' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateComm = () => {
    setEditingComm(null);
    setForm({
      name: '',
      city_id: cities[0]?.id || 'city_hyd',
      category: 'Sports & Cricket',
      organizer_name: '',
      meeting_schedule: 'Every Weekend',
      description: '',
      guidelines: 'Respect all members and foster authentic real-world conversations.',
      status: 'published',
      image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
      organizer_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    });
    setIsFormOpen(true);
  };

  const openEditComm = (c: any) => {
    setEditingComm(c);
    setForm({
      name: c.name || '',
      city_id: c.city_id || 'city_hyd',
      category: c.category || 'Sports & Cricket',
      organizer_name: c.organizer_name || '',
      meeting_schedule: c.meeting_schedule || 'Every Weekend',
      description: c.description || '',
      guidelines: c.guidelines || '',
      status: c.status || 'published',
      image_url: c.image_url || '',
      organizer_avatar: c.organizer_avatar || '',
    });
    setIsFormOpen(true);
  };

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      if (editingComm) {
        await api.updateAdminCommunity(editingComm.id, form);
        setBanner({ type: 'success', message: `Updated community "${form.name}".` });
      } else {
        await api.createAdminCommunity(form);
        setBanner({ type: 'success', message: `Created community "${form.name}".` });
      }
      setIsFormOpen(false);
      loadCommunities();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to save community' });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCommStatus = async (comm: any, nextStatus: string) => {
    setBanner(null);
    try {
      await api.updateAdminCommunity(comm.id, { status: nextStatus });
      setBanner({ type: 'success', message: `${comm.name} status set to ${nextStatus}.` });
      loadCommunities();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to update community status' });
    }
  };

  const handleViewMembers = async (comm: any) => {
    setMembersModalComm(comm);
    setCommMembers([]);
    setLoadingMembers(true);
    try {
      const res = await api.getAdminCommunityMembers(comm.id);
      setCommMembers(res.members || []);
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load community members' });
    } finally {
      setLoadingMembers(false);
    }
  };

  const openReviewModal = (post: any) => {
    setReviewingPost(post);
    setModerationNotes(post.moderation_notes || '');
    setSuspendAuthor(false);
  };

  const handleModerate = async (postId: string, status: string, notes?: string, suspend?: boolean) => {
    setModerating(true);
    setBanner(null);
    try {
      await api.moderateAdminPost(postId, {
        status,
        moderation_notes: notes,
        suspend_author: Boolean(suspend),
      });
      setBanner({
        type: 'success',
        message: `Post marked as ${status}${suspend ? ' and author suspended' : ''}.`,
      });
      setReviewingPost(null);
      loadPosts();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Moderation action failed' });
    } finally {
      setModerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stroom-black font-display">
            {mode === 'communities' ? 'Communities & Club Directory' : 'Community Feed Moderation'}
          </h2>
          <p className="text-xs text-stroom-charcoal/70">
            {mode === 'communities'
              ? 'Create, edit, publish, suspend, or archive local interest clubs and inspect real joined member rosters.'
              : 'Review reported, pending, or flagged member posts, apply moderation notes, and remove abusive content.'}
          </p>
        </div>

        {mode === 'communities' && (
          <button
            onClick={openCreateComm}
            className="px-4 py-2.5 rounded-2xl bg-stroom-orange hover:bg-stroom-deep text-white font-black text-xs flex items-center gap-1.5 shadow-brand self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Create Community</span>
          </button>
        )}
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

      {mode === 'communities' && (
        <>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : communities.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No communities found. Create your first community above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communities.map((comm) => (
                <div
                  key={comm.id}
                  className="p-5 rounded-3xl bg-white border border-stroom-borderLight shadow-sm flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-stroom-orange">
                          {comm.category} • {comm.city_name}
                        </span>
                        <h3 className="text-base font-black text-stroom-black mt-0.5">{comm.name}</h3>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          comm.status === 'published'
                            ? 'bg-emerald-100 text-emerald-700'
                            : comm.status === 'suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {comm.status || 'published'}
                      </span>
                    </div>

                    <p className="text-xs text-stroom-charcoal/80 mt-2 line-clamp-2">{comm.description}</p>

                    <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-2xl bg-stroom-ivory text-center">
                      <div>
                        <div className="text-sm font-black text-stroom-black">{comm.real_joined_count || 0}</div>
                        <div className="text-[10px] font-bold text-stone-500">Joined Users</div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-stroom-black">{comm.total_members || 0}</div>
                        <div className="text-[10px] font-bold text-stone-500">Total Roster</div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-stroom-black">{comm.upcoming_events_count || 0}</div>
                        <div className="text-[10px] font-bold text-stone-500">City Events</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stroom-borderLight">
                    <button
                      onClick={() => openEditComm(comm)}
                      className="px-3 py-1.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-[11px] font-black flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3 text-stroom-orange" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleViewMembers(comm)}
                      className="px-3 py-1.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-[11px] font-black flex items-center gap-1"
                    >
                      <Users className="w-3 h-3 text-stroom-orange" />
                      <span>Members ({comm.real_joined_count || 0})</span>
                    </button>
                    {comm.status !== 'published' ? (
                      <button
                        onClick={() => handleQuickCommStatus(comm, 'published')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black"
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickCommStatus(comm, 'draft')}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black"
                      >
                        Unpublish
                      </button>
                    )}
                    {comm.status !== 'suspended' && (
                      <button
                        onClick={() => handleQuickCommStatus(comm, 'suspended')}
                        className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-black"
                      >
                        Suspend
                      </button>
                    )}
                    {comm.status !== 'archived' && (
                      <button
                        onClick={() => handleQuickCommStatus(comm, 'archived')}
                        className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-600 text-[11px] font-black"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'moderation' && (
        <>
          <div className="p-4 rounded-3xl bg-white border border-stroom-borderLight flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadPosts(e.currentTarget.value);
                }}
                placeholder="Search posts by title, content, or author..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-semibold outline-none focus:border-stroom-orange"
              />
            </div>
            <select
              value={postStatusFilter}
              onChange={(e) => setPostStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory text-xs font-bold outline-none"
            >
              <option value="all">All Moderation Statuses</option>
              <option value="Reported">Reported (Priority)</option>
              <option value="Pending">Pending Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Published">Published</option>
              <option value="Removed">Removed</option>
              <option value="Archived">Archived</option>
            </select>
            <button
              onClick={() => loadPosts()}
              className="px-4 py-2 rounded-xl bg-stroom-orange text-white font-black text-xs"
            >
              Search
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stroom-orange" />
            </div>
          ) : posts.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white border border-stroom-borderLight text-center text-xs font-bold text-stone-500">
              No community posts match the moderation filter.
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={`p-5 rounded-3xl bg-white border shadow-sm space-y-3 ${
                    post.status === 'Reported' ? 'border-red-300 bg-red-50/20' : 'border-stroom-borderLight'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            post.status === 'Reported'
                              ? 'bg-red-100 text-red-700'
                              : post.status === 'Published'
                              ? 'bg-emerald-100 text-emerald-700'
                              : post.status === 'Pending' || post.status === 'Under Review'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {post.status}
                        </span>
                        <span className="text-[11px] font-bold text-stroom-orange">{post.community_name}</span>
                        <span className="text-[11px] text-stone-400">• by {post.author_name || 'Member'}</span>
                        {post.reports_count > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                            <MessageSquareWarning className="w-3 h-3" />
                            {post.reports_count} Reports
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-stroom-black mt-1.5">{post.title}</h3>
                      <p className="text-xs text-stroom-charcoal/85 mt-1">{post.content}</p>
                      {post.report_reason && (
                        <p className="text-[11px] font-bold text-red-700 mt-1.5">
                          Flag Reason: {post.report_reason}
                        </p>
                      )}
                      {post.moderation_notes && (
                        <p className="text-[11px] text-stone-500 mt-1 italic">
                          Moderation note: {post.moderation_notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleModerate(post.id, 'Published')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleModerate(post.id, 'Removed')}
                        className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-black flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                      <button
                        onClick={() => openReviewModal(post)}
                        className="px-3 py-1.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight hover:border-stroom-orange text-[11px] font-black flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>Inspect & Actions</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Community Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-stroom-borderLight shadow-2xl">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <h3 className="text-base font-black text-stroom-black font-display">
                {editingComm ? 'Edit Community' : 'Create New Community'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1.5 rounded-xl hover:bg-stroom-ivory">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveComm} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-black mb-1">Community Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none focus:border-stroom-orange"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black mb-1">City *</label>
                  <select
                    value={form.city_id}
                    onChange={(e) => setForm({ ...form, city_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-black mb-1">Category *</label>
                  <input
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black mb-1">Organizer / Lead</label>
                  <input
                    value={form.organizer_name}
                    onChange={(e) => setForm({ ...form, organizer_name: e.target.value })}
                    placeholder="Community Lead Name"
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-black mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-bold outline-none"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="suspended">Suspended</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-black mb-1">Meeting Schedule</label>
                <input
                  value={form.meeting_schedule}
                  onChange={(e) => setForm({ ...form, meeting_schedule: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block font-black mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block font-black mb-1">Community Guidelines</label>
                <textarea
                  rows={2}
                  value={form.guidelines}
                  onChange={(e) => setForm({ ...form, guidelines: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <ImageUpload
                  label="Community Cover Image"
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                  folder="communities/covers"
                  aspectRatio="video"
                  maxSizeMB={8}
                  helperText="Community header banner (max 8MB)."
                />
                <ImageUpload
                  label="Organizer Avatar"
                  value={form.organizer_avatar}
                  onChange={(url) => setForm({ ...form, organizer_avatar: url })}
                  folder="communities/organizers"
                  aspectRatio="square"
                  maxSizeMB={5}
                  helperText="Organizer profile photo (max 5MB)."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stroom-borderLight font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-stroom-orange text-white font-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingComm ? 'Save Changes' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Joined Members Modal */}
      {membersModalComm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto border border-stroom-borderLight shadow-2xl">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-stroom-black">{membersModalComm.name} — Real Members</h3>
                <p className="text-[11px] text-stone-500">Authenticated users joined via STROOM</p>
              </div>
              <button onClick={() => setMembersModalComm(null)} className="p-1.5 rounded-xl hover:bg-stroom-ivory">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              {loadingMembers ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-stroom-orange" />
                </div>
              ) : commMembers.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-6">No registered STROOM users have joined this club yet.</p>
              ) : (
                <div className="space-y-2">
                  {commMembers.map((m) => (
                    <div key={m.id} className="p-3 rounded-2xl bg-stroom-ivory flex items-center justify-between text-xs">
                      <div>
                        <div className="font-black text-stroom-black">{m.full_name}</div>
                        <div className="text-[11px] font-mono text-stone-500">
                          {m.member_id} • {m.city || 'No city'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-stroom-borderLight text-[10px] font-black uppercase">
                        {m.community_role || 'member'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inspect & Moderate Post Modal */}
      {reviewingPost && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-stroom-borderLight shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-stroom-borderLight flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-stroom-orange" />
                <h3 className="text-base font-black text-stroom-black">Moderation Decision</h3>
              </div>
              <button onClick={() => setReviewingPost(null)} className="p-1.5 rounded-xl hover:bg-stroom-ivory">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-stroom-ivory border border-stroom-borderLight">
                <div className="font-black text-stroom-black">{reviewingPost.title}</div>
                <p className="text-stroom-charcoal/80 mt-1">{reviewingPost.content}</p>
                <div className="text-[10px] text-stone-500 mt-2">
                  Author: {reviewingPost.author_name} • Current Status: {reviewingPost.status}
                </div>
              </div>

              <div>
                <label className="block font-black mb-1">Moderation Notes (Logged in Audit Trail)</label>
                <textarea
                  rows={2}
                  value={moderationNotes}
                  onChange={(e) => setModerationNotes(e.target.value)}
                  placeholder="Document reason for removal, approval, or warning..."
                  className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight bg-stroom-ivory outline-none"
                />
              </div>

              {canSuspendMembers && reviewingPost.author_user_id && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={suspendAuthor}
                    onChange={(e) => setSuspendAuthor(e.target.checked)}
                  />
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>Also suspend author account ({reviewingPost.author_name})</span>
                </label>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <button
                  disabled={moderating}
                  onClick={() => handleModerate(reviewingPost.id, 'Published', moderationNotes, false)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-black"
                >
                  Approve
                </button>
                <button
                  disabled={moderating}
                  onClick={() => handleModerate(reviewingPost.id, 'Under Review', moderationNotes, false)}
                  className="px-3 py-2 rounded-xl bg-amber-500 text-white font-black"
                >
                  Under Review
                </button>
                <button
                  disabled={moderating}
                  onClick={() => handleModerate(reviewingPost.id, 'Archived', moderationNotes, false)}
                  className="px-3 py-2 rounded-xl bg-stone-600 text-white font-black flex items-center justify-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
                <button
                  disabled={moderating}
                  onClick={() => handleModerate(reviewingPost.id, 'Removed', moderationNotes, suspendAuthor)}
                  className="px-3 py-2 rounded-xl bg-red-600 text-white font-black"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
