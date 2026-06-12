/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0B0F14',
          light: '#131920',
          card: '#1A2128',
          border: '#2A3340',
        },
        primary: {
          DEFAULT: '#22C55E',
          hover: '#16A34A',
          dim: '#166534',
        },
        accent: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
        text: {
          primary: '#F0F4F8',
          secondary: '#94A3B8',
          dim: '#64748B',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"Helvetica Neue"', 'Arial', '"Noto Sans SC"', 'sans-serif'
        ],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      }
    },
  },
  plugins: [],
}
