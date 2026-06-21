/* ============================================================
   NIJU ICHI — Strukturbaum (shared)
   Zeigt die Cluster/Ordner-Struktur (index.json) + Prozesse.
   editable=true (Management): Ordner/Maps anlegen/umbenennen/löschen,
   Prozesse verschieben/sortieren per DnD und Dropdown.
   editable=false (Hub/Viewer): nur Auswahl.

   NIJU.TREE.render(host, { index, prozesse, selected }, {
     editable, onSelect, onChange,
     onSelectMap(id|null),       // called when Master Map or map-cluster "Open" is clicked
     onNewProcessMap(name)       // called when "+ Process Map" button is clicked
   })
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.TREE) return;
  function t(k, v) { return window.NIJU.I18N ? window.NIJU.I18N.t(k, v) : k; }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(cls, txt, title, fn) {
    var b = el("button", "nt-btn " + (cls || ""), txt);
    if (title) b.title = title;
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  }

  /* ---- Modell-Mutationen ---- */
  function findCluster(idx, id) {
    var found = null;
    (function walk(list) { list.forEach(function (c) { if (c.id === id) found = c; else walk(c.cluster || []); }); })(idx.cluster || []);
    return found;
  }
  function removeProcess(idx, name) {
    function walk(list) { list.forEach(function (c) { var i = c.prozesse.indexOf(name); if (i >= 0) c.prozesse.splice(i, 1); walk(c.cluster || []); }); }
    walk(idx.cluster || []);
    var j = idx.lose.indexOf(name); if (j >= 0) idx.lose.splice(j, 1);
  }
  function addProcess(idx, targetId, name) {
    if (!targetId || targetId === "__lose__") { idx.lose.push(name); return; }
    var c = findCluster(idx, targetId); if (c) c.prozesse.push(name); else idx.lose.push(name);
  }
  function collectProcesses(cluster, out) { (cluster.prozesse || []).forEach(function (p) { out.push(p); }); (cluster.cluster || []).forEach(function (c) { collectProcesses(c, out); }); }
  function removeCluster(idx, id) {
    var moved = [];
    function walk(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) { collectProcesses(list[i], moved); list.splice(i, 1); return true; }
        if (walk(list[i].cluster || [])) return true;
      }
      return false;
    }
    walk(idx.cluster || []);
    moved.forEach(function (p) { idx.lose.push(p); });
  }
  function flatClusters(idx) {
    var out = [];
    (function walk(list, d) { list.forEach(function (c) { out.push({ id: c.id, name: c.name, depth: d, typ: c.typ || "folder" }); walk(c.cluster || [], d + 1); }); })(idx.cluster || [], 0);
    return out;
  }
  function move(arr, i, dir) { var j = i + dir; if (j < 0 || j >= arr.length) return; var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }

  function render(host, state, opts) {
    opts = opts || {};
    var idx = state.index, prozesse = state.prozesse || {}, selected = state.selected;
    var editable = !!opts.editable;
    var onSelect      = opts.onSelect      || function () {};
    var onChange      = opts.onChange      || function () {};
    var onSelectMap   = opts.onSelectMap   || null;
    var onNewProcessMap = opts.onNewProcessMap || null;
    function aenderung() { onChange(idx); }

    /* Drag state — shared across all proc items rendered in this call */
    var dragging = null;

    host.innerHTML = "";
    host.classList.add("niju-tree");

    /* ---- Toolbar (editable only) ---- */
    if (editable) {
      var head = el("div", "nt-toolbar");
      head.appendChild(btn("add", t("tree.newCluster"), "", function () {
        var name = prompt(t("tree.newCluster"), t("tree.newClusterName"));
        if (name == null) return;
        idx.cluster.push({ id: window.NIJU.LIB.newClusterId(), name: name || t("tree.newClusterName"), prozesse: [], cluster: [] });
        aenderung();
      }));
      if (onNewProcessMap) {
        head.appendChild(btn("add", t("tree.newProcessMap"), "", function () {
          var name = prompt(t("tree.newProcessMap"), t("tree.newProcessMapName"));
          if (name == null) return;
          onNewProcessMap(name || t("tree.newProcessMapName"));
        }));
      }
      host.appendChild(head);
    }

    /* ---- Master Process Map (always at top) ---- */
    var masterItem = el("div", "nt-master-map");
    var masterHead = el("div", "nt-master-map-head");
    masterHead.appendChild(el("span", "nt-map-ic", "⊞"));
    masterHead.appendChild(el("span", "nt-map-name", t("map.masterMap")));
    masterHead.addEventListener("click", function () { if (onSelectMap) onSelectMap(null); });
    masterItem.appendChild(masterHead);
    host.appendChild(masterItem);

    /* ---- Drop zone helper ---- */
    function makeDropZone(zone, targetId) {
      zone.addEventListener("dragover", function (e) {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        zone.classList.add("nt-drop-active");
      });
      zone.addEventListener("dragleave", function (e) {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove("nt-drop-active");
      });
      zone.addEventListener("drop", function (e) {
        e.preventDefault();
        zone.classList.remove("nt-drop-active");
        var nm = dragging; dragging = null;
        if (!nm) return;
        removeProcess(idx, nm);
        addProcess(idx, targetId, nm);
        aenderung();
      });
    }

    /* ---- Process item ---- */
    function procItem(name, list, i) {
      var p = prozesse[name];
      var item = el("div", "nt-proc" + (name === selected ? " sel" : ""));
      var label = el("span", "nt-proc-name", (p && p.titel) || name);
      if (p && p.fehler) label.classList.add("nt-fehler");
      item.appendChild(label);
      item.addEventListener("click", function () { onSelect(name); });

      if (editable) {
        item.setAttribute("draggable", "true");
        item.addEventListener("dragstart", function (e) {
          dragging = name;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", name);
          setTimeout(function () { item.classList.add("nt-drag"); }, 0);
        });
        item.addEventListener("dragend", function () {
          dragging = null;
          item.classList.remove("nt-drag");
        });

        var tools = el("span", "nt-tools");
        tools.appendChild(btn("", "↑", t("editor.moveUp"), function () { move(list, i, -1); aenderung(); }));
        tools.appendChild(btn("", "↓", t("editor.moveDown"), function () { move(list, i, 1); aenderung(); }));
        var sel = document.createElement("select"); sel.className = "nt-move";
        var optLose = document.createElement("option"); optLose.value = "__lose__"; optLose.textContent = t("tree.unclustered"); sel.appendChild(optLose);
        flatClusters(idx).forEach(function (c) {
          var o = document.createElement("option"); o.value = c.id;
          o.textContent = "— ".repeat(c.depth) + (c.typ === "map" ? "⊞ " : "") + (c.name || t("common.untitled"));
          sel.appendChild(o);
        });
        sel.value = "__keep__";
        var keep = document.createElement("option"); keep.value = "__keep__"; keep.textContent = t("tree.moveTo"); keep.disabled = true; keep.selected = true; sel.insertBefore(keep, sel.firstChild);
        sel.addEventListener("click", function (e) { e.stopPropagation(); });
        sel.addEventListener("change", function () { if (sel.value === "__keep__") return; removeProcess(idx, name); addProcess(idx, sel.value, name); aenderung(); });
        tools.appendChild(sel);
        item.appendChild(tools);
      }
      return item;
    }

    /* ---- Cluster node (folder or map) ---- */
    function clusterNode(c, list, i) {
      var isMap = c.typ === "map";
      var node = el("div", "nt-cluster" + (isMap ? " nt-map-node" : ""));
      var h = el("div", "nt-cluster-head");
      h.appendChild(el("span", "nt-folder-ic", isMap ? "⊞" : "▸"));
      h.appendChild(el("span", "nt-folder-name", c.name || t("common.untitled")));
      h.appendChild(el("span", "nt-count", String((c.prozesse || []).length)));
      var collapsed = false;
      var body = el("div", "nt-cluster-body");
      h.addEventListener("click", function () { collapsed = !collapsed; node.classList.toggle("zu", collapsed); });

      if (editable) {
        var tools = el("span", "nt-tools");
        tools.appendChild(btn("", "↑", t("editor.moveUp"), function () { move(list, i, -1); aenderung(); }));
        tools.appendChild(btn("", "↓", t("editor.moveDown"), function () { move(list, i, 1); aenderung(); }));
        tools.appendChild(btn("", "✎", t("tree.rename"), function () { var nn = prompt(t("tree.rename"), c.name || ""); if (nn != null) { c.name = nn; aenderung(); } }));
        if (isMap) {
          if (onSelectMap) {
            tools.appendChild(btn("", "⊞", t("tree.openMap"), function () { onSelectMap(c.id); }));
          }
          tools.appendChild(btn("del", "✕", t("tree.deleteMap"), function () {
            if (confirm(t("tree.confirmDeleteMap", { name: c.name || "" }))) { removeCluster(idx, c.id); aenderung(); }
          }));
        } else {
          tools.appendChild(btn("add", "+▸", t("tree.newSubfolder"), function () {
            var nn = prompt(t("tree.newSubfolder"), t("tree.newClusterName")); if (nn == null) return;
            c.cluster.push({ id: window.NIJU.LIB.newClusterId(), name: nn || t("tree.newClusterName"), prozesse: [], cluster: [] }); aenderung();
          }));
          tools.appendChild(btn("del", "✕", t("tree.deleteCluster"), function () {
            if (confirm(t("tree.confirmDeleteCluster", { name: c.name || "" }))) { removeCluster(idx, c.id); aenderung(); }
          }));
        }
        h.appendChild(tools);
      } else if (!editable && isMap && onSelectMap) {
        /* Read-only: clicking map header navigates to that map */
        h.removeEventListener("click", h._toggle);
        h.addEventListener("click", function () { onSelectMap(c.id); });
      }

      node.appendChild(h);
      makeDropZone(body, c.id);
      (c.cluster || []).forEach(function (cc, ci) { body.appendChild(clusterNode(cc, c.cluster, ci)); });
      if (!(c.prozesse || []).length && !(c.cluster || []).length) body.appendChild(el("div", "nt-empty", t("tree.empty")));
      (c.prozesse || []).forEach(function (nm, pi) { body.appendChild(procItem(nm, c.prozesse, pi)); });
      node.appendChild(body);
      return node;
    }

    (idx.cluster || []).forEach(function (c, i) { host.appendChild(clusterNode(c, idx.cluster, i)); });

    /* ---- Unsorted ---- */
    var lose = el("div", "nt-cluster nt-lose");
    var lh = el("div", "nt-cluster-head");
    lh.appendChild(el("span", "nt-folder-ic", "▸"));
    lh.appendChild(el("span", "nt-folder-name", t("tree.unclustered")));
    lh.appendChild(el("span", "nt-count", String((idx.lose || []).length)));
    lh.addEventListener("click", function () { lose.classList.toggle("zu"); });
    lose.appendChild(lh);
    var lbody = el("div", "nt-cluster-body");
    makeDropZone(lbody, "__lose__");
    if (!(idx.lose || []).length) lbody.appendChild(el("div", "nt-empty", t("tree.empty")));
    (idx.lose || []).forEach(function (nm, pi) { lbody.appendChild(procItem(nm, idx.lose, pi)); });
    lose.appendChild(lbody);
    host.appendChild(lose);
  }

  window.NIJU.TREE = { render: render };
})();
