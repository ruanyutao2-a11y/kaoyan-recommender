/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1D2B',
        paper: '#FAF8F5',
        vermilion: '#C43C2E',
        graphite: '#6B7280',
        indigo: '#2563A5',
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Songti SC"', 'serif'],
        body: ['"PingFang SC"', '"Microsoft YaHei"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SF Mono"', '"Menlo"', 'monospace'],
      },
    },
  },
  plugins: [],
}
