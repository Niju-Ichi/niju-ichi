/* ============================================================
   NIJU ICHI — Process Builder: HTML export
   Produces a self-contained, JS-free static HTML document: all process views
   rendered, CSS inline, logos as data-URLs, RACI connectors baked in as SVG.
   Single page and batch mode (multiple JSONs → ZIP-like folder via FSA).
   Provides (global): htmlName, blattSeiteSerialisieren, baueHtmlDokument,
     downloadHtml, exportiereHtml, htmlBatchStart, batchTitel,
     zeigeHtmlBatchDialog, htmlDelay, fuehreHtmlBatchAus, batchSpeichern
   Uses: core, render, connectors, export-image (sammleSeitenCss),
     io (idbHandleLaden, idbHandleSpeichern)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   HTML-Export (offline, statisch — ohne JavaScript zum Anzeigen)
   Erzeugt EINE in sich geschlossene .html-Datei: Prozessübersicht +
   ALLE Detailseiten, fertig gerendert wie im NIJU-Viewer. Kein JS, kein
   Nachladen — Blatt-CSS inline, Logos als Data-URL, RACI-Verbinder als
   eingebackenes SVG, das aktive Design als :root-Variablen. Zusätzlich ist
   die Original-JSON eingebettet (verlustfreier Rück-Import). Jede Seite wird
   als ECHTES HTML ausgegeben (KEIN SVG-<foreignObject> — das verrutscht in
   Safari/Firefox/Chrome, v. a. Badges + Verbinder) → rendert 1:1 mit der CSS-
   Engine wie im Viewer. Ein winziges Inline-Skript skaliert jede Seite per
   transform:scale auf die Spaltenbreite (wie der Viewer-„fit"); ohne Skript
   zeigt sie sich in natürlicher Größe (scrollbar) — Inhalt bleibt vollständig.
   Einbetten: Datei anhängen und per iframe einbinden, oder standalone öffnen.
   ============================================================ */
function htmlName(daten) {
  const m = ((daten || STATE.daten) || {}).meta || {};
  let basis = m.prozessId || m.titel || "prozess";
  basis = basis.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-+|-+$/g, "");
  return (basis || "prozess") + ".html";
}

/* Aktuelles #blatt klonen → HTML-String. KEINE festen Pixel-Maße einbacken:
   das Blatt behält seine mm-Breite (über Browser konstant) und natürliche Höhe.
   Größe + Verbinder werden im Export pro Browser frisch gemessen/gezeichnet —
   so passen Layout und RACI-Linien überall (auch Safari), nicht nur im Browser,
   in dem exportiert wurde. */
function blattSeiteSerialisieren() {
  const blatt = document.getElementById("blatt");
  const klon = blatt.cloneNode(true);
  klon.style.transform = "none";
  klon.style.boxShadow = "none";
  klon.style.margin = "0";
  /* relative (NICHT static): #verbinder ist position:absolute;inset:0 und muss
     das Blatt als positionierten Vorfahren überlagern (sonst verrutschen die
     RACI-Verbinderlinien). top/left=0 = normaler Fluss-Platz. */
  klon.style.position = "relative";
  klon.style.left = "0"; klon.style.top = "0";
  return klon.outerHTML;
}

/* Vollständiges, statisches HTML-Dokument bauen (Übersicht + alle Details).
   zielDaten = zu exportierender Prozess (Default: aktueller). Für den Stapel
   wird STATE.daten kurz auf den Zielprozess umgeschaltet und danach wieder
   zurückgesetzt — der Editor-Zustand bleibt unverändert. */
function baueHtmlDokument(zielDaten) {
  const daten = zielDaten || STATE.daten;
  const sichern = { daten: STATE.daten, ansicht: STATE.ansicht, idx: STATE.detailIndex, bearb: STATE.bearbeiten };
  STATE.daten = daten;
  STATE.bearbeiten = false;   /* read-only Look (keine Editier-Affordances) */

  const seiten = [];
  /* Übersicht */
  STATE.ansicht = "uebersicht";
  render(daten); zeichneVerbinder();
  seiten.push(blattSeiteSerialisieren());
  /* alle Detailseiten */
  const n = (daten.schritte || []).length;
  for (let i = 0; i < n; i++) {
    STATE.ansicht = "detail"; STATE.detailIndex = i;
    render(daten); zeichneVerbinder();
    seiten.push(blattSeiteSerialisieren());
  }

  /* ALLES, was den Live-Zustand liest (Design am :root, body-Klassen, JSON des
     Zielprozesses), VOR dem Restore erfassen — sonst bekäme der Stapel das
     Design/JSON des falschen (zurückgesetzten) Prozesses. */
  const sheetCss = sammleSeitenCss();
  const optClasses = Array.from(document.body.classList).filter(c => /^opt-/.test(c)).join(" ");
  const rs = getComputedStyle(document.documentElement);
  const designVars = ["--ink","--paper","--muted","--akzent","--rule","--rule-mid","--rule-strong",
    "--sidebar","--body","--zebra","--verbinder","--num-soft","--sans","--mono",
    "--raci-R","--raci-R-text","--raci-A","--raci-A-text","--raci-C","--raci-C-text","--raci-I","--raci-I-text"];
  let rootStyle = "";
  designVars.forEach(v => { const val = rs.getPropertyValue(v); if (val) rootStyle += v + ":" + val.trim() + ";"; });
  /* Original-JSON als Daten-Insel (nicht ausgeführt) → Rück-Import / Datenträger */
  const jsonText = baueJsonText().replace(/<\//g, "<\\/");

  /* Zustand wiederherstellen (Daten + Ansicht) */
  STATE.daten = sichern.daten; STATE.bearbeiten = sichern.bearb;
  setAnsicht(sichern.ansicht === "detail" ? "detail" : "uebersicht", sichern.idx);

  /* Design-Options-Regeln (liegen sonst in base.css = Chrome, hier nicht geladen) */
  const optRules =
    "body.opt-no-connectors #verbinder{display:none!important}" +
    "body.opt-badge-round .badge,body.opt-badge-round .bb-badge{border-radius:50%}" +
    "body.opt-no-zebra .rrow-1 .raci-zelle,body.opt-no-zebra .raci-zelle.rrow-1," +
    "body.opt-no-zebra .rrow-1.raci-rolle,body.opt-no-zebra .rm-rolle.stripe," +
    "body.opt-no-zebra .rm-zelle.stripe{background:transparent!important}";
  /* Dokument-Layout. WICHTIG: das eingebettete Builder-CSS setzt
     body{height:100vh;overflow:hidden;display:flex} (App-Shell) — unten
     überschrieben. .niju-doc-scale = inline-block, schrumpft auf die natürliche
     Blattgröße; das Skript skaliert sie per transform und setzt die Seitengröße.
     Ohne Skript: natürliche Größe, .niju-doc-page scrollt statt zu beschneiden. */
  const docCss =
    "html{margin:0;padding:0}" +
    "body{margin:0;padding:0;display:block;height:auto;min-height:0;overflow:visible;" +
      "background:#e9ecef;font-family:var(--sans,\"Helvetica Neue\",Arial,sans-serif)}" +
    ".niju-doc{display:block;box-sizing:border-box;max-width:1200px;margin:0 auto;padding:20px 14px 44px}" +
    ".niju-doc-page{box-sizing:content-box;margin:0 auto 22px;background:var(--paper,#fff);" +
      "box-shadow:0 6px 22px rgba(15,23,42,.20);border-radius:4px;overflow:auto}" +
    ".niju-doc-page:last-child{margin-bottom:0}" +
    ".niju-doc-scale{display:inline-block;vertical-align:top;transform-origin:top left}" +
    "@media print{body{background:#fff}@page{size:A3 landscape;margin:6mm}" +
    ".niju-doc{max-width:none;margin:0;padding:0}" +
    ".niju-doc-page{margin:0;width:auto!important;height:auto!important;overflow:visible;" +
    "box-shadow:none;border-radius:0;break-after:page}" +
    ".niju-doc-page:last-child{break-after:auto}" +
    ".niju-doc-scale{transform:none!important}}";
  const css = sheetCss + "\n" + optRules + "\n" + docCss;

  const seitenHtml = seiten.map(h =>
    '<div class="niju-doc-page"><div class="niju-doc-scale">' + h + '</div></div>'
  ).join("\n");

  /* Inline-Skript: (1) zeichnet die RACI-Verbinder im Export-Browser NEU gegen
     die echten Badge-Positionen (1:1, in jedem Browser deckungsgleich), (2)
     skaliert jede Seite per transform:scale auf die Spaltenbreite (wie der
     Viewer-„fit"). Wird bei jedem fit() in natürlicher Größe gemessen → robust
     gegen Font-/Reflow-Unterschiede. Inhalt steht auch ohne das Skript. */
  const fitScript =
    '<script>(function(){' +
    'var NS="http://www.w3.org/2000/svg";' +
    'function draw(blatt){' +
      'var svg=blatt.querySelector("#verbinder");if(!svg)return;' +
      'var ref=svg.parentNode;while(svg.firstChild)svg.removeChild(svg.firstChild);' +
      'var w=ref.clientWidth,h=ref.clientHeight;' +
      'svg.setAttribute("viewBox","0 0 "+w+" "+h);svg.setAttribute("preserveAspectRatio","none");' +
      'var rr=ref.getBoundingClientRect();' +
      'function L(a,b,c,d){var l=document.createElementNS(NS,"line");l.setAttribute("x1",a);l.setAttribute("y1",b);l.setAttribute("x2",c);l.setAttribute("y2",d);svg.appendChild(l);}' +
      'function E(a,b,c,d){if(Math.abs(b-d)<0.5){L(a,b,c,d);return;}var xm=(a+c)/2;L(a,b,xm,b);L(xm,b,xm,d);L(xm,d,c,d);}' +
      'function C(el){var r=el.getBoundingClientRect();return{x:r.left+r.width/2-rr.left,y:r.top+r.height/2-rr.top};}' +
      'function tree(bs){var cs=[],is=[],R=null,A=null,i;' +
        'for(i=0;i<bs.length;i++){var p=C(bs[i]),l=bs[i].getAttribute("data-letter");' +
          'if(l==="C")cs.push(p);else if(l==="I")is.push(p);else if(l==="R")R=p;else if(l==="A")A=p;}' +
        'cs.sort(function(a,b){return a.y-b.y;});is.sort(function(a,b){return a.y-b.y;});' +
        'var xC=cs.length?cs[0].x:null,xI=is.length?is[0].x:null,cE=[],iE=[],prev=null;' +
        'if(xC!=null)prev={k:"col",x:xC,e:cE};' +
        'if(R){if(prev&&prev.k==="col"){L(prev.x,R.y,R.x,R.y);prev.e.push(R.y);}prev={k:"pt",x:R.x,y:R.y};}' +
        'if(A){if(prev&&prev.k==="pt")E(prev.x,prev.y,A.x,A.y);else if(prev&&prev.k==="col"){L(prev.x,A.y,A.x,A.y);prev.e.push(A.y);}prev={k:"pt",x:A.x,y:A.y};}' +
        'if(xI!=null){if(prev&&prev.k==="pt"){L(prev.x,prev.y,xI,prev.y);iE.push(prev.y);}else if(prev&&prev.k==="col"){var y=cs[0].y;L(prev.x,y,xI,y);iE.push(y);prev.e.push(y);}}' +
        'function V(items,x,e){if(x==null)return;var ys=[],i;for(i=0;i<items.length;i++)ys.push(items[i].y);ys=ys.concat(e);if(ys.length<2)return;var y1=Math.min.apply(null,ys),y2=Math.max.apply(null,ys);if(y2-y1>0.5)L(x,y1,x,y2);}' +
        'V(cs,xC,cE);V(is,xI,iE);}' +
      'if(blatt.className.indexOf("detail")>=0){tree([].slice.call(ref.querySelectorAll(".rm-zelle .badge")));}' +
      'else{var g={},bs=blatt.querySelectorAll(".raci-zelle .badge"),i;' +
        'for(i=0;i<bs.length;i++){var st=bs[i].getAttribute("data-step")||"";(g[st]=g[st]||[]).push(bs[i]);}' +
        'for(var k in g)if(g.hasOwnProperty(k))tree(g[k]);}' +
    '}' +
    'function fit(){var doc=document.querySelector(".niju-doc");if(!doc)return;' +
      'var avail=doc.clientWidth-28;if(avail<1)return;' +
      'var ps=document.querySelectorAll(".niju-doc-page"),i;' +
      'for(i=0;i<ps.length;i++){var p=ps[i],sc=p.firstElementChild;if(!sc)continue;' +
        'sc.style.transform="none";' +
        'var bl=sc.querySelector(".blatt");if(bl)draw(bl);' +
        'var w=sc.offsetWidth,h=sc.offsetHeight;var s=avail/w;if(s>1)s=1;' +
        'sc.style.transform="scale("+s+")";' +
        'p.style.width=Math.round(w*s)+"px";p.style.height=Math.round(h*s)+"px";p.style.overflow="hidden";}}' +
    'if(document.readyState!=="loading")fit();else document.addEventListener("DOMContentLoaded",fit);' +
    'window.addEventListener("load",fit);window.addEventListener("resize",fit);' +
    '})();</scr' + 'ipt>';

  const m = daten.meta || {};
  const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const lang = (window.NIJU.I18N && NIJU.I18N.get()) || "en";

  return '<!DOCTYPE html>\n<html lang="' + esc(lang) + '" style="' + esc(rootStyle) + '">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="generator" content="NIJU ICHI Process Builder">\n' +
    '<title>' + esc(m.titel || "Prozess") + '</title>\n' +
    '<style>\n' + css + '\n</style>\n</head>\n' +
    '<body class="' + optClasses + '">\n' +
    '<div class="niju-doc">\n' + seitenHtml + '\n</div>\n' +
    fitScript + '\n' +
    '<script type="application/json" id="niju-process">' + jsonText + '</scr' + 'ipt>\n' +
    '</body>\n</html>\n';
}

/* Klassischer HTML-Download (Blob, text/html). */
function downloadHtml(html, name) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* „HTML page": aktueller Prozess → eine HTML-Datei. */
function exportiereHtml() {
  if (!STATE.daten || !STATE.daten.meta) { alert(t("msg.noSaveData")); return; }
  let html;
  try { html = baueHtmlDokument(STATE.daten); }
  catch (e) { alert(t("html.failed", { err: (e && e.message) || String(e) })); return; }
  downloadHtml(html, htmlName(STATE.daten));
}

/* ============================================================
   „HTML batch": mehrere Prozessdateien wählen → Auswahlfenster →
   pro ausgewähltem Prozess EINE HTML-Datei. Quelle = vom Nutzer
   gewählte JSON-Dateien (Mehrfachauswahl), nichts wird wahllos
   exportiert. Ausgabe: Zielordner (File System Access) oder Downloads.
   ============================================================ */
const htmlBatchInput = document.getElementById("htmlBatchInput");
function htmlBatchStart() { htmlBatchInput.value = ""; htmlBatchInput.click(); }

htmlBatchInput.addEventListener("change", (ev) => {
  const files = Array.from(ev.target.files || []);
  if (!files.length) return;
  const kandidaten = [];
  let rest = files.length;
  const fertig = () => { if (--rest === 0) zeigeHtmlBatchDialog(kandidaten); };
  files.forEach(f => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d && d.meta && Array.isArray(d.schritte)) kandidaten.push({ file: f.name, daten: d });
      } catch (err) {}
      fertig();
    };
    r.onerror = fertig;
    r.readAsText(f, "utf-8");
  });
});

function batchTitel(k) { return (k.daten.meta && k.daten.meta.titel) || k.file; }

function zeigeHtmlBatchDialog(kandidaten) {
  const alt = document.getElementById("htmlBatchOverlay"); if (alt) alt.remove();
  if (!kandidaten.length) { alert(t("htmlBatch.none")); return; }
  kandidaten.sort((a, b) => batchTitel(a).localeCompare(batchTitel(b)));

  const overlay = el("div", "import-overlay"); overlay.id = "htmlBatchOverlay";
  const dialog = el("div", "import-dialog"); dialog.style.width = "min(540px, 94vw)";
  const kopf = el("div", "import-kopf");
  kopf.appendChild(el("h2", null, t("htmlBatch.title")));
  kopf.appendChild(el("p", null, t("htmlBatch.intro")));
  dialog.appendChild(kopf);

  const body = el("div", "import-body");
  const liste = el("div", "batch-liste");
  const checks = [];
  kandidaten.forEach(k => {
    const row = el("label", "batch-row");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true;
    cb.addEventListener("change", aktualisiere);
    const txt = el("div", "batch-txt");
    txt.appendChild(el("div", "batch-titel", batchTitel(k)));
    txt.appendChild(el("div", "batch-datei", k.file));
    row.appendChild(cb); row.appendChild(txt);
    liste.appendChild(row);
    checks.push({ cb: cb, k: k });
  });
  body.appendChild(liste);
  dialog.appendChild(body);

  const fuss = el("div", "import-fuss");
  const summe = el("div", "summe"); fuss.appendChild(summe);
  const alleBtn = el("button", "btn-sek", "");
  alleBtn.addEventListener("click", () => {
    const an = checks.some(c => !c.cb.checked);
    checks.forEach(c => c.cb.checked = an); aktualisiere();
  });
  const abbrechen = el("button", "btn-sek", t("htmlBatch.cancel"));
  abbrechen.addEventListener("click", () => overlay.remove());
  const exportBtn = el("button", "btn-akt", "");
  exportBtn.addEventListener("click", async () => {
    const auswahl = checks.filter(c => c.cb.checked).map(c => c.k);
    if (!auswahl.length) return;
    exportBtn.disabled = abbrechen.disabled = alleBtn.disabled = true;
    summe.textContent = t("htmlBatch.working");
    try {
      const res = await fuehreHtmlBatchAus(auswahl);
      overlay.remove();
      if (res && !res.aborted) {
        alert(res.folder ? t("htmlBatch.writtenFolder", { n: res.written })
                         : t("htmlBatch.done", { n: res.written }));
      }
    } catch (e) {
      exportBtn.disabled = abbrechen.disabled = alleBtn.disabled = false;
      summe.textContent = "";
      alert(t("html.failed", { err: (e && e.message) || String(e) }));
    }
  });

  function aktualisiere() {
    const n = checks.filter(c => c.cb.checked).length;
    summe.textContent = t("htmlBatch.count", { n: n });
    exportBtn.textContent = t("htmlBatch.export", { n: n });
    exportBtn.disabled = (n === 0);
    alleBtn.textContent = checks.some(c => !c.cb.checked) ? t("htmlBatch.selectAll") : t("htmlBatch.deselectAll");
  }

  fuss.appendChild(alleBtn); fuss.appendChild(abbrechen); fuss.appendChild(exportBtn);
  dialog.appendChild(fuss);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  aktualisiere();
}

function htmlDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fuehreHtmlBatchAus(auswahl) {
  /* Pro Prozess eine Datei bauen; bei Namensgleichheit eindeutig machen. */
  const gesehen = {};
  const dateien = auswahl.map(k => {
    let name = htmlName(k.daten);
    if (gesehen[name]) { const basis = name.replace(/\.html$/, ""); let i = 2; while (gesehen[basis + "-" + i + ".html"]) i++; name = basis + "-" + i + ".html"; }
    gesehen[name] = true;
    return { name: name, html: baueHtmlDokument(k.daten) };
  });
  return await batchSpeichern(dateien);
}

/* Ausgabe: bevorzugt Zielordner (File System Access), sonst Einzel-Downloads. */
async function batchSpeichern(dateien) {
  if (window.showDirectoryPicker) {
    let dir = null;
    try {
      const opts = { mode: "readwrite" };
      try { const last = await idbHandleLaden("htmlout"); if (last) opts.startIn = last; } catch (e) {}
      dir = await window.showDirectoryPicker(opts);
    } catch (e) { if (e && e.name === "AbortError") return { aborted: true }; }
    if (dir) {
      for (const d of dateien) {
        const fh = await dir.getFileHandle(d.name, { create: true });
        const w = await fh.createWritable(); await w.write(d.html); await w.close();
      }
      idbHandleSpeichern("htmlout", dir);
      return { written: dateien.length, folder: true };
    }
  }
  for (const d of dateien) { downloadHtml(d.html, d.name); await htmlDelay(180); }
  return { written: dateien.length, folder: false };
}
