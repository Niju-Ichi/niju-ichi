/* ============================================================
   NIJU ICHI — Org Manager (shared)
   Zentrale Verwaltung aller Funktionen (Abteilungen) und Rollen.
   Datenmodell liegt in index.json unter "organisation" (parallel zu
   "landkarte"). Bindung Org ↔ Prozess erfolgt rein über Namens-
   Gleichheit der RACI-Zeilen (rollen[] + raci-Schlüssel) — die
   Prozess-JSONs bleiben dadurch eigenständig/gültig.

   Modell organisation:
   { version:1, knoten:[ { id, name, parent:"<id|''>", typ:"funktion"|"rolle" } ] }

   Funktionen bilden den Organigramm-Baum (Kästen). Rollen hängen unter
   einer Funktion und erscheinen als Chips im/unter dem Kasten.

   Reine DOM-/CSS-Darstellung (kein Canvas/D3), offline, kein fetch.

   NIJU.ORG.normalize(org) -> bereinigtes Modell
   NIJU.ORG.alleNamen(org) -> [name] (Funktionen + Rollen, distinkt)
   NIJU.ORG.beteiligungen(name, prozesse) -> [dateiname]
   NIJU.ORG.umbenennen(org, id, neu, prozesse) -> {alt,neu,betroffen:[datei]}
   NIJU.ORG.ausProzessenUebernehmen(org, prozesse) -> anzahlNeu
   NIJU.ORG.renderListe(host, {org,prozesse}, {onChange,onRename})
   NIJU.ORG.renderChart(host, {org,prozesse}, {onRename})
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.ORG) return;

  function t(k, v) { return (window.NIJU && NIJU.I18N) ? NIJU.I18N.t(k, v) : k; }
  function newId() { return "o_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* ---- Modell ---- */
  function normalize(org) {
    org = (org && typeof org === "object") ? org : {};
    if (typeof org.version !== "number") org.version = 1;
    if (!Array.isArray(org.knoten)) org.knoten = [];
    var ids = {};
    org.knoten.forEach(function (k) {
      if (!k.id) k.id = newId();
      ids[k.id] = true;
      if (typeof k.name !== "string") k.name = "";
      if (k.typ !== "rolle") k.typ = "funktion";
      if (typeof k.parent !== "string") k.parent = "";
    });
    /* kaputte/eigene parent-Verweise auf "" zurücksetzen */
    org.knoten.forEach(function (k) { if (k.parent && (!ids[k.parent] || k.parent === k.id)) k.parent = ""; });
    return org;
  }

  function byId(org, id) { for (var i = 0; i < org.knoten.length; i++) if (org.knoten[i].id === id) return org.knoten[i]; return null; }
  function funktionen(org) { return org.knoten.filter(function (k) { return k.typ === "funktion"; }); }
  function rollen(org) { return org.knoten.filter(function (k) { return k.typ === "rolle"; }); }
  function children(org, parentId) { return org.knoten.filter(function (k) { return k.parent === parentId; }); }
  function alleNamen(org) {
    var seen = {}, out = [];
    org.knoten.forEach(function (k) { var n = (k.name || "").trim(); if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  /* ---- Beteiligungen (Namens-Gleichheit zu Prozess-RACI-Zeilen) ---- */
  function beteiligungen(name, prozesse) {
    var out = [];
    name = (name || "").trim();
    if (!name || !prozesse) return out;
    Object.keys(prozesse).forEach(function (datei) {
      var d = prozesse[datei] && prozesse[datei].data;
      var rollenListe = (d && Array.isArray(d.rollen)) ? d.rollen : [];
      if (rollenListe.some(function (r) { return NIJU.PROZESS.rolleName(r) === name; })) out.push(datei);
    });
    return out;
  }

  /* ---- Zentrale Umbenennung → Sync auf alle Prozesse ---- */
  function dedupe(arr) { var s = {}, o = []; arr.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  function umbenennen(org, id, neu, prozesse) {
    var node = byId(org, id);
    neu = (neu || "").trim();
    var alt = node ? node.name : "";
    if (node) node.name = neu;
    var betroffen = [];
    if (!node || alt === neu || !alt) return { alt: alt, neu: neu, betroffen: betroffen };
    Object.keys(prozesse || {}).forEach(function (datei) {
      var d = prozesse[datei] && prozesse[datei].data;
      if (!d) return;
      var changed = false;
      if (Array.isArray(d.rollen)) {
        var hit = false;
        d.rollen = d.rollen.map(function (r) {
          if (r && typeof r === "object") { if (NIJU.PROZESS.rolleName(r) === alt) { hit = true; r.name = neu; } return r; }
          if (r === alt) { hit = true; return neu; }   /* altes String-Format */
          return r;
        });
        /* Objekte sind über ihre id eindeutig → nur altes String-Format dedupen */
        if (hit) { if (d.rollen.every(function (r) { return typeof r !== "object"; })) d.rollen = dedupe(d.rollen); changed = true; }
      }
      /* RACI-Schlüssel: im neuen Format = stabile Rollen-id → der Name-Treffer unten greift NICHT
         (korrekt — die id bleibt). Nur alte, namensbasierte Dateien werden hier umgeschlüsselt. */
      if (d.raci && typeof d.raci === "object") {
        Object.keys(d.raci).forEach(function (sid) {
          var zeile = d.raci[sid];
          if (zeile && Object.prototype.hasOwnProperty.call(zeile, alt)) {
            if (Object.prototype.hasOwnProperty.call(zeile, neu)) {
              zeile[neu] = dedupe((zeile[neu] || []).concat(zeile[alt] || []));
            } else { zeile[neu] = zeile[alt]; }
            delete zeile[alt];
            changed = true;
          }
        });
      }
      if (changed) betroffen.push(datei);
    });
    return { alt: alt, neu: neu, betroffen: betroffen };
  }

  /* ---- Coverage: Anteil Org-Namen, die in mind. einem Prozess vorkommen ---- */
  function coverage(org, prozesse) {
    var namen = alleNamen(org);
    var total = namen.length, used = 0, white = 0, whiteNames = [];
    namen.forEach(function (n) {
      if (beteiligungen(n, prozesse).length > 0) { used++; }
      else { white++; whiteNames.push(n); }
    });
    return { total: total, used: used, white: white, whiteNames: whiteNames };
  }

  /* ---- Bootstrap: fehlende Rollennamen aus Prozessen übernehmen ---- */
  function ausProzessenUebernehmen(org, prozesse) {
    var vorhanden = {};
    org.knoten.forEach(function (k) { var n = (k.name || "").trim(); if (n) vorhanden[n] = 1; });
    var neu = 0;
    Object.keys(prozesse || {}).forEach(function (datei) {
      var d = prozesse[datei] && prozesse[datei].data;
      var rollenListe = (d && Array.isArray(d.rollen)) ? d.rollen : [];
      rollenListe.forEach(function (r) {
        var nm = NIJU.PROZESS.rolleName(r).trim();
        if (nm && !vorhanden[nm]) { vorhanden[nm] = 1; org.knoten.push({ id: newId(), name: nm, parent: "", typ: "funktion" }); neu++; }
      });
    });
    return neu;
  }

  /* ---- Tidy-Tree-Layout über die Funktionen (reine Zahlen) ---- */
  function layout(org) {
    var funk = funktionen(org);
    var fIds = {}; funk.forEach(function (f) { fIds[f.id] = f; });
    function kids(f) { return funk.filter(function (x) { return x.parent === f.id; }); }
    var roots = funk.filter(function (f) { return !f.parent || !fIds[f.parent]; });
    var leaf = 0, maxDepth = 0, pos = {};
    function place(node, depth) {
      if (depth > maxDepth) maxDepth = depth;
      var ck = kids(node);
      if (!ck.length) { pos[node.id] = { x: leaf, depth: depth }; leaf++; return pos[node.id].x; }
      var xs = ck.map(function (c) { return place(c, depth + 1); });
      var x = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
      pos[node.id] = { x: x, depth: depth };
      return x;
    }
    roots.forEach(function (r) { place(r, 0); });
    return { funk: funk, roots: roots, pos: pos, breite: leaf, maxDepth: maxDepth, kids: kids };
  }

  /* ============================================================
     Liste (editierbar) — inkl. DnD-Greifer + Coverage-Leiste + White-Spot-Filter
     ============================================================ */
  function renderListe(host, model, opts) {
    opts = opts || {};
    var org = normalize(model.org), prozesse = model.prozesse || {};
    var onChange         = opts.onChange         || function () {};
    var onRename         = opts.onRename         || function () {};
    var whiteOnly        = !!opts.whiteOnly;
    var onToggleWhiteOnly = opts.onToggleWhiteOnly || function () {};

    host.innerHTML = "";
    host.classList.add("org-list");

    /* DnD-Zustand, scoped auf diesen render-Aufruf */
    var dragging = null;   /* gezogene node.id */

    /* fIds für Schleifenschutz + moveSelect */
    var fIds = {};
    funktionen(org).forEach(function (f) { fIds[f.id] = f; });

    /* ---- Aktionsleiste ---- */
    var bar = el("div", "org-bar");
    var addF = el("button", "nt-btn add", t("org.addFunction"));
    addF.addEventListener("click", function () { org.knoten.push({ id: newId(), name: t("org.newFunction"), parent: "", typ: "funktion" }); onChange(); });
    bar.appendChild(addF);
    var imp = el("button", "nt-btn", t("org.importFromProcesses"));
    imp.addEventListener("click", function () {
      var n = ausProzessenUebernehmen(org, prozesse);
      alert(n ? t("org.importedN", { n: n }) : t("org.importedNone"));
      onChange();
    });
    bar.appendChild(imp);
    host.appendChild(bar);

    /* ---- Coverage-Leiste (nur wenn Prozesse geladen) ---- */
    if (Object.keys(prozesse).length) {
      var cov = coverage(org, prozesse);
      var covBar = el("div", "org-coverage-bar");
      covBar.appendChild(el("span", "org-coverage-txt",
        t("org.coverage", { used: cov.used, total: cov.total, white: cov.white })));
      var cbLabel = document.createElement("label");
      cbLabel.className = "org-coverage-toggle";
      var cbCheck = document.createElement("input");
      cbCheck.type = "checkbox"; cbCheck.checked = whiteOnly;
      cbCheck.addEventListener("change", function () { onToggleWhiteOnly(); });
      cbLabel.appendChild(cbCheck);
      cbLabel.appendChild(document.createTextNode(" " + t("org.filterWhiteSpots")));
      covBar.appendChild(cbLabel);
      host.appendChild(covBar);
    }

    if (!org.knoten.length) { host.appendChild(el("div", "org-empty", t("org.empty"))); return; }

    /* ---- White-Spot-Filtermodus: flache Liste aller Knoten mit 0 Beteiligungen ---- */
    if (whiteOnly) {
      var whiteNodes = org.knoten.filter(function (k) {
        return (k.name || "").trim() && beteiligungen(k.name, prozesse).length === 0;
      });
      if (!whiteNodes.length) {
        host.appendChild(el("div", "org-empty", t("org.usedNone")));
        return;
      }
      whiteNodes.forEach(function (k) {
        var row = el("div", "org-li " + (k.typ === "funktion" ? "funktion" : "role"));
        row.appendChild(el("span", "org-dot " + (k.typ === "funktion" ? "funk" : "role")));
        row.appendChild(nameInput(k));
        row.appendChild(countBadge(k.name));
        row.appendChild(moveSelect(k));
        row.appendChild(delBtn(k));
        host.appendChild(row);
      });
      return;
    }

    /* ---- Hilfsfunktionen (hoisted function declarations) ---- */

    function countBadge(name) {
      var n = beteiligungen(name, prozesse).length;
      var b = el("span", "org-count" + (n ? "" : " null"), String(n));
      b.title = n ? t("org.usedInN", { n: n }) : t("org.usedNone");
      return b;
    }
    function nameInput(node) {
      var inp = document.createElement("input");
      inp.type = "text"; inp.className = "org-name-in"; inp.value = node.name;
      inp.setAttribute("aria-label", t("org.name"));
      var alt = node.name;
      inp.addEventListener("focus", function () { alt = node.name; });
      function commit() {
        var neu = inp.value.trim();
        if (neu === alt) { node.name = neu; return; }
        onRename(node, neu);
      }
      inp.addEventListener("blur", commit);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") inp.blur(); });
      return inp;
    }
    function moveSelect(node) {
      var sel = document.createElement("select"); sel.className = "org-move";
      var o0 = document.createElement("option"); o0.value = ""; o0.textContent = t("org.topLevel"); sel.appendChild(o0);
      funktionen(org).forEach(function (f) {
        if (f.id === node.id) return;
        var o = document.createElement("option"); o.value = f.id; o.textContent = f.name || t("common.untitled"); sel.appendChild(o);
      });
      sel.value = fIds[node.parent] ? node.parent : "";
      sel.title = t("org.moveTo");
      sel.addEventListener("change", function () {
        /* Schleifenschutz wie gehabt */
        var ziel = sel.value, p = ziel, schutz = 0;
        while (p && schutz++ < 999) { if (p === node.id) { sel.value = node.parent; return; } p = fIds[p] ? fIds[p].parent : ""; }
        node.parent = ziel; onChange();
      });
      return sel;
    }
    function delBtn(node) {
      var b = el("button", "nt-btn del", "✕");
      b.title = t("org.delete");
      b.addEventListener("click", function () {
        var kinder = children(org, node.id);
        if (kinder.length && !confirm(t("org.confirmDeleteWithChildren", { name: node.name || "" }))) return;
        kinder.forEach(function (c) { c.parent = node.parent; });
        org.knoten = org.knoten.filter(function (k) { return k.id !== node.id; });
        onChange();
      });
      return b;
    }

    /* Greifer-Span: nur dieser ist draggable, nicht die ganze Zeile */
    function grip(node, row) {
      var g = el("span", "org-grip", "⠷");
      g.setAttribute("draggable", "true");
      g.setAttribute("aria-label", t("org.dragHandle"));
      g.addEventListener("dragstart", function (e) {
        dragging = node.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.id);
        setTimeout(function () { row.classList.add("org-drag"); }, 0);
      });
      g.addEventListener("dragend", function () {
        dragging = null;
        row.classList.remove("org-drag");
      });
      return g;
    }

    /* Funktions-Zeile als Drop-Ziel verdrahten */
    function makeFunkDropTarget(row, targetId) {
      row.addEventListener("dragover", function (e) {
        if (!dragging || dragging === targetId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        row.classList.add("org-drop-active");
      });
      row.addEventListener("dragleave", function (e) {
        if (e.relatedTarget && row.contains(e.relatedTarget)) return;
        row.classList.remove("org-drop-active");
      });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        row.classList.remove("org-drop-active");
        if (!dragging || dragging === targetId) return;
        var dragNode = byId(org, dragging);
        if (!dragNode) { dragging = null; return; }
        /* Schleifenschutz: targetId darf kein Nachfahre des gezogenen Knotens sein */
        var p = targetId, schutz = 0;
        while (p && schutz++ < 999) {
          if (p === dragging) { dragging = null; return; }
          p = fIds[p] ? fIds[p].parent : "";
        }
        dragNode.parent = targetId;
        dragging = null;
        onChange();
      });
    }

    /* ---- Top-Level-Drop-Leiste (persistent, oben) ---- */
    var topDrop = el("div", "org-drop-top", t("org.dropTopLevel"));
    topDrop.addEventListener("dragover", function (e) {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      topDrop.classList.add("org-drop-active");
    });
    topDrop.addEventListener("dragleave", function (e) {
      if (e.relatedTarget && topDrop.contains(e.relatedTarget)) return;
      topDrop.classList.remove("org-drop-active");
    });
    topDrop.addEventListener("drop", function (e) {
      e.preventDefault();
      topDrop.classList.remove("org-drop-active");
      if (!dragging) return;
      var dragNode = byId(org, dragging);
      if (!dragNode) { dragging = null; return; }
      dragNode.parent = "";
      dragging = null;
      onChange();
    });
    host.appendChild(topDrop);

    /* ---- Hierarchie rendern ---- */

    function rolleZeile(role) {
      var row = el("div", "org-li role");
      row.appendChild(grip(role, row));
      row.appendChild(el("span", "org-dot role"));
      row.appendChild(nameInput(role));
      row.appendChild(countBadge(role.name));
      row.appendChild(moveSelect(role));
      row.appendChild(delBtn(role));
      return row;
    }
    function funkBlock(funk, depth) {
      var wrap = el("div", "org-block");
      wrap.style.marginLeft = (depth * 22) + "px";
      var row = el("div", "org-li funktion");
      row.appendChild(grip(funk, row));
      row.appendChild(el("span", "org-dot funk"));
      row.appendChild(nameInput(funk));
      row.appendChild(countBadge(funk.name));
      var addR = el("button", "nt-btn add mini", "+ " + t("org.role"));
      addR.title = t("org.addRole");
      addR.addEventListener("click", function () { org.knoten.push({ id: newId(), name: t("org.newRole"), parent: funk.id, typ: "rolle" }); onChange(); });
      row.appendChild(addR);
      var addSub = el("button", "nt-btn add mini", "+ " + t("org.subfunction"));
      addSub.addEventListener("click", function () { org.knoten.push({ id: newId(), name: t("org.newFunction"), parent: funk.id, typ: "funktion" }); onChange(); });
      row.appendChild(addSub);
      row.appendChild(moveSelect(funk));
      row.appendChild(delBtn(funk));
      makeFunkDropTarget(row, funk.id);
      wrap.appendChild(row);
      children(org, funk.id).filter(function (k) { return k.typ === "rolle"; }).forEach(function (r) { wrap.appendChild(rolleZeile(r)); });
      host.appendChild(wrap);
      children(org, funk.id).filter(function (k) { return k.typ === "funktion"; }).forEach(function (sf) { funkBlock(sf, depth + 1); });
    }

    funktionen(org).filter(function (f) { return !fIds[f.parent]; }).forEach(function (f) { funkBlock(f, 0); });

    var loseR = rollen(org).filter(function (r) { return !fIds[r.parent]; });
    if (loseR.length) {
      host.appendChild(el("div", "org-sub-h", t("org.otherRoles")));
      loseR.forEach(function (r) { host.appendChild(rolleZeile(r)); });
    }
  }

  /* ============================================================
     Organigramm (Kästen + SVG-Verbinder)
     ============================================================ */
  function renderChart(host, model, opts) {
    opts = opts || {};
    var org = normalize(model.org), prozesse = model.prozesse || {};
    var onRename = opts.onRename || function () {};
    host.innerHTML = "";
    host.classList.add("org-chart-host");

    var L = layout(org);
    if (!L.funk.length) { host.appendChild(el("div", "org-empty", t("org.emptyChart"))); return; }

    var BOXW = 176, GAPX = 26, ROWH = 150, PADX = 24, PADY = 20;
    var stage = el("div", "org-chart");
    var breite = Math.max(1, L.breite) * (BOXW + GAPX) - GAPX + PADX * 2;
    var hoehe = (L.maxDepth + 1) * ROWH + PADY * 2;
    stage.style.width = breite + "px";
    stage.style.height = hoehe + "px";

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "org-links");
    svg.setAttribute("width", breite); svg.setAttribute("height", hoehe);
    stage.appendChild(svg);

    function rolleChips(funkId) {
      var rs = children(org, funkId).filter(function (k) { return k.typ === "rolle"; });
      if (!rs.length) return null;
      var wrap = el("div", "org-chips");
      rs.forEach(function (r) {
        var c = el("span", "org-role-chip", r.name || t("common.untitled"));
        var n = beteiligungen(r.name, prozesse).length;
        if (n) c.appendChild(el("span", "org-chip-n", String(n)));
        wrap.appendChild(c);
      });
      return wrap;
    }

    var boxEls = {};
    L.funk.forEach(function (f) {
      var p = L.pos[f.id]; if (!p) return;
      var left = PADX + p.x * (BOXW + GAPX);
      var top = PADY + p.depth * ROWH;
      var box = el("div", "org-box");
      box.style.left = left + "px"; box.style.top = top + "px"; box.style.width = BOXW + "px";

      var cnt = beteiligungen(f.name, prozesse).length;
      var cb = el("span", "org-count corner" + (cnt ? "" : " null"), String(cnt));
      cb.title = cnt ? t("org.usedInN", { n: cnt }) : t("org.usedNone");
      box.appendChild(cb);

      var title = el("div", "org-box-title", f.name || t("common.untitled"));
      title.title = t("org.dblToRename");
      title.addEventListener("dblclick", function () {
        var neu = prompt(t("org.renamePrompt", { name: f.name || "" }), f.name || "");
        if (neu != null) onRename(f, neu.trim());
      });
      box.appendChild(title);
      var chips = rolleChips(f.id); if (chips) box.appendChild(chips);
      if (!cnt) box.classList.add("ungenutzt");

      stage.appendChild(box);
      boxEls[f.id] = box;
    });

    host.appendChild(stage);

    /* Verbinder messen + zeichnen (nach DOM-Layout) */
    function zeichneLinks() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var sr = stage.getBoundingClientRect();
      L.funk.forEach(function (f) {
        if (!f.parent || !boxEls[f.parent] || !boxEls[f.id]) return;
        var pr = boxEls[f.parent].getBoundingClientRect();
        var cr = boxEls[f.id].getBoundingClientRect();
        var x1 = pr.left - sr.left + pr.width / 2, y1 = pr.bottom - sr.top;
        var x2 = cr.left - sr.left + cr.width / 2, y2 = cr.top - sr.top;
        var my = (y1 + y2) / 2;
        var d = "M" + x1 + " " + y1 + " V" + my + " H" + x2 + " V" + y2;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d); path.setAttribute("class", "org-link");
        svg.appendChild(path);
      });
    }
    requestAnimationFrame(zeichneLinks);
    /* einmaliges Nachzeichnen, falls Schriftmetriken später laden */
    setTimeout(zeichneLinks, 120);
  }

  window.NIJU.ORG = {
    normalize: normalize, newId: newId,
    byId: byId, funktionen: funktionen, rollen: rollen, children: children, alleNamen: alleNamen,
    beteiligungen: beteiligungen, coverage: coverage,
    umbenennen: umbenennen, ausProzessenUebernehmen: ausProzessenUebernehmen,
    layout: layout, renderListe: renderListe, renderChart: renderChart
  };
})();
