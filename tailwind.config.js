/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stroom: {
          orange: '#FF6900',      // Primary Orange
          deep: '#E94B0B',        // Deep Orange accent
          cream: '#FFF7EC',       // Warm Cream
          ivory: '#FFF8ED',       // Soft Ivory
          black: '#17120F',       // Deep Black
          charcoal: '#241A14',    // Dark Brown / Charcoal
          darkBrown: '#241A14',   // Dark Brown
          gold: '#D9A441',        // Subtle Gold
          white: '#FFFFFF',       // Soft White
          secondaryText: '#756B63', // Secondary Text
          // Tonal shades for borders and interactive states
          cardDark: '#1E1814',
          surfaceDark: '#241A14',
          borderDark: '#3A2E26',
          borderLight: '#F3E5D4',
          subtleOrange: '#FFF2E6',
        },
        brand: {
          50: '#FFF8ED',
          100: '#FFF7EC',
          200: '#FEDEBA',
          300: '#FDBF82',
          400: '#FF9538',
          500: '#FF6900',
          600: '#E94B0B',
          700: '#C53507',
          800: '#9C2A09',
          900: '#7E250B',
          950: '#17120F',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Manrope', 'system-ui', 'sans-serif'],
        brush: ['"Permanent Marker"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'brand': '0 10px 30px -10px rgba(255, 113, 0, 0.25)',
        'brand-lg': '0 20px 40px -15px rgba(233, 75, 11, 0.35)',
        'warm': '0 12px 32px -8px rgba(41, 34, 29, 0.08)',
        'dark-stage': '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'gavel-strike': 'gavelStrike 0.6s ease-out',
        'bid-flash': 'bidFlash 0.8s ease-out',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(1.02)' },
        },
        gavelStrike: {
          '0%': { transform: 'rotate(-45deg) scale(0.8)', opacity: '0' },
          '50%': { transform: 'rotate(10deg) scale(1.15)', opacity: '1' },
          '100%': { transform: 'rotate(0deg) scale(1)', opacity: '1' },
        },
        bidFlash: {
          '0%': { backgroundColor: 'rgba(255, 113, 0, 0.35)', transform: 'scale(1.02)' },
          '100%': { backgroundColor: 'transparent', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
};
