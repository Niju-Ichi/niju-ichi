/* ============================================================
   NIJU ICHI — Prozess-Library (shared)
   Liest ein per <input webkitdirectory> gewähltes Verzeichnis ein,
   verwaltet das index.json-Strukturmodell (Cluster/Ordner → Prozesse)
   und serialisiert es für den Download. Offline, kein fetch.

   Modell index.json:
   { version, titel, cluster: [ {id,name,prozesse:[datei],cluster:[…]} ], lose: [datei] }

   NIJU.LIB.fromFileList(fileList) -> Promise<{files,prozesse,index,dirName}>
   NIJU.LIB.normalize(index, names) -> bereinigtes Modell (lose ergänzt, fehlende raus)
   NIJU.LIB.referenced(index) -> [dateinamen]
   NIJU.LIB.serialize(index) -> JSON-Text
   NIJU.LIB.newClusterId() -> string
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.LIB) return;

  function readText(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function (e) { res(e.target.result); };
      r.onerror = function () { rej(new Error("read error")); };
      r.readAsText(file, "utf-8");
    });
  }

  function fromFileList(fileList) {
    var arr = Array.from(fileList || []).filter(function (f) { return /\.json$/i.test(f.name); });
    var dirName = "";
    if (arr[0] && arr[0].webkitRelativePath) dirName = arr[0].webkitRelativePath.split("/")[0];
    return Promise.all(arr.map(function (f) {
      return readText(f).then(function (txt) { return { f: f, txt: txt }; }, function () { return { f: f, txt: null }; });
    })).then(function (results) {
      var files = {}, prozesse = {}, index = null;
      results.forEach(function (r) {
        var base = r.f.name;
        if (base.toLowerCase() === "index.json") { try { index = JSON.parse(r.txt); } catch (e) {} return; }
        files[base] = r.f;
        var data = null;
        try { data = JSON.parse(r.txt); } catch (e) {}
        prozesse[base] = {
          name: base,
          titel: (data && data.meta && data.meta.titel) ? data.meta.titel : base,
          meta: (data && data.meta) ? data.meta : {},
          data: data,
          fehler: !data
        };
      });
      return { files: files, prozesse: prozesse, index: index, dirName: dirName };
    });
  }

  function newClusterId() { return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function normalize(index, names) {
    var idx = index ? JSON.parse(JSON.stringify(index)) : null;
    if (!idx || typeof idx !== "object") idx = { version: 1, titel: "Process Library", cluster: [], lose: [] };
    if (typeof idx.version !== "number") idx.version = 1;
    if (typeof idx.titel !== "string") idx.titel = "Process Library";
    if (!Array.isArray(idx.cluster)) idx.cluster = [];
    if (!Array.isArray(idx.lose)) idx.lose = [];
    var seen = {};
    function walk(list) {
      list.forEach(function (c) {
        if (!c.id) c.id = newClusterId();
        if (typeof c.name !== "string") c.name = "";
        if (!Array.isArray(c.prozesse)) c.prozesse = [];
        if (!Array.isArray(c.cluster)) c.cluster = [];
        if (c.typ === "map" && (!c.landkarte || typeof c.landkarte !== "object")) c.landkarte = {};
        c.prozesse = c.prozesse.filter(function (p) { if (names.indexOf(p) < 0 || seen[p]) return false; seen[p] = 1; return true; });
        walk(c.cluster);
      });
    }
    walk(idx.cluster);
    idx.lose = idx.lose.filter(function (p) { if (names.indexOf(p) < 0 || seen[p]) return false; seen[p] = 1; return true; });
    names.forEach(function (nm) { if (!seen[nm]) idx.lose.push(nm); });
    return idx;
  }

  function referenced(index) {
    var out = [];
    function walk(list) { list.forEach(function (c) { (c.prozesse || []).forEach(function (p) { out.push(p); }); walk(c.cluster || []); }); }
    if (index) { walk(index.cluster || []); (index.lose || []).forEach(function (p) { out.push(p); }); }
    return out;
  }

  function serialize(index) { return JSON.stringify(index, null, 2) + "\n"; }

  window.NIJU.LIB = {
    fromFileList: fromFileList,
    normalize: normalize,
    referenced: referenced,
    serialize: serialize,
    newClusterId: newClusterId
  };
})();
