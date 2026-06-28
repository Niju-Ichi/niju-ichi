/* ============================================================
   NIJU ICHI — Process Builder: Sample data
   Embedded default process (shown on startup) and empty template.
   Provides (global): BEISPIEL_DATEN, TEMPLATE_LEER
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   Embedded sample data (neutral default — released build)
   ============================================================ */
const BEISPIEL_DATEN = {
  "meta": {
    "titel": "Sample Process - Overview",
    "firma": "Your Company",
    "firmaModus": "text",
    "logo": "",
    "prozessId": "0.0 Sample",
    "version": "1.0",
    "datum": "2026-01-01",
    "processOwner": "Process Owner",
    "fusstext": "Sample process - overview"
  },
  "input": {
    "label": "Input [Responsible]",
    "punkte": [
      "Trigger [Role A]"
    ]
  },
  "output": {
    "label": "Output [Responsible]",
    "verantwortlich": "Team",
    "punkte": [
      "Result"
    ]
  },
  "schritte": [
    {
      "id": "step1",
      "kopfId": "1",
      "titel": "First step",
      "untertitel": "What happens here",
      "bloecke": [
        {
          "typ": "liste",
          "stil": "eckig",
          "ueberschrift": "This includes:",
          "punkte": [
            {
              "text": "First point",
              "unterpunkte": [
                "Sub-point one",
                "Sub-point two"
              ]
            },
            {
              "text": "Second point"
            }
          ]
        },
        {
          "typ": "absatz",
          "text": "Free text paragraph between two lists."
        },
        {
          "typ": "liste",
          "stil": "eckig",
          "ueberschrift": "Also note:",
          "punkte": [
            {
              "text": "Another point"
            }
          ]
        }
      ],
      "beschreibung": []
    },
    {
      "id": "step2",
      "kopfId": "2",
      "titel": "Second step",
      "untertitel": "Continue the process",
      "bloecke": [
        {
          "typ": "liste",
          "stil": "eckig",
          "ueberschrift": "This includes:",
          "punkte": [
            {
              "text": "A task"
            }
          ]
        }
      ],
      "beschreibung": []
    }
  ],
  "rollen": [
    "Role A",
    "Role B",
    "Team"
  ],
  "raci": {
    "step1": {
      "Role A": [
        "R"
      ],
      "Role B": [
        "A"
      ],
      "Team": [
        "C",
        "I"
      ]
    },
    "step2": {
      "Role A": [
        "A"
      ],
      "Role B": [
        "R"
      ],
      "Team": [
        "I"
      ]
    }
  },
  "legende": {
    "R": "Responsible",
    "A": "Accountable",
    "C": "Consulted",
    "I": "Informed"
  }
};

/* Eingebettetes Standard-Template (inhaltsgleich zu data/templates/standard.json),
   damit "Neuer Prozess" auch per Doppelklick ohne Server offline funktioniert.
   Bei Änderungen beide synchron halten. */
const TEMPLATE_LEER = {
  "meta": { "titel": "New process overview", "firma": "", "firmaModus": "text", "logo": "", "prozessId": "", "version": "1.0", "datum": "", "processOwner": "", "fusstext": "" },
  "input": { "label": "Input [Responsible]", "punkte": [""] },
  "output": { "label": "Output [Responsible]", "verantwortlich": "", "punkte": [""] },
  "schritte": [
    { "id": "standards", "kopfId": "", "titel": "Standards", "untertitel": "", "punkteUeberschrift": "Standards to develop:", "punkte": [{ "text": "" }], "beschreibung": [] },
    { "id": "schritt1", "kopfId": "", "titel": "Process step 1", "untertitel": "", "punkteUeberschrift": "This includes:", "punkte": [{ "text": "" }], "beschreibung": [] },
    { "id": "schritt2", "kopfId": "", "titel": "Process step 2", "untertitel": "", "punkteUeberschrift": "This includes:", "punkte": [{ "text": "" }], "beschreibung": [] },
    { "id": "schritt3", "kopfId": "", "titel": "Process step 3", "untertitel": "", "punkteUeberschrift": "This includes:", "punkte": [{ "text": "" }], "beschreibung": [] },
    { "id": "schritt4", "kopfId": "", "titel": "Process step 4", "untertitel": "", "punkteUeberschrift": "This includes:", "punkte": [{ "text": "" }], "beschreibung": [] }
  ],
  "rollen": [],
  "raci": { "standards": {}, "schritt1": {}, "schritt2": {}, "schritt3": {}, "schritt4": {} },
  "legende": {
    "R": "Concept responsibility (Responsible)",
    "A": "Decision responsibility (Accountable)",
    "C": "Contribution responsibility (Consulted)",
    "I": "Right to be informed (Informed)"
  }
};
