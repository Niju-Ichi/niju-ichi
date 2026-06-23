/* ============================================================
   NIJU ICHI — Org CSV-Import (shared)
   Isolierter Parser + Preview-UI für den HR-CSV-Import.
   Exponiert: NIJU.ORGIMPORT.parse(text) -> {knoten, stats, warnungen}
              NIJU.ORGIMPORT.template() -> string
              NIJU.ORGIMPORT.renderPreview(container, parsed, {onReplace, onMerge, onCancel})
   Kein fetch, kein ES-Module, kein CDN.  Offline auf file://.
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.ORGIMPORT) return;

  function t(k, v) { return (window.NIJU && NIJU.I18N) ? NIJU.I18N.t(k, v) : k; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* ---- CSV-Parser (robust für deutsches Excel: ;-Trenner + BOM + Anführungszeichen) ---- */
  function parseCSV(text) {
    /* BOM entfernen */
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    /* Delimiter automatisch erkennen: zähle in der Kopfzeile ; vs , vs Tab */
    var firstNL = text.indexOf("\n");
    var firstLine = firstNL >= 0 ? text.slice(0, firstNL) : text;
    var cntSemi = 0, cntComma = 0, cntTab = 0;
    for (var ci = 0; ci < firstLine.length; ci++) {
      if (firstLine[ci] === ";") cntSemi++;
      else if (firstLine[ci] === ",") cntComma++;
      else if (firstLine[ci] === "\t") cntTab++;
    }
    var delim = ";";
    if (cntComma > cntSemi && cntComma >= cntTab) delim = ",";
    else if (cntTab > cntSemi && cntTab > cntComma) delim = "\t";

    var rows = [], curRow = [], curField = "", inQuote = false;
    var pos = 0, len = text.length;

    while (pos <= len) {
      var ch = pos < len ? text[pos] : undefined;
      if (inQuote) {
        if (ch === undefined) {
          /* Datei endet innerhalb von Anführungszeichen */
          curRow.push(curField); rows.push(curRow); break;
        } else if (ch === '"') {
          if (text[pos + 1] === '"') { curField += '"'; pos += 2; } /* verdoppeltes "" */
          else { inQuote = false; pos++; }
        } else { curField += ch; pos++; }
      } else {
        if (ch === '"') { inQuote = true; pos++; }
        else if (ch === delim) { curRow.push(curField); curField = ""; pos++; }
        else if (ch === "\r" || ch === "\n" || ch === undefined) {
          curRow.push(curField); curField = "";
          if (ch === "\r" && text[pos + 1] === "\n") pos++; /* CRLF */
          rows.push(curRow); curRow = [];
          if (ch === undefined) break;
          pos++;
        } else { curField += ch; pos++; }
      }
    }
    /* evtl. letztes Feld ohne Zeilenende */
    if (curRow.length || curField) { curRow.push(curField); rows.push(curRow); }
    return rows;
  }

  /* Mojibake-Erkennung: UTF-8-Datei als Latin-1 gelesen → Ã + Fortsetzungszeichen */
  function hatMojibake(text) {
    return /Ã[¤¶¼ŸœžŽ]|Ã¤|Ã¶|Ã¼|ÃŸ|Ã–|Ã„|Ãœ/.test(text);
  }

  /* Header-Normalisierung: Leerzeichen trimmen, Kleinschreibung */
  function normH(h) { return (h || "").trim().toLowerCase(); }

  /* Bekannte Spaltennamen für jede Rolle (DE + EN) */
  var COLS_FUNKTION = ["funktion", "function", "abteilung", "department", "team", "bereich"];
  var COLS_PARENT   = ["übergeordnete funktion", "uebergeordnete funktion", "parent function",
                       "parent", "übergeordnet", "uebergeordnet", "parent funktion"];
  var COLS_ROLLE    = ["rolle", "role"];

  function findCol(headers, aliases) {
    for (var i = 0; i < headers.length; i++) {
      var h = normH(headers[i]);
      for (var j = 0; j < aliases.length; j++) { if (h === aliases[j]) return i; }
    }
    return -1;
  }

  /* ---- parse(text) -> {knoten, stats:{funktionen,rollen}, warnungen:[string]} ---- */
  function parse(text) {
    var warnungen = [];

    if (hatMojibake(text)) warnungen.push(t("org.importEncodingWarn"));

    var rows = parseCSV(text);
    if (!rows.length) return { knoten: [], stats: { funktionen: 0, rollen: 0 }, warnungen: warnungen };

    var headers = rows[0];
    var colF = findCol(headers, COLS_FUNKTION);
    var colP = findCol(headers, COLS_PARENT);
    var colR = findCol(headers, COLS_ROLLE);

    if (colF < 0) {
      warnungen.push("No column \"Funktion\" / \"Function\" found in the header row.");
      return { knoten: [], stats: { funktionen: 0, rollen: 0 }, warnungen: warnungen };
    }

    /* Distinks Funktionsnamen in Reihenfolge + ihre übergeordnete Funktion */
    var funkNamen   = [];          /* distinct, in Reihenfolge */
    var funkParentN = {};          /* name -> parent-Name (string) */
    var funkRollen  = {};          /* name -> [rollenName] */

    for (var ri = 1; ri < rows.length; ri++) {
      var row   = rows[ri];
      var fName = colF >= 0 && row[colF] !== undefined ? row[colF].trim() : "";
      if (!fName) continue;                /* leere Funktionszeile überspringen */
      var pName = colP >= 0 && row[colP] !== undefined ? row[colP].trim() : "";
      var rName = colR >= 0 && row[colR] !== undefined ? row[colR].trim() : "";

      if (funkNamen.indexOf(fName) < 0) {
        funkNamen.push(fName);
        funkParentN[fName] = pName;
        funkRollen[fName]  = [];
      }
      if (rName && funkRollen[fName].indexOf(rName) < 0) {
        funkRollen[fName].push(rName);
      }
    }

    /* ---- Knoten aufbauen ---- */
    var knoten  = [];
    var funkIds = {};   /* name -> id */
    var warnedParents = {};

    /* 1) Alle Funktionsknoten anlegen */
    funkNamen.forEach(function (fn) {
      var id = NIJU.ORG.newId();
      funkIds[fn] = id;
      knoten.push({ id: id, name: fn, parent: "", typ: "funktion" });
    });

    /* 2) Parent-Namen zu IDs auflösen */
    knoten.forEach(function (k) {
      var pn = funkParentN[k.name];
      if (!pn) return;
      if (funkIds[pn]) {
        k.parent = funkIds[pn];
      } else if (!warnedParents[pn]) {
        warnedParents[pn] = true;
        warnungen.push(t("org.importParentUnresolved", { p: pn }));
      }
    });

    /* 3) Rollen anlegen */
    funkNamen.forEach(function (fn) {
      var fId = funkIds[fn];
      (funkRollen[fn] || []).forEach(function (rn) {
        knoten.push({ id: NIJU.ORG.newId(), name: rn, parent: fId, typ: "rolle" });
      });
    });

    /* 4) normalize() bereinigt kaputte parent-Verweise und stellt Schema-Konformität sicher */
    var org = NIJU.ORG.normalize({ version: 1, knoten: knoten });
    var nF  = org.knoten.filter(function (k) { return k.typ === "funktion"; }).length;
    var nR  = org.knoten.filter(function (k) { return k.typ === "rolle"; }).length;

    return { knoten: org.knoten, stats: { funktionen: nF, rollen: nR }, warnungen: warnungen };
  }

  /* ---- template() -> CSV-String (UTF-8-BOM + ;-Trenner für deutsches Excel) ---- */
  function template() {
    var BOM   = "﻿";
    var lines = [
      "Funktion;Übergeordnete Funktion;Rolle",
      "Board;;",
      "Sales;Board;Account Manager",
      "Sales;Board;Sales Director",
      "IT;Board;IT Administrator"
    ];
    return BOM + lines.join("\r\n") + "\r\n";
  }

  /* ---- renderPreview(container, parsed, {onReplace, onMerge, onCancel}) ---- */
  function renderPreview(container, parsed, cbs) {
    cbs = cbs || {};
    var onReplace = cbs.onReplace || function () {};
    var onMerge   = cbs.onMerge   || function () {};
    var onCancel  = cbs.onCancel  || function () {};

    container.innerHTML = "";
    container.className = "org-import-panel";

    /* Titel */
    container.appendChild(el("div", "org-import-h", t("org.menuImportCsv")));

    /* Stats */
    container.appendChild(el("div", "org-import-stats",
      t("org.importStats", { f: parsed.stats.funktionen, r: parsed.stats.rollen })));

    /* Warnungen */
    if (parsed.warnungen.length) {
      var ul = el("ul", "org-import-warns");
      parsed.warnungen.forEach(function (w) { ul.appendChild(el("li", null, w)); });
      container.appendChild(ul);
    }

    /* Aktions-Buttons */
    var acts = el("div", "org-import-actions");

    var btnR = el("button", "nt-btn primary", t("org.importReplace"));
    btnR.addEventListener("click", function () { onReplace(parsed); });
    acts.appendChild(btnR);

    var btnM = el("button", "nt-btn", t("org.importMerge"));
    btnM.addEventListener("click", function () { onMerge(parsed); });
    acts.appendChild(btnM);

    var btnC = el("button", "nt-btn", t("org.importCancel"));
    btnC.addEventListener("click", onCancel);
    acts.appendChild(btnC);

    container.appendChild(acts);
  }

  window.NIJU.ORGIMPORT = { parse: parse, template: template, renderPreview: renderPreview };
})();
