/* ============================================================
   NIJU ICHI — eingebettete Demo-Library (shared)
   Leer — kein Vorinhalt. Manager und Viewer starten ohne Prozesse.
   Ordner laden: Schaltfläche "Load folder" (webkitdirectory).
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.DEMO) return;

  window.NIJU.DEMO = {
    prozesse: {},
    index: {
      version: 1,
      titel: "",
      cluster: [],
      lose: [],
      landkarte: { modus: "overlay", bild: "", bildRatio: 0.5, kaesten: [] },
      organisation: { version: 1, knoten: [] },
      wissen: { version: 1, tools: [], knowledge: [], assessment: {} }
    }
  };
})();
