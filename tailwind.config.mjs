/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ShoFlow light theme — cream paper + cocoa ink + coral accent.
        paper: "#F3EDE0",
        surface: "#EDE6D6",
        card: "#FFFCF6",
        ink: "#221D16",
        muted: "#5E5648",
        faint: "#938975",
        accent: "#E85D42",
        "accent-soft": "#F6E2D4",
        line: {
          DEFAULT: "rgba(34,29,22,0.14)",
          soft: "rgba(34,29,22,0.08)",
        },
      },
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Inter Variable"', "Inter", '"Helvetica Neue"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", '"SF Mono"', "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(34,29,22,0.04), 0 8px 30px rgba(34,29,22,0.10)",
        lift: "0 20px 60px -20px rgba(34,29,22,0.28)",
      },
      animation: {
        "slide-up": "slide-up-fade 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards",
      },
      keyframes: {
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
