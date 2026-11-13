import React, { useState } from 'react';
import { api } from '../../services/api';
import { AuctionTeam } from '../../types';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  X,
  Shield,
  Coins,
  CheckCircle2,
  AlertCircle,
  Save,
  User,
  DollarSign
} from 'lucide-react';

interface AuctionTeamManagerProps {
  auctionId: string;
  isOpen: boolean;
  teams: AuctionTeam[];
  onClose: () => void;
  onRefresh: () => void;
}

export const AuctionTeamManager: React.FC<AuctionTeamManagerProps> = ({
  auctionId,
  isOpen,
  teams,
  onClose,
  onRefresh,
}) => {
  const [editingTeam, setEditingTeam] = useState<AuctionTeam | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [formTeam, setFormTeam] = useState({
    name: '',
    city: 'Hyderabad',
    color: '#FF6900',
    purse_initial: 10000000,
    captain_name: '',
    owner_name: '',
    owner_email: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingTeam(null);
    setFormTeam({
      name: '',
      city: 'Hyderabad',
      color: '#FF6900',
      purse_initial: 10000000,
      captain_name: '',
      owner_name: '',
      owner_email: '',
    });
    setIsCreating(true);
    setError(null);
  };

  const handleStartEdit = (team: AuctionTeam) => {
    setIsCreating(false);
    setEditingTeam(team);
    setFormTeam({
      name: team.name,
      city: team.city,
      color: team.color,
      purse_initial: team.purse_initial,
      captain_name: team.captain_name || '',
      owner_name: team.owner_name || '',
      owner_email: team.owner_email || '',
    });
    setError(null);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTeam.name.trim()) {
      setError('Team name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingTeam) {
        await api.updateAuctionTeam(auctionId, editingTeam.id, formTeam);
      } else {
        await api.createAuctionTeam(auctionId, formTeam);
      }
      setIsCreating(false);
      setEditingTeam(null);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to save team:', err);
      setError(err.message || 'Failed to save team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm('Are you sure you want to delete this franchise team?')) return;
    try {
      await api.deleteAuctionTeam(auctionId, teamId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete team');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stroom-cardDark border border-stroom-borderDark rounded-3xl max-w-4xl w-full p-6 sm:p-8 text-white relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stroom-borderDark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stroom-orange/20 border border-stroom-orange/40 flex items-center justify-center text-stroom-orange">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Franchise Teams Management</h2>
              <p className="text-xs text-stone-400 font-medium">Manage participating teams, purse allocations, captains, and owners.</p>
            </div>
          </div>

          {!isCreating && !editingTeam && (
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Team</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Team Create / Edit Form */}
        {(isCreating || editingTeam) ? (
          <form onSubmit={handleSaveTeam} className="bg-stroom-surfaceDark p-5 rounded-2xl border border-stroom-borderDark mb-6 space-y-4">
            <h3 className="text-xs font-black text-stroom-orange uppercase tracking-wider">
              {editingTeam ? `Edit ${editingTeam.name}` : 'Create Franchise Team'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Franchise Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hyderabad Cyber Strikers"
                  value={formTeam.name}
                  onChange={(e) => setFormTeam({ ...formTeam, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">City</label>
                <input
                  type="text"
                  value={formTeam.city}
                  onChange={(e) => setFormTeam({ ...formTeam, city: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formTeam.color}
                    onChange={(e) => setFormTeam({ ...formTeam, color: e.target.value })}
                    className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={formTeam.color}
                    onChange={(e) => setFormTeam({ ...formTeam, color: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono font-bold text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Initial Purse (₹)</label>
                <input
                  type="number"
                  min={1000000}
                  step={500000}
                  value={formTeam.purse_initial}
                  onChange={(e) => setFormTeam({ ...formTeam, purse_initial: parseInt(e.target.value) || 10000000 })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Captain Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dev Patel"
                  value={formTeam.captain_name}
                  onChange={(e) => setFormTeam({ ...formTeam, captain_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
                  value={formTeam.owner_name}
                  onChange={(e) => setFormTeam({ ...formTeam, owner_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Owner Email</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@stroom.club"
                  value={formTeam.owner_email}
                  onChange={(e) => setFormTeam({ ...formTeam, owner_email: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingTeam(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-stone-300"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}</span>
              </button>
            </div>
          </form>
        ) : null}

        {/* Teams List Grid */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {teams.map((t) => {
            const spent = t.purse_initial - t.purse_remaining;
            return (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-stroom-surfaceDark border border-stroom-borderDark flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs text-white shadow-md flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white">{t.name}</h4>
                      <span className="text-[10px] font-bold text-stone-400">({t.city})</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-400">
                      <span>Squad: <strong className="text-white">{t.squad_count} players</strong></span>
                      <span>•</span>
                      <span>Cap: <strong className="text-white">₹{(t.purse_initial / 10000000).toFixed(2)} Cr</strong></span>
                      {t.captain_name && (
                        <>
                          <span>•</span>
                          <span>Captain: <strong className="text-stroom-cream">{t.captain_name}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Purse Remaining</p>
                    <p className="text-xs font-black text-emerald-400">₹{t.purse_remaining.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => handleStartEdit(t)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition-colors"
                      title="Edit Team"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteTeam(t.id)}
                      disabled={t.squad_count > 0}
                      className={`p-2 rounded-xl transition-colors ${
                        t.squad_count > 0 ? 'opacity-30 cursor-not-allowed text-stone-600' : 'bg-red-950/40 hover:bg-red-900/60 text-red-300'
                      }`}
                      title={t.squad_count > 0 ? 'Cannot delete team with players' : 'Delete Team'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
