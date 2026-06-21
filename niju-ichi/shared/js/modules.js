/* ============================================================
   NIJU ICHI — Modul-Registry (shared)
   Hier steuert der Verteiler, welche Module vorhanden/erlaubt sind.
   Will man jemandem nur EIN Modul geben: die übrigen auf enabled:false
   setzen (und den jeweiligen Ordner weglassen) — dann sind sie im
   Umschalter und im Launcher ausgegraut.

   "dir" ist der Ordnername unter niju-ichi/modules/.
   Pfade werden je Seite relativ berechnet (NIJU.MODS.href).
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};

  var LIST = [
    { id: "builder",    dir: "process-builder",    key: "nav.builder",    enabled: true },
    { id: "management", dir: "process-manager",    key: "nav.management", enabled: true },
    { id: "hub",        dir: "process-viewer",     key: "nav.hub",        enabled: true },
    { id: "brain",      dir: "process-brain",      key: "nav.brain",      enabled: true }
  ];

  /* base: "module"  -> Aufruf aus einem Modul (../<dir>/index.html)
     base: "root"    -> Aufruf vom Launcher (modules/<dir>/index.html) */
  function href(mod, base) {
    if (base === "root") return "modules/" + mod.dir + "/index.html";
    return "../" + mod.dir + "/index.html";
  }

  window.NIJU.MODS = {
    list: function () { return LIST.slice(); },
    byId: function (id) { return LIST.filter(function (m) { return m.id === id; })[0] || null; },
    href: href
  };
})();
