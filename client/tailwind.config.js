/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        joule: {
          primary: '#0070F2',
          'primary-hover': '#0057D2',
          shell: '#F5F6F7',
          surface: '#FFFFFF',
          border: '#D9D9D9',
          text: '#32363A',
          'text-secondary': '#6A6D70',
          accent: '#5D36FF',
          'accent-end': '#0070F2',
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
