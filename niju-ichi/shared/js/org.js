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
      if (rollenListe.indexOf(name) >= 0) out.push(datei);
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
        d.rollen = d.rollen.map(function (r) { if (r === alt) { hit = true; return neu; } return r; });
        if (hit) { d.rollen = dedupe(d.rollen); changed = true; }
      }
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

  /* ---- Bootstrap: fehlende Rollennamen aus Prozessen übernehmen ---- */
  function ausProzessenUebernehmen(org, prozesse) {
    var vorhanden = {};
    org.knoten.forEach(function (k) { var n = (k.name || "").trim(); if (n) vorhanden[n] = 1; });
    var neu = 0;
    Object.keys(prozesse || {}).forEach(function (datei) {
      var d = prozesse[datei] && prozesse[datei].data;
      var rollenListe = (d && Array.isArray(d.rollen)) ? d.rollen : [];
      rollenListe.forEach(function (r) {
        r = (r || "").trim();
        if (r && !vorhanden[r]) { vorhanden[r] = 1; org.knoten.push({ id: newId(), name: r, parent: "", typ: "funktion" }); neu++; }
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
     Liste (editierbar)
     ============================================================ */
  function renderListe(host, model, opts) {
    opts = opts || {};
    var org = normalize(model.org), prozesse = model.prozesse || {};
    var onChange = opts.onChange || function () {};
    var onRename = opts.onRename || function () {};
    host.innerHTML = "";
    host.classList.add("org-list");

    /* Aktionsleiste */
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

    if (!org.knoten.length) { host.appendChild(el("div", "org-empty", t("org.empty"))); return; }

    var fIds = {}; funktionen(org).forEach(function (f) { fIds[f.id] = f; });

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
        onRename(node, neu); /* Manager führt Sync aus + rerendert */
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
        /* keine Schleifen: ein Knoten darf nicht unter einen seiner Nachfahren */
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
        /* Kinder eine Ebene hochziehen */
        kinder.forEach(function (c) { c.parent = node.parent; });
        org.knoten = org.knoten.filter(function (k) { return k.id !== node.id; });
        onChange();
      });
      return b;
    }

    /* rekursiv Funktionen rendern; darunter ihre Rollen als Chips-Zeile */
    function rolleZeile(role) {
      var row = el("div", "org-li role");
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
      wrap.appendChild(row);
      /* eigene Rollen */
      children(org, funk.id).filter(function (k) { return k.typ === "rolle"; }).forEach(function (r) { wrap.appendChild(rolleZeile(r)); });
      host.appendChild(wrap);
      /* Unter-Funktionen */
      children(org, funk.id).filter(function (k) { return k.typ === "funktion"; }).forEach(function (sf) { funkBlock(sf, depth + 1); });
    }

    /* oberste Ebene: Funktionen ohne (gültigen) Funktions-Parent */
    funktionen(org).filter(function (f) { return !fIds[f.parent]; }).forEach(function (f) { funkBlock(f, 0); });

    /* lose Rollen (parent ist keine Funktion) */
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
    beteiligungen: beteiligungen, umbenennen: umbenennen, ausProzessenUebernehmen: ausProzessenUebernehmen,
    layout: layout, renderListe: renderListe, renderChart: renderChart
  };
})();
