/* ============================================================
   NIJU ICHI — eingebettete Demo-Library (shared)
   Kleiner, klar FIKTIVER Beispiel-Datensatz (keine echten/personen-
   bezogenen Daten), damit Manager, Viewer und Brain beim ersten Start
   sofort etwas Sinnvolles zeigen statt einer leeren Bühne.
   Firma "Muster GmbH"; Rollen sind Funktionen, nicht Personen.
   Eigene Daten laden: Schaltfläche "Load folder" (webkitdirectory).
   Org<->Prozess-Bindung läuft über Namens-Gleichheit der Rollen.
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.DEMO) return;

  /* ---- Prozess 1: Blogartikel veröffentlichen ---- */
  var blog = {
    meta: {
      titel: "Blogartikel veröffentlichen", firma: "Muster GmbH", firmaModus: "text", logo: "",
      prozessId: "3.1 Blog", version: "1.0", datum: "01.06.2026",
      processOwner: "Marketing", fusstext: "Demo – Blogartikel veröffentlichen"
    },
    input: { label: "Input [Auslöser]", punkte: ["Themenidee [Redaktion]", "Redaktionsplan [Marketing]"] },
    output: { label: "Output [Ergebnis]", verantwortlich: "Marketing", punkte: ["Veröffentlichter Artikel", "Social-Media-Post"] },
    schritte: [
      { id: "s0", titel: "Standards", untertitel: "Styleguide & Regeln", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Tonalität & Stil" }, { text: "SEO-Richtlinie" }], beschreibung: [] },
      { id: "s1", titel: "Schritt 1", untertitel: "Recherche & Entwurf", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Quellen prüfen" }, { text: "Rohtext schreiben" }], beschreibung: [] },
      { id: "s2", titel: "Schritt 2", untertitel: "Lektorat", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Korrektur lesen" }, { text: "Faktencheck" }], beschreibung: [] },
      { id: "s3", titel: "Schritt 3", untertitel: "Veröffentlichung", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Im CMS einplanen" }, { text: "Social-Media-Post" }], beschreibung: [] }
    ],
    rollen: ["Redaktion", "Lektorat", "Marketing", "Social Media"],
    raci: {
      s0: { "Marketing": ["A"], "Redaktion": ["R"] },
      s1: { "Redaktion": ["R", "A"], "Lektorat": ["C"] },
      s2: { "Lektorat": ["R"], "Marketing": ["A"], "Redaktion": ["C", "I"] },
      s3: { "Marketing": ["R", "A"], "Social Media": ["R"], "Redaktion": ["I"] }
    },
    legende: {
      R: "Durchführungsverantwortung (Responsible)",
      A: "Ergebnisverantwortung (Accountable)",
      C: "Mitwirkung (Consulted)",
      I: "Informationsrecht (Informed)"
    }
  };

  /* ---- Prozess 2: Newsletter versenden ---- */
  var news = {
    meta: {
      titel: "Newsletter versenden", firma: "Muster GmbH", firmaModus: "text", logo: "",
      prozessId: "3.2 Newsletter", version: "1.0", datum: "01.06.2026",
      processOwner: "Marketing", fusstext: "Demo – Newsletter versenden"
    },
    input: { label: "Input [Auslöser]", punkte: ["Redaktionsschluss [Marketing]", "Beitragsliste [Redaktion]"] },
    output: { label: "Output [Ergebnis]", verantwortlich: "Marketing", punkte: ["Versendeter Newsletter"] },
    schritte: [
      { id: "s0", titel: "Standards", untertitel: "Vorlage & Rhythmus", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Monatlicher Versand" }, { text: "Freigabe-Regel" }], beschreibung: [] },
      { id: "s1", titel: "Schritt 1", untertitel: "Inhalte kuratieren", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Themen sammeln" }, { text: "Texte kürzen" }], beschreibung: [] },
      { id: "s2", titel: "Schritt 2", untertitel: "Versand", punkteUeberschrift: "Dazu gehört:", punkte: [{ text: "Testversand" }, { text: "Finaler Versand" }], beschreibung: [] }
    ],
    rollen: ["Marketing", "Redaktion", "Social Media"],
    raci: {
      s0: { "Marketing": ["R", "A"] },
      s1: { "Marketing": ["R", "A"], "Redaktion": ["C"] },
      s2: { "Marketing": ["R", "A"], "Social Media": ["I"] }
    },
    legende: {
      R: "Durchführungsverantwortung (Responsible)",
      A: "Ergebnisverantwortung (Accountable)",
      C: "Mitwirkung (Consulted)",
      I: "Informationsrecht (Informed)"
    }
  };

  /* Verzeichnis-Eintrag in derselben Hülle, die der echte Ordner-Loader
     (library.js) erzeugt: { name, titel, meta, data, fehler } — der rohe
     Prozess liegt unter .data. Manager/Viewer/Brain erwarten diese Form. */
  function entry(name, data) {
    return { name: name, titel: data.meta.titel, meta: data.meta, data: data, fehler: false };
  }

  window.NIJU.DEMO = {
    prozesse: {
      "blogartikel-veroeffentlichen.json": entry("blogartikel-veroeffentlichen.json", blog),
      "newsletter-versenden.json": entry("newsletter-versenden.json", news)
    },
    index: {
      version: 1,
      titel: "Demo – Muster GmbH",
      cluster: [
        {
          id: "c_content",
          name: "Content & Marketing",
          prozesse: ["blogartikel-veroeffentlichen.json", "newsletter-versenden.json"],
          cluster: []
        }
      ],
      lose: [],
      landkarte: {
        modus: "overlay", bild: "", bildRatio: 0.5,
        kaesten: [
          { id: "b_content", x: 12, y: 30, w: 40, h: 26, label: "Content & Marketing", farbe: "#3479c9", form: "rect", ziel: { typ: "cluster", ref: "c_content" } },
          { id: "b_blog", x: 58, y: 20, w: 34, h: 18, label: "Blogartikel veröffentlichen", farbe: "#2e9e4f", form: "rect", ziel: { typ: "prozess", ref: "blogartikel-veroeffentlichen.json" } },
          { id: "b_news", x: 58, y: 48, w: 34, h: 18, label: "Newsletter versenden", farbe: "#e0850f", form: "rect", ziel: { typ: "prozess", ref: "newsletter-versenden.json" } }
        ]
      },
      organisation: {
        version: 1,
        knoten: [
          /* Drei Abteilungen als oberste Funktionen = drei Team-Farben im Brain.
             "IT" hat (bewusst) keine Rolle in den Prozessen → unbesetzte Stelle. */
          { id: "o_mk", name: "Marketing & Kommunikation", parent: "", typ: "funktion" },
          { id: "o_qs", name: "Qualität", parent: "", typ: "funktion" },
          { id: "o_it", name: "IT", parent: "", typ: "funktion" },
          { id: "o_red", name: "Redaktion", parent: "o_mk", typ: "rolle" },
          { id: "o_mkt", name: "Marketing", parent: "o_mk", typ: "rolle" },
          { id: "o_sm", name: "Social Media", parent: "o_mk", typ: "rolle" },
          { id: "o_lek", name: "Lektorat", parent: "o_qs", typ: "rolle" }
        ]
      },
      wissen: {
        version: 1,
        tools: [
          { id: "w_cms", name: "Redaktions-CMS", kind: "saas", category: "CMS", cost: 90, owner: "Marketing", hosting: "eu", pii: false, aiAct: "minimal", aiPhase: 0, aiKind: "", usedBy: ["Redaktion", "Lektorat"], supports: ["blogartikel-veroeffentlichen.json"] },
          { id: "w_ai", name: "Text-Assistent (KI)", kind: "ai", category: "AI Co-Pilot", cost: 0, owner: "Redaktion", hosting: "eu", pii: false, aiAct: "limited", aiPhase: 1, aiKind: "copilot", usedBy: ["Redaktion"], supports: ["blogartikel-veroeffentlichen.json"] },
          { id: "w_mail", name: "Newsletter-Tool", kind: "saas", category: "E-Mail-Marketing", cost: 45, owner: "Marketing", hosting: "eu", pii: true, aiAct: "limited", aiPhase: 0, aiKind: "", usedBy: ["Marketing"], supports: ["newsletter-versenden.json"] },
          { id: "w_an", name: "Web-Analytics", kind: "saas", category: "Analytics", cost: 60, owner: "Marketing", hosting: "us", pii: true, aiAct: "minimal", aiPhase: 0, aiKind: "", usedBy: ["Marketing", "Social Media"], supports: ["blogartikel-veroeffentlichen.json", "newsletter-versenden.json"] }
        ],
        knowledge: [
          { id: "k_style", name: "Styleguide", type: "policy", url: "", documents: ["blogartikel-veroeffentlichen.json"] },
          { id: "k_check", name: "Newsletter-Checkliste", type: "runbook", url: "", documents: ["newsletter-versenden.json"] }
        ],
        assessment: {
          "blogartikel-veroeffentlichen.json": { frequency: "weekly", criticality: "high", docStatus: "full", aiPotential: "high" },
          "newsletter-versenden.json": { frequency: "monthly", criticality: "high", docStatus: "full", aiPotential: "high" }
        }
      }
    }
  };
})();
