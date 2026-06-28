/* ============================================================
   NIJU ICHI — Process Builder: Markdown export
   Produces machine-readable Markdown (LLM/RAG-optimised): YAML front-matter,
   prose narrative, RACI spelled out, consolidated matrix table, glossary.
   Single page and batch mode (+ manifest.json corpus index).
   Provides (global): mdLabels, mdSlug, mdName, mdYaml, mdCell,
     mdRaciGruppen, mdPunkte, mdBeschreibung, prozessNachMarkdown,
     baueMarkdownDokument, downloadMd, exportiereMarkdown,
     mdBatchStart, baueManifest, fuehreMdBatchAus,
     batchSpeichernMd, zeigeMdBatchDialog
   Uses: core (STATE, el, t, rName, rId, schrittBloecke), io (idbHandleLaden,
     idbHandleSpeichern), export-html (htmlDelay, batchTitel)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   Markdown-Export („Markdown (AI)") — maschinenlesbare Prosa-Fassung
   für KI/RAG (M365-Copilot, Atlassian-Rovo, Custom-RAG). REIN ADDITIV:
   nutzt dieselben Prozessdaten wie der JSON-/HTML-Export und ändert KEINE
   bestehende Funktion. Inhalt je Prozess: YAML-Front-Matter (Metadaten) ·
   Steckbrief · Input/Output · je Schritt Klartext + ausgeschriebenes RACI +
   stabiler Anker · konsolidierte RACI-Matrix (Tabelle) · Glossar (aus der
   prozess-eigenen Legende). RACI-Buchstaben werden in Klartext-Sätze
   aufgelöst — genau das, was ein Retrieval-System (RAG) lesen kann.
   - „Markdown page": aktueller Prozess → eine .md-Datei (Download).
   - „Markdown batch": gewählte JSON-Dateien → je eine .md + manifest.json
     (Korpus-Index) in einen Zielordner (File System Access) oder Downloads.
   ============================================================ */

/* Lokalisierte STRUKTUR-Labels (nur das Gerüst, KEIN Nutzer-Inhalt — der
   bleibt unübersetzt). Fällt auf Englisch zurück. */
const MD_LABELS = {
  en: { step: "Step", input: "Input", output: "Output", responsible: "Responsible",
        owner: "Process owner", version: "Version", date: "Date", company: "Company",
        id: "Process ID", anchor: "Anchor", profile: "At a glance",
        raciHead: "RACI for this step", matrix: "RACI matrix (roles × steps)",
        role: "Role", glossary: "Glossary",
        R: "Responsible (R)", A: "Accountable (A)", C: "Consulted (C)", I: "Informed (I)",
        legend: { R: "Responsible — does the work",
                  A: "Accountable — owns the decision / sign-off",
                  C: "Consulted — gives input", I: "Informed — kept up to date" } },
  de: { step: "Schritt", input: "Input", output: "Output", responsible: "Verantwortlich",
        owner: "Process Owner", version: "Version", date: "Stand", company: "Firma",
        id: "Prozess-ID", anchor: "Anker", profile: "Steckbrief",
        raciHead: "RACI für diesen Schritt", matrix: "RACI-Matrix (Rollen × Schritte)",
        role: "Rolle", glossary: "Glossar",
        R: "Verantwortlich (R)", A: "Rechenschaftspflichtig (A)", C: "Konsultiert (C)", I: "Informiert (I)",
        legend: { R: "Verantwortlich — führt die Arbeit aus",
                  A: "Rechenschaftspflichtig — trägt Entscheidung / Freigabe",
                  C: "Konsultiert — wird um Input gebeten", I: "Informiert — wird auf dem Laufenden gehalten" } },
  ja: { step: "ステップ", input: "インプット", output: "アウトプット", responsible: "担当",
        owner: "プロセスオーナー", version: "バージョン", date: "日付", company: "会社",
        id: "プロセスID", anchor: "アンカー", profile: "概要",
        raciHead: "このステップのRACI", matrix: "RACIマトリクス（役割 × ステップ）",
        role: "役割", glossary: "用語集",
        R: "実行責任 (R)", A: "説明責任 (A)", C: "協業 (C)", I: "報告 (I)",
        legend: { R: "実行責任 — 作業を行う",
                  A: "説明責任 — 決定・承認を持つ",
                  C: "協業 — 意見を提供する", I: "報告 — 情報を共有される" } }
};
function mdLabels() {
  const lang = (window.NIJU && NIJU.I18N && NIJU.I18N.get && NIJU.I18N.get()) || "en";
  return MD_LABELS[lang] || MD_LABELS.en;
}

/* slug aus beliebigem Text — für Dateiname + Anker (stabiler Deep-Link). */
function mdSlug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-+|-+$/g, "");
}
function mdName(daten) {
  const m = ((daten || STATE.daten) || {}).meta || {};
  return (mdSlug(m.prozessId || m.titel) || "prozess") + ".md";
}
/* YAML-Wert sicher quoten. */
function mdYaml(v) {
  return '"' + String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
/* Tabellenzelle: Pipe maskieren, Zeilenumbrüche zu Leerzeichen. */
function mdCell(v) {
  return String(v == null ? "" : v).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

/* RACI eines Schritts nach Buchstabe gruppieren → { R:[rollen], A:[…], C:[…], I:[…] }. */
function mdRaciGruppen(daten, stepId) {
  const out = { R: [], A: [], C: [], I: [] };
  const row = (daten.raci && daten.raci[stepId]) || {};
  (daten.rollen || []).forEach(rolle => {
    (row[rId(rolle)] || []).forEach(b => { if (out[b]) out[b].push(rName(rolle)); });
  });
  return out;
}
/* Aufzählungspunkte eines Schritts (mit optionalen Unterpunkten). */
function mdPunkte(punkte) {
  let s = "";
  (punkte || []).forEach(p => {
    const text = (typeof p === "string") ? p : (p.text || "");
    s += "- " + String(text).trim() + "\n";
    const unter = (typeof p === "object" && p && p.unterpunkte) ? p.unterpunkte : null;
    if (unter && unter.length) unter.forEach(u => { s += "  - " + String(u).trim() + "\n"; });
  });
  return s;
}
/* Optionale RACI-gruppierte Narrative („beschreibung"). **fett** bleibt erhalten. */
function mdBeschreibung(beschr, L) {
  let s = "";
  (beschr || []).forEach(b => {
    const tag = L[b.raci] || b.raci || "";
    s += "\n**" + (tag ? tag + " · " : "") + String(b.titel || "").replace(/\n/g, " ") + "**\n\n";
    (b.inhalt || []).forEach(it => {
      if (typeof it === "string") { s += String(it).trim() + "\n\n"; }
      else if (it && it.liste) {
        it.liste.forEach(li => {
          const text = (typeof li === "string") ? li : (li.text || "");
          s += "- " + String(text).trim() + "\n";
          const unter = (typeof li === "object" && li && li.unterpunkte) ? li.unterpunkte : null;
          if (unter && unter.length) unter.forEach(u => { s += "  - " + String(u).trim() + "\n"; });
        });
        s += "\n";
      }
    });
  });
  return s;
}

/* KERN: ein Prozess-Objekt → vollständiges Markdown (rein, ohne Seiteneffekte). */
function prozessNachMarkdown(daten, L, heute) {
  if (!daten) return "";
  const m = daten.meta || {};
  const schritte = daten.schritte || [];
  const rollen = daten.rollen || [];
  const leg = daten.legende || {};
  const NL = "\n";
  let s = "";

  /* --- YAML-Front-Matter (Metadaten für Retrieval) --- */
  s += "---" + NL;
  s += "prozess_id: " + mdYaml(m.prozessId || "") + NL;
  s += "titel: " + mdYaml(m.titel || "") + NL;
  s += "owner: " + mdYaml(m.processOwner || "") + NL;
  s += "version: " + mdYaml(m.version || "") + NL;
  s += "stand: " + mdYaml(m.datum || "") + NL;
  if (m.firma) s += "firma: " + mdYaml(m.firma) + NL;
  s += "schritte: " + schritte.length + NL;
  s += "rollen: [" + rollen.map(r => mdYaml(rName(r))).join(", ") + "]" + NL;
  s += "quelle: " + mdYaml("") + NL;
  s += "generator: " + mdYaml("NIJU ICHI Process Builder") + NL;
  s += "exportiert: " + mdYaml(heute) + NL;
  s += "---" + NL + NL;

  /* --- Titel + Steckbrief --- */
  s += "# " + (m.titel || "Prozess") + NL + NL;
  const steck = [];
  if (m.prozessId) steck.push(L.id + ": " + m.prozessId);
  if (m.processOwner) steck.push(L.owner + ": " + m.processOwner);
  if (m.version) steck.push(L.version + ": " + m.version);
  if (m.datum) steck.push(L.date + ": " + m.datum);
  if (steck.length) s += "**" + L.profile + ":** " + steck.join(" · ") + NL + NL;

  /* --- Input --- */
  const inp = (daten.input && daten.input.punkte) || [];
  if (inp.length) {
    s += "## " + L.input + NL + NL;
    inp.forEach(p => { s += "- " + String(typeof p === "string" ? p : (p.text || "")).trim() + NL; });
    s += NL;
  }

  /* --- Schritte: Klartext + ausgeschriebenes RACI + stabiler Anker --- */
  schritte.forEach((sch, i) => {
    const anker = "schritt-" + (sch.id ? mdSlug(sch.id) : (i + 1));
    s += "## " + L.step + " " + (i + 1) + ": " + String(sch.titel || "").trim() + NL;
    if (sch.untertitel) s += "*" + String(sch.untertitel).trim() + "*" + NL;
    s += NL + "`" + L.anchor + ": #" + anker + "`" + NL + NL;

    schrittBloecke(sch).forEach(block => {
      if (block.typ === "absatz") {
        if (block.text && String(block.text).trim()) s += String(block.text).trim() + NL + NL;
      } else {
        if (block.ueberschrift) s += "**" + String(block.ueberschrift).trim() + "**" + NL + NL;
        const pk = mdPunkte(block.punkte);
        if (pk) s += pk + NL;
      }
    });

    const g = mdRaciGruppen(daten, sch.id);
    const zeilen = ["R", "A", "C", "I"].filter(k => g[k].length);
    if (zeilen.length) {
      s += "**" + L.raciHead + ":**" + NL + NL;
      zeilen.forEach(k => { s += "- **" + L[k] + ":** " + g[k].join(", ") + NL; });
      s += NL;
    }
    if (sch.beschreibung && sch.beschreibung.length) s += mdBeschreibung(sch.beschreibung, L);
  });

  /* --- Output --- */
  const outp = (daten.output && daten.output.punkte) || [];
  if (outp.length) {
    s += "## " + L.output + NL + NL;
    if (daten.output.verantwortlich) s += "**" + L.responsible + ":** " + daten.output.verantwortlich + NL + NL;
    outp.forEach(p => { s += "- " + String(typeof p === "string" ? p : (p.text || "")).trim() + NL; });
    s += NL;
  }

  /* --- Konsolidierte RACI-Matrix als Tabelle (LLM-freundlich) --- */
  if (rollen.length && schritte.length) {
    s += "## " + L.matrix + NL + NL;
    s += "| " + L.role + " | " + schritte.map((sc, i) => "S" + (i + 1)).join(" | ") + " |" + NL;
    s += "| --- |" + schritte.map(() => " :-: |").join("") + NL;
    rollen.forEach(rolle => {
      const cells = schritte.map(sc => {
        const b = (daten.raci && daten.raci[sc.id] && daten.raci[sc.id][rId(rolle)]) || [];
        return b.join(", ") || "–";
      });
      s += "| " + mdCell(rName(rolle)) + " | " + cells.join(" | ") + " |" + NL;
    });
    s += NL;
    s += schritte.map((sc, i) => "S" + (i + 1) + " = " + String(sc.titel || sc.id || "")).join(" · ") + NL + NL;
  }

  /* --- Glossar: prozess-eigene Legende (sonst Default) → gibt der KI den Rahmen --- */
  s += "## " + L.glossary + NL + NL;
  ["R", "A", "C", "I"].forEach(k => {
    const def = leg[k] || (L.legend && L.legend[k]) || "";
    s += "- **" + k + "** — " + def + NL;
  });
  s += NL;

  if (m.fusstext) s += "---" + NL + NL + "*" + m.fusstext + "*" + NL;
  return s;
}

/* Wrapper: aktueller/Ziel-Prozess → Markdown-Text (wählt Sprache + Datum). */
function baueMarkdownDokument(zielDaten) {
  return prozessNachMarkdown(zielDaten || STATE.daten, mdLabels(), new Date().toISOString().slice(0, 10));
}
/* Klassischer Download (text/markdown). */
function downloadMd(text, name) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
/* „Markdown page": aktueller Prozess → eine .md-Datei. */
function exportiereMarkdown() {
  if (!STATE.daten || !STATE.daten.meta) { alert(t("msg.noSaveData")); return; }
  let md;
  try { md = baueMarkdownDokument(STATE.daten); }
  catch (e) { alert(t("html.failed", { err: (e && e.message) || String(e) })); return; }
  downloadMd(md, mdName(STATE.daten));
}

/* ---- „Markdown batch": gewählte JSONs → je .md + manifest.json ---- */
const mdBatchInput = document.getElementById("mdBatchInput");
function mdBatchStart() { mdBatchInput.value = ""; mdBatchInput.click(); }
mdBatchInput.addEventListener("change", (ev) => {
  const files = Array.from(ev.target.files || []);
  if (!files.length) return;
  const kandidaten = [];
  let rest = files.length;
  const fertig = () => { if (--rest === 0) zeigeMdBatchDialog(kandidaten); };
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

/* manifest.json = Korpus-Index für die RAG-Pipeline (eine Zeile je Prozess). */
function baueManifest(dateien, heute) {
  return JSON.stringify({
    "niju.manifest": 1,
    generator: "NIJU ICHI Process Builder",
    erstellt: heute,
    anzahl: dateien.length,
    prozesse: dateien.map(d => {
      const m = d.daten.meta || {};
      return {
        datei: d.name,
        prozessId: m.prozessId || "",
        titel: m.titel || "",
        owner: m.processOwner || "",
        version: m.version || "",
        stand: m.datum || "",
        schritte: (d.daten.schritte || []).length,
        rollen: (d.daten.rollen || []).map(rName)
      };
    })
  }, null, 2);
}

async function fuehreMdBatchAus(auswahl) {
  const heute = new Date().toISOString().slice(0, 10);
  const L = mdLabels();
  const gesehen = {};
  const dateien = auswahl.map(k => {
    let name = mdName(k.daten);
    if (gesehen[name]) { const basis = name.replace(/\.md$/, ""); let i = 2; while (gesehen[basis + "-" + i + ".md"]) i++; name = basis + "-" + i + ".md"; }
    gesehen[name] = true;
    return { name: name, text: prozessNachMarkdown(k.daten, L, heute), daten: k.daten };
  });
  return await batchSpeichernMd(dateien, heute);
}

/* Ausgabe: bevorzugt Zielordner (File System Access) inkl. manifest.json,
   sonst Einzel-Downloads (+ manifest.json). Eigener Ordner-Merker „mdout". */
async function batchSpeichernMd(dateien, heute) {
  const manifest = baueManifest(dateien, heute);
  if (window.showDirectoryPicker) {
    let dir = null;
    try {
      const opts = { mode: "readwrite" };
      try { const last = await idbHandleLaden("mdout"); if (last) opts.startIn = last; } catch (e) {}
      dir = await window.showDirectoryPicker(opts);
    } catch (e) { if (e && e.name === "AbortError") return { aborted: true }; }
    if (dir) {
      for (const d of dateien) {
        const fh = await dir.getFileHandle(d.name, { create: true });
        const w = await fh.createWritable(); await w.write(d.text); await w.close();
      }
      const mh = await dir.getFileHandle("manifest.json", { create: true });
      const mw = await mh.createWritable(); await mw.write(manifest); await mw.close();
      idbHandleSpeichern("mdout", dir);
      return { written: dateien.length, folder: true };
    }
  }
  for (const d of dateien) { downloadMd(d.text, d.name); await htmlDelay(180); }
  downloadMd(manifest, "manifest.json");
  return { written: dateien.length, folder: false };
}

/* Auswahl-Dialog (eigenständig — lässt die HTML-Stapel-Variante unberührt). */
function zeigeMdBatchDialog(kandidaten) {
  const alt = document.getElementById("mdBatchOverlay"); if (alt) alt.remove();
  if (!kandidaten.length) { alert(t("mdBatch.none")); return; }
  kandidaten.sort((a, b) => batchTitel(a).localeCompare(batchTitel(b)));

  const overlay = el("div", "import-overlay"); overlay.id = "mdBatchOverlay";
  const dialog = el("div", "import-dialog"); dialog.style.width = "min(540px, 94vw)";
  const kopf = el("div", "import-kopf");
  kopf.appendChild(el("h2", null, t("mdBatch.title")));
  kopf.appendChild(el("p", null, t("mdBatch.intro")));
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
  const abbrechen = el("button", "btn-sek", t("mdBatch.cancel"));
  abbrechen.addEventListener("click", () => overlay.remove());
  const exportBtn = el("button", "btn-akt", "");
  exportBtn.addEventListener("click", async () => {
    const auswahl = checks.filter(c => c.cb.checked).map(c => c.k);
    if (!auswahl.length) return;
    exportBtn.disabled = abbrechen.disabled = alleBtn.disabled = true;
    summe.textContent = t("mdBatch.working");
    try {
      const res = await fuehreMdBatchAus(auswahl);
      overlay.remove();
      if (res && !res.aborted) {
        alert(res.folder ? t("mdBatch.writtenFolder", { n: res.written })
                         : t("mdBatch.done", { n: res.written }));
      }
    } catch (e) {
      exportBtn.disabled = abbrechen.disabled = alleBtn.disabled = false;
      summe.textContent = "";
      alert(t("html.failed", { err: (e && e.message) || String(e) }));
    }
  });

  function aktualisiere() {
    const nn = checks.filter(c => c.cb.checked).length;
    summe.textContent = t("mdBatch.count", { n: nn });
    exportBtn.textContent = t("mdBatch.export", { n: nn });
    exportBtn.disabled = (nn === 0);
    alleBtn.textContent = checks.some(c => !c.cb.checked) ? t("mdBatch.selectAll") : t("mdBatch.deselectAll");
  }

  fuss.appendChild(alleBtn); fuss.appendChild(abbrechen); fuss.appendChild(exportBtn);
  dialog.appendChild(fuss);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  aktualisiere();
}
