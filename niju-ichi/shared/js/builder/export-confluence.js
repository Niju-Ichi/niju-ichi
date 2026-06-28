/* ============================================================
   NIJU ICHI — Process Builder: Confluence export
   Produces Confluence Storage Format XML (structured pages per process).
   Single page and batch mode (+ manifest.json upload index).
   Provides (global): cfEsc, cfRich, cfAnchor, confluenceName,
     cfPunkte, cfBeschreibung, prozessNachConfluence,
     baueConfluenceDokument, downloadCf, exportiereConfluence,
     confluenceBatchStart, baueCfManifest, fuehreCfBatchAus,
     batchSpeichernCf, zeigeCfBatchDialog
   Uses: core (STATE, el, t, rName, rId, schrittBloecke), io (idbHandleLaden,
     idbHandleSpeichern), export-md (mdLabels, mdRaciGruppen), export-html (htmlDelay, batchTitel)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   Confluence-Export („Confluence (AI)") — NATIVE Confluence-Seiten im
   Storage-Format (XHTML + ac:-Makros) statt eingebettetem HTML-Blob.
   Der Inhalt wird so Teil des INDEXIERTEN, durchsuchbaren Seitenkörpers
   (Confluence-Suche + M365-Copilot-Connector + Atlassian Rovo lesen echten
   Text — keine iframe-/Attachment-Blackbox). REIN ADDITIV; teilt die
   lokalisierten Labels (MD_LABELS/mdLabels) und Helfer (mdSlug,
   mdRaciGruppen, idbHandle*, htmlDelay, batchTitel) mit dem Markdown-Export.
   Ausgabe je Prozess: <slug>.confluence.xml = der Wert für `body.storage.value`
   der Confluence-REST-API (POST /wiki/rest/api/content). Inhalt: TOC-Makro,
   Info-Panel (Metadaten), je Schritt Anker-Makro + Überschrift + Punkte +
   ausgeschriebenes RACI + Narrative, echte RACI-Matrix als <table> mit <th>,
   Glossar. „Confluence page" = aktueller Prozess; „Confluence batch" = je
   .xml + manifest.json (Seiten-/Korpus-Index für das Hochladen).
   ============================================================ */

/* XML-/XHTML-Escape für Text-Inhalt. */
function cfEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
/* Wie cfEsc, aber **fett** → <strong> (Confluence-XHTML). */
function cfRich(s) { return cfEsc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
/* Confluence-Anker-Makro: stabiler Deep-Link, unabhängig vom Überschriftstext. */
function cfAnchor(name) {
  return '<ac:structured-macro ac:name="anchor" ac:schema-version="1"><ac:parameter ac:name="">' + cfEsc(name) + '</ac:parameter></ac:structured-macro>';
}
function confluenceName(daten) {
  const m = ((daten || STATE.daten) || {}).meta || {};
  return (mdSlug(m.prozessId || m.titel) || "prozess") + ".confluence.xml";
}
/* Aufzählung (mit optionalen Unterpunkten) → <ul>. */
function cfPunkte(punkte) {
  let s = "";
  (punkte || []).forEach(p => {
    const text = (typeof p === "string") ? p : (p.text || "");
    const unter = (typeof p === "object" && p && p.unterpunkte) ? p.unterpunkte : null;
    s += "<li>" + cfRich(String(text).trim());
    if (unter && unter.length) { s += "<ul>"; unter.forEach(u => { s += "<li>" + cfRich(String(u).trim()) + "</li>"; }); s += "</ul>"; }
    s += "</li>";
  });
  return s ? ("<ul>" + s + "</ul>") : "";
}
/* Optionale RACI-gruppierte Narrative („beschreibung") → Absätze/Listen. */
function cfBeschreibung(beschr, L) {
  let s = "";
  (beschr || []).forEach(b => {
    const tag = L[b.raci] || b.raci || "";
    s += "<p><strong>" + cfEsc((tag ? tag + " · " : "") + String(b.titel || "").replace(/\n/g, " ")) + "</strong></p>";
    (b.inhalt || []).forEach(it => {
      if (typeof it === "string") { s += "<p>" + cfRich(String(it).trim()) + "</p>"; }
      else if (it && it.liste) {
        s += "<ul>";
        it.liste.forEach(li => {
          const text = (typeof li === "string") ? li : (li.text || "");
          const unter = (typeof li === "object" && li && li.unterpunkte) ? li.unterpunkte : null;
          s += "<li>" + cfRich(String(text).trim());
          if (unter && unter.length) { s += "<ul>"; unter.forEach(u => { s += "<li>" + cfRich(String(u).trim()) + "</li>"; }); s += "</ul>"; }
          s += "</li>";
        });
        s += "</ul>";
      }
    });
  });
  return s;
}

/* KERN: ein Prozess-Objekt → Confluence-Storage-XHTML (rein, ohne Seiteneffekte). */
function prozessNachConfluence(daten, L, heute) {
  if (!daten) return "";
  const m = daten.meta || {};
  const schritte = daten.schritte || [];
  const rollen = daten.rollen || [];
  const leg = daten.legende || {};
  let s = "";

  /* Inhaltsverzeichnis-Makro (listet die Schritt-Überschriften nativ). */
  s += '<ac:structured-macro ac:name="toc" ac:schema-version="1"/>';

  /* Metadaten als Info-Panel (sichtbar + durchsuchbar/indexierbar). */
  const info = [];
  if (m.prozessId)   info.push("<strong>" + cfEsc(L.id) + ":</strong> " + cfEsc(m.prozessId));
  if (m.processOwner) info.push("<strong>" + cfEsc(L.owner) + ":</strong> " + cfEsc(m.processOwner));
  if (m.version)     info.push("<strong>" + cfEsc(L.version) + ":</strong> " + cfEsc(m.version));
  if (m.datum)       info.push("<strong>" + cfEsc(L.date) + ":</strong> " + cfEsc(m.datum));
  if (m.firma)       info.push("<strong>" + cfEsc(L.company) + ":</strong> " + cfEsc(m.firma));
  if (info.length) s += '<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:rich-text-body><p>' + info.join("<br/>") + '</p></ac:rich-text-body></ac:structured-macro>';

  /* Input */
  const inp = (daten.input && daten.input.punkte) || [];
  if (inp.length) s += "<h2>" + cfEsc(L.input) + "</h2>" + cfPunkte(inp);

  /* Schritte: Anker + Überschrift + Punkte + ausgeschriebenes RACI + Narrative */
  schritte.forEach((sch, i) => {
    const anker = "schritt-" + (sch.id ? mdSlug(sch.id) : (i + 1));
    s += cfAnchor(anker);
    s += "<h2>" + cfEsc(L.step + " " + (i + 1) + ": " + String(sch.titel || "").trim()) + "</h2>";
    if (sch.untertitel) s += "<p><em>" + cfEsc(String(sch.untertitel).trim()) + "</em></p>";
    schrittBloecke(sch).forEach(block => {
      if (block.typ === "absatz") {
        if (block.text && String(block.text).trim()) s += "<p>" + cfRich(String(block.text).trim()) + "</p>";
      } else {
        if (block.ueberschrift) s += "<p><strong>" + cfEsc(String(block.ueberschrift).trim()) + "</strong></p>";
        s += cfPunkte(block.punkte);
      }
    });
    const g = mdRaciGruppen(daten, sch.id);
    const zeilen = ["R", "A", "C", "I"].filter(k => g[k].length);
    if (zeilen.length) {
      s += "<p><strong>" + cfEsc(L.raciHead) + ":</strong></p><ul>";
      zeilen.forEach(k => { s += "<li><strong>" + cfEsc(L[k]) + ":</strong> " + cfEsc(g[k].join(", ")) + "</li>"; });
      s += "</ul>";
    }
    if (sch.beschreibung && sch.beschreibung.length) s += cfBeschreibung(sch.beschreibung, L);
  });

  /* Output */
  const outp = (daten.output && daten.output.punkte) || [];
  if (outp.length) {
    s += "<h2>" + cfEsc(L.output) + "</h2>";
    if (daten.output.verantwortlich) s += "<p><strong>" + cfEsc(L.responsible) + ":</strong> " + cfEsc(daten.output.verantwortlich) + "</p>";
    s += cfPunkte(outp);
  }

  /* Konsolidierte RACI-Matrix als echte Confluence-Tabelle (mit Kopfzellen). */
  if (rollen.length && schritte.length) {
    s += "<h2>" + cfEsc(L.matrix) + "</h2><table><tbody><tr><th>" + cfEsc(L.role) + "</th>";
    schritte.forEach(sc => { s += "<th>" + cfEsc(String(sc.titel || sc.id || "").trim()) + "</th>"; });
    s += "</tr>";
    rollen.forEach(rolle => {
      s += "<tr><th>" + cfEsc(rName(rolle)) + "</th>";
      schritte.forEach(sc => {
        const b = (daten.raci && daten.raci[sc.id] && daten.raci[sc.id][rId(rolle)]) || [];
        s += "<td>" + cfEsc(b.join(", ") || "–") + "</td>";
      });
      s += "</tr>";
    });
    s += "</tbody></table>";
  }

  /* Glossar aus der prozess-eigenen Legende (sonst Default). */
  s += "<h2>" + cfEsc(L.glossary) + "</h2><ul>";
  ["R", "A", "C", "I"].forEach(k => { s += "<li><strong>" + cfEsc(k) + "</strong> — " + cfEsc(leg[k] || (L.legend && L.legend[k]) || "") + "</li>"; });
  s += "</ul>";

  if (m.fusstext) s += "<hr/><p><em>" + cfEsc(m.fusstext) + "</em></p>";
  return s;
}

/* Wrapper: aktueller/Ziel-Prozess → Storage-XHTML (Sprache + Datum). */
function baueConfluenceDokument(zielDaten) {
  return prozessNachConfluence(zielDaten || STATE.daten, mdLabels(), new Date().toISOString().slice(0, 10));
}
/* Klassischer Download (application/xml). */
function downloadCf(text, name) {
  const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
/* „Confluence page": aktueller Prozess → eine .confluence.xml. */
function exportiereConfluence() {
  if (!STATE.daten || !STATE.daten.meta) { alert(t("msg.noSaveData")); return; }
  let xml;
  try { xml = baueConfluenceDokument(STATE.daten); }
  catch (e) { alert(t("html.failed", { err: (e && e.message) || String(e) })); return; }
  downloadCf(xml, confluenceName(STATE.daten));
}

/* ---- „Confluence batch": gewählte JSONs → je .confluence.xml + manifest.json ---- */
const confluenceBatchInput = document.getElementById("confluenceBatchInput");
function confluenceBatchStart() { confluenceBatchInput.value = ""; confluenceBatchInput.click(); }
confluenceBatchInput.addEventListener("change", (ev) => {
  const files = Array.from(ev.target.files || []);
  if (!files.length) return;
  const kandidaten = [];
  let rest = files.length;
  const fertig = () => { if (--rest === 0) zeigeCfBatchDialog(kandidaten); };
  files.forEach(f => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d && d.meta && Array.isArray(d.schritte)) kandidaten.push({ file: f.name, daten: d });
      } catch (err) {}
      fertig();
    };
    r.onerror = fertig;
    r.readAsText(f, "utf-8");
  });
});

/* manifest.json = Seiten-/Korpus-Index für das Hochladen via Confluence-REST-API. */
function baueCfManifest(dateien, heute) {
  return JSON.stringify({
    "niju.manifest": 1,
    format: "confluence-storage",
    generator: "NIJU ICHI Process Builder",
    erstellt: heute,
    anzahl: dateien.length,
    prozesse: dateien.map(d => {
      const m = d.daten.meta || {};
      return {
        datei: d.name,
        titel: m.titel || "",
        prozessId: m.prozessId || "",
        owner: m.processOwner || "",
        version: m.version || "",
        stand: m.datum || "",
        schritte: (d.daten.schritte || []).length,
        rollen: (d.daten.rollen || []).map(rName)
      };
    })
  }, null, 2);
}

async function fuehreCfBatchAus(auswahl) {
  const heute = new Date().toISOString().slice(0, 10);
  const L = mdLabels();
  const gesehen = {};
  const dateien = auswahl.map(k => {
    let name = confluenceName(k.daten);
    if (gesehen[name]) { const basis = name.replace(/\.confluence\.xml$/, ""); let i = 2; while (gesehen[basis + "-" + i + ".confluence.xml"]) i++; name = basis + "-" + i + ".confluence.xml"; }
    gesehen[name] = true;
    return { name: name, text: prozessNachConfluence(k.daten, L, heute), daten: k.daten };
  });
  return await batchSpeichernCf(dateien, heute);
}

/* Ausgabe: bevorzugt Zielordner (File System Access) inkl. manifest.json,
   sonst Einzel-Downloads (+ manifest.json). Eigener Ordner-Merker „cfout". */
async function batchSpeichernCf(dateien, heute) {
  const manifest = baueCfManifest(dateien, heute);
  if (window.showDirectoryPicker) {
    let dir = null;
    try {
      const opts = { mode: "readwrite" };
      try { const last = await idbHandleLaden("cfout"); if (last) opts.startIn = last; } catch (e) {}
      dir = await window.showDirectoryPicker(opts);
    } catch (e) { if (e && e.name === "AbortError") return { aborted: true }; }
    if (dir) {
      for (const d of dateien) {
        const fh = await dir.getFileHandle(d.name, { create: true });
        const w = await fh.createWritable(); await w.write(d.text); await w.close();
      }
      const mh = await dir.getFileHandle("manifest.json", { create: true });
      const mw = await mh.createWritable(); await mw.write(manifest); await mw.close();
      idbHandleSpeichern("cfout", dir);
      return { written: dateien.length, folder: true };
    }
  }
  for (const d of dateien) { downloadCf(d.text, d.name); await htmlDelay(180); }
  downloadCf(manifest, "manifest.json");
  return { written: dateien.length, folder: false };
}

/* Auswahl-Dialog (eigenständig — lässt HTML-/Markdown-Stapel unberührt). */
function zeigeCfBatchDialog(kandidaten) {
  const alt = document.getElementById("cfBatchOverlay"); if (alt) alt.remove();
  if (!kandidaten.length) { alert(t("cfBatch.none")); return; }
  kandidaten.sort((a, b) => batchTitel(a).localeCompare(batchTitel(b)));

  const overlay = el("div", "import-overlay"); overlay.id = "cfBatchOverlay";
  const dialog = el("div", "import-dialog"); dialog.style.width = "min(540px, 94vw)";
  const kopf = el("div", "import-kopf");
  kopf.appendChild(el("h2", null, t("cfBatch.title")));
  kopf.appendChild(el("p", null, t("cfBatch.intro")));
  dialog.appendChild(kopf);

  const body = el("div", "import-body");
  const liste = el("div", "batch-liste");
  const checks = [];
  kandidaten.forEach(k => {
    const row = el("label", "batch-row");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true;
    cb.addEventListener("change", aktualisiere);
    const txt = el("div", "batch-txt");
    txt.appendChild(el("div", "batch-titel", batchTitel(k)));
    txt.appendChild(el("div", "batch-datei", k.file));
    row.appendChild(cb); row.appendChild(txt);
    liste.appendChild(row);
    checks.push({ cb: cb, k: k });
  });
  body.appendChild(liste);
  dialog.appendChild(body);

  const fuss = el("div", "import-fuss");
  const summe = el("div", "summe"); fuss.appendChild(summe);
  const alleBtn = el("button", "btn-sek", "");
  alleBtn.addEventListener("click", () => {
    const an = checks.some(c => !c.cb.checked);
    checks.forEach(c => c.cb.checked = an); aktualisiere();
  });
  const abbrechen = el("button", "btn-sek", t("cfBatch.cancel"));
  abbrechen.addEventListener("click", () => overlay.remove());
  const exportBtn = el("button", "btn-akt", "");
  exportBtn.addEventListener("click", async () => {
    const auswahl = checks.filter(c => c.cb.checked).map(c => c.k);
    if (!auswahl.length) return;
    exportBtn.disabled = abbrechen.disabled = alleBtn.disabled = true;
    summe.textContent = t("cfBatch.working");
    try {
      const res = await fuehreCfBatchAus(auswahl);
      overlay.remove();
      if (res && !res.aborted) {
        alert(res.folder ? t("cfBatch.writtenFolder", { n: res.written })
                         : t("cfBatch.done", { n: res.written }));
      }
    } catch (e) {
      exportBtn.disabled = abbrechen.disabled = alleBtn.disabled = false;
      summe.textContent = "";
      alert(t("html.failed", { err: (e && e.message) || String(e) }));
    }
  });

  function aktualisiere() {
    const nn = checks.filter(c => c.cb.checked).length;
    summe.textContent = t("cfBatch.count", { n: nn });
    exportBtn.textContent = t("cfBatch.export", { n: nn });
    exportBtn.disabled = (nn === 0);
    alleBtn.textContent = checks.some(c => !c.cb.checked) ? t("cfBatch.selectAll") : t("cfBatch.deselectAll");
  }

  fuss.appendChild(alleBtn); fuss.appendChild(abbrechen); fuss.appendChild(exportBtn);
  dialog.appendChild(fuss);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  aktualisiere();
}
