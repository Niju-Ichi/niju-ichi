/* ============================================================
   NIJU ICHI — Grafische Prozesslandkarte (shared)
   Frei platzierbare, klickbare Kästen auf einer Fläche, optional über
   einer hochgeladenen Grafik. KEINE Zeichen-Leinwand/D3 — nur absolut
   positionierte DIVs (Drag/Resize per Pointer-Events). Offline.

   Modi: "overlay" (Grafik im Hintergrund, Kästen sichtbar) |
         "hotspot" (Grafik im Vordergrund, Kästen transparent + klickbar).

   NIJU.MAP.normalize(landkarte) -> vollständiges Objekt
   NIJU.MAP.newBox() -> Default-Kasten
   NIJU.MAP.render(host, landkarte, {
       editable, selectedBoxId,
       onSelectBox(id|null), onChangeBox(), onOpen(ziel) })
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.MAP) return;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function id() { return "b_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function normalize(lk) {
    lk = (lk && typeof lk === "object") ? lk : {};
    if (lk.modus !== "hotspot") lk.modus = "overlay";
    if (typeof lk.bild !== "string") lk.bild = "";
    if (typeof lk.bildRatio !== "number" || !(lk.bildRatio > 0)) lk.bildRatio = 9 / 16;
    if (!Array.isArray(lk.kaesten)) lk.kaesten = [];
    lk.kaesten.forEach(function (k) {
      if (!k.id) k.id = id();
      k.x = clamp(typeof k.x === "number" ? k.x : 10, 0, 100);
      k.y = clamp(typeof k.y === "number" ? k.y : 10, 0, 100);
      k.w = clamp(typeof k.w === "number" ? k.w : 22, 3, 100);
      k.h = clamp(typeof k.h === "number" ? k.h : 12, 3, 100);
      if (typeof k.label !== "string") k.label = "";
      if (typeof k.farbe !== "string") k.farbe = "#3479c9";
      if (k.form !== "circle" && k.form !== "chevron") k.form = "rect";
      if (!k.ziel || typeof k.ziel !== "object") k.ziel = { typ: "", ref: "" };
      if (typeof k.ziel.typ !== "string") k.ziel.typ = "";
      if (typeof k.ziel.ref !== "string") k.ziel.ref = "";
    });
    return lk;
  }

  function newBox(form) {
    return { id: id(), x: 38, y: 42, w: 24, h: 14, label: "", farbe: "#3479c9",
             form: (form === "circle" || form === "chevron") ? form : "rect", ziel: { typ: "", ref: "" } };
  }

  function render(host, lk, opts) {
    opts = opts || {};
    var editable = !!opts.editable;
    lk = normalize(lk);
    host.innerHTML = "";
    host.classList.add("niju-map-stage");

    var map = document.createElement("div");
    map.className = "niju-map " + lk.modus;
    map.style.aspectRatio = String(1 / lk.bildRatio);
    host.appendChild(map);

    if (lk.bild) {
      var img = document.createElement("img");
      img.className = "nm-img"; img.src = lk.bild; img.alt = "";
      img.style.zIndex = (lk.modus === "hotspot") ? "2" : "0";
      map.appendChild(img);
    }

    /* Klick auf leere Fläche = Auswahl aufheben (Editor) */
    if (editable) map.addEventListener("mousedown", function (e) { if (e.target === map) (opts.onSelectBox || function () {})(null); });

    lk.kaesten.forEach(function (k) {
      var box = document.createElement("div");
      box.className = "nm-box " + lk.modus + " form-" + k.form + (editable && k.id === opts.selectedBoxId ? " sel" : "");
      box.style.left = k.x + "%"; box.style.top = k.y + "%";
      box.style.width = k.w + "%"; box.style.height = k.h + "%";
      box.style.zIndex = (lk.modus === "hotspot") ? "1" : "3";

      /* Form-/Aussehens-Ebene (Fuellung overlay bzw. Rahmen hotspot) */
      var shape = document.createElement("div"); shape.className = "nm-shape";
      if (lk.modus === "overlay") { shape.style.background = k.farbe; }
      else if (editable) { shape.style.borderColor = k.farbe; }
      box.appendChild(shape);

      var zeigeLabel = (lk.modus === "overlay") || editable;
      if (zeigeLabel) { var lab = document.createElement("span"); lab.className = "nm-label"; lab.textContent = k.label || ""; box.appendChild(lab); }

      if (editable) {
        var handle = document.createElement("div"); handle.className = "nm-handle"; box.appendChild(handle);
        macheVerschiebbar(box, handle, map, k, opts);
      } else {
        box.addEventListener("click", function () { (opts.onOpen || function () {})(k.ziel); });
      }
      map.appendChild(box);
    });
  }

  /* Drag (Box) + Resize (Griff) per Pointer-Events; Klick-vs-Drag-Schwelle */
  function macheVerschiebbar(box, handle, map, k, opts) {
    var SCHWELLE = 3; /* px */
    function start(e, modus) {
      e.preventDefault(); e.stopPropagation();
      var rect = map.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY, sX = k.x, sY = k.y, sW = k.w, sH = k.h, bewegt = false;
      function move(ev) {
        var dxP = (ev.clientX - sx) / rect.width * 100, dyP = (ev.clientY - sy) / rect.height * 100;
        if (!bewegt && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > SCHWELLE) bewegt = true;
        if (modus === "drag") {
          k.x = clamp(sX + dxP, 0, 100 - k.w); k.y = clamp(sY + dyP, 0, 100 - k.h);
          box.style.left = k.x + "%"; box.style.top = k.y + "%";
        } else {
          k.w = clamp(sW + dxP, 4, 100 - k.x); k.h = clamp(sH + dyP, 4, 100 - k.y);
          box.style.width = k.w + "%"; box.style.height = k.h + "%";
        }
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (!bewegt && modus === "drag") (opts.onSelectBox || function () {})(k.id);
        else (opts.onChangeBox || function () {})();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    }
    box.addEventListener("pointerdown", function (e) { start(e, "drag"); });
    handle.addEventListener("pointerdown", function (e) { start(e, "resize"); });
  }

  window.NIJU.MAP = { normalize: normalize, newBox: newBox, render: render };
})();
