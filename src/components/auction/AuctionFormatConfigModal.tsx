import React, { useState } from 'react';
import { api } from '../../services/api';
import {
  X,
  Settings,
  Trophy,
  Clock,
  Users,
  Shield,
  Coins,
  CheckCircle2,
  AlertCircle,
  Save,
  Flame,
  Globe
} from 'lucide-react';

interface AuctionFormatConfigModalProps {
  auctionId: string;
  isOpen: boolean;
  currentConfig?: any;
  onClose: () => void;
  onSaved: () => void;
}

export const AuctionFormatConfigModal: React.FC<AuctionFormatConfigModalProps> = ({
  auctionId,
  isOpen,
  currentConfig = {},
  onClose,
  onSaved,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<'ipl_mock' | 'all_time_mega' | 'rapid_draft' | 'custom'>(
    currentConfig.format_category || 'ipl_mock'
  );

  const [formData, setFormData] = useState({
    title: currentConfig.title || 'STROOM Premier League Mock Auction',
    format_type: currentConfig.format_type || 'stroom_premier',
    team_purse_cap: currentConfig.team_purse_cap || 10000000,
    min_squad_size: currentConfig.min_squad_size || 8,
    max_squad_size: currentConfig.max_squad_size || 15,
    overseas_limit: currentConfig.overseas_limit !== undefined ? currentConfig.overseas_limit : 4,
    countdown_seconds: currentConfig.countdown_seconds || 15,
    min_bid_increment: currentConfig.min_bid_increment || 25000,
    description: currentConfig.description || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: 'ipl_mock' | 'all_time_mega' | 'rapid_draft' | 'custom') => {
    setSelectedPreset(preset);
    if (preset === 'ipl_mock') {
      setFormData((prev) => ({
        ...prev,
        format_type: 'ipl_mock',
        team_purse_cap: 10000000,
        min_squad_size: 8,
        max_squad_size: 15,
        overseas_limit: 4,
        countdown_seconds: 15,
        min_bid_increment: 25000,
        description: 'Simulates the high-octane IPL franchise auction room. Strict purse cap, squad slot limits, overseas constraints, and live gavel hammer.',
      }));
    } else if (preset === 'all_time_mega') {
      setFormData((prev) => ({
        ...prev,
        format_type: 'all_time_mega',
        team_purse_cap: 20000000,
        min_squad_size: 11,
        max_squad_size: 18,
        overseas_limit: 4,
        countdown_seconds: 20,
        min_bid_increment: 50000,
        description: 'Featuring all-time cricket legends and current champions. Multi-era dream teams, ₹2 Crore purse, tactical bidding rounds.',
      }));
    } else if (preset === 'rapid_draft') {
      setFormData((prev) => ({
        ...prev,
        format_type: 'rapid_draft',
        team_purse_cap: 5000000,
        min_squad_size: 7,
        max_squad_size: 10,
        overseas_limit: 2,
        countdown_seconds: 10,
        min_bid_increment: 10000,
        description: 'High-speed rapid-fire 10-second draft format designed for fast-paced club drafts and local community cricket tournaments.',
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.updateAuction(auctionId, {
        ...formData,
        format_category: selectedPreset,
        rules_json: JSON.stringify({
          formatName: selectedPreset === 'ipl_mock' ? 'IPL-Inspired Mock Auction' : selectedPreset === 'all_time_mega' ? 'All-Time Legends Mega Auction' : selectedPreset === 'rapid_draft' ? 'Rapid Draft Blitz' : 'Custom Format',
          purseCap: formData.team_purse_cap,
          maxSquadSize: formData.max_squad_size,
          minSquadSize: formData.min_squad_size,
          overseasLimit: formData.overseas_limit,
          countdownSeconds: formData.countdown_seconds,
          minBidIncrement: formData.min_bid_increment,
        }),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to update format config:', err);
      setError(err.message || 'Failed to save format configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stroom-cardDark border border-stroom-borderDark rounded-3xl max-w-2xl w-full p-6 sm:p-8 text-white relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-stroom-orange/20 border border-stroom-orange/40 flex items-center justify-center text-stroom-orange">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Configure Auction Format & Rules</h2>
            <p className="text-xs text-stone-400 font-medium">Set bidding rules, team purse caps, overseas limits, and countdown timers.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preset Selector */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase text-stone-300 mb-2">Select Auction Format Template</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => handlePresetSelect('ipl_mock')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                selectedPreset === 'ipl_mock'
                  ? 'bg-stroom-orange/20 border-stroom-orange text-white'
                  : 'bg-white/5 border-white/10 text-stone-400 hover:border-white/20'
              }`}
            >
              <Flame className="w-4 h-4 text-stroom-orange mb-1" />
              <div className="text-xs font-black">IPL Mock</div>
              <div className="text-[10px] text-stone-400">Franchise room</div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect('all_time_mega')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                selectedPreset === 'all_time_mega'
                  ? 'bg-stroom-orange/20 border-stroom-orange text-white'
                  : 'bg-white/5 border-white/10 text-stone-400 hover:border-white/20'
              }`}
            >
              <Trophy className="w-4 h-4 text-stroom-gold mb-1" />
              <div className="text-xs font-black">All-Time Mega</div>
              <div className="text-[10px] text-stone-400">Era Legends</div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect('rapid_draft')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                selectedPreset === 'rapid_draft'
                  ? 'bg-stroom-orange/20 border-stroom-orange text-white'
                  : 'bg-white/5 border-white/10 text-stone-400 hover:border-white/20'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-400 mb-1" />
              <div className="text-xs font-black">Rapid Draft</div>
              <div className="text-[10px] text-stone-400">10s Blitz</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPreset('custom')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                selectedPreset === 'custom'
                  ? 'bg-stroom-orange/20 border-stroom-orange text-white'
                  : 'bg-white/5 border-white/10 text-stone-400 hover:border-white/20'
              }`}
            >
              <Settings className="w-4 h-4 text-sky-400 mb-1" />
              <div className="text-xs font-black">Custom</div>
              <div className="text-[10px] text-stone-400">Full control</div>
            </button>
          </div>
        </div>

        {/* Detailed Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Auction Event Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Franchise Purse Cap (₹)</label>
              <input
                type="number"
                required
                min={1000000}
                step={500000}
                value={formData.team_purse_cap}
                onChange={(e) => setFormData({ ...formData, team_purse_cap: parseInt(e.target.value) || 10000000 })}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
              />
              <span className="text-[10px] text-stone-400">₹{(formData.team_purse_cap / 10000000).toFixed(2)} Crore per team</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Min Bid Increment (₹)</label>
              <input
                type="number"
                required
                min={5000}
                step={5000}
                value={formData.min_bid_increment}
                onChange={(e) => setFormData({ ...formData, min_bid_increment: parseInt(e.target.value) || 25000 })}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
              />
              <span className="text-[10px] text-stone-400">₹{(formData.min_bid_increment / 1000).toFixed(0)}k minimum jump</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Min Squad Size</label>
              <input
                type="number"
                required
                min={5}
                max={25}
                value={formData.min_squad_size}
                onChange={(e) => setFormData({ ...formData, min_squad_size: parseInt(e.target.value) || 8 })}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Max Squad Size</label>
              <input
                type="number"
                required
                min={5}
                max={30}
                value={formData.max_squad_size}
                onChange={(e) => setFormData({ ...formData, max_squad_size: parseInt(e.target.value) || 15 })}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Overseas Limit</label>
              <input
                type="number"
                required
                min={0}
                max={8}
                value={formData.overseas_limit}
                onChange={(e) => setFormData({ ...formData, overseas_limit: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Countdown Clock Duration (Seconds)</label>
            <input
              type="number"
              required
              min={5}
              max={60}
              value={formData.countdown_seconds}
              onChange={(e) => setFormData({ ...formData, countdown_seconds: parseInt(e.target.value) || 15 })}
              className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-bold text-white focus:outline-none focus:border-stroom-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 uppercase mb-1">Auction Format Summary</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-stroom-surfaceDark border border-stroom-borderDark text-xs font-medium text-white focus:outline-none focus:border-stroom-orange"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-stroom-borderDark">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 text-xs font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black shadow-brand hover:brightness-105 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Rules...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
