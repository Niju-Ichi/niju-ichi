/* NIJU ICHI — Design "Swiss Modular" (Standard-Look). Registriert sich selbst. */
NIJU.DESIGN.register({
  "niju.design": 1,
  id: "swiss-modular",
  name: "Swiss Modular",
  builtin: true,
  tokens: {
    color: {
      ink: "#16181d", paper: "#ffffff", akzent: "#3479c9",
      muted: "#8b919b", mutedDark: "#9aa3b1", body: "#3a3f47",
      rule: "#e3e6ea", ruleMid: "#c7ccd3", ruleStrong: "#16181d",
      sidebar: "#16181d", zebra: "#f1f3f5", numSoft: "#c4c9d0",
      verbinder: "#b3bbc5"
    },
    raci: {
      R: { bg: "#e0850f", text: "#ffffff" },
      A: { bg: "#2e9e4f", text: "#ffffff" },
      C: { bg: "#3479c9", text: "#ffffff" },
      I: { bg: "#1f3a66", text: "#ffffff" }
    },
    font: {
      sans: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif',
      mono: 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
    }
  },
  options: { connectors: true, badgeShape: "square", zebra: true }
});
