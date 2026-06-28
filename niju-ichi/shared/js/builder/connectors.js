/* ============================================================
   NIJU ICHI — Process Builder: RACI connectors
   Draws the SVG connector lines that link RACI badges in the overview
   and in the detail mini-matrix.
   Provides (global): zeichneVerbinder, zeichneVerbinderUebersicht,
     zeichneVerbinderDetail
   Uses: core (SVG_NS, STATE)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   RACI-Verbinder zeichnen — Dispatcher je Ansicht
   ============================================================ */
function zeichneVerbinder() {
  if (STATE.ansicht === "detail") zeichneVerbinderDetail();
  else zeichneVerbinderUebersicht();
}

/* ----- Verbinder für die Übersicht (alle Schritt-Spalten) ----- */
function zeichneVerbinderUebersicht() {
  const blatt = document.getElementById("blatt");
  if (!blatt) return;
  /* Während der Messung das transform:scale neutralisieren, damit
     getBoundingClientRect natürliche (unskalierte) Koordinaten liefert. */
  const altTransform = blatt.style.transform;
  blatt.style.transform = "none";

  let svg = document.getElementById("verbinder");
  if (!svg) { svg = document.createElementNS(SVG_NS, "svg"); svg.id = "verbinder"; blatt.appendChild(svg); }
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const bRect = blatt.getBoundingClientRect();
  const w = blatt.clientWidth, h = blatt.clientHeight;
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("preserveAspectRatio", "none");

  function linie(x1, y1, x2, y2) {
    const l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    svg.appendChild(l);
  }
  function elbow(x1, y1, x2, y2) {
    if (Math.abs(y1 - y2) < 0.5) { linie(x1, y1, x2, y2); return; }
    const xm = (x1 + x2) / 2;
    linie(x1, y1, xm, y1); linie(xm, y1, xm, y2); linie(xm, y2, x2, y2);
  }
  const zentrum = (b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2 - bRect.left, y: r.top + r.height / 2 - bRect.top };
  };

  const proSchritt = {};
  Array.from(blatt.querySelectorAll(".raci-zelle .badge")).forEach(b => {
    (proSchritt[b.dataset.step] = proSchritt[b.dataset.step] || []).push(b);
  });

  Object.keys(proSchritt).forEach(stepId => {
    const cs = [], is = []; let R = null, A = null;
    proSchritt[stepId].forEach(b => {
      const p = zentrum(b), L = b.dataset.letter;
      if (L === "C") cs.push(p); else if (L === "I") is.push(p);
      else if (L === "R") R = p; else if (L === "A") A = p;
    });
    cs.sort((a, b) => a.y - b.y); is.sort((a, b) => a.y - b.y);
    const xC = cs.length ? cs[0].x : null;
    const xI = is.length ? is[0].x : null;
    const cExtra = [], iExtra = [];

    let prev = null;
    if (xC != null) prev = { kind: "col", x: xC, extra: cExtra };
    if (R) {
      if (prev && prev.kind === "col") { linie(prev.x, R.y, R.x, R.y); prev.extra.push(R.y); }
      prev = { kind: "pt", x: R.x, y: R.y };
    }
    if (A) {
      if (prev && prev.kind === "pt") elbow(prev.x, prev.y, A.x, A.y);
      else if (prev && prev.kind === "col") { linie(prev.x, A.y, A.x, A.y); prev.extra.push(A.y); }
      prev = { kind: "pt", x: A.x, y: A.y };
    }
    if (xI != null) {
      if (prev && prev.kind === "pt") { linie(prev.x, prev.y, xI, prev.y); iExtra.push(prev.y); }
      else if (prev && prev.kind === "col") { const y = cs[0].y; linie(prev.x, y, xI, y); iExtra.push(y); prev.extra.push(y); }
    }

    function vert(items, x, extra) {
      if (x == null) return;
      const ys = items.map(p => p.y).concat(extra);
      if (ys.length < 2) return;
      const y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys);
      if (y2 - y1 > 0.5) linie(x, y1, x, y2);
    }
    vert(cs, xC, cExtra);
    vert(is, xI, iExtra);
  });

  blatt.style.transform = altTransform;
}
/* ----- Verbinder für die Detail-Mini-Matrix (eine Schritt-Spalte) ----- */
function zeichneVerbinderDetail() {
  const matrix = document.querySelector(".raci-matrix");
  const blatt = document.getElementById("blatt");
  if (!matrix || !blatt) return;
  const altTransform = blatt.style.transform;
  blatt.style.transform = "none";

  let svg = document.getElementById("verbinder");
  if (!svg) { svg = document.createElementNS(SVG_NS, "svg"); svg.id = "verbinder"; matrix.appendChild(svg); }
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const mRect = matrix.getBoundingClientRect();
  const w = matrix.clientWidth, h = matrix.clientHeight;
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("preserveAspectRatio", "none");

  function linie(x1, y1, x2, y2) {
    const l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    svg.appendChild(l);
  }
  function elbow(x1, y1, x2, y2) {
    if (Math.abs(y1 - y2) < 0.5) { linie(x1, y1, x2, y2); return; }
    const xm = (x1 + x2) / 2;
    linie(x1, y1, xm, y1); linie(xm, y1, xm, y2); linie(xm, y2, x2, y2);
  }
  const zentrum = (b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2 - mRect.left, y: r.top + r.height / 2 - mRect.top };
  };

  const badges = Array.from(matrix.querySelectorAll(".rm-zelle .badge"));
  const cs = [], is = []; let R = null, A = null;
  badges.forEach(b => {
    const p = zentrum(b), L = b.dataset.letter;
    if (L === "C") cs.push(p); else if (L === "I") is.push(p);
    else if (L === "R") R = p; else if (L === "A") A = p;
  });
  cs.sort((a, b) => a.y - b.y); is.sort((a, b) => a.y - b.y);
  const xC = cs.length ? cs[0].x : null;
  const xI = is.length ? is[0].x : null;
  const cExtra = [], iExtra = [];

  let prev = null;
  if (xC != null) prev = { kind: "col", x: xC, extra: cExtra };
  if (R) {
    if (prev && prev.kind === "col") { linie(prev.x, R.y, R.x, R.y); prev.extra.push(R.y); }
    prev = { kind: "pt", x: R.x, y: R.y };
  }
  if (A) {
    if (prev && prev.kind === "pt") elbow(prev.x, prev.y, A.x, A.y);
    else if (prev && prev.kind === "col") { linie(prev.x, A.y, A.x, A.y); prev.extra.push(A.y); }
    prev = { kind: "pt", x: A.x, y: A.y };
  }
  if (xI != null) {
    if (prev && prev.kind === "pt") { linie(prev.x, prev.y, xI, prev.y); iExtra.push(prev.y); }
    else if (prev && prev.kind === "col") { const y = cs[0].y; linie(prev.x, y, xI, y); iExtra.push(y); prev.extra.push(y); }
  }

  function vert(items, x, extra) {
    if (x == null) return;
    const ys = items.map(p => p.y).concat(extra);
    if (ys.length < 2) return;
    const y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys);
    if (y2 - y1 > 0.5) linie(x, y1, x, y2);
  }
  vert(cs, xC, cExtra);
  vert(is, xI, iExtra);

  blatt.style.transform = altTransform;
}
