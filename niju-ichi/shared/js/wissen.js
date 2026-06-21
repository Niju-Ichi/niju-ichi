/* ============================================================
   NIJU ICHI — Knowledge model + AI & Tools editor (shared)
   Data lives in index.json under "wissen". The Process Manager
   edits it; the Process Brain module reads it.

   NIJU.WISSEN.normalize(w)
   NIJU.WISSEN.renderEditor(host, {index, prozesse, org}, opts)
     opts: { sub, searchTools, searchKnowledge, showDetails, showDetailsKnowledge,
             onChange, onSub, onSearch, onShowDetails, onShowDetailsKnowledge }
   NIJU.WISSEN.getPmConfig() / setPmConfig(cfg)
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.WISSEN) return;

  function t(k, v) { return (window.NIJU && NIJU.I18N) ? NIJU.I18N.t(k, v) : k; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function newToolId() { return newId("w_"); }
  function newKnowId() { return newId("k_"); }

  /* ---- Built-in option lists (used as fallback) ---- */
  var TOOL_KIND  = ["saas", "ai"];
  var AI_KIND    = ["copilot", "brain", "agent", "voice"];
  var HOSTING    = ["", "eu", "us", "onprem"];
  var AI_ACT     = ["", "minimal", "limited", "high"];
  var KNOW_TYPE  = ["runbook", "template", "policy", "wiki", "other"];
  var LEVELS     = ["", "low", "med", "high"];
  var DOC_STATUS = ["", "none", "partial", "full"];
  var FREQS      = ["", "daily", "weekly", "monthly", "quarterly", "adhoc"];

  /* ============================================================
     PM Config — configurable dropdown options stored in localStorage.
     Schema: { hosting:[{v,label,builtin}], aiKind:[…], knowType:[…], categories:[…] }
     ============================================================ */
  var PM_LS = "niju.config.pm";
  function getPmConfig() { try { return JSON.parse(localStorage.getItem(PM_LS) || "{}"); } catch (e) { return {}; } }
  function setPmConfig(cfg) { try { localStorage.setItem(PM_LS, JSON.stringify(cfg)); } catch (e) {} }

  /* Effective value list for a configurable field */
  function fieldValues(field, builtins) {
    var cfg = getPmConfig();
    if (cfg[field] && Array.isArray(cfg[field]) && cfg[field].length) {
      return cfg[field].map(function (o) { return o.v || o; });
    }
    return builtins;
  }
  /* Display label for a value in a configurable field */
  function fieldLabel(field, value) {
    var cfg = getPmConfig();
    var list = cfg[field];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        if ((list[i].v || list[i]) === value && list[i].label) return list[i].label;
      }
    }
    var k = "wsn." + field + "_" + value;
    var tr = t(k);
    return (tr !== k) ? tr : value;
  }

  function asArr(x) { return Array.isArray(x) ? x.slice() : []; }

  function normalize(w) {
    w = (w && typeof w === "object") ? w : {};
    if (typeof w.version !== "number") w.version = 1;
    if (!Array.isArray(w.tools)) w.tools = [];
    if (!Array.isArray(w.knowledge)) w.knowledge = [];
    if (!w.assessment || typeof w.assessment !== "object") w.assessment = {};

    w.tools.forEach(function (tl) {
      if (!tl.id) tl.id = newToolId();
      if (typeof tl.name !== "string") tl.name = "";
      if (TOOL_KIND.indexOf(tl.kind) < 0) tl.kind = "saas";
      if (typeof tl.category !== "string") tl.category = "";
      tl.cost = (typeof tl.cost === "number" && isFinite(tl.cost)) ? tl.cost : 0;
      if (typeof tl.owner !== "string") tl.owner = "";
      /* Hosting / AI kind / AI Act: accept any string (supports custom options) */
      if (typeof tl.hosting !== "string") tl.hosting = "";
      tl.pii = !!tl.pii;
      if (typeof tl.aiAct !== "string") tl.aiAct = "";
      if (AI_ACT.indexOf(tl.aiAct) < 0) tl.aiAct = "";  /* AI Act stays enum */
      tl.aiPhase = (tl.kind === "ai" && [1, 2, 3].indexOf(tl.aiPhase) >= 0) ? tl.aiPhase : (tl.kind === "ai" ? 1 : 0);
      if (tl.kind !== "ai") { tl.aiKind = ""; tl.aiPhase = 0; }
      else if (typeof tl.aiKind !== "string") tl.aiKind = "copilot";
      tl.usedBy   = asArr(tl.usedBy).filter(function (s) { return typeof s === "string" && s.trim(); });
      tl.supports = asArr(tl.supports).filter(function (s) { return typeof s === "string" && s.trim(); });
    });

    w.knowledge.forEach(function (k) {
      if (!k.id) k.id = newKnowId();
      if (typeof k.name !== "string") k.name = "";
      /* knowType: accept any string for custom types */
      if (typeof k.type !== "string" || !k.type) k.type = "runbook";
      if (typeof k.url !== "string") k.url = "";
      k.documents = asArr(k.documents).filter(function (s) { return typeof s === "string" && s.trim(); });
    });

    Object.keys(w.assessment).forEach(function (file) {
      var a = w.assessment[file] || {};
      if (FREQS.indexOf(a.frequency) < 0) a.frequency = "";
      if (LEVELS.indexOf(a.criticality) < 0) a.criticality = "";
      if (DOC_STATUS.indexOf(a.docStatus) < 0) a.docStatus = "";
      if (LEVELS.indexOf(a.aiPotential) < 0) a.aiPotential = "";
      w.assessment[file] = a;
    });
    return w;
  }

  function getAssessment(w, file) {
    if (!w.assessment[file]) w.assessment[file] = { frequency: "", criticality: "", docStatus: "", aiPotential: "" };
    return w.assessment[file];
  }

  function allOrgNames(org) {
    if (window.NIJU && NIJU.ORG && org) return NIJU.ORG.alleNamen(org);
    return [];
  }

  /* ============================================================
     Manager editor — Tools, Knowledge, Assessment tabs
     ============================================================ */
  function renderEditor(host, model, opts) {
    opts = opts || {};
    var index = model.index, prozesse = model.prozesse || {};
    var w = normalize(index.wissen || {});
    index.wissen = w;
    var org = index.organisation || null;
    var onChange    = opts.onChange    || function () {};
    var sub         = opts.sub || "tools";
    var showDetails = opts.showDetails !== false;
    var showDetailsKnowledge = opts.showDetailsKnowledge !== false;
    host.innerHTML = "";
    host.classList.add("wsn-host");

    var procNames = Object.keys(prozesse);
    function procLabel(file) { var p = prozesse[file]; return (p && p.titel) ? p.titel : file; }
    var nameSugg = allOrgNames(org);

    function fieldRow(labelKey, node) {
      var f = el("div", "wsn-field");
      f.appendChild(el("label", null, t(labelKey)));
      f.appendChild(node);
      return f;
    }
    function select(values, current, labelFn, onPick) {
      var s = document.createElement("select");
      values.forEach(function (v) { var o = document.createElement("option"); o.value = v; o.textContent = labelFn(v); s.appendChild(o); });
      s.value = current;
      s.addEventListener("change", function () { onPick(s.value); });
      return s;
    }
    function textInput(val, ph, onInput, listId) {
      var i = document.createElement("input"); i.type = "text"; i.value = val || ""; if (ph) i.placeholder = ph;
      if (listId) i.setAttribute("list", listId);
      i.addEventListener("input", function () { onInput(i.value); });
      return i;
    }
    function multiPick(allValues, selected, labelFn, onToggle) {
      var box = el("div", "wsn-multi");
      var chips = el("div", "wsn-chips");
      function redraw() {
        chips.innerHTML = "";
        selected.forEach(function (v) {
          var c = el("span", "wsn-chip", labelFn(v));
          var x = el("button", "wsn-chip-x", "✕"); x.title = t("editor.remove");
          x.addEventListener("click", function () { var i = selected.indexOf(v); if (i >= 0) selected.splice(i, 1); onToggle(); redraw(); fillSel(); });
          c.appendChild(x); chips.appendChild(c);
        });
      }
      var add = document.createElement("select");
      function fillSel() {
        add.innerHTML = "";
        var o0 = document.createElement("option"); o0.value = ""; o0.textContent = t("wsn.addEllipsis"); add.appendChild(o0);
        allValues.forEach(function (v) {
          if (selected.indexOf(v) >= 0) return;
          var o = document.createElement("option"); o.value = v; o.textContent = labelFn(v); add.appendChild(o);
        });
      }
      add.addEventListener("change", function () { if (add.value) { selected.push(add.value); onToggle(); redraw(); fillSel(); } });
      fillSel(); redraw();
      box.appendChild(chips); box.appendChild(add);
      return box;
    }

    /* sub-nav */
    var nav = el("div", "wsn-subnav");
    [["tools", "wsn.tabTools"], ["knowledge", "wsn.tabKnowledge"], ["assessment", "wsn.tabAssessment"]].forEach(function (s) {
      var b = el("button", "btn seg" + (sub === s[0] ? " aktiv" : ""), t(s[1]));
      b.addEventListener("click", function () {
        opts.sub = s[0];
        if (opts.onSub) opts.onSub(s[0]);
        renderEditor(host, model, opts);
      });
      nav.appendChild(b);
    });
    host.appendChild(nav);

    var scroll = el("div", "wsn-scroll");
    host.appendChild(scroll);

    if (sub === "tools") renderTools();
    else if (sub === "knowledge") renderKnowledge();
    else renderAssessment();

    /* ---- Tool card ---- */
    function toolCard(tl) {
      var card = el("div", "wsn-card " + (tl.kind === "ai" ? "ai" : "saas"));
      var head = el("div", "wsn-card-head");
      var badge = el("span", "wsn-kind-badge " + tl.kind, tl.kind === "ai" ? t("wsn.kindAi") : t("wsn.kindSaas"));
      head.appendChild(badge);
      var nm = textInput(tl.name, t("wsn.namePh"), function (v) { tl.name = v; onChange(); });
      nm.className = "wsn-card-name";
      head.appendChild(nm);
      var del = el("button", "nt-btn del", "✕"); del.title = t("editor.remove");
      del.addEventListener("click", function () { w.tools = w.tools.filter(function (x) { return x.id !== tl.id; }); onChange(); renderEditor(host, model, opts); });
      head.appendChild(del);
      card.appendChild(head);

      var grid = el("div", "wsn-grid");
      grid.appendChild(fieldRow("wsn.kind", select(TOOL_KIND, tl.kind, function (v) {
        return v === "ai" ? t("wsn.kindAi") : t("wsn.kindSaas");
      }, function (v) { tl.kind = v; normalize(w); onChange(); renderEditor(host, model, opts); })));

      /* Category: free-text with datalist from PM config */
      var catValues = fieldValues("categories", []);
      var catDl = null;
      if (catValues.length) {
        catDl = document.createElement("datalist"); catDl.id = "wsnCat_" + tl.id;
        catValues.forEach(function (v) { var o = document.createElement("option"); o.value = v; catDl.appendChild(o); });
        card.appendChild(catDl);
      }
      grid.appendChild(fieldRow("wsn.category", textInput(tl.category, t("wsn.categoryPh"), function (v) { tl.category = v; onChange(); }, catDl ? catDl.id : null)));

      grid.appendChild(fieldRow("wsn.owner", function () {
        var i = textInput(tl.owner, "", function (v) { tl.owner = v; onChange(); });
        i.setAttribute("list", "wsnNames");
        return i;
      }()));
      grid.appendChild(fieldRow("wsn.cost", function () {
        var i = document.createElement("input"); i.type = "number"; i.min = "0"; i.step = "10"; i.value = String(tl.cost || 0);
        i.addEventListener("input", function () { tl.cost = parseFloat(i.value) || 0; onChange(); });
        return i;
      }()));
      if (tl.kind === "ai") {
        var aiKindVals = fieldValues("aiKind", AI_KIND);
        grid.appendChild(fieldRow("wsn.aiKind", select(aiKindVals, tl.aiKind, function (v) { return fieldLabel("aiKind", v); }, function (v) { tl.aiKind = v; onChange(); })));
        grid.appendChild(fieldRow("wsn.aiPhase", select(["1", "2", "3"], String(tl.aiPhase || 1), function (v) { return t("wsn.phaseN", { n: v }); }, function (v) { tl.aiPhase = parseInt(v, 10); onChange(); })));
      }
      var hostingVals = [""].concat(fieldValues("hosting", HOSTING.filter(function (v) { return v; })));
      grid.appendChild(fieldRow("wsn.hosting", select(hostingVals, tl.hosting, function (v) { return v ? fieldLabel("hosting", v) : t("wsn.unset"); }, function (v) { tl.hosting = v; onChange(); })));
      grid.appendChild(fieldRow("wsn.aiAct", select(AI_ACT, tl.aiAct, function (v) { return v ? t("wsn.aiAct_" + v) : t("wsn.unset"); }, function (v) { tl.aiAct = v; onChange(); })));
      grid.appendChild(fieldRow("wsn.pii", function () {
        var lab = el("label", "wsn-check");
        var c = document.createElement("input"); c.type = "checkbox"; c.checked = !!tl.pii;
        c.addEventListener("change", function () { tl.pii = c.checked; onChange(); });
        lab.appendChild(c); lab.appendChild(el("span", null, t("wsn.piiYes")));
        return lab;
      }()));
      card.appendChild(grid);

      /* Used by / Supports — hideable via Show Details */
      if (showDetails) {
        card.appendChild(el("div", "wsn-sub-h", t("wsn.usedBy")));
        card.appendChild(multiPick(nameSugg, tl.usedBy, function (v) { return v; }, onChange));
        card.appendChild(el("div", "wsn-sub-h", t("wsn.supports")));
        card.appendChild(multiPick(procNames, tl.supports, procLabel, onChange));
      }
      return card;
    }

    function renderTools() {
      /* ---- Search + Show Details bar ---- */
      var topBar = el("div", "wsn-top-bar");

      var searchInp = document.createElement("input");
      searchInp.type = "search"; searchInp.className = "wsn-search";
      searchInp.placeholder = t("wsn.search");
      searchInp.value = opts.searchTools || "";
      searchInp.addEventListener("input", function () {
        opts.searchTools = searchInp.value;
        if (opts.onSearch) opts.onSearch("tools", searchInp.value);
        renderEditor(host, model, opts);
      });
      topBar.appendChild(searchInp);

      var detLab = el("label", "wsn-show-details");
      var detCb = document.createElement("input"); detCb.type = "checkbox"; detCb.checked = showDetails;
      detCb.addEventListener("change", function () {
        opts.showDetails = detCb.checked;
        if (opts.onShowDetails) opts.onShowDetails(detCb.checked);
        renderEditor(host, model, opts);
      });
      detLab.appendChild(detCb);
      detLab.appendChild(el("span", null, t("wsn.showDetails")));
      topBar.appendChild(detLab);
      scroll.appendChild(topBar);

      /* ---- Add buttons ---- */
      var bar = el("div", "wsn-bar");
      var addSaas = el("button", "nt-btn add", t("wsn.addSaas"));
      addSaas.addEventListener("click", function () { w.tools.push(normalizeOne({ kind: "saas", name: t("wsn.newSaas") })); onChange(); renderEditor(host, model, opts); });
      var addAi = el("button", "nt-btn add", t("wsn.addAi"));
      addAi.addEventListener("click", function () { w.tools.push(normalizeOne({ kind: "ai", name: t("wsn.newAi") })); onChange(); renderEditor(host, model, opts); });
      bar.appendChild(addSaas); bar.appendChild(addAi);
      scroll.appendChild(bar);

      /* Name suggestions datalist */
      var dl = document.createElement("datalist"); dl.id = "wsnNames";
      nameSugg.forEach(function (n) { var o = document.createElement("option"); o.value = n; dl.appendChild(o); });
      scroll.appendChild(dl);

      /* ---- Filter by search ---- */
      var q = (opts.searchTools || "").toLowerCase().trim();
      var visible = q ? w.tools.filter(function (tl) {
        return (tl.name || "").toLowerCase().indexOf(q) >= 0 ||
               (tl.category || "").toLowerCase().indexOf(q) >= 0 ||
               (tl.owner || "").toLowerCase().indexOf(q) >= 0;
      }) : w.tools;

      if (!visible.length) {
        scroll.appendChild(el("div", "wsn-empty", q ? t("wsn.noResults") : t("wsn.toolsEmpty")));
        return;
      }
      visible.forEach(function (tl) { scroll.appendChild(toolCard(tl)); });
    }

    function normalizeOne(partial) {
      var tl = Object.assign({ id: newToolId(), name: "", kind: "saas", category: "", cost: 0, owner: "", hosting: "", pii: false, aiAct: "", aiPhase: 0, aiKind: "", usedBy: [], supports: [] }, partial);
      w.tools.push(tl); normalize(w); var out = w.tools.pop(); return out;
    }

    function renderKnowledge() {
      /* ---- Search bar ---- */
      var topBar = el("div", "wsn-top-bar");
      var searchInp = document.createElement("input");
      searchInp.type = "search"; searchInp.className = "wsn-search";
      searchInp.placeholder = t("wsn.search");
      searchInp.value = opts.searchKnowledge || "";
      searchInp.addEventListener("input", function () {
        opts.searchKnowledge = searchInp.value;
        if (opts.onSearch) opts.onSearch("knowledge", searchInp.value);
        renderEditor(host, model, opts);
      });
      topBar.appendChild(searchInp);

      var detLabK = el("label", "wsn-show-details");
      var detCbK = document.createElement("input"); detCbK.type = "checkbox"; detCbK.checked = showDetailsKnowledge;
      detCbK.addEventListener("change", function () {
        opts.showDetailsKnowledge = detCbK.checked;
        if (opts.onShowDetailsKnowledge) opts.onShowDetailsKnowledge(detCbK.checked);
        renderEditor(host, model, opts);
      });
      detLabK.appendChild(detCbK);
      detLabK.appendChild(el("span", null, t("wsn.showDetails")));
      topBar.appendChild(detLabK);
      scroll.appendChild(topBar);

      /* ---- Add button ---- */
      var bar = el("div", "wsn-bar");
      var add = el("button", "nt-btn add", t("wsn.addKnowledge"));
      add.addEventListener("click", function () { w.knowledge.push({ id: newKnowId(), name: t("wsn.newKnowledge"), type: "runbook", url: "", documents: [] }); onChange(); renderEditor(host, model, opts); });
      bar.appendChild(add);
      scroll.appendChild(bar);

      /* ---- Filter ---- */
      var q = (opts.searchKnowledge || "").toLowerCase().trim();
      var visible = q ? w.knowledge.filter(function (k) {
        return (k.name || "").toLowerCase().indexOf(q) >= 0 ||
               (k.url || "").toLowerCase().indexOf(q) >= 0;
      }) : w.knowledge;

      if (!visible.length) {
        scroll.appendChild(el("div", "wsn-empty", q ? t("wsn.noResults") : t("wsn.knowledgeEmpty")));
        return;
      }

      var knowTypeVals = fieldValues("knowType", KNOW_TYPE);

      visible.forEach(function (k) {
        var card = el("div", "wsn-card know");
        var head = el("div", "wsn-card-head");
        var nm = textInput(k.name, t("wsn.namePh"), function (v) { k.name = v; onChange(); });
        nm.className = "wsn-card-name";
        head.appendChild(nm);
        var del = el("button", "nt-btn del", "✕"); del.title = t("editor.remove");
        del.addEventListener("click", function () { w.knowledge = w.knowledge.filter(function (x) { return x.id !== k.id; }); onChange(); renderEditor(host, model, opts); });
        head.appendChild(del);
        card.appendChild(head);

        /* Grid: narrow Type, wide URL */
        var grid = el("div", "wsn-grid wsn-grid-know");
        grid.appendChild(fieldRow("wsn.type", select(knowTypeVals, k.type, function (v) { return fieldLabel("knowType", v); }, function (v) { k.type = v; onChange(); })));
        grid.appendChild(fieldRow("wsn.url", textInput(k.url, "https://…", function (v) { k.url = v; onChange(); })));
        card.appendChild(grid);

        if (showDetailsKnowledge) {
          card.appendChild(el("div", "wsn-sub-h", t("wsn.documents")));
          card.appendChild(multiPick(procNames, k.documents, procLabel, onChange));
        }
        scroll.appendChild(card);
      });
    }

    function renderAssessment() {
      scroll.appendChild(el("div", "wsn-none", t("wsn.assessmentHint")));
      if (!procNames.length) { scroll.appendChild(el("div", "wsn-empty", t("wsn.noProcesses"))); return; }
      var table = el("div", "wsn-table");
      var head = el("div", "wsn-trow head");
      [t("wsn.colProcess"), t("wsn.colFrequency"), t("wsn.colCriticality"), t("wsn.colDocStatus"), t("wsn.colAiPotential")].forEach(function (h) { head.appendChild(el("div", "wsn-tc", h)); });
      table.appendChild(head);
      procNames.forEach(function (file) {
        var a = getAssessment(w, file);
        var row = el("div", "wsn-trow");
        row.appendChild(el("div", "wsn-tc name", procLabel(file)));
        row.appendChild(wrapSel(select(FREQS, a.frequency, function (v) { return v ? t("wsn.freq_" + v) : t("wsn.unset"); }, function (v) { a.frequency = v; onChange(); })));
        row.appendChild(wrapSel(select(LEVELS, a.criticality, function (v) { return v ? t("wsn.level_" + v) : t("wsn.unset"); }, function (v) { a.criticality = v; onChange(); })));
        row.appendChild(wrapSel(select(DOC_STATUS, a.docStatus, function (v) { return v ? t("wsn.doc_" + v) : t("wsn.unset"); }, function (v) { a.docStatus = v; onChange(); })));
        row.appendChild(wrapSel(select(LEVELS, a.aiPotential, function (v) { return v ? t("wsn.level_" + v) : t("wsn.unset"); }, function (v) { a.aiPotential = v; onChange(); })));
        table.appendChild(row);
      });
      scroll.appendChild(table);
      function wrapSel(s) { var c = el("div", "wsn-tc"); c.appendChild(s); return c; }
    }
  }

  window.NIJU.WISSEN = {
    normalize: normalize,
    newToolId: newToolId, newKnowId: newKnowId,
    getAssessment: getAssessment,
    renderEditor: renderEditor,
    getPmConfig: getPmConfig,
    setPmConfig: setPmConfig,
    /* Default value lists (used by config.js Process Manager pane) */
    DEFAULT_HOSTING:  HOSTING.filter(function (v) { return v; }),
    DEFAULT_AI_KIND:  AI_KIND,
    DEFAULT_KNOW_TYPE: KNOW_TYPE,
    TOOL_KIND: TOOL_KIND, AI_KIND: AI_KIND, HOSTING: HOSTING, AI_ACT: AI_ACT,
    KNOW_TYPE: KNOW_TYPE, LEVELS: LEVELS, DOC_STATUS: DOC_STATUS, FREQS: FREQS
  };
})();
