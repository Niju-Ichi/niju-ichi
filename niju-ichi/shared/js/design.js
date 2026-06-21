/* ============================================================
   NIJU ICHI — Design-Engine (shared)
   Offline-tauglich: klassisches Script, keine ES-Module, kein fetch.
   Eingebaute Designs registrieren sich über design/<id>.js.
   Importierte Designs liegen in localStorage (über die Configuration).

   Look = CSS-Variablen (Farben/Schriften) + Body-Klassen (Optionen).
   Ein Design-Wechsel setzt nur ~25 Variablen auf <html> und einige
   Klassen auf <body> — kein DOM-Neuaufbau, O(1) unabhängig von der
   Prozessgröße. Inline-Style auf :root schlägt jede Stylesheet-Regel
   (base.css UND das Builder-Inline-CSS), daher wirkt EIN Mechanismus
   überall (Builder, Hub, Management-Vorschau, Druck).

   Zwei-Schichten-Modell:
     Basis-Design (aktives, gewähltes Look-File)  ⊕  Overrides (Tweaks)
     = effektives Design. „Als Datei sichern" exportiert das Effektive.

   API (window.NIJU.DESIGN):
     register(design)             eingebautes Design registrieren
     list()                       [{id,name,builtin}]
     get(id)                      Design-Objekt (mit Default aufgefüllt)
     activeId() / setActive(id)   aktives Basis-Design (persistiert)
     overrides() / setOverride(path,val) / clearOverrides()
     effektiv()                   vollständiges, in sich geschlossenes Design
     apply(design)                CSS-Variablen + Body-Klassen setzen
     applyEffective()             effektives Design anwenden
     applyForProcess(daten)       daten.design gewinnt, sonst effektiv
     addImport(design) / removeImport(id)
     exportEffektiv(name,id)      Objekt zum Download (Schema niju.design)
     onChange(fn)                 Callback bei Design-/Override-Änderung
     init()                       gespeicherten Stand laden + anwenden
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.DESIGN) return;

  var SCHEMA = 1;
  var DEFAULT_ID = "swiss-modular";

  var LS_ACTIVE    = "niju.design.active";
  var LS_OVERRIDES = "niju.design.overrides";
  var LS_IMPORTS   = "niju.design.imports";   /* id -> design */

  /* Token-Name -> CSS-Variable (eine Stelle: entkoppelt Tokens von Var-Namen) */
  var COLOR_VARS = {
    ink: "--ink", paper: "--paper", akzent: "--akzent",
    muted: "--muted", mutedDark: "--muted-dark", body: "--body",
    rule: "--rule", ruleMid: "--rule-mid", ruleStrong: "--rule-strong",
    sidebar: "--sidebar", zebra: "--zebra", numSoft: "--num-soft",
    verbinder: "--verbinder"
  };
  var RACI_LETTERS = ["R", "A", "C", "I"];

  /* Vollständiges Standard-Design (= heutiger Look). Dient als Auffüllung,
     damit auch teilweise/importierte Designs lückenlos rendern. */
  var DEFAULT = {
    "niju.design": SCHEMA, id: DEFAULT_ID, name: "Swiss Modular", builtin: true,
    tokens: {
      color: {
        ink: "#16181d", paper: "#ffffff", akzent: "#3479c9",
        muted: "#8b919b", mutedDark: "#9aa3b1", body: "#3a3f47",
        rule: "#e3e6ea", ruleMid: "#c7ccd3", ruleStrong: "#16181d",
        sidebar: "#16181d", zebra: "#f1f3f5", numSoft: "#c4c9d0",
        verbinder: "#b3bbc5"
      },
      raci: {
        R: { bg: "#e0850f", text: "#ffffff", label: "R" },
        A: { bg: "#2e9e4f", text: "#ffffff", label: "A" },
        C: { bg: "#3479c9", text: "#ffffff", label: "C" },
        I: { bg: "#1f3a66", text: "#ffffff", label: "I" }
      },
      font: {
        sans: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif',
        mono: 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
      }
    },
    options: { connectors: true, badgeShape: "square", zebra: true }
  };

  var DESIGNS = {};            /* id -> Design (eingebaut + importiert) */
  var current = DEFAULT_ID;    /* aktive Basis-Design-id */
  var ov = {};                 /* Overrides (sparse) */
  var listeners = [];
  /* Im Badge angezeigte Texte je RACI-Buchstabe (vom aktiven/Prozess-Design).
     Wird in apply() aktualisiert und beim Rendern der Badges gelesen. */
  var currentLabels = { R: "R", A: "A", C: "C", I: "I" };
  /* Display-Text für einen RACI-Buchstaben (Fallback = Buchstabe selbst). */
  function labelFor(L) { return (currentLabels && currentLabels[L]) || L; }

  /* ---------- kleine Helfer ---------- */
  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function deepMerge(base, over) {
    var out = clone(base);
    (function merge(t, s) {
      Object.keys(s || {}).forEach(function (k) {
        if (isObj(s[k]) && isObj(t[k])) merge(t[k], s[k]);
        else t[k] = isObj(s[k]) ? clone(s[k]) : s[k];
      });
    })(out, over);
    return out;
  }
  function deepSet(obj, path, val) {
    var ks = path.split("."), cur = obj;
    for (var i = 0; i < ks.length - 1; i++) { if (!isObj(cur[ks[i]])) cur[ks[i]] = {}; cur = cur[ks[i]]; }
    cur[ks[ks.length - 1]] = val;
  }
  function read(key) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  /* ---------- Registry ---------- */
  function register(design) {
    if (!design || !design.id) return;
    var full = deepMerge(DEFAULT, design);
    full.id = design.id;
    full.name = design.name || design.id;
    full.builtin = (design.builtin !== false);
    DESIGNS[design.id] = full;
  }
  function list() {
    return Object.keys(DESIGNS).map(function (id) {
      return { id: id, name: DESIGNS[id].name || id, builtin: !!DESIGNS[id].builtin };
    });
  }
  function get(id) { return DESIGNS[id] ? clone(DESIGNS[id]) : clone(DESIGN_OR_DEFAULT(id)); }
  function DESIGN_OR_DEFAULT(id) { return DESIGNS[id] || DESIGNS[DEFAULT_ID] || DEFAULT; }

  /* ---------- aktives Design + Overrides ---------- */
  function activeId() { return current; }
  function overrides() { return clone(ov); }

  function effektiv() {
    var basis = DESIGN_OR_DEFAULT(current);
    var eff = deepMerge(basis, ov);
    eff["niju.design"] = SCHEMA;
    eff.id = basis.id;
    eff.name = basis.name;
    return eff;
  }

  function fire() { var e = effektiv(); listeners.forEach(function (fn) { try { fn(e); } catch (err) {} }); }

  function setActive(id) {
    if (!DESIGNS[id]) return;
    current = id;
    write(LS_ACTIVE, id);
    applyEffective();
    fire();
  }
  function setOverride(path, val) {
    deepSet(ov, path, val);
    write(LS_OVERRIDES, ov);
    applyEffective();
    fire();
  }
  function clearOverrides() {
    ov = {};
    write(LS_OVERRIDES, ov);
    applyEffective();
    fire();
  }

  /* ---------- Anwenden (CSS-Variablen + Body-Klassen) ---------- */
  function apply(design) {
    var d = deepMerge(DEFAULT, design || {});
    var root = document.documentElement, s = root.style;
    var col = d.tokens.color || {};
    Object.keys(COLOR_VARS).forEach(function (k) { if (col[k] != null) s.setProperty(COLOR_VARS[k], col[k]); });
    var raci = d.tokens.raci || {};
    RACI_LETTERS.forEach(function (L) {
      var r = raci[L]; if (!r) return;
      if (r.bg != null) s.setProperty("--raci-" + L, r.bg);
      if (r.text != null) s.setProperty("--raci-" + L + "-text", r.text);
      currentLabels[L] = (r.label != null && String(r.label).length) ? String(r.label) : L;
    });
    if (d.tokens.font) {
      if (d.tokens.font.sans) s.setProperty("--sans", d.tokens.font.sans);
      if (d.tokens.font.mono) s.setProperty("--mono", d.tokens.font.mono);
    }
    var o = d.options || {};
    var b = document.body;
    if (b) {
      b.classList.toggle("opt-no-connectors", o.connectors === false);
      b.classList.toggle("opt-badge-round", o.badgeShape === "round");
      b.classList.toggle("opt-no-zebra", o.zebra === false);
    }
  }
  function applyEffective() { apply(effektiv()); }
  function applyForProcess(daten) {
    if (daten && daten.design && daten.design.tokens) apply(daten.design);
    else applyEffective();
  }

  /* ---------- Import / Export ---------- */
  function addImport(design) {
    if (!design || !design.id) return;
    design.builtin = false;
    register(design);
    var store = read(LS_IMPORTS) || {};
    store[design.id] = clone(DESIGNS[design.id]);
    write(LS_IMPORTS, store);
  }
  function removeImport(id) {
    if (DESIGNS[id] && DESIGNS[id].builtin) return;
    delete DESIGNS[id];
    var store = read(LS_IMPORTS) || {};
    delete store[id];
    write(LS_IMPORTS, store);
    if (current === id) setActive(DEFAULT_ID);
  }
  function loadImports() {
    var store = read(LS_IMPORTS);
    if (!store) return;
    Object.keys(store).forEach(function (id) { register(store[id]); });
  }
  function exportEffektiv(name, id) {
    var e = effektiv();
    var out = { "niju.design": SCHEMA, id: (id || "my-design"), name: (name || "My design"),
                tokens: e.tokens, options: e.options };
    return out;
  }

  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  function init() {
    register(DEFAULT);            /* Fallback immer vorhanden */
    loadImports();
    var a = read(LS_ACTIVE);
    if (a && DESIGNS[a]) current = a;
    var o = read(LS_OVERRIDES);
    if (isObj(o)) ov = o;
    applyEffective();
    fire();
  }

  window.NIJU.DESIGN = {
    register: register, list: list, get: get,
    activeId: activeId, setActive: setActive,
    overrides: overrides, setOverride: setOverride, clearOverrides: clearOverrides,
    effektiv: effektiv, apply: apply, applyEffective: applyEffective, applyForProcess: applyForProcess,
    labelFor: labelFor,
    addImport: addImport, removeImport: removeImport, exportEffektiv: exportEffektiv,
    onChange: onChange, init: init,
    SCHEMA: SCHEMA, DEFAULT_ID: DEFAULT_ID, _default: DEFAULT
  };
})();
