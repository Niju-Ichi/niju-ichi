/* NIJU ICHI — Design "Executive Dark" (Boardroom, dunkel).
   Palette portiert aus dem Layout-Entwurf (dark): dunkles Navy-Papier,
   goldener Akzent, helle Badges mit dunkler Schrift. Nur Farb-/Options-Tokens
   — die Daten (Textfelder, Badges, RACI) rendern identisch zu den anderen
   Designs; nur Aussehen/Farben wechseln, kein Datenverlust beim Umschalten.
   `ink` ist hier hell (Text/Linien auf dunklem Papier), die dunklen Flächen
   (Meta-Seitenleiste, Firmen-Chip) laufen über `sidebar`. */
NIJU.DESIGN.register({
  "niju.design": 1,
  id: "executive-dark",
  name: "Executive Dark",
  builtin: true,
  tokens: {
    color: {
      ink: "#edf1f7", paper: "#0c1626", akzent: "#c9a24b",
      muted: "#7e8fab", mutedDark: "#8c98ae", body: "#aebdd4",
      rule: "#2a405e", ruleMid: "#3a527a", ruleStrong: "#c9a24b",
      sidebar: "#15273f", zebra: "#12233c", numSoft: "#33496b",
      verbinder: "#3a527a"
    },
    raci: {
      R: { bg: "#e0944a", text: "#0c1626" },
      A: { bg: "#46b877", text: "#0c1626" },
      C: { bg: "#5c9bdb", text: "#0c1626" },
      I: { bg: "#8195b7", text: "#0c1626" }
    }
  },
  options: { connectors: true, badgeShape: "square", zebra: true }
});
