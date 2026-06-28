/* ============================================================
   NIJU ICHI — Process Builder: I/O & view control
   JSON save/download (File System Access API + IndexedDB handle cache),
   view switching (overview / detail), print-size, hamburger-menu open/close.
   Provides (global): speichern, speichernAls, templateSpeichern,
     baueJsonText, dateiName, dateiNameTemplate, idbHandleLaden,
     idbHandleSpeichern, downloadJson, speichereMitDialog,
     setzeDruckGroesse, aktualisiereAnsichtKnoepfe, setAnsicht,
     schliesseMenu, aufMenuAussenklick, btnMenu, menuDropdown
   Uses: core (STATE, setDaten), render (passeBildschirmEin), editor (baueEditor)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ----- Speichern (JSON-Download) ----- */
function dateiName() {
  const m = (STATE.daten && STATE.daten.meta) || {};
  let basis = m.prozessId || m.titel || "prozess";
  basis = basis.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-+|-+$/g, "");
  return (basis || "prozess") + ".json";
}
function dateiNameTemplate() {
  const m = (STATE.daten && STATE.daten.meta) || {};
  let basis = m.titel || "template";
  basis = basis.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-+|-+$/g, "");
  return (basis || "template") + ".json";
}

/* JSON-Text der aktuellen Daten + Design-Snapshot (reist mit der Datei, Hub). */
function baueJsonText() {
  if (window.NIJU.DESIGN) STATE.daten.design = STATE.daten.design || window.NIJU.DESIGN.effektiv();
  return JSON.stringify(STATE.daten, null, 2);
}

/* ---- Zuletzt benutzte Speicherorte merken (FileSystem-Handle in IndexedDB) ----
   Separate Schlüssel für Prozesse ("proc") und Templates ("tpl"), damit der
   Speichern-Dialog beim nächsten Mal wieder im passenden Ordner aufgeht.
   Alles defensiv: schlägt etwas fehl (z. B. file://-IndexedDB), läuft die
   Funktion ohne Merken weiter. */
function idbHandleLaden(key) {
  return new Promise(res => {
    try {
      const r = indexedDB.open("niju", 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore("handles"); } catch (e) {} };
      r.onsuccess = () => {
        try {
          const req = r.result.transaction("handles", "readonly").objectStore("handles").get(key);
          req.onsuccess = () => res(req.result || null);
          req.onerror = () => res(null);
        } catch (e) { res(null); }
      };
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbHandleSpeichern(key, val) {
  try {
    const r = indexedDB.open("niju", 1);
    r.onupgradeneeded = () => { try { r.result.createObjectStore("handles"); } catch (e) {} };
    r.onsuccess = () => { try { r.result.transaction("handles", "readwrite").objectStore("handles").put(val, key); } catch (e) {} };
  } catch (e) {}
}

/* Klassischer Download in den Download-Ordner (Fallback). */
function downloadJson(txt, name) {
  const blob = new Blob([txt], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Speichern über den Datei-Dialog (File System Access API, wo verfügbar).
   startIn = zuletzt gespeicherte Datei desselben Typs → Dialog öffnet im
   gemerkten Ordner. Rückgabe: true = erledigt (gespeichert ODER abgebrochen),
   false = API nicht verfügbar → Aufrufer soll downloaden. */
async function speichereMitDialog(txt, suggestedName, key) {
  if (!window.showSaveFilePicker) return false;
  const opts = { suggestedName: suggestedName, types: [{ description: "JSON", accept: { "application/json": [".json"] } }] };
  try { const last = await idbHandleLaden(key); if (last) opts.startIn = last; } catch (e) {}
  try {
    const handle = await window.showSaveFilePicker(opts);
    const w = await handle.createWritable();
    await w.write(txt);
    await w.close();
    idbHandleSpeichern(key, handle);   /* Ordner für nächstes Mal merken */
    return true;
  } catch (e) {
    if (e && e.name === "AbortError") return true;   /* Nutzer hat abgebrochen */
    return false;                                    /* sonst Download-Fallback */
  }
}

/* Klassischer Download (Menü: Export → JSON). */
function speichern() {
  if (!STATE.daten) { alert(t("msg.noSaveData")); return; }
  downloadJson(baueJsonText(), dateiName());
}
/* "Speichern…": Ordner-/Dateiauswahl, sonst Download. */
async function speichernAls() {
  if (!STATE.daten) { alert(t("msg.noSaveData")); return; }
  const txt = baueJsonText();
  if (!await speichereMitDialog(txt, dateiName(), "proc")) downloadJson(txt, dateiName());
}
/* "Als Vorlage speichern…": wie Speichern, aber eigener Ordner-Merker (tpl)
   und Template-Dateiname. Dieselbe JSON-Struktur wie ein Prozess. */
async function templateSpeichern() {
  if (!STATE.daten) { alert(t("msg.noSaveData")); return; }
  const txt = baueJsonText();
  if (!await speichereMitDialog(txt, dateiNameTemplate(), "tpl")) downloadJson(txt, dateiNameTemplate());
}
/* ============================================================
   Ansicht umschalten (Übersicht / Prozessschritt-Detail)
   ============================================================ */
/* Seitengröße für den Druck setzen: Übersicht = A3, Detail = A4 (je quer). */
function setzeDruckGroesse() {
  const st = document.getElementById("druckGroesse");
  /* The detail page is now 351mm wide (+25%) → no longer fits A4 landscape
     (297mm). Both views print on A3 landscape (matches the HTML export). */
  if (st) st.textContent = "@page { size: A3 landscape; margin: 8mm; }";
}
function aktualisiereAnsichtKnoepfe() {
  const bu = document.getElementById("btnAnsichtUebersicht");
  const bd = document.getElementById("btnAnsichtDetail");
  if (bu) bu.classList.toggle("aktiv", STATE.ansicht === "uebersicht");
  if (bd) bd.classList.toggle("aktiv", STATE.ansicht === "detail");
  const sichtbar = (STATE.ansicht === "detail");
  const lab = document.getElementById("schrittLab");
  const sel = document.getElementById("schrittWahl");
  if (lab) lab.style.display = sichtbar ? "" : "none";
  if (sel) sel.style.display = sichtbar ? "" : "none";
}
function setAnsicht(name, index) {
  STATE.ansicht = (name === "detail") ? "detail" : "uebersicht";
  if (typeof index === "number") STATE.detailIndex = index;
  setzeDruckGroesse();
  aktualisiereAnsichtKnoepfe();
  schliesseRaciMenu();
  render(STATE.daten);
  if (STATE.bearbeiten) baueEditor();
  requestAnimationFrame(passeBildschirmEin);
}

/* ============================================================
   Hamburger-Menü (oben links): Neu / Laden
   ============================================================ */
const btnMenu = document.getElementById("btnMenu");
const menuDropdown = document.getElementById("menuDropdown");
function schliesseMenu() {
  menuDropdown.hidden = true;
  btnMenu.setAttribute("aria-expanded", "false");
  menuDropdown.querySelectorAll(".menu-sub.auf").forEach(s => s.classList.remove("auf"));
  document.removeEventListener("click", aufMenuAussenklick);
}
function aufMenuAussenklick(e) {
  if (!menuDropdown.contains(e.target) && e.target !== btnMenu) schliesseMenu();
}
