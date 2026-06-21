/* NIJU ICHI — Design "Strategy Editorial" (hell, redaktionell).
   Palette portiert aus dem Layout-Entwurf (editorial): warmes Papier,
   teal-grüner Akzent, ockerfarbenes R-Badge. Nur Farb-/Options-Tokens —
   die Daten (Textfelder, Badges, RACI) rendern wie bei den anderen Designs.
   Nur Abweichungen vom Standard; die Engine füllt den Rest auf. */
NIJU.DESIGN.register({
  "niju.design": 1,
  id: "strategy-editorial",
  name: "Strategy Editorial",
  builtin: true,
  tokens: {
    color: {
      ink: "#16243b", paper: "#fcfcfa", akzent: "#0e5c54",
      muted: "#7c879b", mutedDark: "#93a0b5", body: "#3a4a63",
      rule: "#d9dce3", ruleMid: "#aeb6c4", ruleStrong: "#16243b",
      sidebar: "#16243b", zebra: "#f4f4f0", numSoft: "#cdd2d9",
      verbinder: "#aeb6c4"
    },
    raci: {
      R: { bg: "#b5651d", text: "#ffffff" },
      A: { bg: "#15803d", text: "#ffffff" },
      C: { bg: "#2e6ca6", text: "#ffffff" },
      I: { bg: "#1b2a45", text: "#ffffff" }
    }
  },
  options: { connectors: true, badgeShape: "square", zebra: true }
});
