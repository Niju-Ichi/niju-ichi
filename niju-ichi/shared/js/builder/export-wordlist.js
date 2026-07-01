/* ============================================================
   NIJU ICHI — Process Builder: Word-list export (Phase 11)
   Collects all translatable content leaves from the current process
   (or a batch of processes), deduplicates by DE primary text, and
   produces a CSV (UTF-8 BOM, RFC-4180) ready for external translation.

   Each row: "de source","en translation","stale"
   - stale = 1 when the EN translation exists but the DE source has changed
     since the last translation (so the translator knows what to revisit).
   - Existing EN translations are prefilled; untranslated rows have empty EN.

   Provides (global): wlExtract, wlCsv, exportWordlist
   Uses: STATE (builder core), NIJU.PROZESS
   Classic <script> — shares global scope.
   ============================================================ */

/* Leaf paths that carry translatable content per process object.
   Traversal is iterative; structural meta (prozessId, firma, version, datum,
   processOwner, kopfId, rollen[].name) is intentionally skipped. */
function wlExtract(daten) {
  if (!daten) return [];
  const P = NIJU.PROZESS;
  const out = [];   /* [{de, en, stale}] — not yet deduped */

  function leaf(v) {
    if (v == null || v === "") return;
    const de = P.srcText(v);
    if (!de.trim()) return;
    const en = P.isI18n(v) ? (v.en || "") : "";
    const stale = P.isI18n(v) ? P.isStale(v, "en") : true;
    out.push({ de: de, en: en, stale: stale });
  }

  /* meta */
  const m = daten.meta || {};
  leaf(m.titel);
  leaf(m.fusstext);

  /* input / output */
  if (daten.input) {
    leaf(daten.input.label);
    (daten.input.punkte || []).forEach(function (p) { leaf(typeof p === "string" ? p : (p.text || p)); });
  }
  if (daten.output) {
    leaf(daten.output.label);
    (daten.output.punkte || []).forEach(function (p) { leaf(typeof p === "string" ? p : (p.text || p)); });
  }

  /* legende */
  const leg = daten.legende || {};
  Object.keys(leg).forEach(function (k) { leaf(leg[k]); });

  /* schritte */
  (daten.schritte || []).forEach(function (s) {
    leaf(s.titel);
    leaf(s.untertitel);
    /* bloecke (overview content) */
    (s.bloecke || []).forEach(function (block) {
      leaf(block.ueberschrift);
      leaf(block.text);
      (block.punkte || []).forEach(function (p) {
        const raw = (typeof p === "string") ? p : (p.text || "");
        leaf(raw);
        const unter = (typeof p === "object" && p && p.unterpunkte) ? p.unterpunkte : null;
        if (unter) unter.forEach(function (u) { leaf(u); });
      });
    });
    /* beschreibung (detail page content) */
    (s.beschreibung || []).forEach(function (block) {
      leaf(block.titel);
      (block.inhalt || []).forEach(function (teil) {
        if (P.isI18n(teil) || typeof teil === "string") { leaf(teil); return; }
        if (teil && teil.ueberschrift != null) { leaf(teil.ueberschrift); return; }
        if (teil && teil.liste) {
          teil.liste.forEach(function (li) {
            const raw = (typeof li === "string") ? li : (li.text || "");
            leaf(raw);
            const unter = (typeof li === "object" && li && li.unterpunkte) ? li.unterpunkte : null;
            if (unter) unter.forEach(function (u) { leaf(u); });
          });
        }
      });
    });
  });

  return out;
}

/* Deduplicate extracted leaves by DE source; keep best EN (prefer non-stale). */
function wlDedup(leaves) {
  const map = {};   /* de -> {de, en, stale} */
  leaves.forEach(function (r) {
    const key = r.de;
    if (!map[key]) { map[key] = { de: r.de, en: r.en, stale: r.stale }; return; }
    /* prefer a non-stale (up-to-date) translation */
    if (!r.stale && map[key].stale) { map[key].en = r.en; map[key].stale = false; }
  });
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

/* Build RFC-4180 CSV (UTF-8 BOM). Header: de, en, stale. */
function wlCsv(rows) {
  function cell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  const lines = [cell("de") + "," + cell("en") + "," + cell("stale")];
  rows.forEach(function (r) {
    lines.push(cell(r.de) + "," + cell(r.en) + "," + (r.stale ? "1" : "0"));
  });
  return "﻿" + lines.join("\r\n");
}

/* Export the word list for the current process as a CSV download. */
function exportWordlist() {
  const daten = STATE.daten;
  if (!daten || !daten.meta) { alert(t("msg.noSaveData")); return; }
  const leaves = wlExtract(daten);
  const rows = wlDedup(leaves);
  const csv = wlCsv(rows);
  const name = (mdSlug && daten.meta.prozessId ? mdSlug(NIJU.PROZESS.srcText(daten.meta.prozessId || daten.meta.titel)) : "prozess") + "-wordlist.csv";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}
