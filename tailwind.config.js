/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          '50':  '#eef2ff',
          '100': '#e0e7ff',
          '200': '#c7d2fe',
          '300': '#a5b4fc',
          '400': '#818cf8',
          '500': '#6366f1',
          '600': '#4f46e5',
          '700': '#4338ca',
          '800': '#3730a3',
          '900': '#312e81',
          '950': '#1e1b4b',
          DEFAULT: '#4f46e5',
        },
        game: {
          '50':  '#f5f7ff',
          '100': '#ebf0fe',
          '200': '#dce3fd',
          '300': '#c2cdfb',
          '400': '#9faef8',
          '500': '#7b8df4',
          '600': '#5668ed',
          '700': '#3d4bdb',
          '800': '#1e2976',
          '900': '#0c1133',
          '950': '#070a1f',
          DEFAULT: '#4f46e5'
        },
        racing: {
          red: '#FF4C4C',
          blue: '#4C9EFF',
          yellow: '#FFD700',
          green: '#50C878',
        },
        neon: {
          glow: '#00FF9580',
          purple: '#B24BF3',
          blue: '#4C9EFF',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'button-press': 'button-press 0.2s ease-in-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px #00FF95, 0 0 20px #00FF95, 0 0 50px #00FF95' },
          '50%': { boxShadow: '0 0 10px #00FF95, 0 0 30px #00FF95, 0 0 60px #00FF95' },
        },
        'button-press': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.98)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'racing-pattern': 'repeating-conic-gradient(from 0deg, #ffffff11 0deg 10deg, #00000000 10deg 20deg)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  darkMode: 'class',
}
