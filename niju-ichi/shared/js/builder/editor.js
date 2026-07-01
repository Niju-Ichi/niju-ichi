/* ============================================================
   NIJU ICHI — Process Builder: Editor
   Form-based editing panel: field helpers, popover menu, collapse state,
   keyboard focus model, drag-reorder, overview/detail editors, block editing,
   point operations, RACI popover, edit-mode toggle.
   Provides (global): baueEditor, setzeBearbeiten, nachStruktur,
     schliesseRaciMenu, toggleRaci, oeffneRaciMenu, feld, knopf, ic,
     setIc, iconBtn, oeffnePop, schliessePop, auswahl, bloeckeEditor,
     listenKoerper, punktRow, arrVerschieben, dragWire
   Uses: core, render
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   Editor (Phase 2) — Formular, RACI-Klick, Neu, Speichern
   ============================================================ */

/* Nach einer Struktur-Änderung (hinzufügen/entfernen/umsortieren):
   Vorschau neu rendern UND das Formular neu aufbauen. */
function nachStruktur() { render(STATE.daten); baueEditor(); }

/* ----- DOM-Helfer für Formularfelder ----- */
function feld(label, wert, onChange, opts) {
  opts = opts || {};
  const f = el("div", "ed-field");
  if (label) f.appendChild(el("label", null, label));
  const inp = opts.mehrzeilig ? document.createElement("textarea") : document.createElement("input");
  if (!opts.mehrzeilig) inp.type = "text";
  inp.value = (wert == null) ? "" : wert;
  if (opts.platzhalter) inp.placeholder = opts.platzhalter;
  inp.addEventListener("input", () => onChange(inp.value));
  f.appendChild(inp);
  return f;
}

/* Current content language for bilingual editing (Phase 11). */
function cL() { return STATE.contentLang || "de"; }

/* Like `feld` but reads/writes a bilingual leaf (string | i18n-map).
   When cL() is the primary language, writes plain strings (backward compat).
   When cL() is a secondary language, writes via setLeaf (upgrades to map).
   Marks stale translations with a yellow indicator. */
function feldI18n(label, leaf, onChange, opts) {
  opts = opts || {};
  const P = NIJU.PROZESS;
  const lang = cL();
  const stale = lang !== P.PRIMARY && P.isStale(leaf, lang);
  const f = el("div", "ed-field" + (stale ? " i18n-stale" : ""));
  if (label) {
    const lbl = document.createElement("label");
    lbl.textContent = label;
    if (stale) lbl.appendChild(el("span", "stale-ind", " " + t("content.stale")));
    f.appendChild(lbl);
  }
  const inp = opts.mehrzeilig ? document.createElement("textarea") : document.createElement("input");
  if (!opts.mehrzeilig) inp.type = "text";
  inp.value = P.text(leaf, lang);
  if (opts.platzhalter) inp.placeholder = opts.platzhalter;
  inp.addEventListener("input", () => {
    if (lang === P.PRIMARY) onChange(P.isI18n(leaf) ? P.setLeaf(leaf, lang, inp.value) : inp.value);
    else onChange(P.setLeaf(leaf, lang, inp.value));
  });
  f.appendChild(inp);
  return f;
}

/* Content language toggle bar (Phase 11): DE | EN buttons. */
function bautLangToggle() {
  const bar = el("div", "ed-lang-bar");
  const P = NIJU.PROZESS;
  bar.appendChild(el("span", "ed-lang-label", t("content.lang.switch") + ":"));
  [P.PRIMARY, "en"].forEach(function (lng) {
    const b = el("button", "ed-lang-btn" + (cL() === lng ? " an" : ""));
    b.type = "button";
    b.textContent = t("content.lang." + lng);
    b.addEventListener("click", function () { STATE.contentLang = lng; baueEditor(); });
    bar.appendChild(b);
  });
  return bar;
}
function knopf(text, klasse, onClick, titel) {
  const b = el("button", "mini " + (klasse || ""), text);
  if (titel) b.title = titel;
  b.addEventListener("click", (e) => { e.preventDefault(); onClick(); });
  return b;
}

/* ============================================================
   Editor redesign — shared building blocks (detail-page editor).
   Local icons, hover-reveal icon buttons, popover menus, collapse
   view-state, keyboard-driven list editing. All offline, no deps.
   ============================================================ */
const SVG_NS_ED = "http://www.w3.org/2000/svg";
/* Local SVG icon, referencing the inline sprite at the top of <body>. */
function ic(name) {
  const svg = document.createElementNS(SVG_NS_ED, "svg");
  svg.setAttribute("class", "ic"); svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS_ED, "use");
  use.setAttribute("href", "#" + name);
  svg.appendChild(use);
  return svg;
}
function setIc(host, name) { const u = host.querySelector("use"); if (u) u.setAttribute("href", "#" + name); }
/* 28x28 icon button. label → aria-label + title (a11y §6).
   opts: { reveal:hover-reveal, grip:drag handle, klasse, disabled }. */
function iconBtn(name, label, onClick, opts) {
  opts = opts || {};
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ed-iconbtn" + (opts.reveal ? " ed-reveal" : "") + (opts.grip ? " ed-grip" : "") + (opts.klasse ? " " + opts.klasse : "");
  b.setAttribute("aria-label", label); b.title = label;
  b.appendChild(ic(name));
  if (opts.disabled) b.disabled = true;
  if (onClick) b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onClick(e); });
  return b;
}

/* ----- Popover menu (⋯ overflow, + block). Plain positioned div, closes on
   outside-click / Esc. items: { icon, label, onClick, disabled } or "-". ----- */
let _edPop = null;
function _edPopAussen(e) { if (_edPop && !_edPop.contains(e.target)) schliessePop(); }
function _edPopTaste(e) { if (e.key === "Escape") schliessePop(); }
function schliessePop() {
  if (_edPop) { _edPop.remove(); _edPop = null; }
  document.removeEventListener("mousedown", _edPopAussen, true);
  document.removeEventListener("keydown", _edPopTaste, true);
}
function oeffnePop(anchor, items) {
  schliessePop();
  const pop = el("div", "ed-pop");
  items.forEach(function (it) {
    if (it === "-") { pop.appendChild(document.createElement("hr")); return; }
    const b = document.createElement("button"); b.type = "button";
    b.appendChild(ic(it.icon || "ic-dots-vertical"));
    b.appendChild(el("span", null, it.label));
    if (it.disabled) b.disabled = true;
    else b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); schliessePop(); it.onClick(); });
    pop.appendChild(b);
  });
  document.body.appendChild(pop);
  pop.style.position = "fixed";
  const r = anchor.getBoundingClientRect();
  let left = r.right - pop.offsetWidth, top = r.bottom + 4;
  if (left < 6) left = 6;
  if (top + pop.offsetHeight > window.innerHeight - 6) top = r.top - pop.offsetHeight - 4;
  pop.style.left = Math.round(left) + "px";
  pop.style.top = Math.round(Math.max(6, top)) + "px";
  _edPop = pop;
  setTimeout(function () {
    document.addEventListener("mousedown", _edPopAussen, true);
    document.addEventListener("keydown", _edPopTaste, true);
  }, 0);
}

/* ============================================================
   Phase 10 — inline {…} function-reference autocomplete (description textareas).
   Triggered by typing "{" in a paragraph textarea; shows a live-filtered floating
   list of organisation functions/roles + the current process roles. Selecting one
   inserts the full token {Name¦id} (id from the loaded org, or name-only). MVP
   positions the popup just below the textarea (robust caret tracking deferred).
   ============================================================ */
let _refPop = null, _refTa = null, _refItems = [], _refSel = 0, _refStart = -1;
function _refAussen(e) { if (_refPop && !_refPop.contains(e.target) && e.target !== _refTa) refSchliessen(); }
function refSchliessen() {
  if (_refPop) { _refPop.remove(); _refPop = null; }
  _refTa = null; _refItems = []; _refStart = -1; _refSel = 0;
  document.removeEventListener("mousedown", _refAussen, true);
}
/* Suggestion source: loaded organisation (carries node ids) + current process roles
   (id only if the role name also exists in the org). -> [{name,id,typ}] deduped. */
function refVorschlaege() {
  const idx = window.NIJU._orgRefIndex || {};
  const set = {}, out = [];
  Object.keys(idx).forEach((n) => {
    const nn = n.trim(); if (!nn || set[nn]) return;
    set[nn] = 1; out.push({ name: nn, id: idx[n].id || "", typ: idx[n].typ || "" });
  });
  ((STATE.daten && STATE.daten.rollen) || []).forEach((r) => {
    const nn = rName(r).trim(); if (!nn || set[nn]) return;
    set[nn] = 1; out.push({ name: nn, id: (idx[nn] && idx[nn].id) || "", typ: "rolle" });
  });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
/* Open "{" token left of the caret (no "}" between it and the caret). */
function offenesRefToken(ta) {
  const pos = ta.selectionStart;
  const vor = ta.value.slice(0, pos);
  const auf = vor.lastIndexOf("{");
  if (auf < 0 || vor.indexOf("}", auf) >= 0) return null;
  const query = vor.slice(auf + 1);
  if (/[\n{]/.test(query)) return null;
  return { start: auf, query: query };
}
function refPosition(ta) {
  const r = ta.getBoundingClientRect();
  _refPop.style.position = "fixed";
  _refPop.style.left = Math.round(r.left) + "px";
  _refPop.style.minWidth = Math.round(Math.min(Math.max(r.width, 200), 340)) + "px";
  let top = r.bottom + 2;
  const h = _refPop.offsetHeight;
  if (top + h > window.innerHeight - 6) top = Math.max(6, r.top - h - 2);
  _refPop.style.top = Math.round(top) + "px";
}
function refListe() {
  _refPop.innerHTML = "";
  _refPop.appendChild(el("div", "ref-pop-head", t("editor.refInsert")));
  _refItems.slice(0, 8).forEach((v, i) => {
    const b = el("button", "ref-pop-item" + (i === _refSel ? " an" : ""));
    b.type = "button";
    b.appendChild(el("span", "ref-pop-name", v.name));
    if (v.typ) b.appendChild(el("span", "ref-pop-typ", v.typ === "funktion" ? t("editor.refFunction") : t("editor.refRole")));
    b.addEventListener("mousedown", (e) => { e.preventDefault(); refWaehlen(i); });
    _refPop.appendChild(b);
  });
}
function refOeffnen(ta) {
  const tok = offenesRefToken(ta);
  if (!tok) { refSchliessen(); return; }
  const q = tok.query.trim().toLowerCase();
  const alle = refVorschlaege();
  const treffer = q ? alle.filter((v) => v.name.toLowerCase().indexOf(q) >= 0) : alle;
  if (!treffer.length) { refSchliessen(); return; }
  _refTa = ta; _refItems = treffer; _refStart = tok.start;
  if (_refSel >= Math.min(treffer.length, 8)) _refSel = 0;
  if (!_refPop) {
    _refPop = el("div", "ref-pop");
    document.body.appendChild(_refPop);
    setTimeout(() => document.addEventListener("mousedown", _refAussen, true), 0);
  }
  refListe();
  refPosition(ta);
}
function refWaehlen(i) {
  if (!_refTa || !_refItems[i]) { refSchliessen(); return; }
  const ta = _refTa, v = _refItems[i];
  const tok = offenesRefToken(ta);
  const start = tok ? tok.start : _refStart;
  const pos = ta.selectionStart;
  const token = NIJU.RICH.token(v.name, v.id);
  ta.value = ta.value.slice(0, start) + token + ta.value.slice(pos);
  const caret = start + token.length;
  refSchliessen();
  ta.focus();
  try { ta.setSelectionRange(caret, caret); } catch (e) {}
  /* commit via the textarea's own input handler (updates data, autoGrow, render) */
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}
/* Attach the autocomplete to a description paragraph textarea. */
function refWire(ta) {
  ta.addEventListener("input", () => refOeffnen(ta));
  ta.addEventListener("click", () => refOeffnen(ta));
  ta.addEventListener("keydown", (e) => {
    if (!_refPop || _refTa !== ta) return;
    const n = Math.min(_refItems.length, 8);
    if (e.key === "ArrowDown") { e.preventDefault(); _refSel = (_refSel + 1) % n; refListe(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); _refSel = (_refSel - 1 + n) % n; refListe(); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); refWaehlen(_refSel); }
    else if (e.key === "Escape") { e.preventDefault(); refSchliessen(); }
  });
  ta.addEventListener("blur", () => setTimeout(refSchliessen, 150));
}

/* ----- Collapse view-state — NEVER written to the JSON (§4). WeakMap keyed by
   the (stable) description-block object → Set of collapsed content-part indices.
   Toggling only flips a CSS class (no rebuild), so the index stays valid. ----- */
const ED_COLLAPSE = new WeakMap();
function istZu(block, ti) { const s = ED_COLLAPSE.get(block); return !!(s && s.has(ti)); }
function setZu(block, ti, zu) {
  let s = ED_COLLAPSE.get(block);
  if (!s) { s = new Set(); ED_COLLAPSE.set(block, s); }
  if (zu) s.add(ti); else s.delete(ti);
}

/* Read a list item's text whether it is a plain string or { text, unterpunkte }. */
function itemText(li) { return (typeof li === "object" && li) ? (li.text || "") : (li || ""); }
function klonTeil(teil) { return (typeof teil === "object" && teil) ? JSON.parse(JSON.stringify(teil)) : teil; }
/* Collapsed one-line summary of a content part (§5.1). Uses srcText for i18n maps. */
function blockKurz(teil) {
  const P = window.NIJU && NIJU.PROZESS;
  if (P && P.isI18n(teil) || typeof teil === "string") {
    const s = (P ? P.srcText(teil) : String(teil || "")).trim().replace(/\s+/g, " ");
    return s ? (s.length > 60 ? s.slice(0, 60) + "…" : s) : t("editor.paragraph");
  }
  if (teil && teil.liste) {
    const n = teil.liste.length;
    const raw = n ? itemText(teil.liste[0]) : "";
    const f = (P ? P.srcText(raw) : String(raw || "")).trim().replace(/\s+/g, " ");
    return f ? (f + (n > 1 ? "  ·  +" + (n - 1) : "")) : t("editor.list");
  }
  if (teil && typeof teil === "object" && teil.ueberschrift != null) {
    const ue = teil.ueberschrift;
    const s = (P ? P.srcText(ue) : String(ue || "")).trim();
    return s || t("editor.heading");
  }
  return "";
}
/* Auto-grow textarea (§5.9): height = content. */
function autoGrow(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }

/* 2-column segment toggle for a list part (§5.8) — same data effect as before. */
function segmentToggle(teil) {
  const seg = el("div", "ed-seg"); seg.setAttribute("role", "group");
  [["2", 2], ["1", 1]].forEach(function (o) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = o[0];
    if ((teil.spalten === 2 ? 2 : 1) === o[1]) b.classList.add("an");
    b.title = (o[1] === 2) ? t("editor.twoColumns") : "1";
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      teil.spalten = o[1]; render(STATE.daten);
      Array.from(seg.children).forEach(function (c) { c.classList.remove("an"); });
      b.classList.add("an");
    });
    seg.appendChild(b);
  });
  return seg;
}

/* ----- Keyboard model focus restoration across editor rebuilds (§5.5).
   List inputs carry data-listid/lii/ui; after a structural change we re-focus the
   intended cell. `listid` identifies the point-list (detail: "d:<bi>:<ti>",
   overview: "o:<si>"); ui = "x" for a top-level item, a number for a sub-point. ----- */
let _edFokus = null;
function nachFokus(tok) { _edFokus = tok; nachStruktur(); stelleFokusHer(); }
function stelleFokusHer() {
  if (!_edFokus) return;
  const f = _edFokus; _edFokus = null;
  const ui = (f.ui == null) ? "x" : f.ui;
  /* point rows are textareas now (U1) — match by data-* on any element */
  const inp = document.querySelector('#editor [data-listid="' + f.listid + '"][data-lii="' + f.lii + '"][data-ui="' + ui + '"]');
  if (inp) { inp.focus(); const p = (f.caret == null) ? inp.value.length : f.caret; try { inp.setSelectionRange(p, p); autoGrow(inp); } catch (e) {} }
}
/* The row visually above (lii,ui) — for Backspace focus handoff. */
function vorigeZeile(liste, lii, ui) {
  if (ui != null) return (ui > 0) ? { lii: lii, ui: ui - 1 } : { lii: lii, ui: "x" };
  if (lii === 0) return null;
  const prev = liste[lii - 1];
  const subs = (typeof prev === "object" && prev && prev.unterpunkte) ? prev.unterpunkte : null;
  return subs && subs.length ? { lii: lii - 1, ui: subs.length - 1 } : { lii: lii - 1, ui: "x" };
}

/* Move an array entry from index `from` to insertion index `to` (both on the
   original array). Shared by drag-reorder and the ⋯ menu. */
function arrVerschieben(arr, from, to) {
  if (from < 0 || from >= arr.length) return;
  const it = arr.splice(from, 1)[0];
  if (from < to) to--;
  if (to < 0) to = 0; if (to > arr.length) to = arr.length;
  arr.splice(to, 0, it);
}

/* ----- Drag-reorder via the grip (HTML5 native DnD, file://-safe, §5.4).
   The grip flips draggable on while pressed; drops only land inside the same
   sibling group (`gruppe`); a thin --akzent line marks the insertion point.
   reorder(from, to) mutates the array and re-renders. ----- */
let _edDrag = null;
function _edDropPutzen() {
  Array.prototype.forEach.call(document.querySelectorAll(".ed-drop-before,.ed-drop-after"),
    function (x) { x.classList.remove("ed-drop-before", "ed-drop-after"); });
}
function dragWire(grip, itemEl, gruppe, index, reorder) {
  grip.addEventListener("pointerdown", function () { itemEl.draggable = true; });
  grip.addEventListener("pointerup", function () { itemEl.draggable = false; });
  itemEl.addEventListener("dragstart", function (e) {
    if (!itemEl.draggable) { e.preventDefault(); return; }
    _edDrag = { gruppe: gruppe, von: index, reorder: reorder };
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(index)); } catch (_) {}
    setTimeout(function () { itemEl.classList.add("ed-dragging"); }, 0);
  });
  itemEl.addEventListener("dragend", function () {
    itemEl.draggable = false; itemEl.classList.remove("ed-dragging"); _edDropPutzen(); _edDrag = null;
  });
  itemEl.addEventListener("dragover", function (e) {
    if (!_edDrag || _edDrag.gruppe !== gruppe) return;
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
    const r = itemEl.getBoundingClientRect(); const after = (e.clientY - r.top) > r.height / 2;
    _edDropPutzen();
    itemEl.classList.add(after ? "ed-drop-after" : "ed-drop-before");
  });
  itemEl.addEventListener("drop", function (e) {
    if (!_edDrag || _edDrag.gruppe !== gruppe) return;
    e.preventDefault(); e.stopPropagation();
    const r = itemEl.getBoundingClientRect(); const after = (e.clientY - r.top) > r.height / 2;
    const von = _edDrag.von, ziel = index + (after ? 1 : 0), reord = _edDrag.reorder;
    _edDropPutzen(); _edDrag = null;
    if (von !== ziel) reord(von, ziel);
  });
}

/* aufklappbarer Abschnitt */
function abschnitt(titel, key, bauen) {
  const sec = el("div", "ed-section");
  if (STATE.zuKlappen[key]) sec.classList.add("zu");
  const h = el("h3", "ed-h");
  h.appendChild(el("span", null, titel));
  h.appendChild(el("span", "pfeil", "▾"));
  h.addEventListener("click", () => {
    sec.classList.toggle("zu");
    STATE.zuKlappen[key] = sec.classList.contains("zu");
  });
  const body = el("div", "ed-body");
  bauen(body);
  sec.appendChild(h); sec.appendChild(body);
  return sec;
}

/* ----- Gemeinsame Editor-Abschnitte (Kopf-/Fußzeile) für beide Ansichten ----- */

/* Kopfzeile: Firma oben rechts als Text oder Logo wählen */
function firmaAnzeigeEditor(m) {
  const box = el("div");
  box.appendChild(auswahl(t("editor.companyDisplayAs"),
    [["text", t("editor.companyText")], ["logo", t("editor.companyLogo")]],
    m.firmaModus || "text",
    v => { m.firmaModus = v; render(STATE.daten); baueEditor(); }));

  if ((m.firmaModus || "text") === "logo") {
    const f = el("div", "ed-field");
    f.appendChild(el("label", null, t("editor.logoUpload")));
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/png,image/jpeg,image/jpg"; inp.className = "ed-file";
    inp.addEventListener("change", () => {
      const datei = inp.files[0];
      if (!datei) return;
      const r = new FileReader();
      r.onload = e => { m.logo = e.target.result; render(STATE.daten); baueEditor(); };
      r.readAsDataURL(datei);
    });
    f.appendChild(inp);
    box.appendChild(f);

    if (m.logo) {
      const prev = el("div", "logo-vorschau");
      const img = document.createElement("img"); img.src = m.logo; img.alt = t("editor.logoPreview");
      prev.appendChild(img);
      prev.appendChild(knopf(t("editor.logoRemove"), "del", () => { m.logo = ""; render(STATE.daten); baueEditor(); }));
      box.appendChild(prev);
    } else {
      box.appendChild(el("div", "ed-hint", t("editor.logoNone")));
    }
  }
  return box;
}

function abschnittKopfzeile() {
  return abschnitt(t("editor.secHeader"), "kopf", body => {
    body.appendChild(el("div", "ed-hint", t("editor.headerHint")));
    body.appendChild(firmaAnzeigeEditor(STATE.daten.meta));
  });
}

function abschnittFusszeile() {
  return abschnitt(t("editor.secFooter"), "fuss", body => {
    body.appendChild(el("div", "ed-hint", t("editor.footerHint")));
    const m = STATE.daten.meta;
    body.appendChild(feldI18n(t("editor.footerText"), m.fusstext, v => { m.fusstext = v; render(STATE.daten); }));
  });
}

/* Editor für eine einfache String-Liste (Input-/Output-Punkte) */
function stringListe(arr, addLabel, gruppe) {
  const P = NIJU.PROZESS;
  const wrap = el("div");
  arr.forEach(function (s, i) {
    const lang = cL();
    const row = el("div", "ed-row");
    const inp = document.createElement("input");
    inp.type = "text"; inp.className = "grow"; inp.value = P.text(s, lang);
    inp.addEventListener("input", function () {
      const cur = arr[i];
      if (lang === P.PRIMARY) arr[i] = P.isI18n(cur) ? P.setLeaf(cur, lang, inp.value) : inp.value;
      else arr[i] = P.setLeaf(cur, lang, inp.value);
      render(STATE.daten);
    });
    row.appendChild(inp);
    const tools = el("div", "ed-tools");
    const grip = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
    tools.appendChild(grip);
    /* unique group per list ("str:input"/"str:output") so items never cross lists */
    dragWire(grip, row, "str:" + (gruppe || "x"), i, function (from, to) { arrVerschieben(arr, from, to); nachStruktur(); });
    tools.appendChild(iconBtn("ic-trash", t("editor.remove"), function () { arr.splice(i, 1); nachStruktur(); }, { reveal: true }));
    row.appendChild(tools);
    wrap.appendChild(row);
  });
  const ghost = el("button", "ed-ghost"); ghost.type = "button";
  ghost.appendChild(ic("ic-plus")); ghost.appendChild(el("span", null, addLabel));
  ghost.addEventListener("click", function (e) { e.preventDefault(); arr.push(""); nachStruktur(); });
  wrap.appendChild(ghost);
  return wrap;
}

/* Editor für die Aufzählungspunkte (inkl. Unterpunkten) EINES Listen-Blocks.
   Phase-B-Glue: arbeitet auf block.punkte (erster Listen-Block des Schritts).
   Der volle Block-Editor (mehrere Blöcke, Drag&Drop) folgt in Phase C. */
/* Collapsed one-line summary of an overview content block (list | paragraph). */
function bloeckeKurz(block) {
  const P = window.NIJU && NIJU.PROZESS;
  const src = v => P ? P.srcText(v) : String(v == null ? "" : v);
  if (block.typ === "absatz") {
    const s = src(block.text || "").trim().replace(/\s+/g, " ");
    return s ? (s.length > 60 ? s.slice(0, 60) + "…" : s) : t("editor.paragraph");
  }
  if (block.typ === "ueberschrift") {
    const s = src(block.text || "").trim();
    return s || t("editor.heading");
  }
  const head = src(block.ueberschrift || "").trim();
  if (head) return head;
  const n = (block.punkte || []).length;
  const raw = n ? itemText(block.punkte[0]) : "";
  const f = src(raw).trim().replace(/\s+/g, " ");
  return f ? (f + (n > 1 ? "  ·  +" + (n - 1) : "")) : t("editor.list");
}

/* Overview: full block editor for a step's content (schritt.bloecke[] — list
   blocks with a heading + points, or paragraph blocks). Mirrors the detail page's
   inhaltEditor: collapsible block headers, hover-reveal tools, drag, the shared
   keyboard list model, and one "+ Add block" menu (§5.1/§5.6). */
function bloeckeEditor(schritt, si) {
  const wrap = el("div");
  if (!Array.isArray(schritt.bloecke)) schritt.bloecke = schrittBloecke(schritt);
  schritt.bloecke.forEach(function (block, ti) {
    const typ = (block.typ === "absatz" || block.typ === "ueberschrift") ? block.typ : "liste";
    const istListe = (typ === "liste");
    const bl = el("div", "ed-block"); if (istZu(schritt, ti)) bl.classList.add("zu");

    const h = el("div", "ed-block-h");
    const chev = iconBtn(istZu(schritt, ti) ? "ic-chevron-right" : "ic-chevron-down", t("editor.collapse"), null, { klasse: "ed-chev" });
    chev.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      const zu = !bl.classList.contains("zu");
      bl.classList.toggle("zu", zu); setZu(schritt, ti, zu); setIc(chev, zu ? "ic-chevron-right" : "ic-chevron-down");
    });
    h.appendChild(chev);
    const typLabel = istListe ? t("editor.list") : (typ === "ueberschrift" ? t("editor.heading") : t("editor.paragraph"));
    h.appendChild(el("span", "ed-typebadge", typLabel));
    h.appendChild(el("span", "ed-block-sum", bloeckeKurz(block)));
    const gripB = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
    h.appendChild(gripB);
    dragWire(gripB, bl, "bl:" + si, ti, function (from, to) { arrVerschieben(schritt.bloecke, from, to); nachStruktur(); });
    const moreB = iconBtn("ic-dots-vertical", t("editor.more"), function () {
      oeffnePop(moreB, [
        { icon: "ic-duplicate", label: t("editor.duplicate"), onClick: function () { schritt.bloecke.splice(ti + 1, 0, JSON.parse(JSON.stringify(block))); nachStruktur(); } },
        { icon: "ic-arrow-up", label: t("editor.moveUp"), disabled: ti === 0, onClick: function () { arrVerschieben(schritt.bloecke, ti, ti - 1); nachStruktur(); } },
        { icon: "ic-arrow-down", label: t("editor.moveDown"), disabled: ti === schritt.bloecke.length - 1, onClick: function () { arrVerschieben(schritt.bloecke, ti, ti + 2); nachStruktur(); } },
        "-",
        { icon: "ic-trash", label: t("editor.remove"), onClick: function () { schritt.bloecke.splice(ti, 1); nachStruktur(); } }
      ]);
    }, { reveal: true });
    h.appendChild(moreB);
    bl.appendChild(h);

    const body = el("div", "ed-block-body");
    if (istListe) {
      if (!Array.isArray(block.punkte)) block.punkte = [];
      const P = NIJU.PROZESS, lang = cL();
      body.appendChild(feldI18n(t("editor.listHeading"), block.ueberschrift, function (v) {
        block.ueberschrift = v; const sum = h.querySelector(".ed-block-sum"); if (sum) sum.textContent = bloeckeKurz(block); render(STATE.daten);
      }));
      listenKoerper(body, block.punkte, "o:" + si + ":" + ti);
    } else if (typ === "ueberschrift") {
      const P = NIJU.PROZESS, lang = cL();
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "grow"; inp.value = P.text(block.text, lang);
      inp.placeholder = t("editor.heading");
      inp.addEventListener("input", function () {
        if (lang === P.PRIMARY) block.text = P.isI18n(block.text) ? P.setLeaf(block.text, lang, inp.value) : inp.value;
        else block.text = P.setLeaf(block.text, lang, inp.value);
        const sum = h.querySelector(".ed-block-sum"); if (sum) sum.textContent = bloeckeKurz(block);
        render(STATE.daten);
      });
      body.appendChild(inp);
    } else {
      const P = NIJU.PROZESS, lang = cL();
      const ta = document.createElement("textarea");
      ta.className = "grow ed-grow"; ta.value = P.text(block.text, lang); ta.rows = 2;
      ta.addEventListener("input", function () {
        if (lang === P.PRIMARY) block.text = P.isI18n(block.text) ? P.setLeaf(block.text, lang, ta.value) : ta.value;
        else block.text = P.setLeaf(block.text, lang, ta.value);
        autoGrow(ta);
        const sum = h.querySelector(".ed-block-sum"); if (sum) sum.textContent = bloeckeKurz(block);
        render(STATE.daten);
      });
      refWire(ta);
      body.appendChild(ta);
      requestAnimationFrame(function () { autoGrow(ta); });
    }
    bl.appendChild(body);
    wrap.appendChild(bl);
  });

  const add = el("button", "ed-ghost"); add.type = "button";
  add.appendChild(ic("ic-plus"));
  add.appendChild(el("span", null, t("editor.addContentBlock")));
  const chv = ic("ic-chevron-down"); chv.style.marginLeft = "auto"; add.appendChild(chv);
  add.addEventListener("click", function (e) {
    e.preventDefault();
    oeffnePop(add, [
      { icon: "ic-paragraph", label: t("editor.paragraph"), onClick: function () { schritt.bloecke.push({ typ: "absatz", text: "" }); nachStruktur(); } },
      { icon: "ic-list", label: t("editor.list"), onClick: function () { schritt.bloecke.push({ typ: "liste", stil: "eckig", ueberschrift: "", punkte: [""] }); nachStruktur(); } },
      { icon: "ic-heading", label: t("editor.heading"), onClick: function () { schritt.bloecke.push({ typ: "ueberschrift", text: "" }); nachStruktur(); } }
    ]);
  });
  wrap.appendChild(add);
  return wrap;
}

/* neue, eindeutige Schritt-ID */
function neueSchrittId(d) {
  const vorhanden = new Set((d.schritte || []).map(s => s.id));
  let i = 1, id;
  do { id = "schritt_" + Date.now().toString(36) + "_" + (i++); } while (vorhanden.has(id));
  return id;
}

/* ----- Editor-Dispatcher: Übersicht oder Detailseite ----- */
function baueEditor() {
  const ed = document.getElementById("editor");
  ed.innerHTML = "";
  if (!STATE.daten || !STATE.daten.meta) {
    ed.innerHTML = '<div class="ed-inner"></div>'; ed.firstChild.textContent = t("editor.noEditData");
    return;
  }
  if (STATE.ansicht === "detail") baueEditorDetail();
  else baueEditorUebersicht();
  if (typeof aktualisiereOrgNamen === "function") aktualisiereOrgNamen();
}

/* ----- Editor: Prozessübersicht ----- */
function baueEditorUebersicht() {
  const ed = document.getElementById("editor");
  ed.innerHTML = "";
  const d = STATE.daten;
  const m = d.meta;
  const inner = el("div", "ed-inner");

  inner.appendChild(bautLangToggle());

  /* Allgemein / Metadaten */
  inner.appendChild(abschnitt(t("editor.secGeneral"), "meta", body => {
    body.appendChild(feldI18n(t("editor.title"), m.titel, v => { m.titel = v; render(d); }, { platzhalter: t("editor.titlePh") }));
    body.appendChild(el("div", "ed-hint", t("editor.titleHint")));
    const z1 = el("div", "ed-2col");
    z1.appendChild(feld(t("editor.company"), m.firma, v => { m.firma = v; render(d); }));
    z1.appendChild(feld(t("editor.version"), m.version, v => { m.version = v; render(d); }));
    body.appendChild(z1);
    const z2 = el("div", "ed-2col");
    z2.appendChild(feld(t("field.processId"), m.prozessId, v => { m.prozessId = v; render(d); }));
    z2.appendChild(feld(t("editor.date"), m.datum, v => { m.datum = v; render(d); }));
    body.appendChild(z2);
    body.appendChild(feld(t("field.processOwner"), m.processOwner, v => { m.processOwner = v; render(d); }));
  }));

  /* Kopfzeile (Firma als Text/Logo) */
  inner.appendChild(abschnittKopfzeile());

  /* Input */
  inner.appendChild(abschnitt(t("editor.secInput"), "input", body => {
    if (!d.input) d.input = { label: "Input [Responsible]", punkte: [] };
    body.appendChild(feldI18n(t("editor.label"), d.input.label, v => { d.input.label = v; render(d); }));
    body.appendChild(el("div", "ed-hint", t("editor.inputHint")));
    if (!d.input.punkte) d.input.punkte = [];
    body.appendChild(stringListe(d.input.punkte, t("editor.inputPoint"), "input"));
  }));

  /* Output */
  inner.appendChild(abschnitt(t("editor.secOutput"), "output", body => {
    if (!d.output) d.output = { label: "Output [Responsible]", verantwortlich: "", punkte: [] };
    body.appendChild(feldI18n(t("editor.label"), d.output.label, v => { d.output.label = v; render(d); }));
    body.appendChild(feld(t("editor.responsible"), d.output.verantwortlich, v => { d.output.verantwortlich = v; render(d); }));
    if (!d.output.punkte) d.output.punkte = [];
    body.appendChild(stringListe(d.output.punkte, t("editor.outputPoint"), "output"));
  }));

  /* Prozessschritte (Spalten) */
  inner.appendChild(abschnitt(t("editor.secSteps", { n: d.schritte.length }), "schritte", body => {
    d.schritte.forEach((s, si) => {
      const it = el("div", "ed-item");
      const kopf = el("div", "ed-item-kopf");
      kopf.appendChild(el("span", "titel", t("editor.stepSection", { n: si + 1 })));
      const sp = el("div"); sp.style.flex = "1"; kopf.appendChild(sp);
      /* Hover-reveal grip + ⋯ menu (mirror of the detail blocks, §5.2/§5.4). */
      const werkz = el("div", "ed-tools");
      const gripB = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
      werkz.appendChild(gripB);
      dragWire(gripB, it, "schritte", si, function (from, to) { arrVerschieben(d.schritte, from, to); nachStruktur(); });
      const moreB = iconBtn("ic-dots-vertical", t("editor.more"), function () {
        oeffnePop(moreB, [
          { icon: "ic-arrow-up", label: t("editor.moveUp"), disabled: si === 0, onClick: function () { arrVerschieben(d.schritte, si, si - 1); nachStruktur(); } },
          { icon: "ic-arrow-down", label: t("editor.moveDown"), disabled: si === d.schritte.length - 1, onClick: function () { arrVerschieben(d.schritte, si, si + 2); nachStruktur(); } },
          "-",
          { icon: "ic-trash", label: t("editor.deleteStep"), onClick: function () {
            if (confirm(t("msg.confirmDeleteStep", { titel: s.titel || "" }))) {
              const id = s.id; d.schritte.splice(si, 1); if (d.raci) delete d.raci[id]; nachStruktur();
            }
          } }
        ]);
      }, { reveal: true });
      werkz.appendChild(moreB);
      kopf.appendChild(werkz);
      it.appendChild(kopf);
      it.appendChild(feld(t("editor.colId"), s.kopfId || "", v => { s.kopfId = v; render(d); }, { platzhalter: t("editor.colIdPh") }));
      it.appendChild(feldI18n(t("editor.colTitle"), s.titel, v => { s.titel = v; render(d); }));
      it.appendChild(feldI18n(t("editor.subtitle"), s.untertitel, v => { s.untertitel = v; render(d); }));
      it.appendChild(el("div", "ed-hint", t("editor.contentHint")));
      it.appendChild(bloeckeEditor(s, si));
      body.appendChild(it);
    });
    body.appendChild(knopf(t("editor.addStep"), "add", () => {
      const id = neueSchrittId(d);
      /* beschreibung[] = automatische Detailseite für den neuen Schritt */
      d.schritte.push({ id: id, kopfId: "", titel: t("content.newStep"), untertitel: "", bloecke: [{ typ: "liste", stil: "eckig", ueberschrift: t("content.thisIncludes"), punkte: [{ text: "" }] }], beschreibung: [] });
      if (!d.raci) d.raci = {};
      d.raci[id] = {};
      nachStruktur();
    }));
  }));

  /* Rollen (Zeilen) */
  inner.appendChild(abschnitt(t("editor.secRoles", { n: d.rollen.length }), "rollen", body => {
    body.appendChild(el("div", "ed-hint", t("editor.rolesHint")));
    d.rollen.forEach((r, ri) => {
      const row = el("div", "ed-row");
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "grow"; inp.value = rName(r);
      inp.setAttribute("list", "orgNamen");   /* Vorschläge aus Organisation + Prozess */
      inp.addEventListener("input", () => {
        /* Nur den Anzeigenamen ändern — die id (und damit alle RACI-Einträge) bleibt stabil.
           Kein Mitziehen der raci-Schlüssel mehr nötig (das war der fehleranfällige Teil). */
        const ziel = d.rollen[ri];
        if (ziel && typeof ziel === "object") ziel.name = inp.value;
        else d.rollen[ri] = { id: NIJU.PROZESS.neueRollenId(), name: inp.value };
        render(d);
      });
      row.appendChild(inp);
      const tools = el("div", "ed-tools");
      const gripR = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
      tools.appendChild(gripR);
      dragWire(gripR, row, "rollen", ri, function (from, to) { arrVerschieben(d.rollen, from, to); nachStruktur(); });
      tools.appendChild(iconBtn("ic-trash", t("editor.removeRole"), function () {
        const id = rId(d.rollen[ri]);
        d.rollen.splice(ri, 1);
        if (d.raci) Object.keys(d.raci).forEach(function (sid) { if (d.raci[sid]) delete d.raci[sid][id]; });
        nachStruktur();
      }, { reveal: true }));
      row.appendChild(tools);
      body.appendChild(row);
    });
    body.appendChild(knopf(t("editor.addRole"), "add", () => { d.rollen.push({ id: NIJU.PROZESS.neueRollenId(), name: t("content.newRole") }); nachStruktur(); }));
  }));

  /* RACI-Hinweis (Bearbeitung erfolgt direkt in der Vorschau) */
  inner.appendChild(abschnitt(t("editor.secRaci"), "raci", body => {
    body.appendChild(el("div", "ed-hint", t("editor.raciHintOverview")));
  }));

  /* Legende */
  inner.appendChild(abschnitt(t("editor.secLegend"), "legende", body => {
    if (!d.legende) d.legende = {};
    RACI_REIHENFOLGE.forEach(b => {
      body.appendChild(feldI18n(t("editor.legendMeaning", { b: b }), d.legende[b] || "", v => { d.legende[b] = v; render(d); }, { platzhalter: t("editor.legendPh") }));
    });
  }));

  /* Fußzeile (Freitext unten links) */
  inner.appendChild(abschnittFusszeile());

  ed.appendChild(inner);
}

/* Auswahl-Feld (Dropdown) für den Editor */
function auswahl(label, optionen, wert, onChange) {
  const f = el("div", "ed-field");
  if (label) f.appendChild(el("label", null, label));
  const sel = document.createElement("select");
  sel.className = "ed-select";
  optionen.forEach(o => { const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); });
  sel.value = (wert == null) ? "" : wert;
  sel.addEventListener("change", () => onChange(sel.value));
  f.appendChild(sel);
  return f;
}

/* ----- Editor: Prozessschritt-Detailseite ----- */
function baueEditorDetail() {
  const ed = document.getElementById("editor");
  ed.innerHTML = "";
  const d = STATE.daten;
  const schritte = d.schritte || [];
  if (!schritte.length) { ed.innerHTML = '<div class="ed-inner"></div>'; ed.firstChild.textContent = t("editor.noSteps"); return; }
  const index = Math.max(0, Math.min(STATE.detailIndex || 0, schritte.length - 1));
  const s = schritte[index];
  const inner = el("div", "ed-inner");

  inner.appendChild(bautLangToggle());

  /* Schritt-Kopf */
  inner.appendChild(abschnitt(t("editor.stepSection", { n: index + 1 }), "d-schritt", body => {
    body.appendChild(el("div", "ed-hint", t("editor.detailHint")));
    body.appendChild(feld(t("editor.colId"), s.kopfId || "", v => { s.kopfId = v; render(d); }, { platzhalter: t("editor.colIdPh") }));
    body.appendChild(feldI18n(t("editor.colTitle"), s.titel, v => { s.titel = v; render(d); }));
    body.appendChild(feldI18n(t("editor.subtitlePage"), s.untertitel, v => { s.untertitel = v; render(d); }));
  }));

  /* Kopfzeile (Firma als Text/Logo) */
  inner.appendChild(abschnittKopfzeile());

  /* RACI-Hinweis (Bearbeitung in der Vorschau, gespiegelt zur Übersicht) */
  inner.appendChild(abschnitt(t("editor.secRaci"), "d-raci", body => {
    body.appendChild(el("div", "ed-hint", t("editor.raciHintDetail")));
  }));

  /* Beschreibungs-Blöcke (eine Detailseite) */
  inner.appendChild(abschnitt(t("editor.secDescription", { n: (s.beschreibung || []).length }), "d-beschr", body => {
    if (!s.beschreibung) s.beschreibung = [];
    body.appendChild(el("div", "ed-hint", t("editor.descHint")));
    s.beschreibung.forEach((block, bi) => body.appendChild(beschreibungBlockEditor(s, block, bi)));
    body.appendChild(knopf(t("editor.addDescBlock"), "add", () => {
      s.beschreibung.push({ raci: "R", titel: "", inhalt: [""] });
      nachStruktur();
    }));
  }));

  /* Fußzeile (Freitext unten links) */
  inner.appendChild(abschnittFusszeile());

  ed.appendChild(inner);
}

/* Editor für einen Beschreibungs-Block (RACI-Buchstabe, Titel, Inhalt) */
function beschreibungBlockEditor(schritt, block, bi) {
  const d = STATE.daten;
  const liste = schritt.beschreibung;
  const it = el("div", "ed-item");
  const kopf = el("div", "ed-item-kopf");
  kopf.appendChild(el("span", "titel", t("editor.block", { n: bi + 1, raci: block.raci || "?" })));
  const sp = el("div"); sp.style.flex = "1"; kopf.appendChild(sp);
  /* Hover-reveal tools instead of always-visible ↑ ↓ ✕ (§5.2): grip + ⋯ menu. */
  const werkz = el("div", "ed-tools");
  const gripB = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
  werkz.appendChild(gripB);
  dragWire(gripB, it, "besch", bi, function (from, to) { arrVerschieben(liste, from, to); nachStruktur(); });
  const moreB = iconBtn("ic-dots-vertical", t("editor.more"), function () {
    oeffnePop(moreB, [
      { icon: "ic-duplicate", label: t("editor.duplicate"), onClick: function () { liste.splice(bi + 1, 0, JSON.parse(JSON.stringify(block))); nachStruktur(); } },
      { icon: "ic-arrow-up", label: t("editor.moveUp"), disabled: bi === 0, onClick: function () { const x = liste[bi - 1]; liste[bi - 1] = liste[bi]; liste[bi] = x; nachStruktur(); } },
      { icon: "ic-arrow-down", label: t("editor.moveDown"), disabled: bi === liste.length - 1, onClick: function () { const x = liste[bi + 1]; liste[bi + 1] = liste[bi]; liste[bi] = x; nachStruktur(); } },
      "-",
      { icon: "ic-trash", label: t("editor.removeBlock"), onClick: function () { liste.splice(bi, 1); nachStruktur(); } }
    ]);
  }, { reveal: true });
  werkz.appendChild(moreB);
  kopf.appendChild(werkz);
  it.appendChild(kopf);

  const opt = RACI_REIHENFOLGE.map(b => {
    const teile = legendeTeile((d.legende && d.legende[b]) || "");
    return [b, b + " — " + (teile.titel || b)];
  });
  it.appendChild(auswahl(t("editor.responsibilityRaci"), opt, block.raci, v => { block.raci = v; render(d); }));
  it.appendChild(feldI18n(t("editor.heading"), block.titel, v => { block.titel = v; render(d); }));
  it.appendChild(inhaltEditor(block, bi));
  return it;
}

/* Editor for a description block's mixed content. Each content part (paragraph |
   list) is a collapsible block with a header strip [chevron][type][summary] …
   [2-col toggle][grip][⋯] (§5.1). Lists are edited with the keyboard model
   (§5.5); the three add-buttons collapse into one "+ Add block" menu (§5.6). */
function inhaltEditor(block, bi) {
  const wrap = el("div");
  if (!block.inhalt) block.inhalt = [];
  block.inhalt.forEach(function (teil, ti) {
    const istListe = (typeof teil === "object" && teil && teil.liste);
    const istUeberschrift = (typeof teil === "object" && teil && !istListe && teil.ueberschrift != null);
    const bl = el("div", "ed-block"); if (istZu(block, ti)) bl.classList.add("zu");

    /* ---- header strip ---- */
    const h = el("div", "ed-block-h");
    const chev = iconBtn(istZu(block, ti) ? "ic-chevron-right" : "ic-chevron-down", t("editor.collapse"), null, { klasse: "ed-chev" });
    chev.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      const zu = !bl.classList.contains("zu");
      bl.classList.toggle("zu", zu); setZu(block, ti, zu); setIc(chev, zu ? "ic-chevron-right" : "ic-chevron-down");
    });
    h.appendChild(chev);
    const typLabel = istListe ? t("editor.list") : (istUeberschrift ? t("editor.heading") : t("editor.paragraph"));
    h.appendChild(el("span", "ed-typebadge", typLabel));
    h.appendChild(el("span", "ed-block-sum", blockKurz(teil)));
    if (istListe) h.appendChild(segmentToggle(teil));
    const gripB = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
    h.appendChild(gripB);
    dragWire(gripB, bl, "inh:" + bi, ti, function (from, to) { arrVerschieben(block.inhalt, from, to); nachStruktur(); });
    const moreB = iconBtn("ic-dots-vertical", t("editor.more"), function () {
      oeffnePop(moreB, [
        { icon: "ic-duplicate", label: t("editor.duplicate"), onClick: function () { block.inhalt.splice(ti + 1, 0, klonTeil(teil)); nachStruktur(); } },
        { icon: "ic-arrow-up", label: t("editor.moveUp"), disabled: ti === 0, onClick: function () { const a = block.inhalt, x = a[ti - 1]; a[ti - 1] = a[ti]; a[ti] = x; nachStruktur(); } },
        { icon: "ic-arrow-down", label: t("editor.moveDown"), disabled: ti === block.inhalt.length - 1, onClick: function () { const a = block.inhalt, x = a[ti + 1]; a[ti + 1] = a[ti]; a[ti] = x; nachStruktur(); } },
        "-",
        { icon: "ic-trash", label: t("editor.remove"), onClick: function () { block.inhalt.splice(ti, 1); nachStruktur(); } }
      ]);
    }, { reveal: true });
    h.appendChild(moreB);
    bl.appendChild(h);

    /* ---- body ---- */
    const body = el("div", "ed-block-body");
    if (istListe) {
      if (!teil.liste) teil.liste = [];
      listenKoerper(body, teil.liste, "d:" + bi + ":" + ti);
    } else if (istUeberschrift) {
      const P = NIJU.PROZESS, lang = cL();
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "grow"; inp.value = P.text(teil.ueberschrift, lang);
      inp.placeholder = t("editor.heading");
      inp.addEventListener("input", function () {
        if (lang === P.PRIMARY) teil.ueberschrift = P.isI18n(teil.ueberschrift) ? P.setLeaf(teil.ueberschrift, lang, inp.value) : inp.value;
        else teil.ueberschrift = P.setLeaf(teil.ueberschrift, lang, inp.value);
        const sum = h.querySelector(".ed-block-sum"); if (sum) sum.textContent = blockKurz(teil);
        render(STATE.daten);
      });
      body.appendChild(inp);
    } else {
      const P = NIJU.PROZESS, lang = cL();
      const cur = block.inhalt[ti];
      const ta = document.createElement("textarea");
      ta.className = "grow ed-grow"; ta.value = P.text(cur, lang); ta.rows = 2;
      ta.addEventListener("input", function () {
        const prev = block.inhalt[ti];
        if (lang === P.PRIMARY) block.inhalt[ti] = P.isI18n(prev) ? P.setLeaf(prev, lang, ta.value) : ta.value;
        else block.inhalt[ti] = P.setLeaf(prev, lang, ta.value);
        autoGrow(ta);
        const sum = h.querySelector(".ed-block-sum"); if (sum) sum.textContent = blockKurz(block.inhalt[ti]);
        render(STATE.daten);
      });
      refWire(ta);
      body.appendChild(ta);
      requestAnimationFrame(function () { autoGrow(ta); });
    }
    bl.appendChild(body);
    wrap.appendChild(bl);
  });

  /* ---- one "+ Add block" menu replaces the +Paragraph / +List buttons (§5.6) ---- */
  const add = el("button", "ed-ghost"); add.type = "button";
  add.appendChild(ic("ic-plus"));
  add.appendChild(el("span", null, t("editor.addContentBlock")));
  const chv = ic("ic-chevron-down"); chv.style.marginLeft = "auto"; add.appendChild(chv);
  add.addEventListener("click", function (e) {
    e.preventDefault();
    oeffnePop(add, [
      { icon: "ic-paragraph", label: t("editor.paragraph"), onClick: function () { block.inhalt.push(""); nachStruktur(); } },
      { icon: "ic-list", label: t("editor.list"), onClick: function () { block.inhalt.push({ liste: [""], spalten: 1 }); nachStruktur(); } },
      { icon: "ic-heading", label: t("editor.heading"), onClick: function () { block.inhalt.push({ ueberschrift: "" }); nachStruktur(); } }
    ]);
  });
  wrap.appendChild(add);
  return wrap;
}

/* List body: one single-line input per point, sub-points indented one level.
   Editing is keyboard-first (§5.5); a single ghost "+ point" sits at the end. */
/* Shared point-list body — used by the detail page (a list block's items) AND
   the overview (a step's bullet points). `liste` = the points array; `listid`
   uniquely identifies the list ("d:<bi>:<ti>" | "o:<si>"). Keyboard-first
   editing (§5.5); a single ghost "+ point" sits at the end. */
function listenKoerper(body, liste, listid) {
  liste.forEach(function (li, lii) {
    body.appendChild(punktRow(liste, listid, lii, null));
    const unter = (typeof li === "object" && li && li.unterpunkte) ? li.unterpunkte : [];
    unter.forEach(function (u, ui) { body.appendChild(punktRow(liste, listid, lii, ui)); });
  });
  const ghost = el("button", "ed-ghost"); ghost.type = "button";
  ghost.appendChild(ic("ic-plus")); ghost.appendChild(el("span", null, t("editor.addPoint")));
  /* Discoverability (U3): surface the keyboard model right on the +point button. */
  ghost.appendChild(el("span", "kbd", "Enter"));
  ghost.appendChild(el("span", "kbd", "Tab"));
  ghost.appendChild(el("span", "kbd", "⇧Tab"));
  ghost.appendChild(el("span", "kbd", "Alt ↑↓"));
  ghost.title = t("editor.pointKeysHint");
  ghost.addEventListener("click", function (e) {
    e.preventDefault();
    liste.push(""); nachFokus({ listid: listid, lii: liste.length - 1, ui: "x", caret: 0 });
  });
  body.appendChild(ghost);
}

/* One editable point row. ui == null → top-level item, else a sub-point. */
function punktRow(liste, listid, lii, ui) {
  const P = NIJU.PROZESS, lang = cL();
  const istSub = (ui != null);
  const row = el("div", "ed-row" + (istSub ? " ed-sub" : ""));
  /* autoGrow textarea (U1): long bullet points stay fully visible and wrap instead
     of being clipped horizontally. Enter is intercepted by punktTaste (preventDefault),
     so no accidental newline — the field is single-logical-line, just wrapping. */
  const inp = document.createElement("textarea");
  inp.className = "grow ed-grow"; inp.rows = 1;
  /* Read bilingual leaf: for top-level items, the leaf may be a string, {text,unterpunkte}, or i18n map. */
  const _rawLi = istSub ? liste[lii].unterpunkte[ui] : liste[lii];
  const _leaf = (!istSub && typeof _rawLi === "object" && _rawLi && !P.isI18n(_rawLi)) ? (_rawLi.text || "") : _rawLi;
  inp.value = P.text(_leaf, lang);
  inp.dataset.listid = listid; inp.dataset.lii = lii; inp.dataset.ui = (ui == null ? "x" : ui);
  inp.addEventListener("input", function () {
    if (istSub) {
      const cur = liste[lii].unterpunkte[ui];
      liste[lii].unterpunkte[ui] = (lang === P.PRIMARY && !P.isI18n(cur)) ? inp.value : P.setLeaf(cur, lang, inp.value);
    } else {
      const cur = liste[lii];
      if (typeof cur === "object" && cur && !P.isI18n(cur)) {
        cur.text = (lang === P.PRIMARY && !P.isI18n(cur.text)) ? inp.value : P.setLeaf(cur.text || "", lang, inp.value);
      } else {
        liste[lii] = (lang === P.PRIMARY && !P.isI18n(cur)) ? inp.value : P.setLeaf(cur, lang, inp.value);
      }
    }
    autoGrow(inp);
    render(STATE.daten);
  });
  inp.addEventListener("keydown", function (e) { punktTaste(e, inp, liste, listid, lii, ui); });
  row.appendChild(inp);
  requestAnimationFrame(function () { autoGrow(inp); });

  const tools = el("div", "ed-tools");
  const grip = iconBtn("ic-grip", t("editor.dragMove"), null, { reveal: true, grip: true });
  tools.appendChild(grip);
  /* Drag among siblings only: top-level points share one group, a parent's
     sub-points share their own group (sub-points never cross parents, §5.4). */
  dragWire(grip, row, istSub ? ("sub:" + listid + ":" + lii) : ("pts:" + listid), istSub ? ui : lii,
    function (from, to) { arrVerschieben(istSub ? liste[lii].unterpunkte : liste, from, to); nachStruktur(); });
  if (!istSub && lii > 0) tools.appendChild(iconBtn("ic-indent", t("editor.makeSubpoint"), function () { punktEinruecken(liste, listid, lii); }, { reveal: true }));
  tools.appendChild(iconBtn("ic-trash", t("editor.remove"), function () { punktLoeschen(liste, listid, lii, ui, true); }, { reveal: true }));
  const moreB = iconBtn("ic-dots-vertical", t("editor.more"), function () {
    oeffnePop(moreB, [
      { icon: "ic-arrow-up", label: t("editor.moveUp"), onClick: function () { punktBewegen(liste, listid, lii, ui, -1); } },
      { icon: "ic-arrow-down", label: t("editor.moveDown"), onClick: function () { punktBewegen(liste, listid, lii, ui, 1); } },
      { icon: "ic-duplicate", label: t("editor.duplicate"), onClick: function () { punktDuplizieren(liste, listid, lii, ui); } },
      "-",
      { icon: "ic-trash", label: t("editor.remove"), onClick: function () { punktLoeschen(liste, listid, lii, ui, false); } }
    ]);
  }, { reveal: true });
  tools.appendChild(moreB);
  row.appendChild(tools);
  return row;
}

/* ----- Point operations (keyboard model §5.5 + ⋯ menu). All mutate `liste`
   and rebuild via nachFokus so focus lands on the intended cell. ----- */
function punktBewegen(liste, listid, lii, ui, dir) {
  if (ui == null) {
    const j = lii + dir; if (j < 0 || j >= liste.length) return;
    const x = liste[lii]; liste[lii] = liste[j]; liste[j] = x; nachFokus({ listid: listid, lii: j, ui: "x", caret: null });
  } else {
    const a = liste[lii].unterpunkte, j = ui + dir; if (j < 0 || j >= a.length) return;
    const x = a[ui]; a[ui] = a[j]; a[j] = x; nachFokus({ listid: listid, lii: lii, ui: j, caret: null });
  }
}
function punktLoeschen(liste, listid, lii, ui, fokusVorig) {
  const prev = fokusVorig ? vorigeZeile(liste, lii, ui) : null;
  if (ui == null) liste.splice(lii, 1);
  else { liste[lii].unterpunkte.splice(ui, 1); if (!liste[lii].unterpunkte.length) delete liste[lii].unterpunkte; }
  if (prev) nachFokus({ listid: listid, lii: prev.lii, ui: prev.ui, caret: null });
  else nachStruktur();
}
function punktDuplizieren(liste, listid, lii, ui) {
  if (ui == null) { liste.splice(lii + 1, 0, klonTeil(liste[lii])); nachFokus({ listid: listid, lii: lii + 1, ui: "x", caret: null }); }
  else { const a = liste[lii].unterpunkte; a.splice(ui + 1, 0, a[ui]); nachFokus({ listid: listid, lii: lii, ui: ui + 1, caret: null }); }
}
/* Indent a top-level item to become sub-point(s) of the previous item (max 2 levels). */
function punktEinruecken(liste, listid, lii) {
  if (lii <= 0) return;
  const cur = liste[lii], text = itemText(cur);
  const ownSubs = (typeof cur === "object" && cur && cur.unterpunkte) ? cur.unterpunkte.slice() : [];
  let prev = liste[lii - 1];
  if (typeof prev !== "object" || !prev) { prev = { text: prev || "" }; liste[lii - 1] = prev; }
  if (!prev.unterpunkte) prev.unterpunkte = [];
  const at = prev.unterpunkte.length;
  prev.unterpunkte.push(text);
  ownSubs.forEach(function (u) { prev.unterpunkte.push(u); });
  liste.splice(lii, 1);
  nachFokus({ listid: listid, lii: lii - 1, ui: at, caret: null });
}
/* Outdent a sub-point back to a top-level item right after its parent. */
function punktAusruecken(liste, listid, lii, ui) {
  const parent = liste[lii];
  if (typeof parent !== "object" || !parent || !parent.unterpunkte) return;
  const text = parent.unterpunkte[ui];
  parent.unterpunkte.splice(ui, 1);
  if (!parent.unterpunkte.length) delete parent.unterpunkte;
  liste.splice(lii + 1, 0, text);
  nachFokus({ listid: listid, lii: lii + 1, ui: "x", caret: null });
}
function punktTaste(e, inp, liste, listid, lii, ui) {
  if (e.key === "Enter") {
    e.preventDefault();
    if (ui == null) { liste.splice(lii + 1, 0, ""); nachFokus({ listid: listid, lii: lii + 1, ui: "x", caret: 0 }); }
    else { liste[lii].unterpunkte.splice(ui + 1, 0, ""); nachFokus({ listid: listid, lii: lii, ui: ui + 1, caret: 0 }); }
  } else if (e.key === "Tab" && !e.shiftKey) {
    if (ui == null && lii > 0) { e.preventDefault(); punktEinruecken(liste, listid, lii); }
  } else if (e.key === "Tab" && e.shiftKey) {
    if (ui != null) { e.preventDefault(); punktAusruecken(liste, listid, lii, ui); }
  } else if (e.key === "Backspace" && inp.value === "") {
    if (ui == null) {
      const cur = liste[lii];
      if (typeof cur === "object" && cur && cur.unterpunkte && cur.unterpunkte.length) return;  /* keep a parent that still has sub-points */
    }
    e.preventDefault();
    punktLoeschen(liste, listid, lii, ui, true);
  } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    punktBewegen(liste, listid, lii, ui, e.key === "ArrowUp" ? -1 : 1);
  }
}

/* ----- RACI-Popover (Vorschau) ----- */
function schliesseRaciMenu() {
  const m = document.querySelector(".raci-menu");
  if (m) m.remove();
  document.removeEventListener("click", schliesseRaciMenu);
}
function toggleRaci(stepId, rolle, letter) {
  const d = STATE.daten;
  if (!d.raci) d.raci = {};
  const zeile = d.raci[stepId] || (d.raci[stepId] = {});
  let arr = zeile[rolle] ? zeile[rolle].slice() : [];
  if (arr.includes(letter)) arr = arr.filter(x => x !== letter);
  else arr.push(letter);
  arr.sort((a, b) => RACI_REIHENFOLGE.indexOf(a) - RACI_REIHENFOLGE.indexOf(b));
  if (arr.length) zeile[rolle] = arr; else delete zeile[rolle];
  render(d);
}
function oeffneRaciMenu(zelle, stepId, rolle) {
  schliesseRaciMenu();
  const d = STATE.daten;
  const menu = el("div", "raci-menu");
  RACI_REIHENFOLGE.forEach(b => {
    const btn = el("button", "rm-btn rm-" + b, raciLabel(b));
    const aktiv = d.raci && d.raci[stepId] && d.raci[stepId][rolle] && d.raci[stepId][rolle].includes(b);
    if (aktiv) btn.classList.add("an");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRaci(stepId, rolle, b);
      btn.classList.toggle("an");
    });
    menu.appendChild(btn);
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  document.body.appendChild(menu);
  const r = zelle.getBoundingClientRect();
  let left = r.left, top = r.bottom + 6;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - 8 - mw;
  if (top + mh > window.innerHeight - 8) top = r.top - 6 - mh;
  menu.style.left = Math.max(8, left) + "px";
  menu.style.top = Math.max(8, top) + "px";
  setTimeout(() => document.addEventListener("click", schliesseRaciMenu), 0);
}

/* ----- Bearbeiten-Modus an/aus ----- */
function setzeBearbeiten(an) {
  STATE.bearbeiten = an;
  document.body.classList.toggle("bearbeiten", an);
  const ed = document.getElementById("editor");
  ed.hidden = !an;
  if (an) baueEditor();
  else { ed.innerHTML = ""; schliesseRaciMenu(); }
  render(STATE.daten);
  requestAnimationFrame(passeBildschirmEin);
}
