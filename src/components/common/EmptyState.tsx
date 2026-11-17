import React from 'react';
import { Compass } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.FC<{ className?: string }>;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Compass,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`py-16 text-center bg-white rounded-3xl border border-stroom-borderLight p-8 max-w-lg mx-auto shadow-xs ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-stroom-cream border border-stroom-orange/20 flex items-center justify-center text-stroom-orange mx-auto mb-4 shadow-2xs">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-black text-stroom-black font-display tracking-tight uppercase">
        {title}
      </h3>
      <p className="text-xs text-stroom-charcoal/80 mt-1.5 max-w-sm mx-auto leading-relaxed font-medium">
        {description}
      </p>
      {(actionText || secondaryActionText) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {secondaryActionText && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2.5 rounded-xl border border-stroom-borderLight bg-white text-stroom-black text-xs font-black hover:bg-stone-50 transition-all cursor-pointer"
            >
              {secondaryActionText}
            </button>
          )}
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black shadow-brand hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
