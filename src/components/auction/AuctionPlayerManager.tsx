import React, { useState } from 'react';
import { api } from '../../services/api';
import { AuctionPlayer } from '../../types';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  Filter,
  Flame,
  Award,
  Globe,
  Save,
  AlertCircle,
  FileText,
  Upload
} from 'lucide-react';
import ImageUpload from '../common/ImageUpload';

interface AuctionPlayerManagerProps {
  auctionId: string;
  isOpen: boolean;
  players: AuctionPlayer[];
  onClose: () => void;
  onRefresh: () => void;
}

export const AuctionPlayerManager: React.FC<AuctionPlayerManagerProps> = ({
  auctionId,
  isOpen,
  players,
  onClose,
  onRefresh,
}) => {
  const [editingPlayer, setEditingPlayer] = useState<AuctionPlayer | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formPlayer, setFormPlayer] = useState({
    name: '',
    role: 'Batter',
    category: 'Batter',
    nationality: 'India',
    is_overseas: false,
    batting_style: 'Right-hand bat',
    bowling_style: 'Right-arm medium',
    base_price: 500000,
    photo_url: '',
    bio: '',
    age: 24,
    previous_team: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingPlayer(null);
    setFormPlayer({
      name: '',
      role: 'Batter',
      category: 'Batter',
      nationality: 'India',
      is_overseas: false,
      batting_style: 'Right-hand bat',
      bowling_style: 'Right-arm medium',
      base_price: 500000,
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80',
      bio: '',
      age: 24,
      previous_team: '',
    });
    setIsCreating(true);
    setError(null);
  };

  const handleStartEdit = (p: AuctionPlayer) => {
    setIsCreating(false);
    setEditingPlayer(p);
    setFormPlayer({
      name: p.name,
      role: p.role,
      category: p.category || p.role,
      nationality: p.nationality || 'India',
      is_overseas: p.is_overseas === 1,
      batting_style: p.batting_style || 'Right-hand bat',
      bowling_style: p.bowling_style || 'Right-arm medium',
      base_price: p.base_price,
      photo_url: p.photo_url,
      bio: p.bio || '',
      age: p.age || 25,
      previous_team: p.previous_team || '',
    });
    setError(null);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlayer.name.trim()) {
      setError('Player name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingPlayer) {
        await api.updateAuctionPlayer(auctionId, editingPlayer.id, formPlayer);
      } else {
        await api.createAuctionPlayer(auctionId, formPlayer);
      }
      setIsCreating(false);
      setEditingPlayer(null);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to save player:', err);
      setError(err.message || 'Failed to save player lot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!window.confirm('Remove this player from the auction pool?')) return;
    try {
      await api.deleteAuctionPlayer(auctionId, playerId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete player');
    }
  };

  // Filtered players list
  const filteredPlayers = players.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role.toLowerCase().includes(roleFilter.toLowerCase()) || (p.category && p.category.toLowerCase().includes(roleFilter.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stroom-cardDark border border-stroom-borderDark rounded-3xl max-w-5xl w-full p-6 sm:p-8 text-white relative shadow-2xl my-8">
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
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Player Pool & Lot Management</h2>
              <p className="text-xs text-stone-400 font-medium">Add, edit, and organize auction lots, base prices, roles, and statistics.</p>
            </div>
          </div>

          {!isCreating && !editingPlayer && (
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Player Lot</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Player Create / Edit Form */}
        {(isCreating || editingPlayer) ? (
          <form onSubmit={handleSavePlayer} className="bg-stroom-surfaceDark p-5 rounded-2xl border border-stroom-borderDark mb-6 space-y-4">
            <h3 className="text-xs font-black text-stroom-orange uppercase tracking-wider">
              {editingPlayer ? `Edit Lot #${editingPlayer.lot_number}: ${editingPlayer.name}` : 'Add New Player Lot'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jasprit Bumrah"
                  value={formPlayer.name}
                  onChange={(e) => setFormPlayer({ ...formPlayer, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Primary Role *</label>
                <select
                  value={formPlayer.role}
                  onChange={(e) => setFormPlayer({ ...formPlayer, role: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                >
                  <option value="Batter">Batter</option>
                  <option value="Fast Bowler">Fast Bowler</option>
                  <option value="Spin All-Rounder">Spin All-Rounder</option>
                  <option value="Pace All-Rounder">Pace All-Rounder</option>
                  <option value="Wicketkeeper Batter">Wicketkeeper Batter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Player Category</label>
                <select
                  value={formPlayer.category}
                  onChange={(e) => setFormPlayer({ ...formPlayer, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                >
                  <option value="Batter">Batter</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All-Rounder">All-Rounder</option>
                  <option value="Wicketkeeper">Wicketkeeper</option>
                  <option value="Overseas">Overseas Marquee</option>
                  <option value="Legend">All-Time Legend</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Base Price (₹) *</label>
                <input
                  type="number"
                  required
                  min={100000}
                  step={50000}
                  value={formPlayer.base_price}
                  onChange={(e) => setFormPlayer({ ...formPlayer, base_price: parseInt(e.target.value) || 500000 })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Nationality</label>
                <input
                  type="text"
                  value={formPlayer.nationality}
                  onChange={(e) => setFormPlayer({ ...formPlayer, nationality: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Overseas Player?</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_overseas"
                    checked={formPlayer.is_overseas}
                    onChange={(e) => setFormPlayer({ ...formPlayer, is_overseas: e.target.checked })}
                    className="w-4 h-4 rounded text-stroom-orange focus:ring-stroom-orange"
                  />
                  <label htmlFor="is_overseas" className="text-xs text-stone-300 font-bold cursor-pointer">
                    Yes, counts toward overseas limit
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Batting Style</label>
                <input
                  type="text"
                  value={formPlayer.batting_style}
                  onChange={(e) => setFormPlayer({ ...formPlayer, batting_style: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Bowling Style</label>
                <input
                  type="text"
                  value={formPlayer.bowling_style}
                  onChange={(e) => setFormPlayer({ ...formPlayer, bowling_style: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
                />
              </div>

              <div className="md:col-span-2">
                <ImageUpload
                  label="Player Photo"
                  value={formPlayer.photo_url}
                  onChange={(url) => setFormPlayer({ ...formPlayer, photo_url: url })}
                  folder="auctions/players"
                  aspectRatio="square"
                  maxSizeMB={5}
                  helperText="Upload a square photo of the player (max 5MB)."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Bio & Community Scouting Notes</label>
              <textarea
                rows={2}
                value={formPlayer.bio}
                onChange={(e) => setFormPlayer({ ...formPlayer, bio: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-stroom-orange"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingPlayer(null);
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
                <span>{isSubmitting ? 'Saving...' : editingPlayer ? 'Update Lot' : 'Add to Pool'}</span>
              </button>
            </div>
          </form>
        ) : null}

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search player by name, style, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-semibold text-white placeholder-stone-500 focus:outline-none focus:border-stroom-orange"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
            >
              <option value="all">All Roles</option>
              <option value="batter">Batters</option>
              <option value="bowler">Bowlers</option>
              <option value="all-rounder">All-Rounders</option>
              <option value="wicketkeeper">Wicketkeepers</option>
              <option value="legend">Legends</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="in_auction">In Auction</option>
              <option value="sold">Sold</option>
              <option value="unsold">Unsold</option>
            </select>
          </div>
        </div>

        {/* Players List Table */}
        <div className="max-h-96 overflow-y-auto border border-stroom-borderDark rounded-2xl bg-stroom-surfaceDark">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/60 border-b border-stroom-borderDark text-stone-400 font-black uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Lot #</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3">Role & Category</th>
                <th className="py-2.5 px-3">Base Price</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPlayers.map((p) => {
                return (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-stone-400">#{p.lot_number}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={p.photo_url}
                          alt={p.name}
                          className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
                        />
                        <div>
                          <div className="font-black text-white">{p.name}</div>
                          <div className="text-[10px] text-stone-400">{p.nationality} • {p.batting_style}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-stroom-cream">{p.role}</div>
                      {p.is_overseas === 1 && (
                        <span className="text-[9px] uppercase font-black text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800">
                          Overseas
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-stroom-orange">
                      ₹{p.base_price.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          p.status === 'SOLD'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : p.status === 'IN_AUCTION'
                            ? 'bg-stroom-orange/30 text-stroom-orange border border-stroom-orange animate-pulse'
                            : p.status === 'UNSOLD'
                            ? 'bg-stone-800 text-stone-400'
                            : 'bg-white/10 text-stone-300'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(p)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white"
                          title="Edit Player"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(p.id)}
                          disabled={p.status === 'SOLD'}
                          className={`p-1.5 rounded-lg ${
                            p.status === 'SOLD' ? 'opacity-30 cursor-not-allowed text-stone-600' : 'bg-red-950/40 hover:bg-red-900/60 text-red-300'
                          }`}
                          title="Delete Player"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
