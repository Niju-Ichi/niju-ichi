/* ============================================================
   NIJU ICHI — Process Builder: Bilingual HTML export (Phase 11)
   Produces a self-contained HTML page that renders the process EXACTLY like the
   Builder preview / Process Viewer (overview + all detail pages), in BOTH
   languages, with a language switch.

   Fidelity: instead of a custom layout, this reuses the REAL render pipeline —
   render() + zeichneVerbinder() + blattSeiteSerialisieren() — the same code the
   monolingual HTML export uses (export-html.js). We render every page twice:
   once forced to DE, once forced to EN (via STATE.renderLang, honoured in
   render.js), serialize both, and stack them as two <div class="niju-doc"> sets.
   A tiny script fits each sheet to the column width and (re)draws the RACI
   connectors for the VISIBLE language; it also re-fits when the language toggle
   changes. The original process JSON is embedded as a data island (re-import).

   Provides (global): bilingualHtml, exportBilingual
   Uses: STATE, render, zeichneVerbinder, blattSeiteSerialisieren (render/connectors),
     sammleSeitenCss (export-image), baueJsonText, setAnsicht (io), NIJU.PROZESS
   Classic <script> — shares global scope.
   ============================================================ */

/* Render every page (overview + details) of `daten` in a forced language and
   return the serialized sheet HTML strings. STATE.renderLang forces the language
   inside render() without touching the UI language. */
function bilingualSeitenFuer(daten, lang) {
  STATE.renderLang = lang;
  const seiten = [];
  STATE.ansicht = "uebersicht";
  render(daten); zeichneVerbinder();
  seiten.push(blattSeiteSerialisieren());
  const n = (daten.schritte || []).length;
  for (let i = 0; i < n; i++) {
    STATE.ansicht = "detail"; STATE.detailIndex = i;
    render(daten); zeichneVerbinder();
    seiten.push(blattSeiteSerialisieren());
  }
  STATE.renderLang = null;
  return seiten;
}

/* Build the full bilingual HTML document for a process object. */
function bilingualHtml(zielDaten) {
  const daten = zielDaten || STATE.daten;
  if (!daten || !daten.meta) return "";
  const sichern = { daten: STATE.daten, ansicht: STATE.ansicht, idx: STATE.detailIndex, bearb: STATE.bearbeiten };
  STATE.daten = daten;
  STATE.bearbeiten = false;   /* read-only look (no edit affordances) */

  /* Render both languages with the real engine. */
  const seitenDe = bilingualSeitenFuer(daten, "de");
  const seitenEn = bilingualSeitenFuer(daten, "en");

  /* Capture design (:root vars), option classes, sheet CSS and JSON while the
     target process is still active — BEFORE restoring the editor state. */
  const sheetCss = sammleSeitenCss();
  const optClasses = Array.from(document.body.classList).filter(c => /^opt-/.test(c)).join(" ");
  const rs = getComputedStyle(document.documentElement);
  const designVars = ["--ink", "--paper", "--muted", "--akzent", "--rule", "--rule-mid", "--rule-strong",
    "--sidebar", "--body", "--zebra", "--verbinder", "--num-soft", "--sans", "--mono",
    "--raci-R", "--raci-R-text", "--raci-A", "--raci-A-text", "--raci-C", "--raci-C-text", "--raci-I", "--raci-I-text"];
  let rootStyle = "";
  designVars.forEach(v => { const val = rs.getPropertyValue(v); if (val) rootStyle += v + ":" + val.trim() + ";"; });
  const jsonText = baueJsonText().replace(/<\//g, "<\\/");

  /* Restore the editor state (data + view) exactly like export-html.js. */
  STATE.daten = sichern.daten; STATE.bearbeiten = sichern.bearb;
  setAnsicht(sichern.ansicht === "detail" ? "detail" : "uebersicht", sichern.idx);

  /* Design-option rules (normally in base.css = app chrome, not loaded here). */
  const optRules =
    "body.opt-no-connectors #verbinder{display:none!important}" +
    "body.opt-badge-round .badge,body.opt-badge-round .bb-badge{border-radius:50%}" +
    "body.opt-no-zebra .rrow-1 .raci-zelle,body.opt-no-zebra .raci-zelle.rrow-1," +
    "body.opt-no-zebra .rrow-1.raci-rolle,body.opt-no-zebra .rm-rolle.stripe," +
    "body.opt-no-zebra .rm-zelle.stripe{background:transparent!important}";

  /* Document layout (same as export-html.js). */
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

  /* Language toggle bar + show/hide rules (CSS drives the switch; the script only
     re-fits/redraws on change). */
  const langCss =
    ".niju-lr{position:absolute;opacity:0;width:0;height:0;pointer-events:none}" +
    ".niju-langbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:0;" +
      "background:#111827;color:#e5e7eb;padding:9px 16px;" +
      "font-family:var(--sans,\"Helvetica Neue\",Arial,sans-serif)}" +
    ".niju-langbar .lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65;margin-right:12px}" +
    ".niju-langbar label{cursor:pointer;font-size:13px;font-weight:600;padding:5px 15px;" +
      "border:1px solid #374151;color:#cbd5e1;background:transparent;user-select:none}" +
    ".niju-langbar label[for=ln-de]{border-radius:6px 0 0 6px;border-right:0}" +
    ".niju-langbar label[for=ln-en]{border-radius:0 6px 6px 0}" +
    "#ln-de:checked ~ .niju-langbar label[for=ln-de]," +
    "#ln-en:checked ~ .niju-langbar label[for=ln-en]{background:#2563eb;color:#fff;border-color:#2563eb}" +
    ".niju-doc.lang-en{display:none}" +
    "#ln-en:checked ~ .niju-docwrap .lang-de{display:none}" +
    "#ln-en:checked ~ .niju-docwrap .lang-en{display:block}" +
    "@media print{.niju-langbar{display:none}}";

  const css = sheetCss + "\n" + optRules + "\n" + docCss + "\n" + langCss;

  const wrapSeiten = seiten => seiten.map(h =>
    '<div class="niju-doc-page"><div class="niju-doc-scale">' + h + '</div></div>'
  ).join("\n");

  const docs =
    '<div class="niju-docwrap">' +
    '<div class="niju-doc lang-de">' + wrapSeiten(seitenDe) + '</div>' +
    '<div class="niju-doc lang-en">' + wrapSeiten(seitenEn) + '</div>' +
    '</div>';

  /* Inline script: draw() = redraw RACI connectors against real badge positions;
     fit() = scale each sheet of the VISIBLE language to the column width. Re-runs
     on load, resize, and when the language toggle changes. Identical connector
     logic to export-html.js. */
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
    'function visibleDoc(){var ds=document.querySelectorAll(".niju-doc"),k;for(k=0;k<ds.length;k++)if(ds[k].offsetParent!==null)return ds[k];return null;}' +
    'function fit(){var doc=visibleDoc();if(!doc)return;' +
      'var avail=doc.clientWidth-28;if(avail<1)return;' +
      'var ps=doc.querySelectorAll(".niju-doc-page"),i;' +
      'for(i=0;i<ps.length;i++){var p=ps[i],sc=p.firstElementChild;if(!sc)continue;' +
        'sc.style.transform="none";' +
        'var bl=sc.querySelector(".blatt");if(bl)draw(bl);' +
        'var w=sc.offsetWidth,h=sc.offsetHeight;var s=avail/w;if(s>1)s=1;' +
        'sc.style.transform="scale("+s+")";' +
        'p.style.width=Math.round(w*s)+"px";p.style.height=Math.round(h*s)+"px";p.style.overflow="hidden";}}' +
    'if(document.readyState!=="loading")fit();else document.addEventListener("DOMContentLoaded",fit);' +
    'window.addEventListener("load",fit);window.addEventListener("resize",fit);' +
    'var rs=document.getElementsByName("lang");for(var j=0;j<rs.length;j++)rs[j].addEventListener("change",fit);' +
    '})();</scr' + 'ipt>';

  const m = daten.meta || {};
  const P = NIJU.PROZESS;
  const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const titelDe = P.text(m.titel, "de") || "Prozess";
  const titelEn = P.text(m.titel, "en") || titelDe;

  return '<!DOCTYPE html>\n<html lang="de" style="' + esc(rootStyle) + '">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="generator" content="NIJU ICHI Process Builder — bilingual">\n' +
    '<title>' + esc(titelDe) + ' / ' + esc(titelEn) + '</title>\n' +
    '<style>\n' + css + '\n</style>\n</head>\n' +
    '<body class="' + optClasses + '">\n' +
    '<input type="radio" name="lang" id="ln-de" class="niju-lr" checked>\n' +
    '<input type="radio" name="lang" id="ln-en" class="niju-lr">\n' +
    '<div class="niju-langbar"><span class="lbl">Language</span>' +
    '<label for="ln-de">Deutsch</label><label for="ln-en">English</label></div>\n' +
    docs + '\n' +
    fitScript + '\n' +
    '<script type="application/json" id="niju-process">' + jsonText + '</scr' + 'ipt>\n' +
    '</body>\n</html>\n';
}

/* Export the bilingual HTML page for the current process. */
function exportBilingual() {
  if (!STATE.daten || !STATE.daten.meta) { alert(t("msg.noSaveData")); return; }
  let html;
  try { html = bilingualHtml(STATE.daten); }
  catch (e) { alert(t("html.failed", { err: (e && e.message) || String(e) })); return; }
  const P = NIJU.PROZESS;
  const base = (typeof mdSlug === "function")
    ? mdSlug(P.srcText(STATE.daten.meta.prozessId || STATE.daten.meta.titel) || "prozess")
    : "prozess";
  downloadHtml(html, (base || "prozess") + "-bilingual.html");
}
