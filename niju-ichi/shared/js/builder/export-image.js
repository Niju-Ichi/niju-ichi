/* ============================================================
   NIJU ICHI — Process Builder: JPEG export
   Renders the current sheet offline via SVG <foreignObject> → Canvas → JPEG.
   DPI is written into the JFIF APP0 header. Save via File System Access API
   or classic download fallback.
   Provides (global): jpegName, sammleSeitenCss, blattAlsJpeg, setJpegDpi,
     speichereBlobMitDialog, zeigeJpegDialog
   Uses: core (STATE, el, t), io (idbHandleLaden, idbHandleSpeichern)
   Classic <script> — shares global scope (NO ES module, NO IIFE in phase 1).
   ============================================================ */
/* ============================================================
   JPEG-Export (offline, ohne Bibliothek)
   Das Blatt wird über ein SVG-<foreignObject> in ein Bild gerendert
   (kein fetch/D3/html2canvas) und auf einer Canvas in der gewünschten
   Pixelgröße als JPEG ausgegeben. Die DPI-Zahl wird in den JFIF-Header
   geschrieben (Druckauflösung). Speicherort: File-System-Access-Dialog,
   sonst klassischer Download.
   ============================================================ */
function jpegName() {
  const m = (STATE.daten && STATE.daten.meta) || {};
  let basis = m.prozessId || m.titel || "prozess";
  basis = basis.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-+|-+$/g, "");
  return (basis || "prozess") + (STATE.ansicht === "detail" ? "-detail" : "") + ".jpg";
}

/* Alle Seiten-CSS einsammeln: die eingebetteten <style>-Blöcke (enthalten das
   komplette Blatt-Layout inkl. ::before-Aufzählungspunkte) + die aktiven
   Design-Variablen von :root. base.css (nur Toolbar/Chrome) wird nicht benötigt. */
function sammleSeitenCss() {
  let css = "";
  document.querySelectorAll("style").forEach(s => { css += s.textContent + "\n"; });
  const rs = getComputedStyle(document.documentElement);
  const vars = ["--ink","--paper","--muted","--akzent","--rule","--rule-mid","--rule-strong",
    "--sidebar","--body","--zebra","--verbinder","--num-soft","--sans","--mono",
    "--raci-R","--raci-R-text","--raci-A","--raci-A-text","--raci-C","--raci-C-text","--raci-I","--raci-I-text"];
  let root = ":root{";
  vars.forEach(v => { const val = rs.getPropertyValue(v); if (val) root += v + ":" + val + ";"; });
  root += "}";
  return root + "\n" + css;
}

/* Rendert das aktuelle Blatt als JPEG-Blob in (outW × outH) Pixeln. */
function blattAlsJpeg(outW, outH, dpi, quality) {
  return new Promise((resolve, reject) => {
    const blatt = document.getElementById("blatt");
    if (!blatt) { reject(new Error("no sheet")); return; }
    const natW = blatt.offsetWidth, natH = blatt.offsetHeight;

    /* Klon ohne Bildschirm-Transform/Schatten, an 0/0 in natürlicher Größe */
    const klon = blatt.cloneNode(true);
    klon.style.transform = "none";
    klon.style.boxShadow = "none";
    klon.style.margin = "0";
    klon.style.position = "static";
    klon.style.width = natW + "px";

    const wrap = document.createElement("div");
    wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrap.style.width = natW + "px"; wrap.style.height = natH + "px"; wrap.style.background = "#ffffff";
    const styleEl = document.createElement("style");
    styleEl.textContent = sammleSeitenCss();
    wrap.appendChild(styleEl);
    wrap.appendChild(klon);

    const xhtml = new XMLSerializer().serializeToString(wrap);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + natW + '" height="' + natH + '">' +
                '<foreignObject x="0" y="0" width="' + natW + '" height="' + natH + '">' + xhtml +
                '</foreignObject></svg>';
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

    const img = new Image();
    img.onload = function () {
      try {
        const cv = document.createElement("canvas");
        cv.width = outW; cv.height = outH;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
        cv.toBlob(function (blob) {
          if (!blob) { reject(new Error("toBlob failed")); return; }
          blob.arrayBuffer().then(buf => {
            const bytes = setJpegDpi(new Uint8Array(buf), dpi);
            resolve(new Blob([bytes], { type: "image/jpeg" }));
          }).catch(reject);
        }, "image/jpeg", quality);
      } catch (e) { reject(e); }
    };
    img.onerror = function () { reject(new Error("SVG image load failed")); };
    img.src = url;
  });
}

/* DPI in den JFIF-APP0-Header schreiben (units=1 = dots per inch). */
function setJpegDpi(bytes, dpi) {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return bytes; /* kein JPEG */
  for (let i = 2; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xE0) { /* APP0 */
      const seg = i + 4; /* nach Marker(2)+Länge(2): "JFIF\0"(5) version(2) units(1) X(2) Y(2) */
      if (bytes[seg] === 0x4A && bytes[seg + 1] === 0x46 && bytes[seg + 2] === 0x49 && bytes[seg + 3] === 0x46) {
        const u = seg + 7;
        bytes[u] = 1;                          /* units = DPI */
        bytes[u + 1] = (dpi >> 8) & 0xFF; bytes[u + 2] = dpi & 0xFF;   /* Xdensity */
        bytes[u + 3] = (dpi >> 8) & 0xFF; bytes[u + 4] = dpi & 0xFF;   /* Ydensity */
      }
      break;
    }
  }
  return bytes;
}

/* Blob über den Datei-Dialog speichern (FSA), sonst Download. */
async function speichereBlobMitDialog(blob, suggestedName, key) {
  if (window.showSaveFilePicker) {
    const opts = { suggestedName: suggestedName, types: [{ description: "JPEG", accept: { "image/jpeg": [".jpg", ".jpeg"] } }] };
    try { const last = await idbHandleLaden(key); if (last) opts.startIn = last; } catch (e) {}
    try {
      const handle = await window.showSaveFilePicker(opts);
      const w = await handle.createWritable(); await w.write(blob); await w.close();
      idbHandleSpeichern(key, handle);
      return true;
    } catch (e) { if (e && e.name === "AbortError") return true; /* sonst Download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = suggestedName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* Dialog: Breite/Höhe (px) + DPI, dann exportieren + Speicherort wählen. */
function zeigeJpegDialog() {
  if (!STATE.daten) { alert(t("msg.noSaveData")); return; }
  const blatt = document.getElementById("blatt");
  if (!blatt) { alert(t("msg.invalidData")); return; }
  const natW = Math.round(blatt.offsetWidth), natH = Math.round(blatt.offsetHeight);
  const ratio = natW / natH;
  const alt = document.getElementById("jpegOverlay"); if (alt) alt.remove();

  const overlay = el("div", "import-overlay"); overlay.id = "jpegOverlay";
  const dialog = el("div", "import-dialog"); dialog.style.width = "min(440px, 94vw)";
  const kopf = el("div", "import-kopf");
  kopf.appendChild(el("h2", null, t("jpeg.title")));
  kopf.appendChild(el("p", null, t("jpeg.intro")));
  dialog.appendChild(kopf);

  const body = el("div", "import-body");
  function num(labelKey, val) {
    const f = el("div", "ed-field"); f.style.marginBottom = "12px";
    f.appendChild(el("label", null, t(labelKey)));
    const inp = document.createElement("input"); inp.type = "number"; inp.min = "1"; inp.value = String(val);
    f.appendChild(inp); body.appendChild(f); return inp;
  }
  const inW = num("jpeg.width", natW);
  const inH = num("jpeg.height", natH);
  const inDpi = num("jpeg.dpi", 150);
  inDpi.min = "1";
  const inQ = num("jpeg.quality", 92); inQ.min = "10"; inQ.max = "100";

  /* Seitenverhältnis koppeln */
  const ratioWrap = el("label", "ed-check");
  const chk = document.createElement("input"); chk.type = "checkbox"; chk.checked = true;
  ratioWrap.appendChild(chk); ratioWrap.appendChild(document.createTextNode(" " + t("jpeg.keepRatio")));
  body.appendChild(ratioWrap);
  inW.addEventListener("input", () => { if (chk.checked) { const w = parseFloat(inW.value); if (w > 0) inH.value = String(Math.round(w / ratio)); } });
  inH.addEventListener("input", () => { if (chk.checked) { const h = parseFloat(inH.value); if (h > 0) inW.value = String(Math.round(h * ratio)); } });
  dialog.appendChild(body);

  const fuss = el("div", "import-fuss");
  const hinweis = el("div", "summe"); fuss.appendChild(hinweis);
  const abbrechen = el("button", "btn-sek", t("jpeg.cancel"));
  abbrechen.addEventListener("click", () => overlay.remove());
  const exportieren = el("button", "btn-akt", t("jpeg.export"));
  exportieren.addEventListener("click", async () => {
    const w = parseInt(inW.value, 10), h = parseInt(inH.value, 10), dpi = parseInt(inDpi.value, 10);
    let q = parseInt(inQ.value, 10); if (!(q > 0)) q = 92; q = Math.max(10, Math.min(100, q));
    if (!(w > 0) || !(h > 0) || !(dpi > 0)) { alert(t("jpeg.badSize")); return; }
    exportieren.disabled = true; abbrechen.disabled = true; hinweis.textContent = t("jpeg.rendering");
    try {
      const blob = await blattAlsJpeg(w, h, dpi, q / 100);
      overlay.remove();
      await speichereBlobMitDialog(blob, jpegName(), "jpeg");
    } catch (e) {
      exportieren.disabled = false; abbrechen.disabled = false; hinweis.textContent = "";
      alert(t("jpeg.failed", { err: (e && e.message) || String(e) }));
    }
  });
  fuss.appendChild(abbrechen); fuss.appendChild(exportieren);
  dialog.appendChild(fuss);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}
