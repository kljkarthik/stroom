import React from 'react';
import { StroomLogo } from '../common/StroomLogo';
import { X, Award, Download, Share2, ShieldCheck, Trophy, Sparkles } from 'lucide-react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName?: string;
  playerName?: string;
  role?: string;
  teamName?: string;
  amount?: string;
  finalPrice?: string;
  eventName?: string;
  eventTitle?: string;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  recipientName,
  playerName,
  role = 'All-Rounder Dynamite',
  teamName = 'Bangalore Supernovas',
  amount,
  finalPrice,
  eventName,
  eventTitle,
}) => {
  if (!isOpen) return null;

  const displayRecipient = playerName || recipientName || 'Aarav Sharma';
  const displayAmount = finalPrice || amount || '₹18,50,000';
  const displayEvent = eventTitle || eventName || 'STROOM Community Premier Cricket Auction 2026';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-stroom-ivory rounded-3xl border-2 border-stroom-gold/40 shadow-2xl overflow-hidden p-1">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-stroom-charcoal/80 text-white flex items-center justify-center hover:bg-stroom-black transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Frame */}
        <div className="p-8 sm:p-10 rounded-2xl border-4 border-double border-stroom-gold/30 bg-gradient-to-b from-stroom-ivory via-stroom-cream/60 to-stroom-ivory text-center relative overflow-hidden">
          {/* Watermark Infinity in background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
            <span className="text-[280px] font-bold text-stroom-orange leading-none select-none">∞</span>
          </div>

          {/* Certificate Header */}
          <div className="flex flex-col items-center mb-6">
            <StroomLogo variant="dark" size="md" showSubtitle={true} />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-stroom-gold/15 border border-stroom-gold/40 text-stroom-charcoal text-[11px] font-extrabold uppercase tracking-widest">
              <Trophy className="w-3.5 h-3.5 text-stroom-gold" />
              Official Auction Hub Selection Certificate
            </div>
          </div>

          <p className="text-xs font-semibold text-stroom-charcoal/70 uppercase tracking-widest">
            This Certifies That
          </p>

          <h3 className="text-2xl sm:text-3xl font-black text-stroom-black mt-1 font-display tracking-tight">
            {displayRecipient}
          </h3>

          <p className="text-xs sm:text-sm text-stroom-charcoal max-w-md mx-auto mt-2 leading-relaxed">
            has been officially drafted into the <strong className="text-stroom-deep font-extrabold">{teamName}</strong> roster as <strong className="text-stroom-black">{role}</strong> for a closing bid of <strong className="text-stroom-deep font-extrabold">{displayAmount}</strong> at the
          </p>

          <p className="text-xs font-bold text-stroom-orange mt-2 uppercase tracking-wider">
            {displayEvent}
          </p>

          {/* Signature / Badges Footer */}
          <div className="grid grid-cols-3 gap-4 pt-8 mt-6 border-t border-stroom-gold/30 items-end">
            <div className="text-left">
              <div className="h-7 border-b border-stroom-charcoal/40 flex items-end">
                <span className="font-serif italic text-xs text-stroom-charcoal font-bold">Vikram Sethi</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-stroom-charcoal/60 mt-1 block">
                Auction Commissioner
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-stroom-gold/20 border-2 border-stroom-gold flex items-center justify-center text-stroom-gold">
                <ShieldCheck className="w-6 h-6 text-stroom-gold" />
              </div>
              <span className="text-[8px] font-extrabold uppercase tracking-widest text-stroom-deep mt-1">
                VERIFIED SQUAD PASS
              </span>
            </div>

            <div className="text-right">
              <div className="h-7 border-b border-stroom-charcoal/40 flex items-end justify-end">
                <span className="font-serif italic text-xs text-stroom-charcoal font-bold">STROOM Board</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-stroom-charcoal/60 mt-1 block">
                Community Director
              </span>
            </div>
          </div>

          <div className="mt-4 text-[10px] text-stroom-charcoal/50 italic">
            "Strangers Today. Stories Tomorrow." • stroom.app/verify
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-stroom-cream/70 p-4 flex items-center justify-between gap-3 border-t border-stroom-borderLight">
          <button
            onClick={() => alert('Certificate downloaded as High-Res PNG!')}
            className="flex-1 py-2.5 rounded-xl bg-stroom-charcoal hover:bg-stroom-black text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-stroom-orange" />
            Download Certificate
          </button>
          <button
            onClick={() => alert('Shareable link copied to clipboard!')}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:brightness-105 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Share to WhatsApp / Stories
          </button>
        </div>
      </div>
    </div>
  );
};
