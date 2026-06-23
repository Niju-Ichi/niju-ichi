/* ============================================================
   NIJU ICHI — Brain (shared, d3 knowledge graph)
   The Process Brain visualises ONE company knowledge graph built
   from data that already lives in the other modules plus the
   "wissen" block:
     - organisation (index.organisation)  -> teams (functions) + roles
     - process JSONs                       -> processes (+ RACI -> owns/performs)
     - index.wissen.tools                  -> SaaS tools + AI agents
     - index.wissen.knowledge              -> documents
     - index.wissen.assessment             -> per-process AI readiness
   Binding is by NAME equality (same convention as NIJU.ORG), so the
   process JSONs stay self-contained.

   Offline: classic <script>, no ES modules, no fetch. Needs d3
   (shared/lib/d3.min.js) and NIJU.WISSEN (shared/js/wissen.js).

   NIJU.BRAIN.build(index, prozesse) -> graph
   NIJU.BRAIN.insights(graph)        -> derived AI-readiness facts
   NIJU.BRAIN.render(host, {index, prozesse}, opts)
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.BRAIN) return;

  function t(k, v) { return (window.NIJU && NIJU.I18N) ? NIJU.I18N.t(k, v) : k; }
  function trim(s) { return (s == null ? "" : String(s)).trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  var PALETTE = ["#3479c9", "#e0850f", "#2e9e4f", "#9b59b6", "#1abc9c", "#e1b12c", "#e74c3c", "#16a085", "#2980b9", "#d35400", "#7f8c8d", "#8e44ad"];
  var LEVEL_N = { low: 1, med: 2, high: 3 };
  var DOC_N = { none: 1, partial: 2, full: 3 };

  /* ============================================================
     1) BUILD GRAPH
     ============================================================ */
  function build(index, prozesse) {
    index = index || {};
    prozesse = prozesse || {};
    var org = (window.NIJU && NIJU.ORG) ? NIJU.ORG.normalize(index.organisation || {}) : (index.organisation || { knoten: [] });
    var wissen = NIJU.WISSEN.normalize(index.wissen || {});

    var nodes = [], byId = {}, byName = {};
    function addNode(n) { nodes.push(n); byId[n.id] = n; if (n.name && (n.kind === "team" || n.kind === "role")) { var k = trim(n.name); if (k && !byName[k]) byName[k] = n; } return n; }

    /* company root */
    var company = addNode({ id: "__company", kind: "company", name: trim(index.titel) || t("brain.company") });

    /* org -> teams (functions) + roles */
    var orgById = {};
    (org.knoten || []).forEach(function (k) { orgById[k.id] = k; });
    function rootFunction(funkId) {
      var cur = orgById[funkId], guard = 0;
      while (cur && cur.parent && orgById[cur.parent] && orgById[cur.parent].typ === "funktion" && guard++ < 99) cur = orgById[cur.parent];
      return cur ? cur.id : funkId;
    }
    (org.knoten || []).forEach(function (k) {
      if (k.typ === "funktion") addNode({ id: "f::" + k.id, kind: "team", name: trim(k.name), orgId: k.id, parent: k.parent });
      else addNode({ id: "r::" + k.id, kind: "role", name: trim(k.name), orgId: k.id, parent: k.parent });
    });

    /* teams (colour anchors) = top-level functions */
    var teams = [];
    (org.knoten || []).filter(function (k) { return k.typ === "funktion"; }).forEach(function (k) {
      var isRoot = !k.parent || !orgById[k.parent] || orgById[k.parent].typ !== "funktion";
      if (isRoot) teams.push(byId["f::" + k.id]);
    });
    var teamColor = {};
    teams.forEach(function (tm, i) { tm.color = PALETTE[i % PALETTE.length]; teamColor[tm.id] = tm.color; });

    /* processes */
    Object.keys(prozesse).forEach(function (file) {
      var p = prozesse[file]; var d = p && p.data;
      var n = addNode({
        id: "p::" + file, kind: "process", file: file,
        name: (p && p.titel) ? p.titel : file,
        assessment: (wissen.assessment[file] || { frequency: "", criticality: "", docStatus: "", aiPotential: "" })
      });
      n._data = d || null;
    });

    /* tools + agents (kind must win over tl.kind = "saas"/"ai") */
    wissen.tools.forEach(function (tl) {
      addNode(Object.assign({}, tl, { id: tl.id, kind: (tl.kind === "ai" ? "agent" : "tool") }));
    });
    /* knowledge */
    wissen.knowledge.forEach(function (k) { addNode(Object.assign({}, k, { id: k.id, kind: "knowledge" })); });

    /* implicit roles for RACI / owner names not present in the org */
    function nameNode(name) {
      name = trim(name); if (!name) return null;
      if (byName[name]) return byName[name];
      var n = addNode({ id: "ri::" + name, kind: "role", name: name, implicit: true, parent: "" });
      return n;
    }

    /* ---- links ---- */
    var links = [], linkSeen = {};
    function link(s, tg, type) {
      if (!s || !tg || s.id === tg.id) return;
      var key = s.id + "|" + tg.id + "|" + type;
      if (linkSeen[key]) return; linkSeen[key] = 1;
      links.push({ source: s.id, target: tg.id, type: type });
    }

    /* org structure */
    (org.knoten || []).forEach(function (k) {
      var self = byId[(k.typ === "funktion" ? "f::" : "r::") + k.id];
      var parent = k.parent ? byId["f::" + k.parent] : null;
      if (parent) link(self, parent, k.typ === "rolle" ? "member_of" : "part_of");
      else if (k.typ === "funktion") link(self, company, "part_of");
    });

    /* processes <- RACI (owns from A, performs from R) */
    Object.keys(prozesse).forEach(function (file) {
      var pn = byId["p::" + file]; var d = pn && pn._data; if (!d) return;
      var withA = {}, withR = {};
      if (d.raci && typeof d.raci === "object") {
        Object.keys(d.raci).forEach(function (sid) {
          var row = d.raci[sid] || {};
          Object.keys(row).forEach(function (role) {
            var letters = row[role] || [];
            if (letters.indexOf("A") >= 0) withA[role] = 1;
            if (letters.indexOf("R") >= 0) withR[role] = 1;
          });
        });
      }
      if (!Object.keys(withR).length && Array.isArray(d.rollen)) d.rollen.forEach(function (r) { withR[r] = 1; });
      Object.keys(withA).forEach(function (name) { link(nameNode(name), pn, "owns"); });
      Object.keys(withR).forEach(function (name) { link(nameNode(name), pn, "performs"); });
      if (d.meta && trim(d.meta.processOwner)) link(nameNode(d.meta.processOwner), pn, "owns");
    });

    /* tools / agents */
    wissen.tools.forEach(function (tl) {
      var tn = byId[tl.id];
      if (trim(tl.owner)) link(nameNode(tl.owner), tn, "uses");
      (tl.usedBy || []).forEach(function (nm) { link(nameNode(nm), tn, "uses"); });
      (tl.supports || []).forEach(function (file) { var pn = byId["p::" + file]; if (pn) link(pn, tn, "supported_by"); });
    });
    /* knowledge */
    wissen.knowledge.forEach(function (k) {
      var kn = byId[k.id];
      (k.documents || []).forEach(function (file) { var pn = byId["p::" + file]; if (pn) link(kn, pn, "documents"); });
    });

    /* ---- teamOf (colour) ---- */
    var teamOf = {};
    nodes.forEach(function (n) {
      if (n.kind === "team") teamOf[n.id] = "f::" + rootFunction(n.orgId);
      else if (n.kind === "role" && n.orgId) { var rf = orgById[n.orgId] && orgById[n.orgId].parent; teamOf[n.id] = rf ? "f::" + rootFunction(rf) : ""; }
    });
    /* d3.forceLink mutates l.source/l.target from id strings into node
       objects once the simulation initialises — handle both forms. */
    function lid(x) { return (x && typeof x === "object") ? x.id : x; }
    function adjByType(nodeId, type, asTarget) {
      return links.filter(function (l) { return l.type === type && (asTarget ? lid(l.target) === nodeId : lid(l.source) === nodeId); })
                  .map(function (l) { return byId[asTarget ? lid(l.source) : lid(l.target)]; });
    }
    /* processes: owning team */
    nodes.filter(function (n) { return n.kind === "process"; }).forEach(function (pn) {
      var owners = adjByType(pn.id, "owns", true).concat(adjByType(pn.id, "performs", true));
      for (var i = 0; i < owners.length; i++) { var tm = teamOf[owners[i].id]; if (tm) { teamOf[pn.id] = tm; break; } }
    });
    /* tools/agents: owner/usedBy/supported team */
    nodes.filter(function (n) { return n.kind === "tool" || n.kind === "agent"; }).forEach(function (tn) {
      var users = adjByType(tn.id, "uses", true);
      for (var i = 0; i < users.length; i++) { var tm = teamOf[users[i].id]; if (tm) { teamOf[tn.id] = tm; break; } }
      if (!teamOf[tn.id]) { var sup = adjByType(tn.id, "supported_by", true); for (var j = 0; j < sup.length; j++) { if (teamOf[sup[j].id]) { teamOf[tn.id] = teamOf[sup[j].id]; break; } } }
    });
    /* knowledge: documented process team */
    nodes.filter(function (n) { return n.kind === "knowledge"; }).forEach(function (kn) {
      var docs = adjByType(kn.id, "documents", false);
      for (var i = 0; i < docs.length; i++) { if (teamOf[docs[i].id]) { teamOf[kn.id] = teamOf[docs[i].id]; break; } }
    });

    function colorFor(n) {
      if (n.kind === "company") return "#94a3b8";
      if (n.kind === "team") return n.color || "#7f8aa0";
      var tm = teamOf[n.id];
      return (tm && teamColor[tm]) ? teamColor[tm] : "#7f8aa0";
    }

    /* adjacency for hover */
    var adj = {}; nodes.forEach(function (n) { adj[n.id] = {}; });
    links.forEach(function (l) { adj[l.source][l.target] = 1; adj[l.target][l.source] = 1; });

    /* per-process: does it have AI support? performer count? */
    function hasAI(pn) { return adjByType(pn.id, "supported_by", false).some(function (x) { return x.kind === "agent"; }); }
    function performers(pn) { return adjByType(pn.id, "performs", true); }

    return {
      nodes: nodes, links: links, byId: byId, byName: byName, teams: teams,
      teamColor: teamColor, teamOf: teamOf, colorFor: colorFor, adj: adj,
      adjByType: adjByType, hasAI: hasAI, performers: performers,
      wissen: wissen
    };
  }

  /* ============================================================
     2) INSIGHTS (AI readiness)
     ============================================================ */
  function insights(g) {
    var procs = g.nodes.filter(function (n) { return n.kind === "process"; });
    var tools = g.nodes.filter(function (n) { return n.kind === "tool"; });
    var agents = g.nodes.filter(function (n) { return n.kind === "agent"; });

    var busFactor = procs.filter(function (p) { return p.assessment.criticality === "high" && g.performers(p).length <= 1; });
    var quickWins = procs.filter(function (p) { return p.assessment.aiPotential === "high" && p.assessment.docStatus === "full" && !g.hasAI(p); });
    var blocked = procs.filter(function (p) { return p.assessment.aiPotential === "high" && (p.assessment.docStatus === "none" || p.assessment.docStatus === "partial" || !p.assessment.docStatus); });
    var docGaps = procs.filter(function (p) { return p.assessment.docStatus === "none"; });
    var whiteSpots = procs.filter(function (p) { var lv = LEVEL_N[p.assessment.aiPotential] || 0; return lv >= 2 && !g.hasAI(p); });
    var covered = procs.filter(function (p) { return g.hasAI(p); });

    /* shared tools across >1 team */
    var teamsUsing = {};
    g.links.filter(function (l) { return l.type === "uses"; }).forEach(function (l) {
      var src = g.byId[l.source], tm = g.teamOf[src.id]; if (!tm) return;
      (teamsUsing[l.target] = teamsUsing[l.target] || {})[tm] = 1;
    });
    var shared = tools.concat(agents).filter(function (x) { return teamsUsing[x.id] && Object.keys(teamsUsing[x.id]).length > 1; });

    var totalCost = tools.concat(agents).reduce(function (s, x) { return s + (+x.cost || 0); }, 0);
    var compliance = tools.concat(agents).filter(function (x) { return x.aiAct === "high" || (x.pii && x.hosting === "us"); });

    return {
      busFactor: busFactor, quickWins: quickWins, blocked: blocked, docGaps: docGaps,
      whiteSpots: whiteSpots, covered: covered, shared: shared, compliance: compliance,
      totalCost: totalCost, procCount: procs.length, toolCount: tools.length, agentCount: agents.length,
      coverPct: procs.length ? Math.round(covered.length / procs.length * 100) : 0
    };
  }

  /* ============================================================
     3) RENDER (graph + overlay UI)
     ============================================================ */
  function render(host, model, opts) {
    opts = opts || {};
    host.innerHTML = "";
    host.classList.add("brain-host");

    var g = build(model.index, model.prozesse);
    var ins = insights(g);

    /* ---- overlay UI scaffold ---- */
    host.innerHTML =
      '<svg class="brain-svg"></svg>' +
      '<div class="brain-stats" id="brStats"></div>' +
      '<div class="brain-search">' +
        '<input id="brSearch" type="text" autocomplete="off">' +
        '<div class="brain-results" id="brResults"></div>' +
        '<div class="brain-theme-toggle" id="brThemeToggle">' +
          '<button class="brain-tt-btn" data-theme="night"></button>' +
          '<button class="brain-tt-btn" data-theme="day"></button>' +
        '</div>' +
      '</div>' +
      '<div class="brain-legend" id="brLegend"></div>' +
      '<div class="brain-modes" id="brModes">' +
        '<button class="brain-mode" data-m="force"></button>' +
        '<button class="brain-mode" data-m="radial"></button>' +
      '</div>' +
      '<div class="brain-sizer" id="brSizer">' +
        '<span class="bs-l big">●</span>' +
        '<input id="brSize" type="range" min="0.4" max="2.4" step="0.05" value="1">' +
        '<span class="bs-l small">●</span>' +
        '<span class="bs-v" id="brSizeVal">1.0×</span>' +
      '</div>' +
      '<div class="brain-toolbar">' +
        '<button class="brain-tbtn" id="brCover"></button>' +
        '<button class="brain-tbtn" id="brInsightsBtn"></button>' +
        '<button class="brain-tbtn" id="brReport"></button>' +
      '</div>' +
      '<div class="brain-shapes" id="brShapes"></div>' +
      '<div class="brain-insights" id="brInsights"></div>' +
      '<aside class="brain-panel" id="brPanel"><button class="brain-pclose" id="brPClose">✕</button><div id="brPBody"></div></aside>';

    var svgEl = host.querySelector(".brain-svg");
    var svg = d3.select(svgEl);
    var rootG = svg.append("g");
    var gGuide = rootG.append("g").attr("class", "br-guides");
    var gLink = rootG.append("g").attr("class", "br-links");
    var gNode = rootG.append("g").attr("class", "br-nodes");

    var W = host.clientWidth || 900, H = host.clientHeight || 600;
    svg.attr("viewBox", "0 0 " + W + " " + H);

    var zoom = d3.zoom().scaleExtent([0.3, 4]).on("zoom", function (ev) { rootG.attr("transform", ev.transform); });
    svg.call(zoom).on("dblclick.zoom", null);

    /* ---- force simulation ---- */
    var linkDist = { part_of: 90, member_of: 55, owns: 70, performs: 65, supported_by: 70, uses: 60, documents: 55 };
    var sim = d3.forceSimulation(g.nodes)
      .force("link", d3.forceLink(g.links).id(function (d) { return d.id; }).distance(function (l) { return linkDist[l.type] || 70; }).strength(0.25))
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide().radius(26))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.04));
    g.byId["__company"].fx = W / 2; g.byId["__company"].fy = H / 2;

    var mode = (opts.mode === "radial") ? "radial" : "force";  /* "force" | "radial" */
    var iconScale = 1;

    var linkSel = gLink.selectAll("line").data(g.links).join("line").attr("class", "br-link");

    var nodeSel = gNode.selectAll("g.br-node").data(g.nodes, function (d) { return d.id; }).join(function (enter) {
      var gg = enter.append("g").attr("class", "br-node")
        .on("click", function (ev, d) { ev.stopPropagation(); selectNode(d); })
        .on("mouseenter", function (ev, d) { if (!selectedId) highlight(d.id); })
        .on("mouseleave", function () { if (!selectedId) clearHi(); })
        .call(d3.drag()
          .on("start", function (ev, d) { if (mode === "force") { if (!ev.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; } })
          .on("drag", function (ev, d) { d.fx = ev.x; d.fy = ev.y; if (mode === "radial") { d.x = ev.x; d.y = ev.y; ticked(); } })
          .on("end", function (ev, d) { if (mode === "force") { if (!ev.active) sim.alphaTarget(0); if (d.kind !== "company") { d.fx = null; d.fy = null; } } }));
      gg.each(function (d) { drawShape(d3.select(this).append("g").attr("class", "br-scaler").attr("transform", "scale(" + iconScale + ")"), d); });
      gg.filter(function (d) { return d.kind === "company" || d.kind === "team"; }).append("text").attr("class", "br-label")
        .attr("y", function (d) { return d.kind === "company" ? 4 : -16; }).attr("text-anchor", "middle").text(function (d) { return d.name; });
      return gg;
    });

    function drawShape(sel, d) {
      var c = g.colorFor(d);
      if (d.kind === "company") {
        sel.append("rect").attr("class", "br-shape").attr("x", -20).attr("y", -20).attr("width", 40).attr("height", 40).attr("rx", 10).attr("fill", "var(--paper)").attr("stroke", c).attr("stroke-width", 2.4);
        sel.append("circle").attr("r", 6).attr("fill", c);
      } else if (d.kind === "team") {
        sel.append("circle").attr("class", "br-shape").attr("r", 13).attr("fill", c);
      } else if (d.kind === "role") {
        sel.append("circle").attr("class", "br-shape").attr("r", 9).attr("fill", c).attr("opacity", d.implicit ? 0.55 : 1);
      } else if (d.kind === "process") {
        var s = 9, crit = d.assessment.criticality === "high";
        var r = sel.append("rect").attr("class", "br-shape").attr("x", -s).attr("y", -s).attr("width", 2 * s).attr("height", 2 * s).attr("transform", "rotate(45)").attr("fill", c)
          .attr("stroke", crit ? "#e74c3c" : "var(--paper)").attr("stroke-width", crit ? 2 : 1.4);
        if (g.hasAI(d)) sel.append("circle").attr("class", "br-ai-ring").attr("r", 15).attr("fill", "none").attr("stroke", "#2e9e4f").attr("stroke-width", 1.6).attr("stroke-dasharray", "2 2");
      } else if (d.kind === "tool") {
        sel.append("rect").attr("class", "br-shape").attr("x", -8).attr("y", -8).attr("width", 16).attr("height", 16).attr("rx", 3).attr("fill", "var(--paper)").attr("stroke", c).attr("stroke-width", 1.8);
      } else if (d.kind === "agent") {
        sel.append("rect").attr("class", "br-shape").attr("x", -9).attr("y", -9).attr("width", 18).attr("height", 18).attr("rx", 9).attr("fill", c).attr("stroke", "#2e9e4f").attr("stroke-width", 2);
        sel.append("text").attr("class", "br-ai-mark").attr("text-anchor", "middle").attr("y", 3).text("AI");
      } else if (d.kind === "knowledge") {
        sel.append("circle").attr("class", "br-shape").attr("r", 5).attr("fill", "#9aa3b1");
      }
    }

    function ticked() {
      linkSel.attr("x1", function (l) { return l.source.x; }).attr("y1", function (l) { return l.source.y; })
             .attr("x2", function (l) { return l.target.x; }).attr("y2", function (l) { return l.target.y; });
      nodeSel.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    }
    sim.on("tick", ticked);

    /* ---- radial ring layout (the original Company-Brain look) ---- */
    var RING = [["team", 0.20, "brain.teams"], ["process", 0.42, "brain.processes"], ["role", 0.65, "brain.roles"], ["tool", 0.86, "brain.tools"]];
    function sectorOf(n) { return g.teamOf[n.id] || "__none"; }
    function kindBucket(n) { if (n.kind === "tool" || n.kind === "agent" || n.kind === "knowledge") return "tool"; return n.kind; }
    function layoutRadial() {
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 70;
      g.byId["__company"].x = cx; g.byId["__company"].y = cy; g.byId["__company"].fx = cx; g.byId["__company"].fy = cy;
      var sectors = g.teams.map(function (tm) { return tm.id; });
      var orphan = g.nodes.some(function (n) { return n.kind !== "company" && sectorOf(n) === "__none"; });
      if (orphan) sectors.push("__none");
      var TN = Math.max(sectors.length, 1), sector = (2 * Math.PI) / TN;
      sectors.forEach(function (sid, i) {
        var a0 = -Math.PI / 2 + i * sector, half = sector * 0.40;
        RING.forEach(function (r) {
          var list = g.nodes.filter(function (n) { return n.kind !== "company" && sectorOf(n) === sid && kindBucket(n) === r[0]; });
          list.forEach(function (n, j) {
            var fr = (list.length === 1) ? 0.5 : j / (list.length - 1);
            var ang = a0 - half + fr * 2 * half;
            n.x = cx + Math.cos(ang) * R * r[1]; n.y = cy + Math.sin(ang) * R * r[1];
            n.fx = n.x; n.fy = n.y;
          });
        });
      });
    }
    function drawGuides() {
      gGuide.selectAll("*").remove();
      if (mode !== "radial") return;
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 70;
      RING.forEach(function (r) {
        gGuide.append("circle").attr("class", "br-ring").attr("cx", cx).attr("cy", cy).attr("r", R * r[1]);
        gGuide.append("text").attr("class", "br-ring-label").attr("x", cx).attr("y", cy - R * r[1] - 7).attr("text-anchor", "middle").text(t(r[2]).toUpperCase());
      });
    }
    function setMode(m) {
      mode = (m === "radial") ? "radial" : "force";
      if (opts.onMode) opts.onMode(mode);
      host.querySelectorAll(".brain-mode").forEach(function (b) { b.classList.toggle("aktiv", b.dataset.m === mode); });
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);  /* re-centre on layout switch */
      if (mode === "radial") {
        sim.stop();
        layoutRadial(); drawGuides(); ticked();
      } else {
        gGuide.selectAll("*").remove();
        g.nodes.forEach(function (n) { if (n.kind !== "company") { n.fx = null; n.fy = null; } });
        sim.alpha(0.9).restart();
      }
    }
    function applyIconScale(k) {
      iconScale = k;
      var lab = host.querySelector("#brSizeVal"); if (lab) lab.textContent = k.toFixed(1) + "×";
      gNode.selectAll(".br-scaler").attr("transform", "scale(" + k + ")");
    }

    /* mode buttons + size slider */
    host.querySelectorAll(".brain-mode").forEach(function (b) {
      b.textContent = t(b.dataset.m === "radial" ? "brain.viewRadial" : "brain.viewForce");
      b.onclick = function () { setMode(b.dataset.m); };
    });
    var sizeR = host.querySelector("#brSize");
    if (sizeR) sizeR.addEventListener("input", function () { applyIconScale(+sizeR.value); });
    host.querySelectorAll(".brain-mode").forEach(function (b) { b.classList.toggle("aktiv", b.dataset.m === mode); });
    if (mode === "radial") setMode("radial");

    /* ---- highlight / select ---- */
    var selectedId = null;
    function neighbors(id) { var s = {}; s[id] = 1; Object.keys(g.adj[id] || {}).forEach(function (x) { s[x] = 1; }); return s; }
    function highlight(id) {
      var keep = neighbors(id);
      nodeSel.classed("dimmed", function (d) { return !keep[d.id]; });
      linkSel.classed("dim", function (l) { return !(l.source.id === id || l.target.id === id); })
             .classed("hot", function (l) { return l.source.id === id || l.target.id === id; });
      gNode.selectAll(".br-tmp").remove();
      nodeSel.filter(function (d) { return keep[d.id] && d.kind !== "company" && d.kind !== "team"; })
        .append("text").attr("class", "br-label br-tmp").attr("y", 22).attr("text-anchor", "middle").text(function (d) { return d.name; });
    }
    function clearHi() { nodeSel.classed("dimmed", false); linkSel.classed("dim", false).classed("hot", false); gNode.selectAll(".br-tmp").remove(); }
    function selectNode(d) { selectedId = d.id; highlight(d.id); openPanel(d); }
    function deselect() { selectedId = null; clearHi(); closePanel(); }
    svg.on("click", deselect);

    /* ---- detail panel ---- */
    var panel = host.querySelector("#brPanel"), pbody = host.querySelector("#brPBody");
    host.querySelector("#brPClose").onclick = deselect;
    function chips(list) {
      if (!list.length) return '<span class="br-dash">—</span>';
      return list.map(function (n) { return '<span class="br-chip" data-go="' + n.id + '"><span class="br-cd" style="background:' + g.colorFor(n) + '"></span>' + esc(n.name) + '</span>'; }).join("");
    }
    function blk(lbl, html) { return '<div class="br-pblock"><p class="br-lbl">' + esc(lbl) + '</p>' + html + '</div>'; }
    function meta(k, v) { return '<div class="br-meta"><span class="br-mk">' + esc(k) + '</span><span class="br-mv">' + v + '</span></div>'; }
    function badge(cls, txt) { return '<span class="br-badge ' + cls + '">' + esc(txt) + '</span>'; }
    function lvlBadge(v) { return v ? badge("lvl-" + v, t("wsn.level_" + v)) : '<span class="br-dash">—</span>'; }
    function docBadge(v) { return v ? badge("doc-" + v, t("wsn.doc_" + v)) : '<span class="br-dash">—</span>'; }

    var KIND_LABEL = { company: "brain.kCompany", team: "brain.kTeam", role: "brain.kRole", process: "brain.kProcess", tool: "brain.kTool", agent: "brain.kAgent", knowledge: "brain.kKnowledge" };

    function openPanel(d) {
      var c = g.colorFor(d);
      var h = '<p class="br-ptype" style="color:' + c + '">' + esc(t(KIND_LABEL[d.kind])) + '</p><h2>' + esc(d.name) + '</h2>';
      if (d.kind === "role") {
        h += blk(t("brain.memberOf"), chips(g.adjByType(d.id, "member_of", false)));
        h += blk(t("brain.performs"), chips(g.adjByType(d.id, "performs", false)));
        h += blk(t("brain.uses"), chips(g.adjByType(d.id, "uses", false)));
      } else if (d.kind === "team") {
        var owned = g.adjByType(d.id, "owns", false);
        var withAi = owned.filter(function (p) { return g.hasAI(p); }).length;
        h += blk(t("brain.aiCoverage"), meta(t("brain.processesWithAi"), withAi + " / " + owned.length));
        h += blk(t("brain.members"), chips(g.nodes.filter(function (n) { return n.kind === "role" && g.adj[d.id] && g.adj[d.id][n.id] && g.links.some(function (l) { return l.type === "member_of" && l.source.id === n.id && l.target.id === d.id; }); })));
        h += blk(t("brain.ownsProcesses"), chips(owned));
      } else if (d.kind === "process") {
        var a = d.assessment, ai = g.hasAI(d);
        h += blk(t("brain.assessment"),
          meta(t("wsn.colFrequency"), a.frequency ? esc(t("wsn.freq_" + a.frequency)) : '<span class="br-dash">—</span>') +
          meta(t("wsn.colCriticality"), lvlBadge(a.criticality)) +
          meta(t("wsn.colDocStatus"), docBadge(a.docStatus)) +
          meta(t("wsn.colAiPotential"), lvlBadge(a.aiPotential)) +
          meta(t("brain.aiInUse"), ai ? badge("ai-yes", t("brain.yes")) : badge("ai-no", t("brain.no"))));
        h += blk(t("brain.owners"), chips(g.adjByType(d.id, "owns", true)));
        h += blk(t("brain.performers"), chips(g.adjByType(d.id, "performs", true)));
        h += blk(t("brain.supportedBy"), chips(g.adjByType(d.id, "supported_by", false)));
        h += blk(t("brain.documentedBy"), chips(g.adjByType(d.id, "documents", true)));
        h += '<button class="br-open" data-open="' + esc(d.file) + '">' + esc(t("brain.openInViewer")) + ' →</button>';
      } else if (d.kind === "tool" || d.kind === "agent") {
        h += '<p class="br-prole">' + esc(d.category || "") + '</p>';
        var mh = meta(t("wsn.cost"), (d.cost ? d.cost.toLocaleString() + " €" : "—"));
        if (d.kind === "agent") { mh += meta(t("wsn.aiKind"), esc(t("wsn.aiKind_" + (d.aiKind || "copilot")))); mh += meta(t("wsn.aiPhase"), t("wsn.phaseN", { n: d.aiPhase || 1 })); }
        mh += meta(t("wsn.hosting"), d.hosting ? esc(t("wsn.hosting_" + d.hosting)) : '<span class="br-dash">—</span>');
        mh += meta(t("wsn.aiAct"), d.aiAct ? badge("act-" + d.aiAct, t("wsn.aiAct_" + d.aiAct)) : '<span class="br-dash">—</span>');
        mh += meta(t("wsn.pii"), d.pii ? badge("ai-no", t("brain.yes")) : t("brain.no"));
        h += blk(t("brain.facts"), mh);
        h += blk(t("brain.usedByPeople"), chips(g.adjByType(d.id, "uses", true)));
        h += blk(t("brain.supportsProcesses"), chips(g.adjByType(d.id, "supported_by", true)));
      } else if (d.kind === "knowledge") {
        h += '<p class="br-prole">' + esc(t("wsn.knowType_" + (d.type || "runbook"))) + '</p>';
        h += blk(t("brain.documents"), chips(g.adjByType(d.id, "documents", false)));
        if (d.url) h += blk(t("brain.link"), '<a class="br-plink" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.url) + '</a>');
      } else if (d.kind === "company") {
        h += blk(t("brain.teams"), chips(g.adjByType(d.id, "part_of", true)));
        h += blk(t("brain.aiCoverage"), meta(t("brain.processesWithAi"), ins.covered.length + " / " + ins.procCount) + meta(t("brain.toolSpend"), ins.totalCost.toLocaleString() + " € / " + t("brain.month")));
      }
      pbody.innerHTML = h;
      panel.classList.add("open");
      pbody.querySelectorAll(".br-chip[data-go]").forEach(function (el2) { el2.onclick = function () { selectNode(g.byId[el2.dataset.go]); }; });
      var ob = pbody.querySelector(".br-open"); if (ob) ob.onclick = function () { openInViewer(ob.dataset.open); };
    }
    function closePanel() { panel.classList.remove("open"); }

    function openInViewer(file) {
      if (opts.onOpenProcess) { opts.onOpenProcess(file); return; }
      try { localStorage.setItem("niju.brain.openProcess", file); } catch (e) {}
      var mod = NIJU.MODS ? NIJU.MODS.byId("hub") : null;
      if (mod && mod.enabled) location.href = NIJU.MODS.href(mod) + "#p=" + encodeURIComponent(file);
    }

    /* ---- search ---- */
    var search = host.querySelector("#brSearch"), results = host.querySelector("#brResults");
    search.placeholder = t("brain.searchPh");
    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      if (!q) { results.style.display = "none"; return; }
      var hits = g.nodes.filter(function (n) { return n.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
      if (!hits.length) { results.style.display = "none"; return; }
      results.innerHTML = hits.map(function (n) { return '<div class="br-res" data-go="' + n.id + '"><span class="br-dot" style="background:' + g.colorFor(n) + '"></span>' + esc(n.name) + '<span class="br-rk">' + esc(t(KIND_LABEL[n.kind])) + '</span></div>'; }).join("");
      results.style.display = "block";
      results.querySelectorAll(".br-res").forEach(function (r) { r.onclick = function () { var n = g.byId[r.dataset.go]; selectNode(n); focusNode(n); search.value = ""; results.style.display = "none"; }; });
    });
    function focusNode(n) {
      var s = 1.6;
      var tr = d3.zoomIdentity.translate(W / 2 - n.x * s, H / 2 - n.y * s).scale(s);
      svg.transition().duration(500).call(zoom.transform, tr);
    }

    /* ---- theme toggle (night / day) ---- */
    var savedTheme = "night";
    try { savedTheme = localStorage.getItem("niju.brain.theme") || "night"; } catch (e) {}
    function applyTheme(theme) {
      host.classList.toggle("night-mode", theme === "night");
      host.querySelectorAll(".brain-tt-btn").forEach(function (b) {
        b.classList.toggle("aktiv", b.dataset.theme === theme);
      });
      try { localStorage.setItem("niju.brain.theme", theme); } catch (e) {}
    }
    host.querySelectorAll(".brain-tt-btn").forEach(function (b) {
      b.textContent = t(b.dataset.theme === "night" ? "brain.themeNight" : "brain.themeDay");
      b.onclick = function () { applyTheme(b.dataset.theme); };
    });
    applyTheme(savedTheme);

    /* ---- legend (team filter) ---- */
    var legend = host.querySelector("#brLegend");
    var teamActive = {}; g.teams.forEach(function (tm) { teamActive[tm.id] = true; });
    function renderLegend() {
      legend.innerHTML = '<h4>' + esc(t("brain.teamsFilter")) + '</h4>';
      g.teams.forEach(function (tm) {
        var cnt = g.nodes.filter(function (n) { return g.teamOf[n.id] === tm.id; }).length;
        var row = document.createElement("div"); row.className = "br-leg" + (teamActive[tm.id] ? "" : " off");
        row.innerHTML = '<span class="br-sw" style="background:' + tm.color + '"></span>' + esc(tm.name || t("common.untitled")) + '<span class="br-ct">' + cnt + '</span>';
        row.onclick = function () { teamActive[tm.id] = !teamActive[tm.id]; row.classList.toggle("off", !teamActive[tm.id]); applyFilter(); };
        legend.appendChild(row);
      });
      if (!g.teams.length) legend.innerHTML += '<div class="br-leg-empty">' + esc(t("brain.noTeams")) + '</div>';
    }
    function applyFilter() {
      nodeSel.style("display", function (d) { if (d.kind === "company") return null; var tm = g.teamOf[d.id]; return (!tm || teamActive[tm]) ? null : "none"; });
      linkSel.style("display", function (l) { var ts = g.teamOf[l.source.id], tt = g.teamOf[l.target.id]; return (!ts || teamActive[ts]) && (!tt || teamActive[tt]) ? null : "none"; });
    }
    renderLegend();

    /* ---- coverage mode ---- */
    var coverOn = false;
    var coverBtn = host.querySelector("#brCover");
    coverBtn.textContent = t("brain.coverage");
    coverBtn.onclick = function () { coverOn = !coverOn; coverBtn.classList.toggle("on", coverOn); applyCover(); };
    function applyCover() {
      nodeSel.select(".br-shape").attr("fill", function (d) {
        if (!coverOn) {
          if (d.kind === "company" || d.kind === "tool") return "var(--paper)";
          return g.colorFor(d);
        }
        if (d.kind === "process") return g.hasAI(d) ? "#2e9e4f" : "#e74c3c";
        if (d.kind === "team") { var owned = g.adjByType(d.id, "owns", false); var any = owned.some(function (p) { return g.hasAI(p); }); return owned.length ? (any ? "#2e9e4f" : "#e74c3c") : "#9aa3b1"; }
        if (d.kind === "agent") return "#2e9e4f";
        if (d.kind === "company" || d.kind === "tool") return "var(--paper)";
        return g.colorFor(d);
      });
    }

    /* ---- insights ---- */
    var insBtn = host.querySelector("#brInsightsBtn"); insBtn.textContent = t("brain.insights");
    var insPanel = host.querySelector("#brInsights");
    insBtn.onclick = function (e) { e.stopPropagation(); insPanel.classList.toggle("open"); };
    insPanel.onclick = function (e) { e.stopPropagation(); };
    function listHtml(arr, empty) { return arr.length ? arr.map(function (n) { return '<div class="br-item" data-go="' + n.id + '">→ ' + esc(n.name) + '</div>'; }).join("") : '<div class="br-none">' + esc(empty) + '</div>'; }
    function renderInsights() {
      insPanel.innerHTML =
        '<div class="br-ins-header"><h3>' + esc(t("brain.insightsTitle")) + '</h3><button class="br-ins-close" aria-label="Close">✕</button></div>' +
        '<p class="br-sub">' + esc(t("brain.insightsSub")) + '</p>' +
        quadrant() +
        sec("#2e9e4f", t("brain.insQuickWins"), t("brain.insQuickWinsDesc"), ins.quickWins, t("brain.insNoneDocFirst")) +
        sec("#e74c3c", t("brain.insWhiteSpots"), t("brain.insWhiteSpotsDesc"), ins.whiteSpots, t("brain.insNoGaps")) +
        sec("#e0850f", t("brain.insBlocked"), t("brain.insBlockedDesc"), ins.blocked, t("brain.insNone")) +
        sec("#e1b12c", t("brain.insBus"), t("brain.insBusDesc"), ins.busFactor, t("brain.insNone")) +
        sec("#3479c9", t("brain.insShared"), t("brain.insSharedDesc"), ins.shared, t("brain.insNone")) +
        sec("#9b59b6", t("brain.insCompliance"), t("brain.insComplianceDesc"), ins.compliance, t("brain.insNone")) +
        '<div class="br-ins"><div class="br-it"><span class="br-ic" style="background:#94a3b8"></span>' + esc(t("brain.insSpend")) + '</div>' +
          '<p class="br-desc" style="margin:0">' + ins.totalCost.toLocaleString() + ' € / ' + esc(t("brain.month")) + ' · ' + (ins.toolCount + ins.agentCount) + ' ' + esc(t("brain.tools")) + ' · ' + esc(t("brain.coverageN", { p: ins.coverPct })) + '</p></div>';
      insPanel.querySelectorAll(".br-item").forEach(function (el2) { el2.onclick = function () { var n = g.byId[el2.dataset.go]; selectNode(n); focusNode(n); }; });
    }
    function sec(col, title, desc, arr, empty) {
      return '<div class="br-ins"><div class="br-it"><span class="br-ic" style="background:' + col + '"></span>' + esc(title) + ' <span class="br-cnt">' + arr.length + '</span></div>' +
        '<p class="br-desc">' + esc(desc) + '</p>' + listHtml(arr, empty) + '</div>';
    }
    function quadrant() {
      /* x = AI potential (low→high), y = documentation (low→high) */
      var procs = g.nodes.filter(function (n) { return n.kind === "process" && (n.assessment.aiPotential || n.assessment.docStatus); });
      var sz = 168, pad = 22;
      var dots = procs.map(function (p) {
        var x = pad + ((LEVEL_N[p.assessment.aiPotential] || 1) - 1) / 2 * (sz - 2 * pad);
        var y = sz - pad - ((DOC_N[p.assessment.docStatus] || 1) - 1) / 2 * (sz - 2 * pad);
        var col = g.hasAI(p) ? "#2e9e4f" : "#e74c3c";
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + col + '" opacity="0.85"><title>' + esc(p.name) + '</title></circle>';
      }).join("");
      return '<div class="br-quad"><svg viewBox="0 0 ' + sz + ' ' + sz + '">' +
        '<rect x="' + pad + '" y="' + pad + '" width="' + (sz - 2 * pad) + '" height="' + (sz - 2 * pad) + '" class="br-quad-bg"/>' +
        '<line x1="' + (sz / 2) + '" y1="' + pad + '" x2="' + (sz / 2) + '" y2="' + (sz - pad) + '" class="br-quad-ax"/>' +
        '<line x1="' + pad + '" y1="' + (sz / 2) + '" x2="' + (sz - pad) + '" y2="' + (sz / 2) + '" class="br-quad-ax"/>' +
        '<text x="' + (sz - pad) + '" y="' + (sz - 6) + '" class="br-quad-lab" text-anchor="end">' + esc(t("brain.axAiPot")) + ' →</text>' +
        '<text x="6" y="' + (pad + 2) + '" class="br-quad-lab">' + esc(t("brain.axDoc")) + ' ↑</text>' +
        dots + '</svg><p class="br-quad-cap">' + esc(t("brain.quadCap")) + '</p></div>';
    }
    renderInsights();
    insPanel.querySelector(".br-ins-close").onclick = function (e) { e.stopPropagation(); insPanel.classList.remove("open"); };

    /* ---- report show (new tab) ---- */
    var repBtn = host.querySelector("#brReport"); repBtn.textContent = t("brain.showReport");
    repBtn.onclick = function () {
      var html = buildReportHtml(g, ins, model.index);
      var win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
      else {
        var blob = new Blob([html], { type: "text/html" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      }
    };

    /* ---- stats + shape legend ---- */
    host.querySelector("#brStats").innerHTML =
      '<span class="br-stat-h">' + esc(g.byId["__company"].name) + '</span>' +
      '<span class="br-stat-s">' + g.teams.length + ' ' + esc(t("brain.teams")) + ' · ' + ins.procCount + ' ' + esc(t("brain.processes")) + ' · ' + (ins.toolCount + ins.agentCount) + ' ' + esc(t("brain.tools")) + ' · ' + esc(t("brain.coverageN", { p: ins.coverPct })) + '</span>';
    host.querySelector("#brShapes").innerHTML =
      '<span><i class="rsq"></i>' + esc(t("brain.kCompany")) + '</span>' +
      '<span><i class="circ"></i>' + esc(t("brain.kTeam")) + ' / ' + esc(t("brain.kRole")) + '</span>' +
      '<span><i class="dia"></i>' + esc(t("brain.kProcess")) + '</span>' +
      '<span><i class="sq"></i>' + esc(t("brain.kTool")) + '</span>' +
      '<span><i class="aibox">AI</i>' + esc(t("brain.kAgent")) + '</span>';

    /* ---- resize ---- */
    function resize() {
      W = host.clientWidth || W; H = host.clientHeight || H;
      svg.attr("viewBox", "0 0 " + W + " " + H);
      if (mode === "radial") { layoutRadial(); drawGuides(); ticked(); return; }
      sim.force("center", d3.forceCenter(W / 2, H / 2));
      g.byId["__company"].fx = W / 2; g.byId["__company"].fy = H / 2;
      sim.alpha(0.3).restart();
    }
    if (opts.bindResize !== false) {
      var _rt; window.addEventListener("resize", function () { clearTimeout(_rt); _rt = setTimeout(resize, 150); });
    }

    return { graph: g, insights: ins, resize: resize, focus: function (id) { var n = g.byId[id]; if (n) { selectNode(n); focusNode(n); } } };
  }

  /* ============================================================
     4) STATIC REPORT EXPORT (offline, Blob download — no popups)
     ============================================================ */
  function buildReportHtml(g, ins) {
    function ex(s) { return esc(s); }
    var company = g.byId["__company"].name;
    var teams = g.teams;
    var rootStyle = getComputedStyle(document.documentElement);
    function v(name, fb) { var x = rootStyle.getPropertyValue(name).trim(); return x || fb; }
    var col = { ink: v("--ink", "#16181d"), paper: v("--paper", "#fff"), accent: v("--akzent", "#3479c9"), rule: v("--rule", "#e3e6ea"), sidebar: v("--sidebar", "#16181d"), sans: v("--sans", "system-ui, sans-serif") };

    var CRIT = { high: "#e74c3c", med: "#e0850f", low: "#2e9e4f" };
    function critB(c) { return c ? '<span class="b" style="background:' + (CRIT[c] || "#888") + '">' + ex(t("wsn.level_" + c)) + '</span>' : ""; }
    function phaseB(p) { return p ? '<span class="ph">' + ex(t("wsn.phaseN", { n: p })) + '</span>' : ""; }

    var cards = teams.map(function (tm) {
      var members = g.nodes.filter(function (n) { return n.kind === "role" && g.teamOf[n.id] === tm.id; });
      var procs = g.nodes.filter(function (n) { return n.kind === "process" && g.teamOf[n.id] === tm.id; });
      var agents = g.nodes.filter(function (n) { return n.kind === "agent" && g.teamOf[n.id] === tm.id; }).sort(function (a, b) { return (a.aiPhase || 0) - (b.aiPhase || 0); });
      var tools = g.nodes.filter(function (n) { return n.kind === "tool" && g.teamOf[n.id] === tm.id; });
      function sec(l, h) { return h ? '<div class="sec"><div class="sl">' + ex(l) + '</div>' + h + '</div>' : ""; }
      var aR = agents.map(function (a) { return '<div class="row"><span>' + ex(a.name) + '</span>' + phaseB(a.aiPhase) + '</div>'; }).join("");
      var pR = procs.map(function (p) { return '<div class="row"><span>' + ex(p.name) + (g.hasAI(p) ? ' <span class="aidot">AI</span>' : '') + '</span>' + critB(p.assessment.criticality) + '</div>'; }).join("");
      var tR = tools.map(function (x) { return '<span class="chip">' + ex(x.name) + '</span>'; }).join("");
      var mR = members.map(function (m) { return '<span class="chip g">' + ex(m.name) + '</span>'; }).join("");
      return '<div class="card" style="--c:' + tm.color + '"><div class="bar"></div><div class="ch"><div class="cn">' + ex(tm.name) + '</div></div>' +
        sec(t("brain.kAgent"), aR) + sec(t("brain.processes"), pR) + sec(t("brain.kTool"), tR) + sec(t("brain.members"), mR) + '</div>';
    }).join("");

    var allTools = g.nodes.filter(function (n) { return n.kind === "tool" || n.kind === "agent"; });
    var inv = allTools.map(function (x) {
      var flags = [];
      if (x.pii) flags.push(t("wsn.pii"));
      if (x.hosting) flags.push(t("wsn.hosting_" + x.hosting));
      if (x.aiAct) flags.push(t("wsn.aiAct_" + x.aiAct));
      return '<div class="inv"><span class="in">' + ex(x.name) + (x.kind === "agent" ? ' ' + phaseB(x.aiPhase) : '') + '</span><span class="ic">' + ex(x.category || "") + '</span><span class="if">' + ex(flags.join(" · ")) + '</span><span class="ip">' + (x.cost ? x.cost.toLocaleString() + " €" : "–") + '</span></div>';
    }).join("");

    function insList(arr) { return arr.length ? arr.map(function (n) { return '<li>' + ex(n.name) + '</li>'; }).join("") : '<li class="none">—</li>'; }
    var stamp = new Date().toLocaleString();

    var CSS = ":root{--ink:" + col.ink + ";--paper:" + col.paper + ";--accent:" + col.accent + ";--rule:" + col.rule + ";--sidebar:" + col.sidebar + ";--sans:" + col.sans + "}" +
      "*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:var(--ink);font-family:var(--sans);padding:38px 30px 60px}.wrap{max-width:1380px;margin:0 auto}" +
      ".eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--accent);margin:0 0 6px}h1{font-size:30px;margin:0 0 4px}.sub{color:#5a6678;margin:0;font-size:13px}.stamp{color:#93a0b2;font-size:11px;margin:6px 0 0}" +
      ".kpis{display:flex;gap:14px;flex-wrap:wrap;margin:22px 0}.kpi{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:12px 18px;min-width:120px}.kpi .n{font-size:24px;font-weight:600}.kpi .l{font-size:11px;color:#5a6678;text-transform:uppercase;letter-spacing:.08em}" +
      ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}.card{background:#fff;border:1px solid var(--rule);border-radius:13px;overflow:hidden}.bar{height:5px;background:var(--c)}.ch{padding:13px 15px 9px}.cn{font-weight:600;font-size:15px}" +
      ".sec{padding:9px 15px;border-top:1px solid var(--rule)}.sl{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#93a0b2;margin-bottom:6px}.row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0;font-size:12.5px}" +
      ".chip{display:inline-block;font-size:11.5px;background:#f1f4f9;border:1px solid var(--rule);border-radius:7px;padding:3px 8px;margin:0 5px 5px 0}.chip.g{color:#5a6678;background:#fff}" +
      ".b,.ph{color:#fff;font-size:9.5px;border-radius:5px;padding:2px 7px;white-space:nowrap}.ph{background:#64748b}.aidot{background:#2e9e4f;color:#fff;font-size:9px;border-radius:4px;padding:1px 5px}" +
      ".panel{margin:34px 0 0;background:#fff;border:1px solid var(--rule);border-radius:13px;padding:20px 22px}.panel h2{font-size:18px;margin:0 0 14px}" +
      ".inv{display:grid;grid-template-columns:1.4fr 1fr 1.4fr auto;gap:12px;padding:8px 0;border-bottom:1px solid var(--rule);font-size:12.5px;align-items:center}.inv:last-child{border:none}.in{font-weight:600}.ic,.if{color:#5a6678;font-size:11.5px}.ip{text-align:right}" +
      ".tot{display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:2px solid var(--ink);font-weight:600}" +
      ".ins{display:grid;grid-template-columns:1fr 1fr;gap:18px}.ins h3{font-size:13px;margin:0 0 6px}.ins ul{margin:0;padding-left:18px;font-size:12.5px}.ins .none{list-style:none;margin-left:-18px;color:#93a0b2}" +
      ".foot{color:#93a0b2;font-size:10.5px;text-align:center;margin:30px 0 0}@media print{body{background:#fff;padding:0}}";

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + ex(t("brain.reportTitle")) + ' — ' + ex(company) + '</title><style>' + CSS + '</style></head><body><div class="wrap">' +
      '<p class="eyebrow">NIJU ICHI · ' + ex(t("brain.reportTitle")) + '</p><h1>' + ex(company) + '</h1>' +
      '<p class="sub">' + g.teams.length + ' ' + ex(t("brain.teams")) + ' · ' + ins.procCount + ' ' + ex(t("brain.processes")) + ' · ' + (ins.toolCount + ins.agentCount) + ' ' + ex(t("brain.tools")) + '</p>' +
      '<p class="stamp">' + ex(stamp) + '</p>' +
      '<div class="kpis">' +
        '<div class="kpi"><div class="n">' + ins.coverPct + '%</div><div class="l">' + ex(t("brain.kpiCoverage")) + '</div></div>' +
        '<div class="kpi"><div class="n">' + ins.whiteSpots.length + '</div><div class="l">' + ex(t("brain.insWhiteSpots")) + '</div></div>' +
        '<div class="kpi"><div class="n">' + ins.quickWins.length + '</div><div class="l">' + ex(t("brain.insQuickWins")) + '</div></div>' +
        '<div class="kpi"><div class="n">' + ins.totalCost.toLocaleString() + ' €</div><div class="l">' + ex(t("brain.kpiSpend")) + '</div></div></div>' +
      '<div class="grid">' + cards + '</div>' +
      '<div class="panel"><h2>' + ex(t("brain.invTitle")) + '</h2>' + (inv || '<p class="sub">—</p>') +
        '<div class="tot"><span>' + ex(t("brain.totalMonth")) + '</span><span>' + ins.totalCost.toLocaleString() + ' €</span></div></div>' +
      '<div class="panel"><h2>' + ex(t("brain.insightsTitle")) + '</h2><div class="ins">' +
        '<div><h3>' + ex(t("brain.insQuickWins")) + '</h3><ul>' + insList(ins.quickWins) + '</ul></div>' +
        '<div><h3>' + ex(t("brain.insWhiteSpots")) + '</h3><ul>' + insList(ins.whiteSpots) + '</ul></div>' +
        '<div><h3>' + ex(t("brain.insBlocked")) + '</h3><ul>' + insList(ins.blocked) + '</ul></div>' +
        '<div><h3>' + ex(t("brain.insCompliance")) + '</h3><ul>' + insList(ins.compliance) + '</ul></div>' +
        '</div></div>' +
      '<p class="foot">' + ex(t("brain.reportFoot")) + '</p></div></body></html>';
  }

  function exportReport(g, ins, index) {
    var html = buildReportHtml(g, ins);
    var blob = new Blob([html], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "niju-brain-report.html";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.NIJU.BRAIN = { build: build, insights: insights, render: render, exportReport: exportReport };
})();
