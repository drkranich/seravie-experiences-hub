export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0A08',
        moss: '#1A211B',
        olive: '#3E4634',
        gold: '#B69B5D',
        champagne: '#D6C49A',
        ivory: '#F4F0E6',
        sand: '#E6DFCF',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widestx: '0.32em',
        widerx: '0.22em',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0' },
          '12%': { opacity: '0.7' },
          '88%': { opacity: '0.45' },
          '100%': { transform: 'translateY(-140px) translateX(24px)', opacity: '0' },
        },
        drift: {
          '0%, 100%': { transform: 'translateX(0)', opacity: '0.22' },
          '50%': { transform: 'translateX(28px)', opacity: '0.45' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(22px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(8px)' },
        },
      },
      animation: {
        floatUp: 'floatUp linear infinite',
        drift: 'drift 16s ease-in-out infinite',
        fadeUp: 'fadeUp 1.1s ease-out both',
        shimmer: 'shimmer 4.5s ease-in-out infinite',
        bob: 'bob 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
