/* ============================================================
   NIJU ICHI — Function profile / "Steckbrief" (Phase 10, Feature B)
   Read-only aggregation of "everything from one function's point of view":
   for a chosen organisation function/role, list every process + step it takes
   part in — RACI participation (raci[stepId][roleId]) AND inline {…¦id} mentions
   in the description freetext. A calmer, structured alternative to the d3 brain.

   NIJU.STECKBRIEF.aggregate(model) -> { byKey, namen }
   NIJU.STECKBRIEF.render(host, model, { onOpen(datei, schrittIndex) })

   model = { index, prozesse } (same shape the Viewer/Manager already hold).
   No d3, no fetch, classic <script>. Binding to processes is by display name
   (like the Org sync); org node ids are carried through for exactness.
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.STECKBRIEF) return;
  function t(k, v) { return window.NIJU.I18N ? window.NIJU.I18N.t(k, v) : k; }
  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  /* collect every string value below a node (description/overview freetext).
     Language maps ({_i18n:1, de:…}) yield only the primary (DE) text so that
     {…¦id} reference tokens are extracted from the source language and the
     meta keys (_from, _i18n) are never traversed as plain strings. */
  function sammleTexte(node, out) {
    if (node == null) return;
    if (typeof node === "string") { out.push(node); return; }
    if (window.NIJU && NIJU.PROZESS && NIJU.PROZESS.isI18n(node)) { out.push(NIJU.PROZESS.srcText(node)); return; }
    if (Array.isArray(node)) { node.forEach(function (x) { sammleTexte(x, out); }); return; }
    if (typeof node === "object") { Object.keys(node).forEach(function (k) { sammleTexte(node[k], out); }); }
  }

  function aggregate(model) {
    var prozesse = (model && model.prozesse) || {};
    var index = (model && model.index) || {};
    var org = index.organisation || null;
    /* org name -> {name,id,typ} (first wins) for typ labels + searchable zero-involvement entries */
    var orgByName = {};
    if (org && Array.isArray(org.knoten)) org.knoten.forEach(function (k) {
      var n = (k.name || "").trim();
      if (n && !orgByName[n.toLowerCase()]) orgByName[n.toLowerCase()] = { name: n, id: k.id, typ: k.typ };
    });
    var byKey = {};   /* lowercased-name -> { name, id, typ, eintraege:[] } */
    function ensure(name) {
      var key = (name || "").trim().toLowerCase();
      if (!key) return null;
      if (!byKey[key]) {
        var o = orgByName[key];
        byKey[key] = { name: o ? o.name : (name || "").trim(), id: o ? o.id : "", typ: o ? o.typ : "", eintraege: [] };
      }
      return byKey[key];
    }
    Object.keys(prozesse).forEach(function (datei) {
      var d = prozesse[datei] && prozesse[datei].data;
      if (!d) return;
      var P = window.NIJU && NIJU.PROZESS;
      var titel = (P ? P.srcText((d.meta && d.meta.titel) || "") : ((d.meta && d.meta.titel) || "")) || datei;
      var schritte = d.schritte || [];
      var idToIdx = {}, idxTitel = [];
      schritte.forEach(function (s, i) {
        idToIdx[(s && s.id != null) ? s.id : i] = i;
        var P2 = window.NIJU && NIJU.PROZESS;
        idxTitel[i] = P2 ? (P2.srcText((s && s.untertitel) || "") || P2.srcText((s && s.titel) || "")) : ((s && (s.untertitel || s.titel)) || "");
      });
      /* role id -> display name (tolerant: old string roles and new {id,name}) */
      var idToName = {};
      (d.rollen || []).forEach(function (r) { idToName[NIJU.PROZESS.rolleId(r)] = NIJU.PROZESS.rolleName(r); });
      /* ---- RACI participation ---- */
      if (d.raci && typeof d.raci === "object") Object.keys(d.raci).forEach(function (sid) {
        if (!(sid in idToIdx)) return;
        var idx = idToIdx[sid], zeile = d.raci[sid];
        if (!zeile || typeof zeile !== "object") return;
        Object.keys(zeile).forEach(function (rid) {
          var name = (idToName[rid] != null) ? idToName[rid] : rid;
          var letters = zeile[rid] || [];
          (Array.isArray(letters) ? letters : [letters]).forEach(function (L) {
            var e = ensure(name);
            if (e) e.eintraege.push({ datei: datei, titel: titel, idx: idx, schritt: idxTitel[idx], art: L });
          });
        });
      });
      /* ---- inline {…¦id} mentions in the freetext ---- */
      schritte.forEach(function (s, i) {
        if (!window.NIJU.RICH) return;
        var texte = [];
        sammleTexte(s.beschreibung, texte); sammleTexte(s.bloecke, texte); sammleTexte(s.punkte, texte);
        var seen = {};
        texte.forEach(function (tx) {
          NIJU.RICH.refs(tx).forEach(function (ref) {
            var key = (ref.id || ref.name).toLowerCase();
            if (seen[key]) return; seen[key] = 1;
            var e = ensure(ref.name);
            if (e) { if (ref.id && !e.id) e.id = ref.id; e.eintraege.push({ datei: datei, titel: titel, idx: i, schritt: idxTitel[i], art: "mention" }); }
          });
        });
      });
    });
    /* include org functions/roles with zero involvement so they stay searchable */
    Object.keys(orgByName).forEach(function (key) {
      if (!byKey[key]) { var o = orgByName[key]; byKey[key] = { name: o.name, id: o.id, typ: o.typ, eintraege: [] }; }
    });
    var namen = Object.keys(byKey).map(function (k) { return byKey[k]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { byKey: byKey, namen: namen };
  }

  function render(host, model, opts) {
    opts = opts || {};
    var agg = aggregate(model);
    host.innerHTML = "";
    var wrap = el("div", "sb-wrap");
    var side = el("div", "sb-side");
    var such = document.createElement("input");
    such.type = "text"; such.className = "sb-search"; such.placeholder = t("sb.searchPh");
    side.appendChild(such);
    var ul = el("div", "sb-list"); side.appendChild(ul);
    var main = el("div", "sb-main");
    wrap.appendChild(side); wrap.appendChild(main); host.appendChild(wrap);

    var aktiv = null;
    function fuelleListe(filter) {
      ul.innerHTML = "";
      filter = (filter || "").trim().toLowerCase();
      var liste = agg.namen.filter(function (n) { return !filter || n.name.toLowerCase().indexOf(filter) >= 0; });
      if (!liste.length) { ul.appendChild(el("div", "sb-empty", t("sb.noMatch"))); return; }
      liste.forEach(function (n) {
        var b = el("button", "sb-item" + (n === aktiv ? " an" : "") + (n.typ ? " typ-" + n.typ : ""));
        b.type = "button";
        b.appendChild(el("span", "sb-item-name", n.name));
        b.appendChild(el("span", "sb-item-cnt", String(n.eintraege.length)));
        b.addEventListener("click", function () { aktiv = n; fuelleListe(such.value); zeigeProfil(n); });
        ul.appendChild(b);
      });
    }
    function zeigeProfil(n) {
      main.innerHTML = "";
      var head = el("div", "sb-head");
      head.appendChild(el("span", "sb-head-name", n.name));
      if (n.typ) head.appendChild(el("span", "sb-head-typ", n.typ === "funktion" ? t("editor.refFunction") : t("editor.refRole")));
      main.appendChild(head);
      if (!n.eintraege.length) { main.appendChild(el("div", "sb-empty", t("sb.noInvolvement"))); return; }
      var byDatei = {}, order = [];
      n.eintraege.forEach(function (e) {
        if (!byDatei[e.datei]) { byDatei[e.datei] = { titel: e.titel, steps: {} }; order.push(e.datei); }
        var s = byDatei[e.datei].steps;
        if (!s[e.idx]) s[e.idx] = { schritt: e.schritt, arten: [] };
        if (s[e.idx].arten.indexOf(e.art) < 0) s[e.idx].arten.push(e.art);
      });
      order.forEach(function (datei) {
        var grp = byDatei[datei];
        var card = el("div", "sb-card");
        card.appendChild(el("div", "sb-card-titel", grp.titel));
        Object.keys(grp.steps).map(Number).sort(function (a, b) { return a - b; }).forEach(function (idx) {
          var st = grp.steps[idx];
          var row = el("button", "sb-step"); row.type = "button";
          var badges = el("span", "sb-badges");
          ["R", "A", "C", "I"].forEach(function (L) { if (st.arten.indexOf(L) >= 0) badges.appendChild(el("span", "sb-badge " + L, L)); });
          if (st.arten.indexOf("mention") >= 0) badges.appendChild(el("span", "sb-badge mention", t("sb.mention")));
          row.appendChild(badges);
          row.appendChild(el("span", "sb-step-titel", st.schritt || ("#" + idx)));
          row.addEventListener("click", function () { if (opts.onOpen) opts.onOpen(datei, idx); });
          card.appendChild(row);
        });
        main.appendChild(card);
      });
    }
    such.addEventListener("input", function () { fuelleListe(such.value); });
    if (agg.namen.length) { aktiv = agg.namen[0]; fuelleListe(""); zeigeProfil(agg.namen[0]); }
    else { fuelleListe(""); main.appendChild(el("div", "sb-empty", t("sb.noData"))); }
  }

  window.NIJU.STECKBRIEF = { aggregate: aggregate, render: render };
})();
