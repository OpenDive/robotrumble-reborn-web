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
          DEFAULT: '#4f46e5', // Same as 600 for backward compatibility
        },
        secondary: {
          DEFAULT: '#FCD34D', // Yellow-400
          hover: '#FBBF24', // Yellow-500
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
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  darkMode: 'class',
}
