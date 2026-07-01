/* ============================================================
   NIJU ICHI — Process Builder: App wiring (init — LOAD LAST)
   All top-level event listeners (toolbar buttons, menu, export, import, save),
   oeffneKonfiguration, i18n/design/nav init, and startup render.
   This file is the ONLY module that calls functions at load time; all other
   builder/*.js files declare only — no DOM queries or addEventListener at
   top level except where tightly bound to a module's data structure.
   Uses: ALL other builder modules, NIJU.I18N, NIJU.DESIGN, NIJU.NAV, NIJU.CONFIG
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
btnMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!menuDropdown.hidden) { schliesseMenu(); return; }
  menuDropdown.hidden = false;
  btnMenu.setAttribute("aria-expanded", "true");
  setTimeout(() => document.addEventListener("click", aufMenuAussenklick), 0);
});
/* Untermenüs (Import/Export) per Klick auf-/zuklappen */
Array.from(menuDropdown.querySelectorAll(".has-sub")).forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const sub = btn.parentElement;
    const auf = sub.classList.contains("auf");
    menuDropdown.querySelectorAll(".menu-sub.auf").forEach(s => s.classList.remove("auf"));
    if (!auf) sub.classList.add("auf");
  });
});
document.getElementById("btnLaden").addEventListener("click", () => { schliesseMenu(); document.getElementById("dateiInput").click(); });
document.getElementById("dateiInput").addEventListener("change", (ev) => {
  const datei = ev.target.files[0];
  if (!datei) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try { setDaten(JSON.parse(e.target.result)); }
    catch (err) { alert(t("msg.jsonReadFailed", { err: err.message })); }
  };
  reader.readAsText(datei, "utf-8");
  ev.target.value = "";
});
/* Neuer Prozess aus dem eingebetteten Standard-Template */
document.getElementById("btnNeu").addEventListener("click", () => {
  schliesseMenu();
  if (STATE.daten && !confirm(t("msg.confirmNew"))) return;
  setDaten(tiefKopie(TEMPLATE_LEER));
  if (!STATE.bearbeiten) setzeBearbeiten(true);
});

/* Vorlage laden (eigene Inhalts-Vorlage als Startpunkt; gleiches JSON-Format) */
document.getElementById("btnTemplateLaden").addEventListener("click", () => {
  schliesseMenu();
  if (STATE.daten && !confirm(t("msg.confirmLoadTemplate"))) return;
  document.getElementById("templateInput").click();
});
document.getElementById("templateInput").addEventListener("change", (ev) => {
  const datei = ev.target.files[0];
  if (!datei) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      setDaten(JSON.parse(e.target.result));
      if (!STATE.bearbeiten) setzeBearbeiten(true);
    } catch (err) { alert(t("msg.jsonReadFailed", { err: err.message })); }
  };
  reader.readAsText(datei, "utf-8");
  ev.target.value = "";
});
/* Als Vorlage speichern (Dialog, gemerkter Template-Ordner) */
document.getElementById("btnTemplateSpeichern").addEventListener("click", () => { schliesseMenu(); templateSpeichern(); });

/* Bearbeiten-Modus umschalten */
document.getElementById("btnBearbeiten").addEventListener("click", () => setzeBearbeiten(!STATE.bearbeiten));

/* Download (Menü oben: klassischer Download in den Download-Ordner) */
document.getElementById("btnSave").addEventListener("click", () => { schliesseMenu(); speichern(); });
/* Speichern unter… (Menü oben: Ordner-/Dateiauswahl mit editierbarem Namen, sonst Download) */
document.getElementById("btnSaveAs").addEventListener("click", () => { schliesseMenu(); speichernAls(); });
/* Speichern als JSON-Datei (Menü: Export → JSON, klassischer Download) */
document.getElementById("btnSpeichern").addEventListener("click", () => { schliesseMenu(); speichern(); });
/* JPEG-Export (Menü: Export → JPEG) */
document.getElementById("btnJpeg").addEventListener("click", () => { schliesseMenu(); zeigeJpegDialog(); });
document.getElementById("btnHtml").addEventListener("click", () => { schliesseMenu(); exportiereHtml(); });
document.getElementById("btnHtmlBatch").addEventListener("click", () => { schliesseMenu(); htmlBatchStart(); });
/* Confluence-Export (Menü: Export → Confluence (AI)) */
document.getElementById("btnCf").addEventListener("click", () => { schliesseMenu(); exportiereConfluence(); });
document.getElementById("btnCfBatch").addEventListener("click", () => { schliesseMenu(); confluenceBatchStart(); });
/* Markdown-Export (Menü: Export → Markdown (AI)) */
document.getElementById("btnMd").addEventListener("click", () => { schliesseMenu(); exportiereMarkdown(); });
document.getElementById("btnMdBatch").addEventListener("click", () => { schliesseMenu(); mdBatchStart(); });
/* Phase 11 — bilingual export + word-list round-trip */
document.getElementById("btnBilingual").addEventListener("click", () => { schliesseMenu(); exportBilingual(); });
document.getElementById("btnWordlistExport").addEventListener("click", () => { schliesseMenu(); exportWordlist(); });
document.getElementById("btnWordlistImport").addEventListener("click", () => { schliesseMenu(); importWordlist(); });

/* Ansicht-Navigation */
document.getElementById("btnAnsichtUebersicht").addEventListener("click", () => setAnsicht("uebersicht"));
document.getElementById("btnAnsichtDetail").addEventListener("click", () => setAnsicht("detail"));
document.getElementById("schrittWahl").addEventListener("change", (ev) => {
  const idx = parseInt(ev.target.value, 10) || 0;
  setAnsicht("detail", idx);
});

/* Druck: natürliche Größe (das @media-print-CSS erzwingt transform:none
   und neutralisiert die Hülle). Vorher Seitengröße passend zur Ansicht setzen
   und die Verbinder bei natürlichen Koordinaten frisch zeichnen. */
window.addEventListener("beforeprint", () => { setzeDruckGroesse(); zeichneVerbinder(); });
window.addEventListener("afterprint", () => passeBildschirmEin());
document.getElementById("btnDrucken").addEventListener("click", () => { schliesseMenu(); window.print(); });

/* Beim Schließen des Popovers bei Fenster-Resize/Scroll aufräumen. */
window.addEventListener("resize", schliesseRaciMenu);
document.querySelector(".buehne").addEventListener("scroll", schliesseRaciMenu);

/* ============================================================
   Configuration-Ansicht (eingebettet in die Bühne)
   ============================================================ */
function oeffneKonfiguration() {
  schliesseMenu();
  schliesseRaciMenu();
  const buehne = document.querySelector(".buehne");
  const editor = document.getElementById("editor");
  const host = document.getElementById("cfgHost");
  buehne.hidden = true;
  editor.hidden = true;
  host.hidden = false;
  NIJU.CONFIG.open(host, {
    design: true,
    backup: {
      getData: function () {
        if (!STATE.daten) return { prozesse: {}, index: null };
        const m = STATE.daten.meta || {};
        let fn = (m.prozessId || m.titel || "process").replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-").toLowerCase();
        if (!fn) fn = "process";
        const prz = {};
        prz[fn + ".json"] = { data: STATE.daten, titel: m.titel || fn };
        return { prozesse: prz, index: null, name: "niju-builder-backup" };
      },
      onRestore: function (result) {
        if (result.settings) NIJU.BACKUP.applySettings(result.settings);
        NIJU.DESIGN.init(); NIJU.I18N.init();
        const keys = Object.keys(result.prozesse || {});
        if (keys.length) {
          const first = result.prozesse[keys[0]];
          setDaten((first && first.data) ? first.data : first);
        }
      }
    },
    onClose: () => {
      host.hidden = true; host.innerHTML = "";
      buehne.hidden = false;
      if (STATE.bearbeiten) editor.hidden = false;
      render(STATE.daten);
      requestAnimationFrame(passeBildschirmEin);
    }
  });
}
document.getElementById("btnConfig").addEventListener("click", oeffneKonfiguration);
document.getElementById("btnAbout").addEventListener("click", function() {
  schliesseMenu(); schliesseRaciMenu();
  var buehne = document.querySelector(".buehne"), editor = document.getElementById("editor"), host = document.getElementById("cfgHost");
  buehne.hidden = true; editor.hidden = true; host.hidden = false;
  NIJU.CONFIG.open(host, { aboutOnly: true, onClose: function() { host.hidden = true; host.innerHTML = ""; buehne.hidden = false; if (STATE.bearbeiten) editor.hidden = false; render(STATE.daten); requestAnimationFrame(passeBildschirmEin); } });
});

/* ============================================================
   Mehrsprachigkeit + Modul-Umschalter starten
   ============================================================ */
NIJU.I18N.init();                       /* gespeicherte Sprache laden + statische Labels setzen */
NIJU.DESIGN.init();                     /* gespeichertes Design + Anpassungen laden + anwenden */
/* Design-Änderung (aus der Configuration): Effektiv-Snapshot in die Daten
   stempeln, damit Speichern den aktuellen Look mitnimmt. */
NIJU.DESIGN.onChange(() => { if (STATE.daten) STATE.daten.design = NIJU.DESIGN.effektiv(); });
NIJU.NAV.mount("navWrap", "builder");   /* Marke oben rechts → Modul-Dropdown */

/* Beim Start: Beispiel rendern (Übersicht). */
setzeDruckGroesse();
aktualisiereAnsichtKnoepfe();
setDaten(BEISPIEL_DATEN);

/* Bei Sprachwechsel die dynamisch erzeugten Teile neu beschriften
   (Inhalte des Nutzers bleiben unverändert). */
NIJU.I18N.onChange(() => {
  render(STATE.daten);
  if (STATE.bearbeiten) baueEditor();
  aktualisiereAnsichtKnoepfe();
});
