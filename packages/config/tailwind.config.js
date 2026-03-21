/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../../apps/web/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../apps/web/components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#e0e7ff',
          dark: '#3730a3',
        },
        secondary: '#f43f5e',
        background: '#f8fafc',
        surface: '#ffffff',
        border: '#e2e8f0',
        error: '#ef4444',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
};
