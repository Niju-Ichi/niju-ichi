/* ============================================================
   NIJU ICHI — Process Builder: draw.io import + org-name autocomplete
   Parses .drawio / .xml (mxGraph) files offline, classifies nodes
   heuristically, shows a confirmation dialog, and builds a process JSON.
   Also manages the org-name autocomplete datalist (ORG_NAMEN).
   Provides (global): textAusWert, base64ZuBytes, entpackeRaw, geomVon,
     absPos, leseDrawio, klassifiziere, baueDatenAusNodes, zeigeImportDialog,
     aktualisiereOrgNamen, ORG_NAMEN
   Uses: core (STATE, el, t, rName, rId, setDaten, NIJU.PROZESS),
     io (schliesseMenu, setAnsicht), editor (setzeBearbeiten)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   draw.io-Import (Phase 3) — .drawio / .xml (mxGraph)
   Liest alle Textfelder + Koordinaten, schlägt eine Zuordnung vor
   und zeigt einen Bestätigungs-Dialog (semi-automatisch).
   ============================================================ */

/* draw.io-Wert (oft HTML) → reiner Text mit Zeilenumbrüchen */
function textAusWert(wert) {
  if (wert == null) return "";
  let s = String(wert).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n");
  const tmp = document.createElement("div");
  tmp.innerHTML = s;
  let txt = tmp.textContent || "";
  return txt.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

/* Base64 → Uint8Array */
function base64ZuBytes(b64) {
  const bin = atob(b64.replace(/\s+/g, ""));
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

/* Raw-Deflate entpacken über die Browser-API (offline, ohne Bibliothek) */
async function entpackeRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error(t("msg.decompressUnsupported"));
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(new Uint8Array(buf));
}

/* Geometrie einer Zelle (eigene, relativ zum Eltern) */
function geomVon(cell) {
  const g = Array.from(cell.children).find(ch => ch.nodeName === "mxGeometry");
  if (!g) return null;
  const num = a => { const v = parseFloat(g.getAttribute(a)); return isNaN(v) ? 0 : v; };
  return { x: num("x"), y: num("y"), w: num("width"), h: num("height") };
}
/* Absolute Position (Eltern-Gruppen aufsummieren) */
function absPos(cell, byId) {
  let x = 0, y = 0, cur = cell;
  while (cur && cur.getAttribute && cur.getAttribute("vertex") === "1") {
    const g = geomVon(cur); if (g) { x += g.x; y += g.y; }
    cur = byId[cur.getAttribute("parent")];
  }
  return { x, y };
}

/* Datei-Text → Liste von Text-Knoten {text,x,y,w,h,cx,cy} (async wegen Entpacken) */
async function leseDrawio(text) {
  let xmlText = text;
  if (!/<mxGraphModel/i.test(xmlText)) {
    const m = xmlText.match(/<diagram[^>]*>([\s\S]*?)<\/diagram>/i);
    if (m && m[1].trim()) {
      xmlText = decodeURIComponent(await entpackeRaw(base64ZuBytes(m[1].trim())));
    }
  }
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error(t("msg.notXml"));
  const cells = Array.from(doc.getElementsByTagName("mxCell"));
  const byId = {};
  cells.forEach(c => { byId[c.getAttribute("id")] = c; });
  const nodes = [];
  cells.forEach(c => {
    if (c.getAttribute("vertex") !== "1") return;
    const txt = textAusWert(c.getAttribute("value") || "");
    if (!txt) return;
    const g = geomVon(c); if (!g) return;
    const p = absPos(c, byId);
    nodes.push({ id: c.getAttribute("id"), text: txt, x: p.x, y: p.y, w: g.w, h: g.h, cx: p.x + g.w / 2, cy: p.y + g.h / 2 });
  });
  return nodes;
}

/* Heuristische Erst-Zuordnung anhand der Lage */
function klassifiziere(nodes) {
  const raciRe = /^[\s]*[raciRACI]([\s,\/.;|·]*[raciRACI])*[\s]*$/;
  nodes.forEach(n => { n.kat = (raciRe.test(n.text) && n.text.length <= 14) ? "raci" : null; });
  const raci = nodes.filter(n => n.kat === "raci");
  const rest = nodes.filter(n => n.kat !== "raci");
  if (rest.length) {
    let titel = rest[0];
    rest.forEach(n => { if (n.y < titel.y - 2 || (Math.abs(n.y - titel.y) <= 2 && n.w > titel.w)) titel = n; });
    titel.kat = "titel";
  }
  if (raci.length) {
    const minX = Math.min.apply(null, raci.map(n => n.x));
    const maxX = Math.max.apply(null, raci.map(n => n.x + n.w));
    const minY = Math.min.apply(null, raci.map(n => n.y));
    const maxY = Math.max.apply(null, raci.map(n => n.y + n.h));
    nodes.forEach(n => {
      if (n.kat) return;
      if (n.cy >= minY - 6 && n.cy <= maxY + 6 && n.cx < minX) n.kat = "rolle";
      else if (n.cx >= minX - 6 && n.cx <= maxX + 6 && n.cy < minY) n.kat = "schritt";
    });
  }
  nodes.forEach(n => { if (!n.kat) n.kat = "ignore"; });
}

/* Kategorien für die Dropdowns */
const IMPORT_KATEGORIEN = [
  ["ignore", "import.catIgnore"],
  ["titel", "import.catTitle"],
  ["prozessId", "import.catProcessId"],
  ["firma", "import.catCompany"],
  ["owner", "import.catOwner"],
  ["schritt", "import.catStep"],
  ["rolle", "import.catRole"],
  ["raci", "import.catRaci"],
  ["input", "import.catInput"],
  ["output", "import.catOutput"],
  ["legende", "import.catLegend"]
];

/* Aus den (vom Nutzer bestätigten) Knoten das Prozess-JSON bauen */
function baueDatenAusNodes(nodes) {
  const get = k => nodes.filter(n => n.kat === k);
  const einzeilig = n => n.text.replace(/\n+/g, " ").trim();
  const meta = { titel: "", firma: "", firmaModus: "text", logo: "", prozessId: "", version: "1.0", datum: "", processOwner: "", fusstext: "" };
  if (get("titel")[0]) meta.titel = einzeilig(get("titel")[0]);
  if (get("prozessId")[0]) meta.prozessId = einzeilig(get("prozessId")[0]);
  if (get("firma")[0]) meta.firma = einzeilig(get("firma")[0]);
  if (get("owner")[0]) meta.processOwner = einzeilig(get("owner")[0]);

  const schrittNodes = get("schritt").sort((a, b) => a.cx - b.cx);
  const schritte = schrittNodes.map((n, i) => {
    const zeilen = n.text.split("\n").map(s => s.trim()).filter(Boolean);
    return { id: "schritt_imp_" + i, titel: zeilen[0] || t("render.stepFallback", { n: i }), untertitel: zeilen.slice(1).join(" "), punkteUeberschrift: "", punkte: [], beschreibung: [] };
  });
  const rolleNodes = get("rolle").sort((a, b) => a.cy - b.cy);
  const rollen = rolleNodes.map(n => ({ id: NIJU.PROZESS.neueRollenId(), name: einzeilig(n) }));

  const raci = {};
  schritte.forEach(s => { raci[s.id] = {}; });
  get("raci").forEach(n => {
    if (!schrittNodes.length || !rolleNodes.length) return;
    let si = 0, best = Infinity;
    schrittNodes.forEach((s, i) => { const d = Math.abs(s.cx - n.cx); if (d < best) { best = d; si = i; } });
    let ri = 0; best = Infinity;
    rolleNodes.forEach((r, i) => { const d = Math.abs(r.cy - n.cy); if (d < best) { best = d; ri = i; } });
    const vorhanden = (n.text.toUpperCase().match(/[RACI]/g) || []);
    const buchstaben = ["R", "A", "C", "I"].filter(L => vorhanden.includes(L));
    if (buchstaben.length) raci[schritte[si].id][rollen[ri].id] = buchstaben;
  });

  const input = { label: "Input [Responsible]", punkte: get("input").sort((a, b) => a.cy - b.cy).map(einzeilig) };
  const output = { label: "Output [Responsible]", verantwortlich: "", punkte: get("output").sort((a, b) => a.cy - b.cy).map(einzeilig) };
  const legende = {
    "R": "Concept responsibility (Responsible)", "A": "Decision responsibility (Accountable)",
    "C": "Contribution responsibility (Consulted)", "I": "Right to be informed (Informed)"
  };
  return { meta, input, output, schritte, rollen, raci, legende };
}

/* Bestätigungs-Dialog anzeigen */
function zeigeImportDialog(nodes) {
  const alt = document.getElementById("importOverlay");
  if (alt) alt.remove();

  const overlay = el("div", "import-overlay"); overlay.id = "importOverlay";
  const dialog = el("div", "import-dialog");

  const kopf = el("div", "import-kopf");
  kopf.appendChild(el("h2", null, t("import.dialogTitle")));
  kopf.appendChild(el("p", null, t("import.dialogIntro")));
  dialog.appendChild(kopf);

  const body = el("div", "import-body");
  const tab = el("table", "import-tabelle");
  const thead = el("tr");
  ["import.colText", "import.colPosition", "import.colCategory"].forEach(k => thead.appendChild(el("th", null, t(k))));
  tab.appendChild(thead);

  const sortiert = nodes.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const summeAktualisieren = () => {
    const z = {}; nodes.forEach(n => { z[n.kat] = (z[n.kat] || 0) + 1; });
    summe.textContent = t("import.summary", { steps: (z.schritt || 0), roles: (z.rolle || 0), raci: (z.raci || 0), input: (z.input || 0), output: (z.output || 0) });
  };

  sortiert.forEach(n => {
    const tr = el("tr");
    if (n.kat === "raci") tr.classList.add("ist-raci");
    tr.appendChild(el("td", "txt", n.text.replace(/\n/g, " ⏎ ")));
    tr.appendChild(el("td", "pos", "x " + Math.round(n.x) + " · y " + Math.round(n.y)));
    const tdK = el("td");
    const sel = document.createElement("select"); sel.className = "ed-select";
    IMPORT_KATEGORIEN.forEach(([v, key]) => { const o = document.createElement("option"); o.value = v; o.textContent = t(key); sel.appendChild(o); });
    sel.value = n.kat;
    sel.addEventListener("change", () => { n.kat = sel.value; tr.classList.toggle("ist-raci", n.kat === "raci"); summeAktualisieren(); });
    tdK.appendChild(sel);
    tr.appendChild(tdK);
    tab.appendChild(tr);
  });
  body.appendChild(tab);
  dialog.appendChild(body);

  const fuss = el("div", "import-fuss");
  const summe = el("div", "summe");
  fuss.appendChild(summe);
  const abbrechen = el("button", "btn-sek", t("import.cancel"));
  abbrechen.addEventListener("click", () => overlay.remove());
  const uebernehmen = el("button", "btn-akt", t("import.apply"));
  uebernehmen.addEventListener("click", () => {
    const daten = baueDatenAusNodes(nodes);
    overlay.remove();
    setDaten(daten);
    setAnsicht("uebersicht");
    if (!STATE.bearbeiten) setzeBearbeiten(true);
  });
  fuss.appendChild(abbrechen);
  fuss.appendChild(uebernehmen);
  dialog.appendChild(fuss);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  summeAktualisieren();
}

/* Import-Datei wählen + verarbeiten */
document.getElementById("btnImport").addEventListener("click", () => { schliesseMenu(); document.getElementById("drawioInput").click(); });
document.getElementById("drawioInput").addEventListener("change", (ev) => {
  const datei = ev.target.files[0];
  if (!datei) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const nodes = await leseDrawio(e.target.result);
      if (!nodes.length) { alert(t("msg.noTextFields")); return; }
      klassifiziere(nodes);
      zeigeImportDialog(nodes);
    } catch (err) {
      alert(t("msg.importFailed", { err: err.message }));
    }
  };
  reader.readAsText(datei, "utf-8");
  ev.target.value = "";
});
/* ---- Autocomplete: Funktions-/Rollennamen aus der Organisation ----
   Quelle 1: per "Organisation laden…" eingelesene index.json/organisation.json.
   Quelle 2: die im aktuellen Prozess bereits vorhandenen Rollen.
   Beides füllt das <datalist id="orgNamen"> für alle Rollen-Eingaben. */
let ORG_NAMEN = [];
function aktualisiereOrgNamen() {
  const liste = document.getElementById("orgNamen");
  if (!liste) return;
  const set = {}, out = [];
  ORG_NAMEN.forEach((n) => { n = (n || "").trim(); if (n && !set[n]) { set[n] = 1; out.push(n); } });
  ((STATE.daten && STATE.daten.rollen) || []).forEach((r) => { const n = rName(r).trim(); if (n && !set[n]) { set[n] = 1; out.push(n); } });
  out.sort((a, b) => a.localeCompare(b));
  liste.innerHTML = "";
  out.forEach((n) => { const o = document.createElement("option"); o.value = n; liste.appendChild(o); });
}
/* Phase 10 — name -> { id, typ } map of the loaded organisation, so the inline
   {…}-reference autocomplete can stamp the stable org-node id into the token.
   Kept separate from the plain ORG_NAMEN datalist (which only needs names). */
function aktualisiereOrgRefIndex(org) {
  const idx = {};
  (org && Array.isArray(org.knoten) ? org.knoten : []).forEach((k) => {
    const n = (k.name || "").trim();
    if (n && !idx[n]) idx[n] = { id: k.id, typ: k.typ };   /* first wins on duplicate names */
  });
  window.NIJU._orgRefIndex = idx;
}
document.getElementById("btnLadeOrg").addEventListener("click", () => { schliesseMenu(); document.getElementById("orgInput").click(); });
document.getElementById("orgInput").addEventListener("change", (ev) => {
  const datei = ev.target.files[0];
  if (!datei) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    let obj = null;
    try { obj = JSON.parse(e.target.result); } catch (err) { alert(t("msg.jsonReadFailed", { err: err.message })); return; }
    /* Datei kann das ganze index.json sein (.organisation) oder direkt eine organisation */
    const org = (obj && obj.organisation) ? obj.organisation : obj;
    if (!org || !Array.isArray(org.knoten)) { alert(t("org.loadInvalid")); return; }
    const normOrg = NIJU.ORG.normalize(org);
    ORG_NAMEN = NIJU.ORG.alleNamen(normOrg);
    aktualisiereOrgNamen();
    aktualisiereOrgRefIndex(normOrg);
    alert(t("org.loadedNames", { n: ORG_NAMEN.length }));
  };
  reader.readAsText(datei, "utf-8");
  ev.target.value = "";
});
