/* ============================================================
   NIJU ICHI — i18n engine (shared)
   Offline-tauglich: klassisches Script, keine ES-Module, kein fetch.
   Eingebaute Sprachen registrieren sich über lang/<code>.js.
   Importierte Sprachen liegen in localStorage (über die Configuration).

   API (window.NIJU.I18N):
     register(code, dict, meta)   Wörterbuch (teilweise) hinzufügen
     registerMeta(code, meta)     Anzeigename / Flags setzen
     t(key, vars)                 Übersetzung; {var}-Platzhalter
     apply(root)                  data-i18n* im DOM einsetzen
     setLang(code)                Sprache wechseln (+ persistieren)
     get()                        aktiver Sprachcode
     langs()                      [{code,name,builtin}]
     onChange(fn)                 Callback bei Sprachwechsel
     addImport(code,name,dict)    importierte Sprache speichern
     removeImport(code)           importierte Sprache löschen
     init()                       gespeicherte Sprache laden + apply()
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.I18N) return;

  var DICTS = {};   /* code -> { key: text } */
  var METAS = {};   /* code -> { name, builtin } */
  var current = "en";
  var listeners = [];

  var LS_LANG = "niju.lang";
  var LS_IMPORTS = "niju.langImports";   /* code -> { name, dict } */

  function register(code, dict, meta) {
    DICTS[code] = Object.assign({}, DICTS[code] || {}, dict || {});
    METAS[code] = Object.assign({ name: code, builtin: false }, METAS[code] || {}, meta || {});
  }
  function registerMeta(code, meta) {
    METAS[code] = Object.assign({ name: code, builtin: false }, METAS[code] || {}, meta || {});
  }

  function t(key, vars) {
    var d = DICTS[current] || {};
    var s = (key in d) ? d[key]
          : (DICTS.en && (key in DICTS.en)) ? DICTS.en[key]
          : key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (_, k) {
        return (k in vars) ? vars[k] : "{" + k + "}";
      });
    }
    return s;
  }

  function langs() {
    return Object.keys(METAS).map(function (c) {
      return { code: c, name: (METAS[c] && METAS[c].name) || c, builtin: !!(METAS[c] && METAS[c].builtin) };
    });
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(function (e) { e.textContent = t(e.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-ph]").forEach(function (e) { e.setAttribute("placeholder", t(e.getAttribute("data-i18n-ph"))); });
    root.querySelectorAll("[data-i18n-title]").forEach(function (e) { e.setAttribute("title", t(e.getAttribute("data-i18n-title"))); });
    root.querySelectorAll("[data-i18n-aria]").forEach(function (e) { e.setAttribute("aria-label", t(e.getAttribute("data-i18n-aria"))); });
    document.documentElement.setAttribute("lang", current);
  }

  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  function setLang(code) {
    if (!DICTS[code]) return;
    current = code;
    try { localStorage.setItem(LS_LANG, code); } catch (e) {}
    apply(document);
    listeners.forEach(function (fn) { try { fn(code); } catch (e) {} });
  }

  function get() { return current; }

  function loadImports() {
    try {
      var raw = localStorage.getItem(LS_IMPORTS);
      if (!raw) return;
      var obj = JSON.parse(raw);
      Object.keys(obj).forEach(function (code) {
        register(code, obj[code].dict, { name: obj[code].name, builtin: false });
      });
    } catch (e) {}
  }

  function addImport(code, name, dict) {
    register(code, dict, { name: name, builtin: false });
    try {
      var raw = localStorage.getItem(LS_IMPORTS);
      var obj = raw ? JSON.parse(raw) : {};
      obj[code] = { name: name, dict: dict };
      localStorage.setItem(LS_IMPORTS, JSON.stringify(obj));
    } catch (e) {}
  }

  function removeImport(code) {
    delete DICTS[code];
    delete METAS[code];
    try {
      var raw = localStorage.getItem(LS_IMPORTS);
      var obj = raw ? JSON.parse(raw) : {};
      delete obj[code];
      localStorage.setItem(LS_IMPORTS, JSON.stringify(obj));
    } catch (e) {}
    if (current === code) setLang("en");
  }

  function init() {
    loadImports();
    var saved = null;
    try { saved = localStorage.getItem(LS_LANG); } catch (e) {}
    if (saved && DICTS[saved]) current = saved;
    apply(document);
    listeners.forEach(function (fn) { try { fn(current); } catch (e) {} });
  }

  window.NIJU.I18N = {
    register: register, registerMeta: registerMeta,
    t: t, apply: apply, setLang: setLang, get: get, langs: langs,
    onChange: onChange, addImport: addImport, removeImport: removeImport,
    init: init, _dicts: DICTS
  };
})();
