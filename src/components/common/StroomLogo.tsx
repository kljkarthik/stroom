import React from 'react';

export interface StroomLogoProps {
  variant?: 'dark' | 'light' | 'original';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'projector';
  showSubtitle?: boolean;
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const StroomLogo: React.FC<StroomLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showSubtitle = true,
  showTagline = false,
  className = '',
  onClick,
}) => {
  // Height and font size mappings preserving crisp visual balance
  const sizeMap = {
    xs: { h: 'h-6', w: 'w-[88px]', tag: 'text-[9px]' },
    sm: { h: 'h-8 sm:h-9', w: 'w-[124px] sm:w-[136px]', tag: 'text-[10px]' },
    md: { h: 'h-10 sm:h-12', w: 'w-[155px] sm:w-[185px]', tag: 'text-xs' },
    lg: { h: 'h-14 sm:h-16', w: 'w-[215px] sm:w-[245px]', tag: 'text-sm' },
    xl: { h: 'h-20 sm:h-24', w: 'w-[308px] sm:w-[370px]', tag: 'text-base' },
    projector: { h: 'h-28 sm:h-36', w: 'w-[430px] sm:w-[550px]', tag: 'text-lg sm:text-xl' },
  };

  const isLight = variant === 'light'; // Light text for dark backgrounds (dark banners, dark cards)
  const textColor = isLight ? '#FFFFFF' : '#17120F';
  const subtitleColor = isLight ? '#FFF7EC' : '#241A14';
  const gradId = `stroomOrangeGrad_${variant}_${size}`;

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center select-none ${onClick ? 'cursor-pointer hover:opacity-95' : ''} ${className}`}
    >
      <div className={`${sizeMap[size].h} ${sizeMap[size].w} flex items-center justify-center transition-all`}>
        <svg
          viewBox={showSubtitle ? "0 0 320 86" : "0 0 320 64"}
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-contain overflow-visible"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6900" />
              <stop offset="100%" stopColor="#E94B0B" />
            </linearGradient>
          </defs>

          {/* Letter S T R */}
          <text
            x="20"
            y="52"
            fill={textColor}
            fontFamily="'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="1"
          >
            STR
          </text>

          {/* Integrated Infinity Loop (Natural double O) — Strictly NO decorative dashes */}
          <path
            d="M 166 35 C 180 18, 206 18, 212 35 C 218 52, 192 52, 166 35 C 140 18, 114 18, 120 35 C 126 52, 152 52, 166 35 Z"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="9.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Letter M */}
          <text
            x="222"
            y="52"
            fill={textColor}
            fontFamily="'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="1"
          >
            M
          </text>

          {/* Subtitle: — STRANGERS ROOM — */}
          {showSubtitle && (
            <g>
              <line
                x1="22"
                y1="73"
                x2="82"
                y2="73"
                stroke={subtitleColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeOpacity={isLight ? 0.85 : 0.9}
              />
              <text
                x="160"
                y="77"
                textAnchor="middle"
                fill={subtitleColor}
                fontFamily="'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
                fontWeight="800"
                fontSize="9.5"
                letterSpacing="3.2"
                fillOpacity={isLight ? 0.9 : 0.95}
              >
                STRANGERS ROOM
              </text>
              <line
                x1="238"
                y1="73"
                x2="298"
                y2="73"
                stroke={subtitleColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeOpacity={isLight ? 0.85 : 0.9}
              />
            </g>
          )}
        </svg>
      </div>

      {/* Official Tagline below logo */}
      {showTagline && (
        <p
          className={`mt-2 font-extrabold tracking-tight font-display text-center ${
            isLight ? 'text-stroom-cream' : 'text-stroom-deep'
          } ${sizeMap[size].tag}`}
        >
          Strangers Today. Stories Tomorrow.
        </p>
      )}
    </div>
  );
};
