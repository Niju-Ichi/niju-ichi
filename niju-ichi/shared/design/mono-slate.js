/* NIJU ICHI — Design "Mono Slate": zurückhaltend, graublau, ohne Verbinder.
   Nur Abweichungen vom Standard; die Engine füllt den Rest auf. */
NIJU.DESIGN.register({
  "niju.design": 1,
  id: "mono-slate",
  name: "Mono Slate",
  builtin: true,
  tokens: {
    color: {
      ink: "#1f2630", akzent: "#4b6584", body: "#454f5b",
      rule: "#e6e9ed", ruleMid: "#c5ccd4", ruleStrong: "#1f2630",
      sidebar: "#272f3a", zebra: "#f2f4f6", verbinder: "#b6bdc6"
    },
    raci: {
      R: { bg: "#5a6b7e", text: "#ffffff" },
      A: { bg: "#2f3a47", text: "#ffffff" },
      C: { bg: "#8a95a3", text: "#ffffff" },
      I: { bg: "#c2c9d2", text: "#1f2630" }
    }
  },
  options: { connectors: false, badgeShape: "square", zebra: true }
});
