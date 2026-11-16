import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Inbox,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  RefreshCw,
  Loader2,
  Calendar,
  MapPin,
  Users,
  User,
  Mail,
  Phone,
  Building,
  Image as ImageIcon,
  ExternalLink,
  Tag,
  FileText,
  DollarSign,
  AlertTriangle,
  X,
  Sparkles,
  ChevronRight,
  MessageSquare
} from 'lucide-react';

interface AdminEventSubmissionsPanelProps {
  permissions: string[];
}

export interface EventSubmission {
  id: string;
  user_id: string | null;
  organizer_name: string;
  organizer_email: string;
  organizer_phone: string;
  organization_name: string | null;
  title: string;
  category: string;
  short_description: string;
  detailed_description: string;
  format: string;
  city: string;
  venue: string | null;
  proposed_date: string;
  start_time: string;
  end_time: string | null;
  expected_capacity: number;
  age_group: string | null;
  cover_image_url: string | null;
  additional_images_json: string | null;
  estimated_budget: string | null;
  ticketing_details: string | null;
  sponsorship_requirements: string | null;
  additional_notes: string | null;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  submitter_user_name?: string;
  submitter_user_email?: string;
  reviewer_name?: string;
}

export const AdminEventSubmissionsPanel: React.FC<AdminEventSubmissionsPanelProps> = ({ permissions }) => {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Detail Modal & Status Updates
  const [selectedSubmission, setSelectedSubmission] = useState<EventSubmission | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [pendingStatusTarget, setPendingStatusTarget] = useState<'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false);

  const canEdit = permissions.includes('events.edit') || permissions.includes('events.create') || permissions.includes('super_admin');

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminEventSubmissions({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        city: cityFilter !== 'all' ? cityFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: search.trim() || undefined,
      });

      if (res && res.success) {
        setSubmissions(res.submissions || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      }
    } catch (err: any) {
      console.error('Failed to load event submissions:', err);
      setBanner({ type: 'error', message: err.message || 'Failed to fetch event submissions' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cityFilter, categoryFilter, search]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleOpenDetail = (submission: EventSubmission) => {
    setSelectedSubmission(submission);
    setAdminNotesDraft(submission.admin_notes || '');
    setPendingStatusTarget(submission.status);
    setDetailModalOpen(true);
  };

  const handleInitiateStatusChange = (newStatus: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED') => {
    if (!selectedSubmission) return;
    setPendingStatusTarget(newStatus);
    setConfirmStatusModalOpen(true);
  };

  const handleExecuteStatusUpdate = async () => {
    if (!selectedSubmission || !pendingStatusTarget) return;

    setIsUpdatingStatus(true);
    try {
      const res = await api.updateEventSubmissionStatus(selectedSubmission.id, {
        status: pendingStatusTarget,
        admin_notes: adminNotesDraft.trim() || undefined,
      });

      if (res && res.success) {
        setBanner({
          type: 'success',
          message: `Submission ${selectedSubmission.id} updated to ${pendingStatusTarget}.`,
        });

        // Update local selected state
        if (res.submission) {
          setSelectedSubmission(res.submission);
        } else {
          setSelectedSubmission({
            ...selectedSubmission,
            status: pendingStatusTarget,
            admin_notes: adminNotesDraft.trim() || null,
          });
        }

        // Refresh list
        fetchSubmissions();
        setConfirmStatusModalOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to update submission status:', err);
      setBanner({ type: 'error', message: err.message || 'Failed to update submission status' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Review
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-800">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
            Under Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-800">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
      {banner && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold border ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stroom-orange/10 border border-stroom-orange/20 text-stroom-deep text-[11px] font-black uppercase tracking-wider mb-1.5">
            <Inbox className="w-3.5 h-3.5 text-stroom-orange" />
            <span>Community Experience Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight">
            Event Submissions & Proposals
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Review event proposals submitted by organizers, communities, and creators.
          </p>
        </div>

        <button
          onClick={() => fetchSubmissions()}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight hover:bg-stroom-ivory text-stroom-charcoal text-xs font-bold transition-all flex items-center gap-2 shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Proposals</span>
        </button>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            statusFilter === 'all'
              ? 'bg-stroom-black text-white border-stroom-black shadow-md'
              : 'bg-white border-stroom-borderLight hover:border-stroom-orange/40 text-stroom-black'
          }`}
        >
          <div className="text-[11px] uppercase font-black opacity-70">Total Proposals</div>
          <div className="text-2xl font-black mt-1">{metrics.total}</div>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            statusFilter === 'PENDING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-white border-stroom-borderLight hover:border-amber-400 text-amber-700'
          }`}
        >
          <div className="text-[11px] uppercase font-black opacity-80 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </div>
          <div className="text-2xl font-black mt-1">{metrics.pending}</div>
        </button>

        <button
          onClick={() => setStatusFilter('UNDER_REVIEW')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            statusFilter === 'UNDER_REVIEW'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white border-stroom-borderLight hover:border-blue-400 text-blue-700'
          }`}
        >
          <div className="text-[11px] uppercase font-black opacity-80 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
            <span>Under Review</span>
          </div>
          <div className="text-2xl font-black mt-1">{metrics.under_review}</div>
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white border-stroom-borderLight hover:border-emerald-400 text-emerald-700'
          }`}
        >
          <div className="text-[11px] uppercase font-black opacity-80 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>Approved</span>
          </div>
          <div className="text-2xl font-black mt-1">{metrics.approved}</div>
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            statusFilter === 'REJECTED'
              ? 'bg-red-600 text-white border-red-600 shadow-md'
              : 'bg-white border-stroom-borderLight hover:border-red-400 text-red-700'
          }`}
        >
          <div className="text-[11px] uppercase font-black opacity-80 flex items-center gap-1.5">
            <XCircle className="w-3 h-3" />
            <span>Rejected</span>
          </div>
          <div className="text-2xl font-black mt-1">{metrics.rejected}</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stroom-borderLight shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by event title, organizer name, email, or tracking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-stroom-ivory/60 border border-stroom-borderLight text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stroom-orange"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stroom-ivory/60 border border-stroom-borderLight text-xs font-bold text-stroom-charcoal focus:outline-none focus:ring-2 focus:ring-stroom-orange"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stroom-ivory/60 border border-stroom-borderLight text-xs font-bold text-stroom-charcoal focus:outline-none focus:ring-2 focus:ring-stroom-orange"
          >
            <option value="all">All Cities</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Pune">Pune</option>
            <option value="Bangalore">Bangalore</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi NCR">Delhi NCR</option>
            <option value="Chennai">Chennai</option>
            <option value="Kolkata">Kolkata</option>
            <option value="Goa">Goa</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stroom-ivory/60 border border-stroom-borderLight text-xs font-bold text-stroom-charcoal focus:outline-none focus:ring-2 focus:ring-stroom-orange"
          >
            <option value="all">All Categories</option>
            <option value="Social Mixer">Social Mixer</option>
            <option value="Tech & Startups">Tech & Startups</option>
            <option value="Art & Culture">Art & Culture</option>
            <option value="Music & Performance">Music & Performance</option>
            <option value="Board Games & Trivia">Board Games & Trivia</option>
            <option value="Fitness & Wellness">Fitness & Wellness</option>
            <option value="Food & Drinks">Food & Drinks</option>
            <option value="Book Club & Literature">Book Club & Literature</option>
            <option value="Photography & Film">Photography & Film</option>
            <option value="Workshops & Learning">Workshops & Learning</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Submissions List Table / Card View */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-stroom-borderLight text-center">
          <Loader2 className="w-8 h-8 animate-spin text-stroom-orange mx-auto mb-3" />
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Loading event proposals...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-stroom-borderLight text-center">
          <Inbox className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-stroom-black uppercase">No event proposals yet</h3>
          <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || cityFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Proposals submitted through the event submission form will appear here for review and scheduling.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stroom-borderLight shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stroom-borderLight bg-stroom-ivory/50 text-[10px] font-black uppercase tracking-wider text-stroom-charcoal/70">
                  <th className="py-3.5 px-4">Tracking ID & Title</th>
                  <th className="py-3.5 px-4">Organizer</th>
                  <th className="py-3.5 px-4">Location & Date</th>
                  <th className="py-3.5 px-4">Capacity & Model</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroom-borderLight text-xs">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-stroom-ivory/30 transition-colors">
                    {/* ID & Title */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-stroom-ivory border border-stroom-borderLight text-stroom-deep">
                          {sub.id}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-charcoal">
                          {sub.category}
                        </span>
                      </div>
                      <div className="font-black text-stroom-black text-sm line-clamp-1 max-w-xs sm:max-w-md">
                        {sub.title}
                      </div>
                      <div className="text-[11px] text-stone-500 line-clamp-1 mt-0.5 max-w-xs sm:max-w-md">
                        {sub.short_description}
                      </div>
                    </td>

                    {/* Organizer */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold text-stroom-black flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span>{sub.organizer_name}</span>
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-stone-400" />
                        <span>{sub.organizer_email}</span>
                      </div>
                      {sub.organization_name && (
                        <div className="text-[10px] font-semibold text-stroom-orange flex items-center gap-1.5 mt-0.5">
                          <Building className="w-3 h-3" />
                          <span>{sub.organization_name}</span>
                        </div>
                      )}
                    </td>

                    {/* Location & Date */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold text-stroom-black flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stroom-orange" />
                        <span>{sub.city}</span>
                        {sub.venue && <span className="text-stone-400 font-normal">({sub.venue})</span>}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        <span>{sub.proposed_date}</span>
                        <span className="text-stone-300">•</span>
                        <span>{sub.start_time}</span>
                      </div>
                    </td>

                    {/* Capacity & Model */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold text-stroom-black flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-stone-400" />
                        <span>{sub.expected_capacity} guests</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {sub.ticketing_details || 'Free Entry'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {getStatusBadge(sub.status)}
                      {sub.reviewer_name && (
                        <div className="text-[10px] text-stone-400 mt-1">
                          by {sub.reviewer_name}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetail(sub)}
                        className="px-3.5 py-1.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL SUBMISSION DETAIL MODAL */}
      {detailModalOpen && selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl border-2 border-stroom-borderLight shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Top Header */}
            <div className="p-6 border-b border-stroom-borderLight bg-stroom-ivory/50 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-white border border-stroom-borderLight text-stroom-deep">
                    {selectedSubmission.id}
                  </span>
                  {getStatusBadge(selectedSubmission.status)}
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-stroom-cream text-stroom-charcoal">
                    {selectedSubmission.category}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                    {selectedSubmission.format} Format
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-stroom-black uppercase tracking-tight">
                  {selectedSubmission.title}
                </h2>
                <p className="text-xs text-stone-500 font-medium mt-1">
                  Submitted on {new Date(selectedSubmission.created_at).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-2 rounded-xl hover:bg-black/5 text-stone-400 hover:text-stone-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
              {/* Event Cover Image (Cloudinary) */}
              {selectedSubmission.cover_image_url && (
                <div className="rounded-2xl overflow-hidden border border-stroom-borderLight bg-stone-900 relative group max-h-72">
                  <img
                    src={selectedSubmission.cover_image_url}
                    alt={selectedSubmission.title}
                    className="w-full h-full object-cover max-h-72"
                  />
                  <a
                    href={selectedSubmission.cover_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm transition-all"
                  >
                    <span>View Full Image</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Tagline & Detailed Agenda */}
              <div className="bg-stroom-ivory/50 rounded-2xl p-5 border border-stroom-borderLight space-y-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Short Tagline</span>
                  <p className="text-sm font-bold text-stroom-black mt-0.5">{selectedSubmission.short_description}</p>
                </div>
                <div className="border-t border-stroom-borderLight pt-3">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Detailed Description & Agenda</span>
                  <p className="text-xs sm:text-sm text-stroom-charcoal/90 mt-1 whitespace-pre-line leading-relaxed font-medium">
                    {selectedSubmission.detailed_description}
                  </p>
                </div>
              </div>

              {/* Two Column Grid: Organizer & Logistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Organizer Info */}
                <div className="bg-white rounded-2xl p-5 border border-stroom-borderLight space-y-3">
                  <h3 className="text-xs font-black uppercase text-stroom-black flex items-center gap-2 border-b border-stroom-borderLight pb-2">
                    <User className="w-4 h-4 text-stroom-orange" />
                    <span>Organizer Information</span>
                  </h3>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Name</span>
                      <p className="font-bold text-stroom-black">{selectedSubmission.organizer_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Email</span>
                      <p className="font-semibold text-stroom-charcoal flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        <a href={`mailto:${selectedSubmission.organizer_email}`} className="hover:underline text-stroom-deep">
                          {selectedSubmission.organizer_email}
                        </a>
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Phone / WhatsApp</span>
                      <p className="font-semibold text-stroom-charcoal flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <a href={`tel:${selectedSubmission.organizer_phone}`} className="hover:underline">
                          {selectedSubmission.organizer_phone}
                        </a>
                      </p>
                    </div>
                    {selectedSubmission.organization_name && (
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase">Community / Organization</span>
                        <p className="font-bold text-stroom-orange">{selectedSubmission.organization_name}</p>
                      </div>
                    )}
                    {selectedSubmission.submitter_user_name && (
                      <div className="pt-2 border-t border-stroom-borderLight text-[11px] text-stone-500">
                        Linked STROOM Account: <strong>{selectedSubmission.submitter_user_name}</strong> ({selectedSubmission.submitter_user_email})
                      </div>
                    )}
                  </div>
                </div>

                {/* Event Schedule & Venue */}
                <div className="bg-white rounded-2xl p-5 border border-stroom-borderLight space-y-3">
                  <h3 className="text-xs font-black uppercase text-stroom-black flex items-center gap-2 border-b border-stroom-borderLight pb-2">
                    <Calendar className="w-4 h-4 text-stroom-orange" />
                    <span>Schedule & Location</span>
                  </h3>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase">City</span>
                        <p className="font-bold text-stroom-black">{selectedSubmission.city}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase">Proposed Date</span>
                        <p className="font-bold text-stroom-black">{selectedSubmission.proposed_date}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase">Timing</span>
                        <p className="font-semibold text-stroom-charcoal">
                          {selectedSubmission.start_time} {selectedSubmission.end_time ? `– ${selectedSubmission.end_time}` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase">Capacity</span>
                        <p className="font-semibold text-stroom-charcoal">{selectedSubmission.expected_capacity} Guests</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Proposed Venue</span>
                      <p className="font-semibold text-stroom-charcoal">
                        {selectedSubmission.venue || 'To Be Decided / Open to suggestion'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-400 font-bold uppercase">Target Age / Audience</span>
                      <p className="font-semibold text-stroom-charcoal">
                        {selectedSubmission.age_group || 'Open to all (18+)'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commercials & Logistics */}
              <div className="bg-white rounded-2xl p-5 border border-stroom-borderLight space-y-3">
                <h3 className="text-xs font-black uppercase text-stroom-black flex items-center gap-2 border-b border-stroom-borderLight pb-2">
                  <DollarSign className="w-4 h-4 text-stroom-orange" />
                  <span>Commercials & Additional Notes</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-stone-400 font-bold uppercase">Ticketing Model</span>
                    <p className="font-bold text-stroom-black mt-0.5">{selectedSubmission.ticketing_details || 'Free Entry'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 font-bold uppercase">Estimated Budget</span>
                    <p className="font-semibold text-stroom-charcoal mt-0.5">
                      {selectedSubmission.estimated_budget || 'None specified'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 font-bold uppercase">Sponsorship / Equipment Needs</span>
                    <p className="font-semibold text-stroom-charcoal mt-0.5">
                      {selectedSubmission.sponsorship_requirements || 'None specified'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 font-bold uppercase">Special Notes</span>
                    <p className="font-semibold text-stroom-charcoal mt-0.5">
                      {selectedSubmission.additional_notes || 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Review & Decision Section */}
              <div className="bg-stroom-cream/60 rounded-2xl p-6 border-2 border-stroom-orange/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-stroom-black uppercase tracking-wide flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-stroom-orange" />
                    <span>Admin Review & Decision</span>
                  </h3>
                  {selectedSubmission.reviewer_name && (
                    <span className="text-[11px] text-stone-500 font-medium">
                      Last reviewed by <strong>{selectedSubmission.reviewer_name}</strong> on{' '}
                      {new Date(selectedSubmission.reviewed_at || '').toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stroom-charcoal mb-1.5">
                    Internal Admin Notes <span className="text-stone-400 font-normal">(Private to staff)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter internal evaluation notes, venue feasibility, curator feedback, or contact log..."
                    value={adminNotesDraft}
                    onChange={(e) => setAdminNotesDraft(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-stroom-borderLight text-xs sm:text-sm font-medium text-stroom-black focus:outline-none focus:ring-2 focus:ring-stroom-orange leading-relaxed"
                  />
                </div>

                {canEdit && (
                  <div className="pt-2">
                    <span className="block text-xs font-black uppercase text-stroom-charcoal mb-2">
                      Update Proposal Status:
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleInitiateStatusChange('UNDER_REVIEW')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedSubmission.status === 'UNDER_REVIEW'
                            ? 'bg-blue-600 text-white border-blue-600 shadow'
                            : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Move to Under Review</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateStatusChange('APPROVED')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedSubmission.status === 'APPROVED'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                            : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Proposal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateStatusChange('REJECTED')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedSubmission.status === 'REJECTED'
                            ? 'bg-red-600 text-white border-red-600 shadow'
                            : 'bg-white hover:bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject Proposal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateStatusChange('PENDING')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedSubmission.status === 'PENDING'
                            ? 'bg-amber-600 text-white border-amber-600 shadow'
                            : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Reset to Pending</span>
                      </button>
                    </div>

                    <p className="mt-3 text-[11px] text-stone-500 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>
                        Note: Approving a proposal marks it as vetted in the review pipeline. It does NOT publish directly to the live event catalog.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="p-4 border-t border-stroom-borderLight bg-stroom-ivory/30 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black uppercase tracking-wider"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS CHANGE MODAL */}
      {confirmStatusModalOpen && pendingStatusTarget && selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 border-2 border-stroom-borderLight shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  pendingStatusTarget === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-600'
                    : pendingStatusTarget === 'REJECTED'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {pendingStatusTarget === 'APPROVED' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : pendingStatusTarget === 'REJECTED' ? (
                  <XCircle className="w-6 h-6" />
                ) : (
                  <RefreshCw className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-stroom-black uppercase">
                  Confirm Status Change
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  Update proposal <span className="font-mono font-bold text-stroom-black">{selectedSubmission.id}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-stroom-charcoal/90 leading-relaxed font-medium">
              Are you sure you want to change the status of this event proposal to{' '}
              <strong className="uppercase text-stroom-orange">{pendingStatusTarget}</strong>?
            </p>

            {adminNotesDraft.trim() && (
              <div className="p-3 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-[11px] text-stone-600">
                <span className="font-bold text-stone-700 block mb-0.5">Admin notes to save:</span>
                "{adminNotesDraft.trim()}"
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStatusModalOpen(false)}
                disabled={isUpdatingStatus}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stroom-charcoal text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteStatusUpdate}
                disabled={isUpdatingStatus}
                className="px-5 py-2 rounded-xl bg-stroom-black hover:bg-stone-800 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md"
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Confirm Update</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
