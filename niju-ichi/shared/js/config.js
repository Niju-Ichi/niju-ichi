/* ============================================================
   NIJU ICHI — Configuration-Ansicht (shared)
   Klassisches Konfig-Layout: links Kategorien, rechts Inhalt.
   Kategorien: About · Design · Languages · Process Manager · Backup & Restore

   NIJU.CONFIG.open(hostEl, {
     design: bool,          // show Design pane
     processManager: bool,  // show Process Manager pane (wissen.js required)
     backup: {              // show Backup & Restore pane (backup.js required)
       getData()   → { prozesse, index, name }
       onRestore(result)
     },
     onClose()
   })
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.CONFIG) return;
  var I18N = window.NIJU.I18N;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function t(k, v) { return I18N.t(k, v); }

  function templateText() {
    var en = I18N._dicts.en || {};
    var obj = { "__name": "", "__code": "" };
    Object.keys(en).sort().forEach(function (k) { obj[k] = en[k]; });
    return JSON.stringify(obj, null, 2);
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function open(host, opts) {
    opts = opts || {};
    if (typeof host === "string") host = document.getElementById(host);
    if (!host) return;

    /* Header reads "About" when opened as the About window, else "Configuration". */
    function paneTitle() { return opts.aboutOnly ? t("menu.about") : t("config.title"); }

    var wrap = el("div", "cfg-wrap");
    var kopf = el("div", "cfg-kopf");
    kopf.appendChild(el("h2", "cfg-titel", paneTitle()));
    var schliessen = el("button", "cfg-close", t("config.close"));
    schliessen.addEventListener("click", function () { if (opts.onClose) opts.onClose(); });
    kopf.appendChild(schliessen);
    wrap.appendChild(kopf);

    var body = el("div", "cfg-body");
    var nav  = el("div", "cfg-nav");
    var pane = el("div", "cfg-pane");
    body.appendChild(nav); body.appendChild(pane);
    wrap.appendChild(body);

    var KATS = [];
    if (opts.aboutOnly) KATS.push({ id: "about", label: "config.about", build: buildAbout });
    if (!opts.aboutOnly) {
      if (opts.design && window.NIJU.DESIGN) KATS.push({ id: "design", label: "config.design", build: buildDesign });
      KATS.push({ id: "languages", label: "config.languages", build: buildLanguages });
      if (opts.backup && window.NIJU.BACKUP) KATS.push({ id: "backup", label: "config.backup", build: buildBackup });
      if (opts.processManager && window.NIJU.WISSEN) KATS.push({ id: "processManager", label: "config.processManager", build: buildProcessManager, sep: true });
    }

    var aktiv = opts.aboutOnly ? "about" : ((opts.design && window.NIJU.DESIGN) ? "design" : "languages");

    function zeichneNav() {
      nav.innerHTML = "";
      KATS.forEach(function (k) {
        if (k.sep) nav.appendChild(el("hr", "cfg-nav-sep"));
        var b = el("button", "cfg-cat" + (k.id === aktiv ? " aktiv" : ""), t(k.label));
        b.addEventListener("click", function () { aktiv = k.id; zeichne(); });
        nav.appendChild(b);
      });
    }
    function zeichne() {
      zeichneNav();
      pane.innerHTML = "";
      var k = KATS.filter(function (x) { return x.id === aktiv; })[0];
      if (k) k.build(pane);
    }

    /* ---- About (manifesto) ---- */
    function buildAbout(p) {
      var box = el("div", "about");
      box.appendChild(el("p", "about-lead", t("about.tagline")));

      function sec(hKey, pKey) {
        box.appendChild(el("h3", "about-h", t(hKey)));
        if (pKey) box.appendChild(el("p", "about-p", t(pKey)));
      }

      sec("about.visionH", "about.visionP");

      box.appendChild(el("h3", "about-h", t("about.valuesH")));
      box.appendChild(el("p", "about-p", t("about.valuesP")));
      var ul = el("ul", "about-values");
      ["about.value1", "about.value2", "about.value3", "about.value4", "about.value5"].forEach(function (k) {
        var li = el("li", "about-value");
        var full = t(k), i = full.indexOf(" — ");
        if (i > -1) {
          li.appendChild(el("strong", "about-value-lead", full.slice(0, i)));
          li.appendChild(document.createTextNode(" — " + full.slice(i + 3)));
        } else { li.textContent = full; }
        ul.appendChild(li);
      });
      box.appendChild(ul);

      sec("about.strategyH", "about.strategyP");
      sec("about.implH", "about.implP");
      sec("about.operationH", "about.operationP");
      sec("about.feedbackH", "about.feedbackP");

      box.appendChild(el("h3", "about-h", t("about.contactH")));
      var mail = el("a", "about-mail", t("about.contactEmail"));
      mail.href = "mailto:" + t("about.contactEmail");
      box.appendChild(mail);

      box.appendChild(el("p", "about-closing", t("about.closing")));
      p.appendChild(box);
    }

    /* ---- Design (Phase 7) ---- */
    function getPath(obj, path) {
      var ks = path.split("."), cur = obj;
      for (var i = 0; i < ks.length; i++) { if (cur == null) return undefined; cur = cur[ks[i]]; }
      return cur;
    }
    function designDownload(name, obj) { download(name, JSON.stringify(obj, null, 2)); }

    function colorRow(p, labelText, tokenPath) {
      var D = window.NIJU.DESIGN, eff = D.effektiv();
      var wert = getPath(eff, tokenPath) || "#000000";
      var row = el("div", "cfg-color");
      row.appendChild(el("label", null, labelText));
      var pick = document.createElement("input"); pick.type = "color";
      pick.value = /^#[0-9a-f]{6}$/i.test(wert) ? wert : "#000000";
      var hex = document.createElement("input"); hex.type = "text"; hex.className = "cfg-hex"; hex.value = wert;
      function setze(v) { D.setOverride(tokenPath, v); }
      pick.addEventListener("input", function () { hex.value = pick.value; setze(pick.value); });
      hex.addEventListener("change", function () {
        var v = hex.value.trim();
        if (/^#[0-9a-f]{6}$/i.test(v)) { pick.value = v; setze(v); }
      });
      row.appendChild(pick); row.appendChild(hex);
      p.appendChild(row);
    }

    function labelRow(p, labelText, tokenPath, letter) {
      var D = window.NIJU.DESIGN, eff = D.effektiv();
      var wert = getPath(eff, tokenPath);
      if (wert == null) wert = letter;
      var f = el("div", "cfg-color");
      f.appendChild(el("label", null, labelText));
      var inp = document.createElement("input");
      inp.type = "text"; inp.className = "cfg-hex"; inp.value = wert; inp.maxLength = 6;
      inp.style.textAlign = "center";
      inp.addEventListener("input", function () {
        var v = inp.value.trim() || letter;
        D.setOverride(tokenPath, v);
        var b = p.querySelector(".cfg-prev-badges .badge-" + letter);
        if (b) b.textContent = v;
      });
      f.appendChild(inp);
      p.appendChild(f);
    }

    function buildDesign(p) {
      var D = window.NIJU.DESIGN;
      p.appendChild(el("h3", "cfg-h", t("design.activeDesign")));
      var aktivId = D.activeId();
      D.list().forEach(function (item) {
        var row = el("label", "cfg-design-row");
        var rb = document.createElement("input");
        rb.type = "radio"; rb.name = "cfg-design"; rb.value = item.id; rb.checked = (item.id === aktivId);
        rb.addEventListener("change", function () { D.setActive(item.id); zeichne(); });
        row.appendChild(rb);
        row.appendChild(el("span", "cfg-design-name", item.name));
        row.appendChild(el("span", "cfg-lang-tag", item.builtin ? t("config.builtin") : t("config.imported")));
        if (!item.builtin) {
          var del = el("button", "cfg-mini del", t("config.importedRemove"));
          del.addEventListener("click", function (e) { e.preventDefault(); D.removeImport(item.id); zeichne(); });
          row.appendChild(del);
        }
        p.appendChild(row);
      });
      var ioRow = el("div", "cfg-btnrow");
      var dl = el("button", "cfg-btn", t("design.downloadTemplate"));
      dl.addEventListener("click", function () { designDownload("niju-design-template.json", D._default); });
      ioRow.appendChild(dl);
      var imp = el("button", "cfg-btn", t("design.import"));
      var file = document.createElement("input");
      file.type = "file"; file.accept = ".json,application/json"; file.style.display = "none";
      imp.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function (ev) {
        var f = ev.target.files[0]; if (!f) return;
        var r = new FileReader();
        r.onload = function (e) {
          try {
            var obj = JSON.parse(e.target.result);
            if (!obj || !obj.tokens || !obj.id) throw 0;
            D.addImport(obj); D.setActive(obj.id); zeichne();
            alert(t("design.importDone", { name: obj.name || obj.id }));
          } catch (err) { alert(t("design.importInvalid")); }
        };
        r.readAsText(f, "utf-8");
        ev.target.value = "";
      });
      ioRow.appendChild(imp); ioRow.appendChild(file);
      p.appendChild(ioRow);
      p.appendChild(el("hr", "cfg-trenner"));
      p.appendChild(el("h3", "cfg-h", t("design.raciLetters")));
      p.appendChild(el("p", "cfg-text", t("design.raciLettersHint")));
      ["R", "A", "C", "I"].forEach(function (L) { labelRow(p, t("design.badgeLetter", { b: L }), "tokens.raci." + L + ".label", L); });
      p.appendChild(el("hr", "cfg-trenner"));
      p.appendChild(el("h3", "cfg-h", t("design.raciColors")));
      ["R", "A", "C", "I"].forEach(function (L) {
        colorRow(p, t("design.badgeBg", { b: L }), "tokens.raci." + L + ".bg");
        colorRow(p, t("design.badgeText", { b: L }), "tokens.raci." + L + ".text");
      });
      p.appendChild(el("hr", "cfg-trenner"));
      p.appendChild(el("h3", "cfg-h", t("design.colors")));
      colorRow(p, t("design.akzent"), "tokens.color.akzent");
      colorRow(p, t("design.verbinder"), "tokens.color.verbinder");
      colorRow(p, t("design.ink"), "tokens.color.ink");
      colorRow(p, t("design.sidebar"), "tokens.color.sidebar");
      colorRow(p, t("design.paper"), "tokens.color.paper");
      p.appendChild(el("hr", "cfg-trenner"));
      p.appendChild(el("h3", "cfg-h", t("design.options")));
      var eff = D.effektiv();
      function toggle(labelText, path) {
        var row = el("label", "cfg-toggle");
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!getPath(eff, path);
        cb.addEventListener("change", function () { D.setOverride(path, cb.checked); });
        row.appendChild(cb); row.appendChild(document.createTextNode(labelText));
        p.appendChild(row);
      }
      toggle(t("design.connectors"), "options.connectors");
      toggle(t("design.zebra"), "options.zebra");
      var shapeWrap = el("div", "cfg-toggle");
      shapeWrap.appendChild(document.createTextNode(t("design.badgeShape") + " "));
      var seg = el("div", "cfg-seg");
      [["square", "design.shapeSquare"], ["round", "design.shapeRound"]].forEach(function (s) {
        var b = el("button", "btn seg" + ((eff.options.badgeShape || "square") === s[0] ? " aktiv" : ""), t(s[1]));
        b.addEventListener("click", function (e) { e.preventDefault(); D.setOverride("options.badgeShape", s[0]); zeichne(); });
        seg.appendChild(b);
      });
      shapeWrap.appendChild(seg);
      p.appendChild(shapeWrap);
      p.appendChild(el("hr", "cfg-trenner"));
      var saveRow = el("div", "cfg-btnrow");
      var save = el("button", "cfg-btn primary", t("design.saveAsFile"));
      save.addEventListener("click", function () {
        var name = prompt(t("design.namePrompt"), eff.name || "My design");
        if (name == null) return;
        name = name.trim() || "My design";
        var id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-design";
        designDownload(id + ".json", D.exportEffektiv(name, id));
      });
      saveRow.appendChild(save);
      var reset = el("button", "cfg-btn", t("design.reset"));
      reset.addEventListener("click", function () { D.clearOverrides(); zeichne(); });
      saveRow.appendChild(reset);
      p.appendChild(saveRow);
      p.appendChild(el("h3", "cfg-h", t("design.preview")));
      var prev = el("div", "cfg-prev");
      var badges = el("div", "cfg-prev-badges");
      ["C", "R", "A", "I"].forEach(function (L, i) {
        badges.appendChild(el("span", "badge badge-" + L, D.labelFor ? D.labelFor(L) : L));
        if (i < 3) badges.appendChild(el("div", "cfg-prev-conn"));
      });
      prev.appendChild(badges);
      var zebra = el("div", "cfg-prev-zebra");
      zebra.appendChild(Object.assign(el("div"), { textContent: "Role A" }));
      zebra.appendChild(Object.assign(el("div", "z"), { textContent: "Role B" }));
      prev.appendChild(zebra);
      p.appendChild(prev);
    }

    /* ---- Languages ---- */
    function buildLanguages(p) {
      p.appendChild(el("h3", "cfg-h", t("config.activeLanguages")));
      var liste = el("div", "cfg-langs");
      I18N.langs().forEach(function (L) {
        var row = el("label", "cfg-lang");
        var rb = document.createElement("input");
        rb.type = "radio"; rb.name = "cfg-lang"; rb.value = L.code;
        rb.checked = (L.code === I18N.get());
        rb.addEventListener("change", function () { I18N.setLang(L.code); zeichne(); });
        row.appendChild(rb);
        row.appendChild(el("span", "cfg-lang-name", L.name));
        row.appendChild(el("span", "cfg-lang-tag", L.builtin ? t("config.builtin") : t("config.imported")));
        if (!L.builtin) {
          var del = el("button", "cfg-mini del", t("config.importedRemove"));
          del.addEventListener("click", function (e) {
            e.preventDefault(); I18N.removeImport(L.code); zeichne();
          });
          row.appendChild(del);
        }
        liste.appendChild(row);
      });
      p.appendChild(liste);
      p.appendChild(el("hr", "cfg-trenner"));
      p.appendChild(el("h3", "cfg-h", t("config.importLanguage")));
      p.appendChild(el("p", "cfg-text", t("config.importHint")));
      var btnRow = el("div", "cfg-btnrow");
      var dl = el("button", "cfg-btn", t("config.downloadTemplate"));
      dl.addEventListener("click", function () { download("niju-language-template.json", templateText()); });
      btnRow.appendChild(dl);
      var imp = el("button", "cfg-btn primary", t("config.importLanguage"));
      var file = document.createElement("input");
      file.type = "file"; file.accept = ".json,application/json"; file.style.display = "none";
      imp.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function (ev) {
        var f = ev.target.files[0]; if (!f) return;
        var r = new FileReader();
        r.onload = function (e) {
          try {
            var obj = JSON.parse(e.target.result);
            if (typeof obj !== "object" || obj == null) throw 0;
            var code = (obj.__code || "").trim().toLowerCase();
            var name = (obj.__name || "").trim();
            if (!code) { alert(t("config.importNeedCode")); return; }
            if (!name) { alert(t("config.importNeedName")); return; }
            var dict = {};
            Object.keys(obj).forEach(function (kk) { if (kk !== "__code" && kk !== "__name") dict[kk] = obj[kk]; });
            I18N.addImport(code, name, dict);
            I18N.setLang(code);
            zeichne();
            alert(t("config.importDone", { name: name }));
          } catch (err) { alert(t("config.importInvalid")); }
        };
        r.readAsText(f, "utf-8");
        ev.target.value = "";
      });
      btnRow.appendChild(imp); btnRow.appendChild(file);
      p.appendChild(btnRow);
    }

    /* ================================================================
       Process Manager — configurable dropdown options
       Manages: Hosting, AI Kind, Knowledge Type, Tool Categories
       ================================================================ */
    function buildProcessManager(p) {
      var W = window.NIJU.WISSEN;
      p.appendChild(el("h3", "cfg-h", t("config.pmTitle")));
      p.appendChild(el("p", "cfg-text", t("config.pmHint")));

      /* Helper: build defaults list from built-in array */
      function builtins(arr, labelFn) {
        return arr.map(function (v) { return { v: v, label: labelFn(v), builtin: true }; });
      }

      /* ---- Hosting ---- */
      p.appendChild(el("h4", "cfg-h4", t("config.pmHosting")));
      buildOptionList(p, "hosting",
        builtins(W.DEFAULT_HOSTING, function (v) { return t("wsn.hosting_" + v); }));

      p.appendChild(el("hr", "cfg-trenner"));

      /* ---- AI Kind ---- */
      p.appendChild(el("h4", "cfg-h4", t("config.pmAiKind")));
      buildOptionList(p, "aiKind",
        builtins(W.DEFAULT_AI_KIND, function (v) { return t("wsn.aiKind_" + v); }));

      p.appendChild(el("hr", "cfg-trenner"));

      /* ---- Knowledge Type ---- */
      p.appendChild(el("h4", "cfg-h4", t("config.pmKnowType")));
      buildOptionList(p, "knowType",
        builtins(W.DEFAULT_KNOW_TYPE, function (v) { return t("wsn.knowType_" + v); }));

      p.appendChild(el("hr", "cfg-trenner"));

      /* ---- Tool Categories ---- */
      p.appendChild(el("h4", "cfg-h4", t("config.pmCategories")));
      p.appendChild(el("p", "cfg-text", t("config.pmCategoriesHint")));
      buildOptionList(p, "categories", []);

      p.appendChild(el("hr", "cfg-trenner"));

      /* Reset all */
      var resetRow = el("div", "cfg-btnrow");
      var resetBtn = el("button", "cfg-btn", t("config.pmReset"));
      resetBtn.addEventListener("click", function () {
        if (!confirm(t("config.pmResetConfirm"))) return;
        W.setPmConfig({});
        zeichne();
      });
      resetRow.appendChild(resetBtn);
      p.appendChild(resetRow);
    }

    /* Shared option-list editor for one field */
    function buildOptionList(p, field, defaultItems) {
      var W = window.NIJU.WISSEN;
      var cfg = W.getPmConfig();
      /* Use stored list or fall back to built-in defaults */
      var items = (cfg[field] && Array.isArray(cfg[field])) ? cfg[field].slice() : defaultItems.slice();

      var list = el("div", "cfg-opt-list");

      function save() {
        var c = W.getPmConfig();
        c[field] = items;
        W.setPmConfig(c);
      }

      function redraw() {
        list.innerHTML = "";
        items.forEach(function (opt, i) {
          var row = el("div", "cfg-opt-row");
          /* Display label (editable) */
          var lbl = document.createElement("input");
          lbl.type = "text"; lbl.className = "cfg-opt-label";
          lbl.value = opt.label || "";
          lbl.placeholder = opt.v || t("config.pmNewOption");
          lbl.title = opt.v ? t("config.pmValueHint", { v: opt.v }) : "";
          var idx = i;
          lbl.addEventListener("change", function () { items[idx] = Object.assign({}, items[idx], { label: lbl.value }); save(); });
          row.appendChild(lbl);
          /* Delete */
          var del = el("button", "cfg-mini del", "✕");
          del.title = t("editor.remove");
          del.addEventListener("click", function (e) {
            e.preventDefault(); items.splice(idx, 1); save(); redraw();
          });
          row.appendChild(del);
          list.appendChild(row);
        });

        /* Add new row */
        var addRow = el("div", "cfg-opt-add");
        var newLbl = document.createElement("input");
        newLbl.type = "text"; newLbl.className = "cfg-opt-label";
        newLbl.placeholder = t("config.pmNewOption");
        var addBtn = el("button", "cfg-mini add", "+ " + t("config.pmAdd"));
        addBtn.addEventListener("click", function (e) {
          e.preventDefault();
          var lbl = newLbl.value.trim(); if (!lbl) return;
          var val = lbl.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";
          /* Ensure uniqueness */
          var base = val, n = 2;
          while (items.some(function (o) { return o.v === val; })) { val = base + "-" + n++; }
          items.push({ v: val, label: lbl, builtin: false });
          save(); newLbl.value = ""; redraw();
        });
        addRow.appendChild(newLbl); addRow.appendChild(addBtn);
        list.appendChild(addRow);
      }

      redraw();
      p.appendChild(list);
    }

    /* ================================================================
       Backup & Restore
       ================================================================ */
    function buildBackup(p) {
      var B = window.NIJU.BACKUP;
      p.appendChild(el("h3", "cfg-h", t("config.backupTitle")));
      p.appendChild(el("p", "cfg-text", t("config.backupInfo")));

      /* Path hint box */
      var hint = el("div", "cfg-info-box");
      var hintTxt = el("p", null, t("config.backupPathHint"));
      var hintCode = el("code", "cfg-path-hint", "data/backups/");
      hint.appendChild(hintTxt);
      hint.appendChild(hintCode);
      p.appendChild(hint);

      p.appendChild(el("hr", "cfg-trenner"));

      /* Backup button */
      var btnRow = el("div", "cfg-btnrow");
      var backupBtn = el("button", "cfg-btn primary", t("config.backupCreate"));
      backupBtn.addEventListener("click", function () {
        if (!opts.backup || !opts.backup.getData) { alert(t("config.backupNoData")); return; }
        var data = opts.backup.getData();
        if (!data || (!data.prozesse && !data.index)) { alert(t("config.backupNoData")); return; }
        B.create(data);
      });
      btnRow.appendChild(backupBtn);

      /* Restore button */
      var restoreBtn = el("button", "cfg-btn", t("config.backupRestore"));
      var fi = document.createElement("input");
      fi.type = "file"; fi.accept = ".zip,application/zip"; fi.style.display = "none";
      restoreBtn.addEventListener("click", function () { fi.click(); });
      fi.addEventListener("change", function (ev) {
        var f = ev.target.files[0]; if (!f) return;
        ev.target.value = "";
        B.restore(f, function (err, result) {
          if (err) { alert(t("config.backupRestoreError", { err: err.message })); return; }
          if (!confirm(t("config.backupRestoreConfirm"))) return;
          /* Apply settings first, then restore model */
          if (result.settings) B.applySettings(result.settings);
          if (opts.backup && opts.backup.onRestore) opts.backup.onRestore(result);
          alert(t("config.backupRestoreDone"));
          if (opts.onClose) opts.onClose();
        });
      });
      btnRow.appendChild(restoreBtn);
      btnRow.appendChild(fi);
      p.appendChild(btnRow);
    }

    host.innerHTML = "";
    host.appendChild(wrap);
    zeichne();
    if (opts.aboutOnly) nav.style.display = "none";
    if (I18N && I18N.onChange) {
      I18N.onChange(function () {
        if (host.contains(wrap)) {
          kopf.querySelector(".cfg-titel").textContent = paneTitle();
          schliessen.textContent = t("config.close");
          zeichne();
        }
      });
    }
  }

  window.NIJU.CONFIG = { open: open };
})();
