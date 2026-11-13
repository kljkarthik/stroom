import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Trophy,
  ArrowLeft,
  Download,
  Users,
  Coins,
  Flame,
  Award,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet
} from 'lucide-react';

interface AuctionResultsViewProps {
  auctionId: string;
  onBack: () => void;
  onGoToArena?: () => void;
}

export const AuctionResultsView: React.FC<AuctionResultsViewProps> = ({
  auctionId,
  onBack,
  onGoToArena,
}) => {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const fetchResults = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAuctionResults(auctionId);
      if (res && res.report) {
        setReport(res.report);
        if (res.report.teams?.[0]) {
          setSelectedTeamId(res.report.teams[0].id);
        }
      } else {
        setError('Auction results report not available yet');
      }
    } catch (err: any) {
      console.error('Failed to load auction results:', err);
      setError(err.message || 'Failed to generate results');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [auctionId]);

  const handleDownloadCSV = () => {
    if (!report || !report.csvData) return;
    const blob = new Blob([report.csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `STROOM_Auction_${auctionId}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stroom-black text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-stroom-orange animate-spin mb-3" />
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Compiling official auction results...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-stroom-black text-white flex flex-col items-center justify-center p-4">
        <div className="p-8 max-w-md w-full bg-stroom-cardDark rounded-3xl border border-stroom-borderDark text-center">
          <AlertCircle className="w-12 h-12 text-stroom-orange mx-auto mb-3" />
          <h2 className="text-xl font-black uppercase">Results Not Available</h2>
          <p className="mt-2 text-xs text-stone-400 font-semibold">{error || 'This auction does not have recorded sales yet.'}</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand hover:brightness-105 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Auctions</span>
          </button>
        </div>
      </div>
    );
  }

  const clearanceRate = report.totalLots > 0 ? Math.round((report.soldLots / report.totalLots) * 100) : 0;

  return (
    <div className="min-h-screen bg-stroom-black text-white pb-24">
      {/* Top Banner Navigation */}
      <div className="border-b border-stroom-borderDark bg-stroom-cardDark/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-black text-stone-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-stroom-orange" />
            <span>Back to Auction Hub</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-stroom-orange" />
              <span>Export CSV</span>
            </button>

            {onGoToArena && (
              <button
                onClick={onGoToArena}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black shadow-brand hover:brightness-105 transition-all flex items-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Open Live Arena</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Title Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stroom-orange/20 border border-stroom-orange/40 text-stroom-orange text-xs font-black uppercase tracking-wider mb-3">
            <Award className="w-3.5 h-3.5" />
            <span>Official Post-Auction Analytics</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            {report.auctionTitle}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-400 font-medium">
            Generated on {new Date(report.generatedAt).toLocaleString('en-IN')} • {report.city} ({report.venue})
          </p>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-3xl bg-stroom-cardDark border border-stroom-borderDark">
            <p className="text-[10px] font-black uppercase text-stone-400">Total Expenditure</p>
            <p className="text-2xl font-black text-stroom-orange mt-1">₹{(report.totalSpend / 10000000).toFixed(2)} Cr</p>
            <p className="text-[10px] text-stone-500 mt-1 font-semibold">Across all participating franchises</p>
          </div>

          <div className="p-5 rounded-3xl bg-stroom-cardDark border border-stroom-borderDark">
            <p className="text-[10px] font-black uppercase text-stone-400">Clearance Rate</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{clearanceRate}%</p>
            <p className="text-[10px] text-stone-500 mt-1 font-semibold">{report.soldLots} Sold / {report.totalLots} Auctioned</p>
          </div>

          <div className="p-5 rounded-3xl bg-stroom-cardDark border border-stroom-borderDark">
            <p className="text-[10px] font-black uppercase text-stone-400">Highest Bid Player</p>
            <p className="text-lg font-black text-white mt-1 truncate">{report.topBuys?.[0]?.name || 'N/A'}</p>
            <p className="text-[10px] text-stroom-gold font-bold mt-1">
              {report.topBuys?.[0] ? `₹${(report.topBuys[0].amount / 100000).toFixed(1)} Lakh (${report.topBuys[0].team})` : '—'}
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-stroom-cardDark border border-stroom-borderDark">
            <p className="text-[10px] font-black uppercase text-stone-400">Most Active Team</p>
            <p className="text-lg font-black text-white mt-1 truncate">{report.mostActiveTeam?.name || 'N/A'}</p>
            <p className="text-[10px] text-emerald-400 font-bold mt-1">
              {report.mostActiveTeam ? `₹${(report.mostActiveTeam.spent / 10000000).toFixed(2)} Cr spent` : '—'}
            </p>
          </div>
        </div>

        {/* Top Buys Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          <div className="lg:col-span-7 bg-stroom-cardDark rounded-3xl p-6 sm:p-8 border border-stroom-borderDark">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stroom-borderDark">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-stroom-orange" />
                <span>Top Buys Leaderboard</span>
              </h3>
              <span className="text-[10px] text-stone-400 uppercase font-bold">Highest Final Bids</span>
            </div>

            <div className="space-y-3">
              {report.topBuys?.map((buy: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-stroom-orange/20 border border-stroom-orange/40 text-stroom-orange font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-white">{buy.name}</h4>
                      <p className="text-[10px] text-stone-400">{buy.role} • {buy.category}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-stroom-orange">₹{buy.amount.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-stroom-cream font-bold">{buy.team}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="lg:col-span-5 bg-stroom-cardDark rounded-3xl p-6 sm:p-8 border border-stroom-borderDark flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 pb-3 border-b border-stroom-borderDark flex items-center gap-2">
                <Users className="w-4 h-4 text-stroom-orange" />
                <span>Role & Category Breakdown</span>
              </h3>
              <div className="space-y-3">
                {Object.entries(report.categoryCounts || {}).map(([cat, count]: [string, any]) => (
                  <div key={cat} className="flex items-center justify-between text-xs font-bold">
                    <span className="text-stone-300">{cat}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-mono">{count} Sold</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stroom-borderDark flex items-center justify-between text-[11px] text-stone-400 font-semibold">
              <span>Unsold Lots: <strong className="text-white">{report.unsoldLots}</strong></span>
              <span>Total Franchises: <strong className="text-white">{report.teams?.length || 0}</strong></span>
            </div>
          </div>
        </div>

        {/* Team-wise Roster Sheets */}
        <div className="bg-stroom-cardDark rounded-3xl p-6 sm:p-8 border border-stroom-borderDark">
          <h3 className="text-sm font-black text-white uppercase tracking-wider mb-6 pb-3 border-b border-stroom-borderDark flex items-center gap-2">
            <Trophy className="w-4 h-4 text-stroom-orange" />
            <span>Franchise Team Squads & Balances</span>
          </h3>

          {/* Team Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-thin">
            {report.teams?.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border ${
                  selectedTeamId === t.id
                    ? 'bg-stroom-orange text-white border-stroom-orange shadow-brand'
                    : 'bg-white/5 border-white/10 text-stone-400 hover:text-white'
                }`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                <span>{t.name}</span>
                <span className="text-[10px] opacity-80 font-mono">({t.players?.length || 0})</span>
              </button>
            ))}
          </div>

          {/* Selected Team Squad Table */}
          {(() => {
            const currentTeam = report.teams?.find((t: any) => t.id === selectedTeamId) || report.teams?.[0];
            if (!currentTeam) return null;

            return (
              <div className="mt-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Franchise</span>
                    <p className="text-white mt-0.5">{currentTeam.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Squad Size</span>
                    <p className="text-white mt-0.5">{currentTeam.squadCount} Players</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Purse Spent</span>
                    <p className="text-stroom-orange mt-0.5">₹{(currentTeam.purseSpent / 10000000).toFixed(2)} Cr</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase">Purse Remaining</span>
                    <p className="text-emerald-400 mt-0.5">₹{(currentTeam.purseRemaining / 10000000).toFixed(2)} Cr</p>
                  </div>
                </div>

                <div className="border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-black/80 text-[10px] uppercase font-black text-stone-400 border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-4">#</th>
                        <th className="py-2.5 px-4">Player Name</th>
                        <th className="py-2.5 px-4">Role</th>
                        <th className="py-2.5 px-4 text-right">Winning Bid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {currentTeam.players?.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-stone-500 font-bold">
                            No players acquired by this franchise during the auction.
                          </td>
                        </tr>
                      ) : (
                        currentTeam.players?.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="py-3 px-4 font-mono text-stone-400">{idx + 1}</td>
                            <td className="py-3 px-4 font-black text-white">{p.name}</td>
                            <td className="py-3 px-4 font-semibold text-stone-300">{p.role}</td>
                            <td className="py-3 px-4 font-mono font-bold text-stroom-orange text-right">
                              ₹{p.amount.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
