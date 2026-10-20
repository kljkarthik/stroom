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
      className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
        isSelected
          ? 'bg-gradient-to-r from-indigo-950/70 via-indigo-900/40 to-slate-900/90 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
          : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/80 hover:border-slate-700 text-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 pr-2">
        {/* Dynamic Category/Vibe Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected
              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
              : 'bg-slate-800/90 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-700/80'
          }`}
        >
          {getOptionIcon(option.stable_value)}
        </div>

        {/* Option Text */}
        <div className="min-w-0">
          <p className={`text-base font-medium leading-tight truncate ${isSelected ? 'text-white font-semibold' : 'text-slate-200'}`}>
            {option.label}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider font-mono">
            #{option.stable_value.replace(/_/g, '-')}
          </p>
        </div>
      </div>

      {/* Custom Checkbox/Radio Indicator */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
          isSelected
            ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm'
            : 'border-slate-700 bg-slate-950/50 group-hover:border-slate-600'
        }`}
      >
        {isSelected ? (
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-slate-700 transition-colors" />
        )}
      </div>
    </button>
  );
};
