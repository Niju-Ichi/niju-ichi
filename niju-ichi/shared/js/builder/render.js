/* ============================================================
   NIJU ICHI — Process Builder: Renderer
   Builds the visible sheet DOM for overview and detail views; fits the sheet
   to the available screen area.
   Provides (global): render, renderUebersicht, renderDetail,
     baueDetailLinks, baueDetailRechts, aktualisiereSchrittWahl,
     passeBildschirmEin
   Uses: core, connectors (zeichneVerbinder)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   Render-Dispatcher: wählt Übersicht oder Detailseite
   ============================================================ */
function render(daten) {
  normalisiereSchritte(daten);
  NIJU.PROZESS.migriere(daten);   /* Rollen auf {id,name} + raci auf id-Schlüssel (idempotent) */
  normalisiereRaci(daten);
  const blatt = document.getElementById("blatt");
  if (window.NIJU.DESIGN) window.NIJU.DESIGN.applyForProcess(daten);
  blatt.classList.toggle("detail", STATE.ansicht === "detail");
  if (STATE.ansicht === "detail") renderDetail(daten);
  else renderUebersicht(daten);
  aktualisiereSchrittWahl();
}

/* ============================================================
   Render-Funktion: Prozessübersicht (A3 quer)
   ============================================================ */
function renderUebersicht(daten) {
  const blatt = document.getElementById("blatt");
  blatt.innerHTML = "";
  blatt.classList.toggle("bearbeiten", STATE.bearbeiten);
  if (!daten || !daten.meta) {
    blatt.innerHTML = '<div class="leer-hinweis"></div>'; blatt.firstChild.textContent = t("msg.invalidData");
    return;
  }

  const m = daten.meta;
  const schritte = daten.schritte || [];
  const rollen = daten.rollen || [];
  const n = schritte.length;
  const versStand = "VERSION " + " "; // Platzhalter (wird unten zusammengebaut)

  /* ----- Eyebrow / Top-Strip ----- */
  const topbar = el("div", "topbar");
  const tbl = el("div", "tb-l");
  tbl.appendChild(document.createTextNode(t("render.processMap") + " "));
  if (m.firma) { tbl.appendChild(document.createTextNode("/ ")); tbl.appendChild(el("span", "ak", m.firma)); }
  topbar.appendChild(tbl);
  const tbr = el("div", "tb-r");
  const firmaEl = firmaElement(m);   /* Firma oben rechts: Text-Chip oder Logo */
  if (firmaEl) tbr.appendChild(firmaEl);
  topbar.appendChild(tbr);
  blatt.appendChild(topbar);

  /* ----- Titel (zweifarbig: vor "-" fett, danach hell) ----- */
  const titelWrap = el("div", "titel");
  const h1 = el("h1");
  const teile = (m.titel || "").split(/\s[-–]\s/);
  h1.appendChild(el("span", "t1", teile[0] || ""));
  if (teile.length > 1) { h1.appendChild(document.createTextNode(" ")); h1.appendChild(el("span", "t2", teile.slice(1).join(" – "))); }
  titelWrap.appendChild(h1);
  blatt.appendChild(titelWrap);

  /* ----- Raster ----- */
  const raster = el("div", "raster");
  raster.style.gridTemplateColumns = "minmax(205px, 1.12fr) repeat(" + n + ", 1fr)";

  /* Dunkles Meta-Panel: ein Block über Band 1 + 2 (grid-row 1/3).
     Vier Gruppen werden über die volle Höhe gleichmäßig verteilt. */
  const meta = el("div", "zelle meta");
  meta.style.gridColumn = "1";
  meta.style.gridRow = "1 / span 2";
  const mgruppe = (bauen) => { const g = el("div", "mgroup"); bauen(g); meta.appendChild(g); };
  mgruppe(g => {
    g.appendChild(el("div", "mlabel", t("field.processId")));
    g.appendChild(el("div", "mval-id", m.prozessId || "—"));
  });
  mgruppe(g => {
    g.appendChild(el("div", "mlabel", t("field.processOwner")));
    g.appendChild(el("div", "mval", m.processOwner || "—"));
  });
  if (daten.input) mgruppe(g => {
    g.appendChild(el("div", "mlabel", labelFormat(daten.input.label || t("field.input"))));
    g.appendChild(metaListe(daten.input.punkte));
  });
  if (daten.output) mgruppe(g => {
    g.appendChild(el("div", "mlabel", labelFormat(daten.output.label || t("field.output"))));
    if (daten.output.verantwortlich) g.appendChild(el("div", "mval akzent", daten.output.verantwortlich));
    g.appendChild(metaListe(daten.output.punkte));
  });
  raster.appendChild(meta);

  /* Band 1: Schritt-Köpfe (Zeile 1) */
  schritte.forEach((s, i) => {
    const k = el("div", "zelle schritt-kopf");
    k.style.gridColumn = String(i + 2);
    k.style.gridRow = "1";
    const top = el("div", "sk-top");
    /* Spaltenkopf-ID (frei wählbar). Ohne ID beginnt der Titel linksbündig. */
    if (s.kopfId) top.appendChild(el("span", "sk-num", s.kopfId));
    top.appendChild(el("span", "sk-lab", (s.titel || "").toUpperCase()));
    k.appendChild(top);
    if (s.untertitel) k.appendChild(el("div", "sk-sub", s.untertitel));
    raster.appendChild(k);
  });

  /* Band 2: Schritt-Inhalte (Zeile 2) */
  schritte.forEach((s, i) => {
    const c = el("div", "zelle schritt-inhalt");
    c.style.gridColumn = String(i + 2);
    c.style.gridRow = "2";
    schrittBloecke(s).forEach(block => {
      const bd = el("div", "si-block");
      if (block.typ === "absatz") {
        const p = el("div", "si-absatz"); p.innerHTML = richHTML(block.text || ""); bd.appendChild(p);
      } else if (block.typ === "ueberschrift") {
        const hd = el("div", "si-heading"); hd.innerHTML = richHTML(block.text || ""); bd.appendChild(hd);
      } else {
        if (block.ueberschrift) bd.appendChild(el("div", "si-lab", block.ueberschrift));
        bd.appendChild(punkteListe(block.punkte));
      }
      c.appendChild(bd);
    });
    raster.appendChild(c);
  });

  /* ----- RACI: Kopf mit Titel + Legende (volle Breite) ----- */
  const rhead = el("div", "raci-head");
  const rht = el("div");
  rht.appendChild(el("div", "rh-titel", t("render.raciTitle")));
  rht.appendChild(el("span", "rh-sub", t("render.raciSub")));
  rhead.appendChild(rht);
  const legende = el("div", "legende");
  const leg = daten.legende || {};
  RACI_REIHENFOLGE.forEach(b => {
    if (!leg[b]) return;
    const t = legendeTeile(leg[b]);
    const item = el("div", "leg-item");
    item.appendChild(badge(b));
    const txt = el("div", "leg-txt");
    txt.appendChild(el("b", null, t.titel || raciLabel(b)));
    if (t.sub) txt.appendChild(el("i", null, t.sub));
    item.appendChild(txt);
    legende.appendChild(item);
  });
  rhead.appendChild(legende);
  raster.appendChild(rhead);

  /* ----- RACI: Spaltenkopf (00–04) ----- */
  raster.appendChild(el("div", "raci-corner"));
  schritte.forEach((s, i) => {
    const c = el("div", "raci-num");
    if (s.kopfId) c.appendChild(el("span", "rn-num", s.kopfId));
    c.appendChild(el("span", "rn-lab", (s.titel || "").toUpperCase()));
    raster.appendChild(c);
  });

  /* ----- RACI: Matrix-Zeilen ----- */
  rollen.forEach((rolle, ri) => {
    const stripe = "rrow-" + (ri % 2);
    raster.appendChild(el("div", "raci-rolle " + stripe, rName(rolle)));
    schritte.forEach(s => {
      const zelle = el("div", "raci-zelle " + stripe);
      const eintrag = (daten.raci && daten.raci[s.id]) ? daten.raci[s.id][rId(rolle)] : null;
      if (eintrag && eintrag.length) {
        SLOT_REIHENFOLGE.forEach(b => {
          if (eintrag.includes(b)) {
            const bel = badge(b);
            bel.classList.add("slot-" + b);
            bel.dataset.step = s.id;
            bel.dataset.letter = b;
            zelle.appendChild(bel);
          }
        });
      }
      if (STATE.bearbeiten) {
        zelle.classList.add("editierbar");
        zelle.title = t("raci.clickHint");
        zelle.addEventListener("click", (ev) => { ev.stopPropagation(); oeffneRaciMenu(zelle, s.id, rId(rolle)); });
      }
      raster.appendChild(zelle);
    });
  });

  blatt.appendChild(raster);

  /* ----- Fuß ----- */
  const footer = el("div", "footer");
  footer.appendChild(el("div", "f-l", m.fusstext || ""));
  const fr = el("div", "f-r");
  if (m.version) { fr.appendChild(document.createTextNode(t("render.version") + " ")); fr.appendChild(el("b", null, m.version)); }
  if (m.datum)   fr.appendChild(document.createTextNode("  /  " + t("render.asOf") + " " + m.datum));
  if (m.firma)   fr.appendChild(document.createTextNode("  /  " + m.firma));
  footer.appendChild(fr);
  blatt.appendChild(footer);

  requestAnimationFrame(() => { zeichneVerbinder(); passeBildschirmEin(); });
}
/* ============================================================
   Render-Funktion: Prozessschritt-Detailseite (A4 quer)
   Liest dieselben Daten wie die Übersicht; die RACI-Matrix zeigt
   die Spalte dieses Schritts und ist damit 1:1 gespiegelt.
   ============================================================ */
function renderDetail(daten) {
  const blatt = document.getElementById("blatt");
  blatt.innerHTML = "";
  blatt.classList.toggle("bearbeiten", STATE.bearbeiten);
  if (!daten || !daten.meta || !daten.schritte || !daten.schritte.length) {
    blatt.innerHTML = '<div class="leer-hinweis"></div>'; blatt.firstChild.textContent = t("msg.invalidData");
    return;
  }
  const index = Math.max(0, Math.min(STATE.detailIndex || 0, daten.schritte.length - 1));
  STATE.detailIndex = index;

  const m = daten.meta;
  const schritt = daten.schritte[index];
  const rollen = daten.rollen || [];
  const leg = daten.legende || {};
  const pid = prozessIdTeile(m.prozessId);
  const nr = String(index).padStart(2, "0");

  /* ----- Eyebrow / Top-Strip ----- */
  const topbar = el("div", "topbar");
  const tbl = el("div", "tb-l");
  tbl.appendChild(document.createTextNode((pid.name || "").toUpperCase() + (pid.num ? "  ·  " + pid.num + "  /  " : "  /  ")));
  tbl.appendChild(el("span", "ak", t("render.processStep") + " " + nr));
  topbar.appendChild(tbl);
  const tbr = el("div", "tb-r");
  const firmaEl = firmaElement(m);   /* Firma oben rechts: Text-Chip oder Logo */
  if (firmaEl) tbr.appendChild(firmaEl);
  topbar.appendChild(tbr);
  blatt.appendChild(topbar);

  /* ----- Titel = Untertitel des Schritts ----- */
  const titelWrap = el("div", "titel");
  titelWrap.appendChild(el("h1", null, schritt.untertitel || schritt.titel || t("render.stepFallback", { n: index })));
  blatt.appendChild(titelWrap);

  /* ----- Körper: zwei Spalten ----- */
  const koerper = el("div", "koerper");
  koerper.appendChild(baueDetailLinks(daten, schritt, rollen, leg));
  koerper.appendChild(baueDetailRechts(schritt, leg));
  blatt.appendChild(koerper);

  /* ----- Fuß ----- */
  const footer = el("div", "footer");
  footer.appendChild(el("div", "f-l", m.fusstext || ""));
  const fr = el("div", "f-r");
  if (m.version) { fr.appendChild(document.createTextNode(t("render.version") + " ")); fr.appendChild(el("b", null, m.version)); }
  if (m.datum)   fr.appendChild(document.createTextNode("  /  " + t("render.asOf") + " " + m.datum));
  if (m.firma)   fr.appendChild(document.createTextNode("  /  " + m.firma));
  footer.appendChild(fr);
  blatt.appendChild(footer);

  requestAnimationFrame(() => { zeichneVerbinder(); passeBildschirmEin(); });
}

/* ---------- Detail: linke Spalte — RACI-Mini-Matrix + Legende ---------- */
function baueDetailLinks(daten, schritt, rollen, leg) {
  const sp = el("div", "spalte-links");
  const lab = el("div", "abschnitt-lab");
  lab.appendChild(document.createTextNode(t("detail.responsibilities") + " "));
  lab.appendChild(el("span", "dim", t("detail.raciThisStep")));
  sp.appendChild(lab);

  const matrix = el("div", "raci-matrix");
  matrix.appendChild(el("div", "rm-corner"));
  matrix.appendChild(el("div", "rm-kopf"));

  const eintragProRolle = (daten.raci && daten.raci[schritt.id]) ? daten.raci[schritt.id] : {};
  rollen.forEach((rolle, ri) => {
    const stripe = (ri % 2 === 0) ? " stripe" : "";
    matrix.appendChild(el("div", "rm-rolle" + stripe, rName(rolle)));
    const zelle = el("div", "rm-zelle" + stripe);
    const eintrag = eintragProRolle[rId(rolle)];
    if (eintrag && eintrag.length) {
      SLOT_REIHENFOLGE.forEach(b => {
        if (eintrag.includes(b)) {
          const bel = badge(b);
          bel.classList.add("slot-" + b);
          bel.dataset.letter = b;
          zelle.appendChild(bel);
        }
      });
    }
    if (STATE.bearbeiten) {
      zelle.classList.add("editierbar");
      zelle.title = t("raci.clickHint");
      zelle.addEventListener("click", (ev) => { ev.stopPropagation(); oeffneRaciMenu(zelle, schritt.id, rId(rolle)); });
    }
    matrix.appendChild(zelle);
  });
  sp.appendChild(matrix);

  sp.appendChild(el("hr", "leg-trenner"));
  const legende = el("div", "legende");
  RACI_REIHENFOLGE.forEach(b => {
    if (!leg[b]) return;
    const t = legendeTeile(leg[b]);
    const item = el("div", "leg-item");
    item.appendChild(badge(b));
    const txt = el("div", "leg-txt");
    txt.appendChild(el("b", null, t.titel || raciLabel(b)));
    if (t.sub) txt.appendChild(el("i", null, t.sub));
    item.appendChild(txt);
    legende.appendChild(item);
  });
  sp.appendChild(legende);
  return sp;
}

/* ---------- Detail: rechte Spalte — Beschreibungs-Blöcke je RACI-Buchstabe ---------- */
function baueDetailRechts(schritt, leg) {
  const sp = el("div", "spalte-rechts");
  const lab = el("div", "abschnitt-lab");
  lab.appendChild(document.createTextNode(t("detail.description") + " "));
  lab.appendChild(el("span", "dim", t("detail.assignmentRaci")));
  sp.appendChild(lab);

  const bloecke = schritt.beschreibung || [];
  if (!bloecke.length) {
    sp.appendChild(el("div", "leer-hinweis", t("detail.noDescription")));
    return sp;
  }

  bloecke.forEach(block => {
    const b = (block.raci || "").toUpperCase();
    const wrap = el("div", "beschr-block");
    wrap.appendChild(el("div", "bb-badge " + b, raciLabel(b)));
    const inhalt = el("div", "bb-inhalt");
    const t = legendeTeile(leg[b] || "");
    const eyebrow = el("div", "bb-eyebrow " + b);
    eyebrow.appendChild(document.createTextNode((t.titel || raciLabel(b)).toUpperCase() + " "));
    if (t.sub) eyebrow.appendChild(el("span", "dim", "· " + t.sub.toUpperCase()));
    inhalt.appendChild(eyebrow);
    if (block.titel) inhalt.appendChild(el("div", "bb-titel", block.titel));
    (block.inhalt || []).forEach(teil => {
      if (typeof teil === "string") {
        const p = el("p", "bb-p");
        p.innerHTML = richHTML(teil);
        inhalt.appendChild(p);
      } else if (teil && typeof teil === "object" && teil.ueberschrift != null) {
        const hd = el("div", "bb-heading");
        hd.innerHTML = richHTML(teil.ueberschrift || "");
        inhalt.appendChild(hd);
      } else if (teil && teil.liste) {
        const ul = el("ul", "bb-liste" + (teil.spalten === 2 ? " spalten2" : ""));
        teil.liste.forEach(li => {
          const item = el("li");
          const txt = (typeof li === "string") ? li : (li.text || "");
          item.innerHTML = richHTML(txt);
          const unter = (typeof li === "object" && li && li.unterpunkte) ? li.unterpunkte : null;
          if (unter && unter.length) {
            const sub = el("ul");
            unter.forEach(u => { const sl = el("li"); sl.innerHTML = richHTML(u); sub.appendChild(sl); });
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
/* ----- Schritt-Dropdown (Detail-Navigation) füllen/aktualisieren ----- */
function aktualisiereSchrittWahl() {
  const sel = document.getElementById("schrittWahl");
  if (!sel) return;
  const schritte = (STATE.daten && STATE.daten.schritte) || [];
  sel.innerHTML = "";
  schritte.forEach((s, i) => {
    const o = el("option", null, String(i).padStart(2, "0") + " — " + (s.untertitel || s.titel || t("render.stepFallback", { n: i })));
    o.value = String(i);
    sel.appendChild(o);
  });
  sel.value = String(STATE.detailIndex);
  sel.disabled = (STATE.ansicht !== "detail");
}

/* ============================================================
   Bildschirm-Einpassung (komplett sichtbar, kein Scrollen)
   Skalierung über transform:scale + Hülle, die die skalierte
   Größe einnimmt. Das SVG der Verbinder skaliert 1:1 mit.
   ============================================================ */
function passeBildschirmEin() {
  const blatt = document.getElementById("blatt");
  const wrap  = document.getElementById("blattWrap");
  if (!blatt || !wrap) return;
  const buehne = document.querySelector(".buehne");
  const stil = getComputedStyle(buehne);
  const padX = parseFloat(stil.paddingLeft) + parseFloat(stil.paddingRight);
  const padY = parseFloat(stil.paddingTop) + parseFloat(stil.paddingBottom);
  /* Verfügbarer Platz = innere Maße der Bühne (berücksichtigt das Editor-Panel
     automatisch, da die Bühne der Flex-Rest ist). */
  const verfBreite = buehne.clientWidth - padX;
  const verfHoehe  = buehne.clientHeight - padY;

  blatt.style.transform = "none";              // natürliche Maße messen
  const w = blatt.offsetWidth, h = blatt.offsetHeight;
  let skala = Math.min(verfBreite / w, verfHoehe / h, 1);
  if (!(skala > 0)) skala = 1;

  blatt.style.transform = "scale(" + skala + ")";
  wrap.style.width  = (w * skala) + "px";
  wrap.style.height = (h * skala) + "px";
}

let _einpassTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_einpassTimer);
  _einpassTimer = setTimeout(passeBildschirmEin, 120);
});
