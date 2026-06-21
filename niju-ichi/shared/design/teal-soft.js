/* NIJU ICHI — Design "Teal Soft": ruhigere Palette, runde Badges, ohne Zebra.
   Nur Abweichungen vom Standard; die Engine füllt den Rest auf. */
NIJU.DESIGN.register({
  "niju.design": 1,
  id: "teal-soft",
  name: "Teal Soft",
  builtin: true,
  tokens: {
    color: {
      ink: "#13302e", akzent: "#0f8a82", body: "#3c4a48",
      rule: "#e2ece9", ruleMid: "#c3d6d2", ruleStrong: "#13302e",
      sidebar: "#13302e", zebra: "#eef5f3", verbinder: "#a9c4bf"
    },
    raci: {
      R: { bg: "#e07a3f", text: "#ffffff" },
      A: { bg: "#0f8a82", text: "#ffffff" },
      C: { bg: "#3c8fb0", text: "#ffffff" },
      I: { bg: "#274b5a", text: "#ffffff" }
    }
  },
  options: { connectors: true, badgeShape: "round", zebra: false }
});
