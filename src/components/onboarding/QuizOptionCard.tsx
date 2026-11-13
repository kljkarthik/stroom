import React from 'react';
import { QuizOption } from '../../types';
import {
  Check,
  Compass,
  Users,
  Heart,
  Calendar,
  Briefcase,
  Sparkles,
  Palette,
  Activity,
  Lightbulb,
  Coffee,
  Mountain,
  Utensils
} from 'lucide-react';

interface QuizOptionCardProps {
  option: QuizOption;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

// Icon mapper for aesthetic visual reinforcement
function getOptionIcon(value: string) {
  switch (value) {
    case 'communities':
      return <Users className="w-5 h-5" />;
    case 'friendship':
      return <Heart className="w-5 h-5" />;
    case 'social_meetups':
    case 'social_events':
      return <Calendar className="w-5 h-5" />;
    case 'travel_adventure':
      return <Compass className="w-5 h-5" />;
    case 'outdoor_adventures':
      return <Mountain className="w-5 h-5" />;
    case 'professional_networking':
    case 'entrepreneurship':
      return <Briefcase className="w-5 h-5" />;
    case 'creativity':
      return <Palette className="w-5 h-5" />;
    case 'fitness_wellness':
    case 'activity_partners':
      return <Activity className="w-5 h-5" />;
    case 'skills_growth':
      return <Lightbulb className="w-5 h-5" />;
    case 'casual_hangouts':
      return <Coffee className="w-5 h-5" />;
    case 'food_culture':
      return <Utensils className="w-5 h-5" />;
    default:
      return <Sparkles className="w-5 h-5" />;
  }
}

export const QuizOptionCard: React.FC<QuizOptionCardProps> = ({
  option,
  isSelected,
  onSelect,
  disabled
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-stroom-orange/30 ${
        isSelected
          ? 'bg-stroom-cream/90 border-stroom-orange text-stroom-black shadow-brand'
          : 'bg-white hover:bg-stroom-cream/40 border-stroom-borderLight text-stroom-charcoal'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 pr-2">
        {/* Dynamic Category/Vibe Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected
              ? 'bg-stroom-orange text-white shadow-brand'
              : 'bg-stroom-cream text-stroom-deep group-hover:bg-stroom-orange group-hover:text-white'
          }`}
        >
          {getOptionIcon(option.stable_value)}
        </div>

        {/* Option Text */}
        <div className="min-w-0">
          <p className={`text-base font-extrabold leading-tight truncate ${isSelected ? 'text-stroom-black' : 'text-stroom-charcoal'}`}>
            {option.label}
          </p>
          <p className="text-[11px] text-stroom-deep/70 mt-0.5 uppercase tracking-wider font-mono">
            #{option.stable_value.replace(/_/g, '-')}
          </p>
        </div>
      </div>

      {/* Custom Checkbox/Radio Indicator */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
          isSelected
            ? 'bg-stroom-orange border-stroom-orange text-white shadow-sm'
            : 'border-stroom-borderLight bg-stroom-ivory group-hover:border-stroom-orange/40'
        }`}
      >
        {isSelected ? (
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-stroom-orange/40 transition-colors" />
        )}
      </div>
    </button>
  );
};
