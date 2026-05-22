/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        joule: {
          primary: '#5D36FF',
          'primary-hover': '#470CED',
          shell: '#F5F6F7',
          surface: '#FFFFFF',
          border: '#D9D9D9',
          text: '#32363A',
          'text-secondary': '#6A6D70',
          highlight: '#F0EBFF',
          accent: '#7C3AED',
          'accent-end': '#9333EA',
        },
        category: {
          warenbewegung: '#4CAF50',
          rueckmeldung: '#2196F3',
          prozess: '#FF9800',
          qualitaet: '#E91E63',
          dokumentation: '#9C27B0',
        },
      },
    },
  },
  plugins: [],
};
