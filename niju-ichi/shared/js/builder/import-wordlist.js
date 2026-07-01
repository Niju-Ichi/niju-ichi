/* ============================================================
   NIJU ICHI — Process Builder: Word-list import (Phase 11)
   Reads a previously exported CSV (or a JSON translation memory
   { "de source": "en translation" }) and applies the EN translations
   back into the currently loaded process.

   Algorithm: build a DE→EN lookup from the file; walk the same leaf
   paths as wlExtract; call P.setLeaf(leaf, "en", tm[de]) when the
   DE source matches. Idempotent — importing the same file twice is safe.
   After applying, re-renders and offers save via File System Access or
   download fallback.

   Provides (global): parseWordlistCsv, parseWordlistJson,
     applyTranslationMemory, importWordlist
   Uses: STATE (builder core), NIJU.PROZESS, io (idbHandleLaden, speichernUnter)
   Classic <script> — shares global scope.
   ============================================================ */

/* Pick the delimiter from the header line: comma (interchange standard), semicolon
   (German Excel "CSV UTF-8"), or tab. Count occurrences OUTSIDE quotes. */
function detectDelimiter(headerLine) {
  const cands = [",", ";", "\t"];
  var best = ",", bestN = -1;
  cands.forEach(function (d) {
    var n = 0, inq = false;
    for (var i = 0; i < headerLine.length; i++) {
      const c = headerLine[i];
      if (c === '"') inq = !inq;
      else if (c === d && !inq) n++;
    }
    if (n > bestN) { bestN = n; best = d; }
  });
  return best;
}

/* Parse the CSV into a DE→EN map. Robust RFC-4180 tokenizer:
   - auto-detects the delimiter (, ; or tab) so files re-saved by Excel work,
   - UTF-8 BOM tolerated,
   - quoted fields may contain the delimiter, embedded newlines and "" escapes.
   Header row (first record) is skipped; column 0 = DE source, column 1 = EN. */
function parseWordlistCsv(text) {
  const tm = {};
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const firstNl = text.indexOf("\n");
  const header = firstNl < 0 ? text : text.slice(0, firstNl);
  const delim = detectDelimiter(header);

  const rows = [];
  var row = [], cur = "", inq = false;
  for (var i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }   /* escaped quote */
        else inq = false;
      } else cur += c;
    } else {
      if (c === '"') inq = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }   /* last record */

  for (var r = 1; r < rows.length; r++) {   /* skip header */
    const cells = rows[r];
    if (!cells || !cells.length) continue;
    const deRaw = (cells[0] == null ? "" : String(cells[0]));
    const en = (cells[1] == null ? "" : String(cells[1])).trim();
    const de = deRaw.trim();
    if (!de || !en) continue;
    /* store under the exact source AND a trimmed alias, so lookups match whether
       or not Excel altered surrounding whitespace. */
    tm[deRaw] = en;
    tm[de] = en;
  }
  return tm;
}

/* Parse a JSON translation memory { "de": "en" }. */
function parseWordlistJson(text) {
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  } catch (e) {}
  return {};
}

/* Walk the same leaf paths as wlExtract and apply tm (DE→EN map) to each.
   Returns count of applied translations. */
function applyTranslationMemory(daten, tm) {
  if (!daten || !tm) return 0;
  const P = NIJU.PROZESS;
  var count = 0;

  /* Lookup tolerant to surrounding whitespace differences (Excel may trim cells). */
  function look(s) {
    if (s == null) return null;
    if (tm[s] != null) return tm[s];
    const t = String(s).trim();
    return tm[t] != null ? tm[t] : null;
  }

  function applyLeaf(container, key) {
    const v = container[key];
    if (v == null) return;
    const de = P.srcText(v);
    if (!de.trim()) return;
    const en = look(de);
    if (en != null) {
      container[key] = P.setLeaf(v, "en", en);
      count++;
    }
  }

  /* Apply to a string or {_i18n} leaf stored directly in an array slot. */
  function applyItem(arr, idx) {
    const v = arr[idx];
    if (v == null) return;
    if (typeof v === "string" || P.isI18n(v)) {
      const de = P.srcText(v);
      const en = look(de);
      if (de.trim() && en != null) { arr[idx] = P.setLeaf(v, "en", en); count++; }
    } else if (typeof v === "object") {
      applyLeaf(v, "text");
      (v.unterpunkte || []).forEach(function (u, ui) { applyItem(v.unterpunkte, ui); });
    }
  }

  /* meta */
  const m = daten.meta || {};
  applyLeaf(m, "titel");
  applyLeaf(m, "fusstext");

  /* input / output */
  if (daten.input) {
    applyLeaf(daten.input, "label");
    (daten.input.punkte || []).forEach(function (p, i) { applyItem(daten.input.punkte, i); });
  }
  if (daten.output) {
    applyLeaf(daten.output, "label");
    (daten.output.punkte || []).forEach(function (p, i) { applyItem(daten.output.punkte, i); });
  }

  /* legende */
  const leg = daten.legende || {};
  Object.keys(leg).forEach(function (k) { applyLeaf(leg, k); });

  /* schritte — same leaf paths as wlExtract (export), kept symmetric. */
  (daten.schritte || []).forEach(function (s) {
    applyLeaf(s, "titel");
    applyLeaf(s, "untertitel");
    applyLeaf(s, "punkteUeberschrift");
    (s.punkte || []).forEach(function (p, i) { applyItem(s.punkte, i); });
    (s.bloecke || []).forEach(function (block) {
      applyLeaf(block, "ueberschrift");
      applyLeaf(block, "text");
      (block.punkte || []).forEach(function (p, i) { applyItem(block.punkte, i); });
    });
    (s.beschreibung || []).forEach(function (block) {
      applyLeaf(block, "titel");
      (block.inhalt || []).forEach(function (teil, ti) {
        if (P.isI18n(teil) || typeof teil === "string") {
          applyItem(block.inhalt, ti);
        } else if (teil && teil.ueberschrift != null) {
          applyLeaf(teil, "ueberschrift");
        } else if (teil && teil.liste) {
          teil.liste.forEach(function (li, li_i) { applyItem(teil.liste, li_i); });
        }
      });
    });
  });

  return count;
}

/* Entry point: open a file picker, parse CSV or JSON, apply to current process,
   re-render, then save via the current handle or prompt download. */
function importWordlist() {
  if (!STATE.daten || !STATE.daten.meta) { alert(t("msg.noSaveData")); return; }
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".csv,.json";
  inp.addEventListener("change", function () {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function (e) {
      const text = e.target.result;
      let tm;
      if (f.name.toLowerCase().endsWith(".json")) tm = parseWordlistJson(text);
      else tm = parseWordlistCsv(text);
      const count = applyTranslationMemory(STATE.daten, tm);
      render(STATE.daten);
      if (STATE.bearbeiten) baueEditor();
      alert(t("wordlist.applied", { n: count, p: 1 }));
    };
    r.readAsText(f, "utf-8");
  });
  inp.click();
}
