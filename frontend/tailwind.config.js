/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand primary is navy (matches the slate-navy of the Covey flock mark
        // and the BankID login button). The whole UI uses Tailwind's `indigo-*`
        // utilities as its single interactive/primary color, so we remap that
        // scale to a navy ramp here — recolouring every primary button, link,
        // focus ring and selected state in one place, with no per-component edits.
        // `indigo-600` (#182b56) is the canonical primary; the demo mint-theme
        // overrides in index.css still apply since they target these same classes.
        indigo: {
          50: '#eef1f8',
          100: '#d7e0f0',
          200: '#b0c0e0',
          300: '#8198c9',
          400: '#506da6',
          500: '#2e4a82',
          600: '#182b56',
          700: '#122142',
          800: '#0e1a34',
          900: '#0a1226',
        },
      },
    },
  },
  plugins: [],
}
