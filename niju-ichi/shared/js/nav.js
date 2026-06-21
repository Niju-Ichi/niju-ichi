/* ============================================================
   NIJU ICHI — Modul-Umschalter oben rechts (shared)
   Ersetzt die statische Marke durch ein klickbares Dropdown:
   "NIJU ICHI <Modulname>" ▾  →  Liste aller Module.
   Aktivierte Module navigieren im selben Fenster, deaktivierte
   (modules.js: enabled:false) sind ausgegraut.

   NIJU.NAV.mount(containerEl, currentModuleId)
   ============================================================ */
(function () {
  window.NIJU = window.NIJU || {};
  if (window.NIJU.NAV) return;
  var I18N = window.NIJU.I18N, MODS = window.NIJU.MODS;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function mount(container, currentId) {
    if (typeof container === "string") container = document.getElementById(container);
    if (!container) return;
    container.classList.add("nav-wrap");
    container.innerHTML = "";

    var btn = el("button", "nav-marke");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    var akz = el("span", "marke-akz", "NIJU ICHI");
    var name = el("span", "nav-modname");
    var caret = el("span", "nav-caret", "▾");
    btn.appendChild(akz);
    btn.appendChild(document.createTextNode(" "));
    btn.appendChild(name);
    btn.appendChild(caret);

    var menu = el("div", "nav-dropdown");
    menu.hidden = true;

    function relabel() {
      var cur = MODS.byId(currentId);
      name.textContent = cur ? I18N.t(cur.key) : "";
      menu.innerHTML = "";
      MODS.list().forEach(function (m) {
        var item = el("button", "nav-item" + (m.id === currentId ? " aktiv" : "") + (m.enabled ? "" : " disabled"));
        item.type = "button";
        item.textContent = I18N.t(m.key);
        if (!m.enabled) {
          item.disabled = true;
        } else if (m.id !== currentId) {
          item.addEventListener("click", function (e) {
            e.stopPropagation();
            window.location.href = MODS.href(m, "module");
          });
        } else {
          item.addEventListener("click", function (e) { e.stopPropagation(); schliesse(); });
        }
        menu.appendChild(item);
      });
    }

    function aussenklick(e) { if (!container.contains(e.target)) schliesse(); }
    function schliesse() {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", aussenklick);
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!menu.hidden) { schliesse(); return; }
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      setTimeout(function () { document.addEventListener("click", aussenklick); }, 0);
    });

    container.appendChild(btn);
    container.appendChild(menu);
    relabel();
    if (I18N && I18N.onChange) I18N.onChange(relabel);
  }

  window.NIJU.NAV = { mount: mount };
})();
