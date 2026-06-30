/* ============================================================
   NIJU ICHI — Prozess-Datenmodell-Helfer (shared, file://-tauglich)
   -----------------------------------------------------------------
   Phase A2 — STABILE ROLLEN-IDs:
   Rollen werden nicht mehr über ihren Namen referenziert, sondern über
   eine stabile id. Datenmodell:
     rollen: [ { id: "r_<uniq>", name: "<Anzeigename>" } ]
     raci:   { "<schritt-id>": { "<rollen-id>": ["R","A",…] } }   // key = id, NICHT Name
   Umbenennen einer Rolle ändert nur ihren `name` — die id (und damit alle
   RACI-Einträge) bleibt stabil. Das war vorher fehleranfällig (Name = Schlüssel →
   jede Umbenennung musste alle raci-Keys mitziehen).

   `migriere(daten)` wandelt ALTE Dateien (rollen=[name], raci nach Name) idempotent
   ins neue Format. Nur der Builder mutiert (er bearbeitet/speichert); read-only-
   Module (Viewer/Brain/Org) lesen über die toleranten Helfer `rolleName`/`rolleId`,
   die BEIDE Formate verstehen — daher müssen sie nicht migrieren.

   Hinweis: Die Bindung Organisation<->Prozess läuft weiterhin über den ANZEIGE-
   NAMEN (Namens-Gleichheit). Firmenweit stabile Registry-IDs sind ein separater
   Schritt (Konzept „kanonisches Register"), der auf diesem id-Fundament aufsetzt.
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.PROZESS) return;

  function neueRollenId() {
    return "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  /* Toleranter Reader: Anzeigename einer Rolle (altes String- ODER neues {id,name}-Format). */
  function rolleName(r) {
    if (r && typeof r === "object") return String(r.name != null ? r.name : "");
    return String(r != null ? r : "");
  }
  /* Toleranter Reader: RACI-Schlüssel (id) einer Rolle. Im alten Format IST der Name der
     Schlüssel → dann ist der Name die „id" (raci war namensbasiert), passt also weiterhin. */
  function rolleId(r) {
    if (r && typeof r === "object" && r.id) return String(r.id);
    return String(r != null ? r : "");
  }

  /* In-place-Migration auf das neue Format. Idempotent + abwärtskompatibel.
     - rollen[] -> [{id,name}] (vorhandene ids bleiben erhalten, neue werden vergeben)
     - raci-Schlüssel von Name -> id (nur wo nötig; bereits id-basierte Zeilen bleiben unberührt) */
  function migriere(daten) {
    if (!daten || !Array.isArray(daten.rollen)) return daten;
    var nameToId = {}, idSet = {};
    daten.rollen = daten.rollen.map(function (r) {
      if (r && typeof r === "object" && r.id) {           /* schon neues Format → Objekt behalten */
        var id0 = String(r.id), name0 = (r.name != null ? String(r.name) : "");
        idSet[id0] = 1;
        if (name0 && !(name0 in nameToId)) nameToId[name0] = id0;
        return r;
      }
      var name = rolleName(r), id = neueRollenId();        /* altes Format (String) → id vergeben */
      idSet[id] = 1;
      if (name && !(name in nameToId)) nameToId[name] = id;
      return { id: id, name: name };
    });
    if (daten.raci && typeof daten.raci === "object") {
      Object.keys(daten.raci).forEach(function (sid) {
        var zeile = daten.raci[sid];
        if (!zeile || typeof zeile !== "object") return;
        var keys = Object.keys(zeile);
        if (!keys.some(function (k) { return !idSet[k]; })) return;   /* schon id-basiert → nichts tun */
        var neu = {};
        keys.forEach(function (k) {
          var id = idSet[k] ? k : (nameToId[k] || k);                 /* Name -> id; unbekannt bleibt */
          neu[id] = neu[id] ? neu[id].concat(zeile[k]) : zeile[k];    /* Kollision (Doppelname) mergen */
        });
        daten.raci[sid] = neu;
      });
    }
    return daten;
  }

  window.NIJU.PROZESS = {
    neueRollenId: neueRollenId,
    rolleName: rolleName,
    rolleId: rolleId,
    migriere: migriere
  };

  /* ============================================================
     Phase 10 — Inline rich text for process descriptions.
     SINGLE source of truth for BOTH render pipelines (shared/js/viewer.js and
     shared/js/builder/core.js both delegate their richHTML to NIJU.RICH.html),
     so the Builder live preview, Viewer, Manager preview and PDF stay identical.
     Features:
       - HTML escaping
       - function references  {Display}  or  {Display¦id}  (org-node id optional),
         rendered as a bold <span class="ref-fn" data-ref-id="…"> showing only the name
       - **bold**
       - line breaks: single \n -> <br>, blank line -> paragraph gap
     The separator ¦ (U+00A6, also accepts |) is never typed by the user — the editor
     inserts the full token on selection; display names get sanitized of it on save.
     ============================================================ */
  if (!window.NIJU.RICH) (function () {
    var SEP = "¦";                                   /* broken bar ¦ */
    /* Reference token: {Display} or {Display<sep>id}. Token content has no { } . */
    var REF_RE = /\{([^{}|¦]+?)(?:[|¦]([^{}]+?))?\}/g;

    function escapeHtml(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    /* Strip separator/brace chars so a display name can never break the token. */
    function sanitizeName(n) { return String(n == null ? "" : n).replace(/[|¦{}]/g, "").trim(); }
    /* Build a reference token; id optional. */
    function token(name, id) {
      var nm = sanitizeName(name);
      id = (id == null ? "" : String(id)).trim();
      return id ? ("{" + nm + SEP + id + "}") : ("{" + nm + "}");
    }
    /* Collect references from RAW (un-escaped) freetext -> [{id,name}] (deduped). */
    function refs(s) {
      var out = [], seen = {};
      String(s == null ? "" : s).replace(REF_RE, function (_, name, id) {
        var nm = (name || "").trim(), rid = (id || "").trim(), key = rid || nm;
        if (nm && !seen[key]) { seen[key] = 1; out.push({ id: rid, name: nm }); }
        return _;
      });
      return out;
    }
    /* Inline HTML: escape -> references -> bold -> line breaks. Used by BOTH pipelines. */
    function html(s) {
      var out = escapeHtml(s);
      out = out.replace(REF_RE, function (_, name, id) {
        return '<span class="ref-fn"' + (id ? ' data-ref-id="' + id.trim() + '"' : "") +
          ">" + name.trim() + "</span>";
      });
      out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      out = out.replace(/\r\n?/g, "\n")
        .replace(/\n{2,}/g, '<br><span class="abs-gap"></span>')
        .replace(/\n/g, "<br>");
      return out;
    }

    window.NIJU.RICH = { SEP: SEP, html: html, refs: refs, token: token, sanitizeName: sanitizeName };
  })();
})();
