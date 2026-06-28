/* ============================================================
   NIJU ICHI — Process Builder: Core helpers
   Shared state, DOM helpers, text/data normalisation used by all other modules.
   Provides (global): t, RACI_REIHENFOLGE, SLOT_REIHENFOLGE, SVG_NS, STATE,
     rName, rId, tiefKopie, setDaten, el, raciLabel, badge,
     labelFormat, tagSplit, legendeTeile, prozessIdTeile, richHTML,
     firmaElement, metaListe, punkteListe, schrittBloecke,
     normalisiereSchritte, normalisiereRaci
   Uses: NIJU.I18N, NIJU.PROZESS, NIJU.DESIGN
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* Kurzform für Übersetzungen (UI-Texte); Inhalte des Nutzers werden NIE übersetzt. */
const t = (k, vars) => NIJU.I18N.t(k, vars);


const RACI_REIHENFOLGE = ["R", "A", "C", "I"];   /* Legende-Reihenfolge */
const SLOT_REIHENFOLGE = ["C", "R", "A", "I"];   /* feste Plätze im RACI-Feld */
const SVG_NS = "http://www.w3.org/2000/svg";

/* Rollen-Helfer (Phase A2 — stabile IDs): tolerant für altes (String) und neues
   ({id,name}) Rollen-Format. Anzeige = Name, RACI-Schlüssel = id. Siehe shared/js/prozess.js. */
function rName(r) { return NIJU.PROZESS.rolleName(r); }
function rId(r)   { return NIJU.PROZESS.rolleId(r); }

/* Zentraler Zustand: die aktuell bearbeiteten Daten + Editor-Modus + Ansicht.
   ansicht: "uebersicht" | "detail"; detailIndex = angezeigter Schritt im Detail. */
const STATE = { daten: null, bearbeiten: false, zuKlappen: {}, ansicht: "uebersicht", detailIndex: 0 };

function tiefKopie(obj) { return JSON.parse(JSON.stringify(obj)); }

/* Daten setzen = Vorschau rendern und (falls offen) Editor neu aufbauen. */
function setDaten(daten) {
  STATE.daten = daten;
  render(STATE.daten);
  if (STATE.bearbeiten) baueEditor();
}

/* ---------- kleine Helfer ---------- */
function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
/* Im Badge angezeigter Text je RACI-Buchstabe (aus dem aktiven/Prozess-Design;
   Fallback = Buchstabe selbst). So lassen sich die Badges im Design umbenennen. */
function raciLabel(b) { return (window.NIJU && NIJU.DESIGN && NIJU.DESIGN.labelFor) ? NIJU.DESIGN.labelFor(b) : b; }
function badge(buchstabe) { return el("span", "badge badge-" + buchstabe, raciLabel(buchstabe)); }

/* "Input [Verantwortlich]" -> "INPUT / VERANTWORTLICH" */
function labelFormat(text) {
  return (text || "").toUpperCase().replace(/\s*\[/, " / ").replace(/\]/g, "");
}
/* "Unternehmensstrategie [CEO]" -> {text, tag} */
function tagSplit(s) {
  const m = String(s).match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (m) return { text: m[1], tag: m[2] };
  return { text: String(s), tag: null };
}
/* "Konzeptverantwortung (Responsible)" -> {titel:"Responsible", sub:"Konzeptverantwortung"} */
function legendeTeile(text) {
  const m = String(text).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { sub: m[1], titel: m[2] };
  return { sub: text, titel: "" };
}
/* "1.4.3 Organisationsentwicklung" -> {num:"1.4.3", name:"Organisationsentwicklung"} */
function prozessIdTeile(text) {
  const m = String(text || "").match(/^\s*([\d.]+)\s+(.*)$/);
  if (m) return { num: m[1], name: m[2] };
  return { num: "", name: String(text || "") };
}
/* Sichere Rich-Text-Ausgabe (Detailseite): HTML escapen, **fett** zulassen */
function richHTML(s) {
  const esc = String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/* Firma oben rechts in der Kopfzeile: als Text-Chip oder als Logo-Bild.
   meta.firmaModus = "text" | "logo"; meta.logo = Data-URL (PNG/JPEG). */
function firmaElement(m) {
  if (m.firmaModus === "logo" && m.logo) {
    const img = el("img", "firma-logo");
    img.src = m.logo;
    img.alt = m.firma || "Logo";
    return img;
  }
  if (m.firma) return el("span", "chip", m.firma);
  return null;
}

/* Aufzählung für die dunkle Meta-Seitenleiste (mit [Tag]-Unterzeile) */
function metaListe(punkte) {
  const ul = el("ul", "mliste");
  (punkte || []).forEach(p => {
    const { text, tag } = tagSplit(typeof p === "string" ? p : (p.text || ""));
    const li = el("li");
    li.appendChild(el("span", "mtext", text));
    if (tag) li.appendChild(el("span", "mtag", tag));
    ul.appendChild(li);
  });
  return ul;
}

/* Aufzählung für Schritt-Inhalt (mit optionalen Unterpunkten) */
function punkteListe(punkte) {
  const ul = el("ul", "liste");
  (punkte || []).forEach(p => {
    const li = el("li");
    const text = (typeof p === "string") ? p : (p.text || "");
    li.appendChild(el("span", "txt", text));
    const unter = (typeof p === "object" && p.unterpunkte) ? p.unterpunkte : null;
    if (unter && unter.length) {
      const subUl = el("ul");
      unter.forEach(u => subUl.appendChild(el("li", null, u)));
      li.appendChild(subUl);
    }
    ul.appendChild(li);
  });
  return ul;
}

/* ---- Schritt-Inhalt: flexibles Block-Modell (Phase B) ----------------------
   Ein Schritt hat eine geordnete Block-Folge `bloecke[]`:
     { typ:"liste", stil:"eckig", ueberschrift?, punkte:[{text,unterpunkte?}] }
     { typ:"absatz", text }
   Das alte Modell (punkteUeberschrift + punkte) wird beim Laden migriert.
   `schrittBloecke` liest beide Modelle (Fallback, ohne zu mutieren) — so
   funktionieren Renderer/Export auch ohne vorherige Migration. -------------- */
function schrittBloecke(s) {
  if (s && Array.isArray(s.bloecke)) return s.bloecke;
  return [{ typ: "liste", stil: "eckig", ueberschrift: (s && s.punkteUeberschrift) || "", punkte: (s && s.punkte) || [] }];
}
function normalisiereSchritte(daten) {
  ((daten && daten.schritte) || []).forEach(s => {
    if (Array.isArray(s.bloecke)) return;            /* schon migriert */
    const bl = [];
    if ((s.punkteUeberschrift && String(s.punkteUeberschrift).trim()) || (s.punkte && s.punkte.length)) {
      bl.push({ typ: "liste", stil: "eckig", ueberschrift: s.punkteUeberschrift || "", punkte: s.punkte || [] });
    }
    s.bloecke = bl;
    delete s.punkteUeberschrift; delete s.punkte;    /* eine Quelle der Wahrheit */
  });
  return daten;
}
/* RACI-Werte robust normalisieren: jede belegte Zelle wird zu einem Array
   gültiger, eindeutiger, kanonisch sortierter Buchstaben. Schützt vor von Hand
   geschriebenen JSONs mit String-Werten ("A" statt ["A"]) oder Mehrbuchstaben-
   Strings ("CI"): die rendern zwar (.includes greift auf Strings), würden aber
   beim ersten Klick auf eine Matrix-Zelle crashen, weil toggleRaci() .slice()/
   .push() auf einem String aufruft. Idempotent; persistiert beim Speichern
   automatisch saubere Arrays in die Datei. */
function normalisiereRaci(daten) {
  const raci = daten && daten.raci;
  if (!raci || typeof raci !== "object") return daten;
  Object.keys(raci).forEach(sid => {
    const zeile = raci[sid];
    if (!zeile || typeof zeile !== "object") { delete raci[sid]; return; }
    Object.keys(zeile).forEach(rolle => {
      const roh = zeile[rolle];
      if (roh == null) { delete zeile[rolle]; return; }
      const flach = (Array.isArray(roh) ? roh.join("") : String(roh)).toUpperCase();
      const arr = RACI_REIHENFOLGE.filter(b => flach.indexOf(b) >= 0);
      if (arr.length) zeile[rolle] = arr; else delete zeile[rolle];
    });
  });
  return daten;
}
