/** @type {import('tailwindcss').Config} */

// The tokens live as raw "R G B" channels in src/index.css; wrapping them in
// rgb(... / <alpha-value>) is what lets `bg-surface/95` and friends work.
// Using the bare `var(--token)` form here would make every /opacity class
// emit invalid CSS and silently fall back to an inherited colour.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        "surface-alt": token("surface-alt"),
        line: token("line"),
        "line-strong": token("line-strong"),
        ink: token("text"),
        "ink-muted": token("text-muted"),
        brand: token("brand"),
        "brand-ink": token("brand-ink"),
        structure: token("structure"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        "accent-soft": token("accent-soft"),
        holiday: token("holiday"),
        "holiday-ink": token("holiday-ink"),
        "holiday-soft": token("holiday-soft"),
        warn: token("warn"),
        "warn-soft": token("warn-soft"),
        good: token("good"),
        brass: token("brass"),
        danger: token("danger"),
        "danger-ink": token("danger-ink"),
        "danger-soft": token("danger-soft"),
      },
    },
  },
  plugins: [],
};
