/* ============================================================
   NIJU ICHI — Read-only-Viewer (shared)
   Rendert eine Prozess-JSON als Blatt (Übersicht A3 / Detail A4),
   identisch zum Process Builder, aber OHNE Bearbeitung.
   Genutzt von Process Viewer und der Process-Manager-Vorschau.

   NIJU.VIEWER.render(host, data, { ansicht, detailIndex })
   NIJU.VIEWER.fit(host)
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.VIEWER) return;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var RACI_REIHENFOLGE = ["R", "A", "C", "I"];
  var SLOT_REIHENFOLGE = ["C", "R", "A", "I"];
  function t(k, v) { return window.NIJU.I18N ? window.NIJU.I18N.t(k, v) : k; }

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function raciLabel(b) { return (window.NIJU && NIJU.DESIGN && NIJU.DESIGN.labelFor) ? NIJU.DESIGN.labelFor(b) : b; }
  function badge(b) { return el("span", "badge badge-" + b, raciLabel(b)); }
  function labelFormat(text) { return (text || "").toUpperCase().replace(/\s*\[/, " / ").replace(/\]/g, ""); }
  function tagSplit(s) { var m = String(s).match(/^(.*?)\s*\[([^\]]+)\]\s*$/); return m ? { text: m[1], tag: m[2] } : { text: String(s), tag: null }; }
  function legendeTeile(text) { var m = String(text).match(/^(.*?)\s*\(([^)]+)\)\s*$/); return m ? { sub: m[1], titel: m[2] } : { sub: text, titel: "" }; }
  function prozessIdTeile(text) { var m = String(text || "").match(/^\s*([\d.]+)\s+(.*)$/); return m ? { num: m[1], name: m[2] } : { num: "", name: String(text || "") }; }
  function richHTML(s) {
    var esc = String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }
  function firmaElement(m) {
    if (m.firmaModus === "logo" && m.logo) { var img = el("img", "firma-logo"); img.src = m.logo; img.alt = m.firma || "Logo"; return img; }
    if (m.firma) return el("span", "chip", m.firma);
    return null;
  }
  function metaListe(punkte) {
    var ul = el("ul", "mliste");
    (punkte || []).forEach(function (p) {
      var s = tagSplit(typeof p === "string" ? p : (p.text || ""));
      var li = el("li");
      li.appendChild(el("span", "mtext", s.text));
      if (s.tag) li.appendChild(el("span", "mtag", s.tag));
      ul.appendChild(li);
    });
    return ul;
  }
  function punkteListe(punkte) {
    var ul = el("ul", "liste");
    (punkte || []).forEach(function (p) {
      var li = el("li");
      var text = (typeof p === "string") ? p : (p.text || "");
      li.appendChild(el("span", "txt", text));
      var unter = (typeof p === "object" && p.unterpunkte) ? p.unterpunkte : null;
      if (unter && unter.length) {
        var subUl = el("ul");
        unter.forEach(function (u) { subUl.appendChild(el("li", null, u)); });
        li.appendChild(subUl);
      }
      ul.appendChild(li);
    });
    return ul;
  }
  /* Schritt-Inhalt: flexibles Block-Modell (liest altes + neues Modell, read-only). */
  function schrittBloecke(s) {
    if (s && Array.isArray(s.bloecke)) return s.bloecke;
    return [{ typ: "liste", stil: "eckig", ueberschrift: (s && s.punkteUeberschrift) || "", punkte: (s && s.punkte) || [] }];
  }

  function blattVon(host) { return host.querySelector(".blatt"); }

  function render(host, daten, opts) {
    opts = opts || {};
    if (window.NIJU.DESIGN) window.NIJU.DESIGN.applyForProcess(daten);
    var ansicht = (opts.ansicht === "detail") ? "detail" : "uebersicht";
    host.classList.add("viewer-buehne");
    host.innerHTML = '<div class="blatt-wrap"><div class="blatt"></div></div>';
    var blatt = blattVon(host);
    blatt.classList.toggle("detail", ansicht === "detail");
    if (ansicht === "detail") renderDetail(host, blatt, daten, opts.detailIndex || 0);
    else renderUebersicht(host, blatt, daten);
  }

  function renderUebersicht(host, blatt, daten) {
    if (!daten || !daten.meta) { blatt.innerHTML = '<div class="leer-hinweis"></div>'; blatt.firstChild.textContent = t("msg.invalidData"); return; }
    var m = daten.meta, schritte = daten.schritte || [], rollen = daten.rollen || [], n = schritte.length;

    var topbar = el("div", "topbar");
    var tbl = el("div", "tb-l");
    tbl.appendChild(document.createTextNode(t("render.processMap") + " "));
    if (m.firma) { tbl.appendChild(document.createTextNode("/ ")); tbl.appendChild(el("span", "ak", m.firma)); }
    topbar.appendChild(tbl);
    var tbr = el("div", "tb-r");
    var firmaEl = firmaElement(m); if (firmaEl) tbr.appendChild(firmaEl);
    topbar.appendChild(tbr);
    blatt.appendChild(topbar);

    var titelWrap = el("div", "titel");
    var h1 = el("h1");
    var teile = (m.titel || "").split(/\s[-–]\s/);
    h1.appendChild(el("span", "t1", teile[0] || ""));
    if (teile.length > 1) { h1.appendChild(document.createTextNode(" ")); h1.appendChild(el("span", "t2", teile.slice(1).join(" – "))); }
    titelWrap.appendChild(h1);
    blatt.appendChild(titelWrap);

    var raster = el("div", "raster");
    raster.style.gridTemplateColumns = "minmax(205px, 1.12fr) repeat(" + n + ", 1fr)";

    var meta = el("div", "zelle meta");
    meta.style.gridColumn = "1"; meta.style.gridRow = "1 / span 2";
    var mgruppe = function (bauen) { var g = el("div", "mgroup"); bauen(g); meta.appendChild(g); };
    mgruppe(function (g) { g.appendChild(el("div", "mlabel", t("field.processId"))); g.appendChild(el("div", "mval-id", m.prozessId || "—")); });
    mgruppe(function (g) { g.appendChild(el("div", "mlabel", t("field.processOwner"))); g.appendChild(el("div", "mval", m.processOwner || "—")); });
    if (daten.input) mgruppe(function (g) { g.appendChild(el("div", "mlabel", labelFormat(daten.input.label || t("field.input")))); g.appendChild(metaListe(daten.input.punkte)); });
    if (daten.output) mgruppe(function (g) {
      g.appendChild(el("div", "mlabel", labelFormat(daten.output.label || t("field.output"))));
      if (daten.output.verantwortlich) g.appendChild(el("div", "mval akzent", daten.output.verantwortlich));
      g.appendChild(metaListe(daten.output.punkte));
    });
    raster.appendChild(meta);

    schritte.forEach(function (s, i) {
      var k = el("div", "zelle schritt-kopf");
      k.style.gridColumn = String(i + 2); k.style.gridRow = "1";
      var top = el("div", "sk-top");
      if (s.kopfId) top.appendChild(el("span", "sk-num", s.kopfId));
      top.appendChild(el("span", "sk-lab", (s.titel || "").toUpperCase()));
      k.appendChild(top);
      if (s.untertitel) k.appendChild(el("div", "sk-sub", s.untertitel));
      raster.appendChild(k);
    });
    schritte.forEach(function (s, i) {
      var c = el("div", "zelle schritt-inhalt");
      c.style.gridColumn = String(i + 2); c.style.gridRow = "2";
      schrittBloecke(s).forEach(function (block) {
        var bd = el("div", "si-block");
        if (block.typ === "absatz") {
          var p = el("div", "si-absatz"); p.innerHTML = richHTML(block.text || ""); bd.appendChild(p);
        } else {
          if (block.ueberschrift) bd.appendChild(el("div", "si-lab", block.ueberschrift));
          bd.appendChild(punkteListe(block.punkte));
        }
        c.appendChild(bd);
      });
      raster.appendChild(c);
    });

    var rhead = el("div", "raci-head");
    var rht = el("div");
    rht.appendChild(el("div", "rh-titel", t("render.raciTitle")));
    rht.appendChild(el("span", "rh-sub", t("render.raciSub")));
    rhead.appendChild(rht);
    var legende = el("div", "legende"), leg = daten.legende || {};
    RACI_REIHENFOLGE.forEach(function (b) {
      if (!leg[b]) return;
      var te = legendeTeile(leg[b]);
      var item = el("div", "leg-item");
      item.appendChild(badge(b));
      var txt = el("div", "leg-txt");
      txt.appendChild(el("b", null, te.titel || raciLabel(b)));
      if (te.sub) txt.appendChild(el("i", null, te.sub));
      item.appendChild(txt);
      legende.appendChild(item);
    });
    rhead.appendChild(legende);
    raster.appendChild(rhead);

    raster.appendChild(el("div", "raci-corner"));
    schritte.forEach(function (s, i) {
      var c = el("div", "raci-num");
      if (s.kopfId) c.appendChild(el("span", "rn-num", s.kopfId));
      c.appendChild(el("span", "rn-lab", (s.titel || "").toUpperCase()));
      raster.appendChild(c);
    });

    rollen.forEach(function (rolle, ri) {
      var stripe = "rrow-" + (ri % 2);
      raster.appendChild(el("div", "raci-rolle " + stripe, rolle));
      schritte.forEach(function (s) {
        var zelle = el("div", "raci-zelle " + stripe);
        var eintrag = (daten.raci && daten.raci[s.id]) ? daten.raci[s.id][rolle] : null;
        if (eintrag && eintrag.length) {
          SLOT_REIHENFOLGE.forEach(function (b) {
            if (eintrag.includes(b)) { var bel = badge(b); bel.classList.add("slot-" + b); bel.dataset.step = s.id; bel.dataset.letter = b; zelle.appendChild(bel); }
          });
        }
        raster.appendChild(zelle);
      });
    });
    blatt.appendChild(raster);

    var footer = el("div", "footer");
    footer.appendChild(el("div", "f-l", m.fusstext || ""));
    var fr = el("div", "f-r");
    if (m.version) { fr.appendChild(document.createTextNode(t("render.version") + " ")); fr.appendChild(el("b", null, m.version)); }
    if (m.datum) fr.appendChild(document.createTextNode("  /  " + t("render.asOf") + " " + m.datum));
    if (m.firma) fr.appendChild(document.createTextNode("  /  " + m.firma));
    footer.appendChild(fr);
    blatt.appendChild(footer);

    requestAnimationFrame(function () { zeichneVerbinderUebersicht(blatt); fit(host); });
  }

  function renderDetail(host, blatt, daten, index) {
    if (!daten || !daten.meta || !daten.schritte || !daten.schritte.length) { blatt.innerHTML = '<div class="leer-hinweis"></div>'; blatt.firstChild.textContent = t("msg.invalidData"); return; }
    index = Math.max(0, Math.min(index || 0, daten.schritte.length - 1));
    var m = daten.meta, schritt = daten.schritte[index], rollen = daten.rollen || [], leg = daten.legende || {};
    var pid = prozessIdTeile(m.prozessId), nr = String(index).padStart(2, "0");

    var topbar = el("div", "topbar");
    var tbl = el("div", "tb-l");
    tbl.appendChild(document.createTextNode((pid.name || "").toUpperCase() + (pid.num ? "  ·  " + pid.num + "  /  " : "  /  ")));
    tbl.appendChild(el("span", "ak", t("render.processStep") + " " + nr));
    topbar.appendChild(tbl);
    var tbr = el("div", "tb-r");
    var firmaEl = firmaElement(m); if (firmaEl) tbr.appendChild(firmaEl);
    topbar.appendChild(tbr);
    blatt.appendChild(topbar);

    var titelWrap = el("div", "titel");
    titelWrap.appendChild(el("h1", null, schritt.untertitel || schritt.titel || t("render.stepFallback", { n: index })));
    blatt.appendChild(titelWrap);

    var koerper = el("div", "koerper");
    koerper.appendChild(baueDetailLinks(daten, schritt, rollen, leg));
    koerper.appendChild(baueDetailRechts(schritt, leg));
    blatt.appendChild(koerper);

    var footer = el("div", "footer");
    footer.appendChild(el("div", "f-l", m.fusstext || ""));
    var fr = el("div", "f-r");
    if (m.version) { fr.appendChild(document.createTextNode(t("render.version") + " ")); fr.appendChild(el("b", null, m.version)); }
    if (m.datum) fr.appendChild(document.createTextNode("  /  " + t("render.asOf") + " " + m.datum));
    if (m.firma) fr.appendChild(document.createTextNode("  /  " + m.firma));
    footer.appendChild(fr);
    blatt.appendChild(footer);

    requestAnimationFrame(function () { zeichneVerbinderDetail(blatt); fit(host); });
  }

  function baueDetailLinks(daten, schritt, rollen, leg) {
    var sp = el("div", "spalte-links");
    var lab = el("div", "abschnitt-lab");
    lab.appendChild(document.createTextNode(t("detail.responsibilities") + " "));
    lab.appendChild(el("span", "dim", t("detail.raciThisStep")));
    sp.appendChild(lab);

    var matrix = el("div", "raci-matrix");
    matrix.appendChild(el("div", "rm-corner"));
    matrix.appendChild(el("div", "rm-kopf"));
    var eintragProRolle = (daten.raci && daten.raci[schritt.id]) ? daten.raci[schritt.id] : {};
    rollen.forEach(function (rolle, ri) {
      var stripe = (ri % 2 === 0) ? " stripe" : "";
      matrix.appendChild(el("div", "rm-rolle" + stripe, rolle));
      var zelle = el("div", "rm-zelle" + stripe);
      var eintrag = eintragProRolle[rolle];
      if (eintrag && eintrag.length) {
        SLOT_REIHENFOLGE.forEach(function (b) { if (eintrag.includes(b)) { var bel = badge(b); bel.classList.add("slot-" + b); bel.dataset.letter = b; zelle.appendChild(bel); } });
      }
      matrix.appendChild(zelle);
    });
    sp.appendChild(matrix);

    sp.appendChild(el("hr", "leg-trenner"));
    var legende = el("div", "legende");
    RACI_REIHENFOLGE.forEach(function (b) {
      if (!leg[b]) return;
      var te = legendeTeile(leg[b]);
      var item = el("div", "leg-item");
      item.appendChild(badge(b));
      var txt = el("div", "leg-txt");
      txt.appendChild(el("b", null, te.titel || raciLabel(b)));
      if (te.sub) txt.appendChild(el("i", null, te.sub));
      item.appendChild(txt);
      legende.appendChild(item);
    });
    sp.appendChild(legende);
    return sp;
  }

  function baueDetailRechts(schritt, leg) {
    var sp = el("div", "spalte-rechts");
    var lab = el("div", "abschnitt-lab");
    lab.appendChild(document.createTextNode(t("detail.description") + " "));
    lab.appendChild(el("span", "dim", t("detail.assignmentRaci")));
    sp.appendChild(lab);

    var bloecke = schritt.beschreibung || [];
    if (!bloecke.length) { sp.appendChild(el("div", "leer-hinweis", t("detail.noDescription"))); return sp; }

    bloecke.forEach(function (block) {
      var b = (block.raci || "").toUpperCase();
      var wrap = el("div", "beschr-block");
      wrap.appendChild(el("div", "bb-badge " + b, raciLabel(b)));
      var inhalt = el("div", "bb-inhalt");
      var te = legendeTeile(leg[b] || "");
      var eyebrow = el("div", "bb-eyebrow " + b);
      eyebrow.appendChild(document.createTextNode((te.titel || raciLabel(b)).toUpperCase() + " "));
      if (te.sub) eyebrow.appendChild(el("span", "dim", "· " + te.sub.toUpperCase()));
      inhalt.appendChild(eyebrow);
      if (block.titel) inhalt.appendChild(el("div", "bb-titel", block.titel));
      (block.inhalt || []).forEach(function (teil) {
        if (typeof teil === "string") { var p = el("p", "bb-p"); p.innerHTML = richHTML(teil); inhalt.appendChild(p); }
        else if (teil && teil.liste) {
          var ul = el("ul", "bb-liste" + (teil.spalten === 2 ? " spalten2" : ""));
          teil.liste.forEach(function (li) {
            var item = el("li");
            var txt = (typeof li === "string") ? li : (li.text || "");
            item.innerHTML = richHTML(txt);
            var unter = (typeof li === "object" && li && li.unterpunkte) ? li.unterpunkte : null;
            if (unter && unter.length) {
              var sub = el("ul");
              unter.forEach(function (u) { var sl = el("li"); sl.innerHTML = richHTML(u); sub.appendChild(sl); });
              item.appendChild(sub);
            }
            ul.appendChild(item);
          });
          inhalt.appendChild(ul);
        }
      });
      wrap.appendChild(inhalt);
      sp.appendChild(wrap);
    });
    return sp;
  }

  /* ----- RACI-Verbinder ----- */
  function svgIn(parent) {
    var svg = parent.querySelector("#verbinder");
    if (!svg) { svg = document.createElementNS(SVG_NS, "svg"); svg.id = "verbinder"; parent.appendChild(svg); }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    return svg;
  }
  function linieFn(svg) {
    return function (x1, y1, x2, y2) {
      var l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      svg.appendChild(l);
    };
  }
  function verbinde(badges, zentrum, linie) {
    var cs = [], is = [], R = null, A = null;
    badges.forEach(function (b) {
      var p = zentrum(b), L = b.dataset.letter;
      if (L === "C") cs.push(p); else if (L === "I") is.push(p); else if (L === "R") R = p; else if (L === "A") A = p;
    });
    cs.sort(function (a, b) { return a.y - b.y; }); is.sort(function (a, b) { return a.y - b.y; });
    var xC = cs.length ? cs[0].x : null, xI = is.length ? is[0].x : null, cExtra = [], iExtra = [];
    function elbow(x1, y1, x2, y2) { if (Math.abs(y1 - y2) < 0.5) { linie(x1, y1, x2, y2); return; } var xm = (x1 + x2) / 2; linie(x1, y1, xm, y1); linie(xm, y1, xm, y2); linie(xm, y2, x2, y2); }
    var prev = null;
    if (xC != null) prev = { kind: "col", x: xC, extra: cExtra };
    if (R) { if (prev && prev.kind === "col") { linie(prev.x, R.y, R.x, R.y); prev.extra.push(R.y); } prev = { kind: "pt", x: R.x, y: R.y }; }
    if (A) { if (prev && prev.kind === "pt") elbow(prev.x, prev.y, A.x, A.y); else if (prev && prev.kind === "col") { linie(prev.x, A.y, A.x, A.y); prev.extra.push(A.y); } prev = { kind: "pt", x: A.x, y: A.y }; }
    if (xI != null) { if (prev && prev.kind === "pt") { linie(prev.x, prev.y, xI, prev.y); iExtra.push(prev.y); } else if (prev && prev.kind === "col") { var y = cs[0].y; linie(prev.x, y, xI, y); iExtra.push(y); prev.extra.push(y); } }
    function vert(items, x, extra) { if (x == null) return; var ys = items.map(function (p) { return p.y; }).concat(extra); if (ys.length < 2) return; var y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys); if (y2 - y1 > 0.5) linie(x, y1, x, y2); }
    vert(cs, xC, cExtra); vert(is, xI, iExtra);
  }

  function zeichneVerbinderUebersicht(blatt) {
    if (!blatt) return;
    var altT = blatt.style.transform; blatt.style.transform = "none";
    var svg = svgIn(blatt);
    var bRect = blatt.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + blatt.clientWidth + " " + blatt.clientHeight);
    svg.setAttribute("preserveAspectRatio", "none");
    var linie = linieFn(svg);
    var zentrum = function (b) { var r = b.getBoundingClientRect(); return { x: r.left + r.width / 2 - bRect.left, y: r.top + r.height / 2 - bRect.top }; };
    var proSchritt = {};
    Array.from(blatt.querySelectorAll(".raci-zelle .badge")).forEach(function (b) { (proSchritt[b.dataset.step] = proSchritt[b.dataset.step] || []).push(b); });
    Object.keys(proSchritt).forEach(function (stepId) { verbinde(proSchritt[stepId], zentrum, linie); });
    blatt.style.transform = altT;
  }

  function zeichneVerbinderDetail(blatt) {
    var matrix = blatt.querySelector(".raci-matrix");
    if (!matrix) return;
    var altT = blatt.style.transform; blatt.style.transform = "none";
    var svg = svgIn(matrix);
    var mRect = matrix.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + matrix.clientWidth + " " + matrix.clientHeight);
    svg.setAttribute("preserveAspectRatio", "none");
    var linie = linieFn(svg);
    var zentrum = function (b) { var r = b.getBoundingClientRect(); return { x: r.left + r.width / 2 - mRect.left, y: r.top + r.height / 2 - mRect.top }; };
    verbinde(Array.from(matrix.querySelectorAll(".rm-zelle .badge")), zentrum, linie);
    blatt.style.transform = altT;
  }

  /* ----- Bildschirm-Einpassung ----- */
  function fit(host) {
    var blatt = blattVon(host), wrap = host.querySelector(".blatt-wrap");
    if (!blatt || !wrap) return;
    var stil = getComputedStyle(host);
    var padX = parseFloat(stil.paddingLeft) + parseFloat(stil.paddingRight);
    var padY = parseFloat(stil.paddingTop) + parseFloat(stil.paddingBottom);
    var verfBreite = host.clientWidth - padX, verfHoehe = host.clientHeight - padY;
    blatt.style.transform = "none";
    var w = blatt.offsetWidth, h = blatt.offsetHeight;
    var skala = Math.min(verfBreite / w, verfHoehe / h, 1);
    if (!(skala > 0)) skala = 1;
    blatt.style.transform = "scale(" + skala + ")";
    wrap.style.width = (w * skala) + "px";
    wrap.style.height = (h * skala) + "px";
  }

  window.NIJU.VIEWER = { render: render, fit: fit };
})();
