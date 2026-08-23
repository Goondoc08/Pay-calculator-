/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Semantic names only — the actual values live as CSS custom
      // properties in src/index.css so light and dark are two definitions
      // of one vocabulary rather than two sets of utility classes.
      colors: {
        canvas: "var(--c-canvas)",
        surface: "var(--c-surface)",
        "surface-alt": "var(--c-surface-alt)",
        line: "var(--c-line)",
        "line-strong": "var(--c-line-strong)",
        ink: "var(--c-text)",
        "ink-muted": "var(--c-text-muted)",
        brand: "var(--c-brand)",
        "brand-ink": "var(--c-brand-ink)",
        structure: "var(--c-structure)",
        accent: "var(--c-accent)",
        "accent-ink": "var(--c-accent-ink)",
        "accent-soft": "var(--c-accent-soft)",
        holiday: "var(--c-holiday)",
        "holiday-ink": "var(--c-holiday-ink)",
        "holiday-soft": "var(--c-holiday-soft)",
        warn: "var(--c-warn)",
        "warn-soft": "var(--c-warn-soft)",
        danger: "var(--c-danger)",
        "danger-ink": "var(--c-danger-ink)",
        "danger-soft": "var(--c-danger-soft)",
        good: "var(--c-good)",
        brass: "var(--c-brass)",
      },
    },
  },
  plugins: [],
};
