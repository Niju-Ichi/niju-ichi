# NIJU ICHI — Process Builder Suite

An **offline-capable web app** for creating, editing, visualising, and exporting **RACI process overviews** as PDF.  
Runs entirely in the browser — **no build step, no installation, no internet connection required.**  
Just double-click the HTML file.

The layout is a fixed table (not a freehand diagram): meta column on the left, process step columns across the top, RACI matrix below, legend in the footer.

---

## Modules

The suite consists of four modules under a shared interface (module switcher top-right):

| Module | Purpose |
|--------|---------|
| **Process Builder** | Create and edit process **content** — steps, roles, RACI matrix. PDF, JPEG, and **AI-ready Markdown & Confluence** export. Import from draw.io. |
| **Process Manager** | Manage **structure** — cluster/folder tree, graphical process map, Organisation chart, AI & Tools editor. Read-only process preview. |
| **Process Viewer** | Pure **read-only viewer** for end users — folder tree + process display. |
| **Process Brain** | **Knowledge graph** (d3, offline) — visualises the whole organisation derived from processes and roles. AI-Readiness insights, AI coverage mode, offline HTML report export. |

---

## Features

### Process Builder
- Display as **CSS Grid** (A4 landscape), R/A/C/I as coloured badges
- **Form editor**: title/owner/input/output, add/remove/reorder steps, manage bullet points, clickable RACI matrix, role management
- **PDF export** via the browser print function (`@media print`, A4 landscape) — no PDF library needed
- **JPEG export** with custom width/height/DPI/quality dialog — rendered offline via SVG `<foreignObject>` → Canvas (no html2canvas)
- **draw.io import** (`.drawio`/`.xml`) with semi-automatic mapping confirmation screen
- **Design snapshot** per process — the active design is stamped into the JSON on save
- **Flexible step content** — each step is an ordered sequence of blocks: bulleted lists (with their own heading and round sub-points) and free text paragraphs

#### AI-ready exports (for Copilot, RAG & knowledge bases)

Feed your processes into AI assistants and intranet knowledge bases as **machine-readable, retrieval-optimised** content — the model is a commodity, the data quality is the differentiator.

- **Markdown export** — one `.md` per process (single **or batch**) plus a `manifest.json` corpus index. Plain text built for retrieval: YAML front-matter (process ID, owner, version), **RACI written out in full sentences**, stable per-step anchors, a consolidated RACI table, and a glossary. Ideal for **Microsoft 365 Copilot, SharePoint** libraries, and custom **RAG** pipelines.
- **Confluence export** — native **Confluence storage format** (XHTML with table-of-contents / info-panel / anchor macros and a real RACI `<table>`). One `.confluence.xml` per process (single or batch) plus `manifest.json`, ready to push via the **Confluence REST API**. The content becomes part of the **indexed, searchable page body** — not an embedded blob — so **Confluence search, the Microsoft Copilot connector, and Atlassian Rovo** can read it.

### Process Manager
- **Folder/cluster tree editor** — create, rename, delete clusters, assign and sort processes
- **Graphical process map** — freely positionable, clickable boxes, optional background image, overlay or hotspot mode
- **Organisation Manager** — org chart of departments (functions) and roles, role-to-process participation counter, central rename syncs across all loaded processes
- **AI & Tools editor** — manage tools/AI agents, knowledge resources, per-process AI assessments, all saved to `index.json`
- Read-only process preview on the right panel

### Process Brain
- **d3 knowledge graph** — offline, no CDN, uses Design Engine variables
- Nodes: teams (functions), roles, tools/AI agents; edges derived from RACI ownership (`A`/`R`) and org bindings
- **AI-Readiness Insights**: Quick Wins, White Spots, Bus Factor, shared tools, EU AI Act / GDPR compliance hints, Readiness Quadrant
- **AI Coverage mode** — green = AI in use / red = white spot
- Full-text **search** + team filter + deeplink to Process Viewer
- **Offline HTML report export** (self-contained Blob, no popup)

### Shared
- **Multilingual UI**: English (default), German, Japanese — switchable at runtime; further languages importable via template
- **Design Engine** — 5 built-in themes (Swiss Modular, Teal Soft, Mono Slate, Strategy Editorial, Executive Dark), CSS-variable based, import/export custom design files. User content is never re-styled.
- **Configuration panel** — embedded in the layout (categories: About, Languages, Design)
- **Module switcher** — all four modules accessible from the top-right dropdown without page reload

---

## Quick Start

```
Open:  niju-ichi/niju-ichi.html
```

No installation, no server, no internet required. Everything runs locally via `file://`.

---

## Project Structure

```
niju-ichi/
  niju-ichi.html                  Launcher (module selector, language, branding)
  shared/
    css/
      base.css                    Shared chrome (toolbar, nav, config, launcher)
      viewer.css                  Read-only process renderer styles
      org.css                     Organisation Manager styles
      brain.css                   Process Brain styles
      wissen.css                  AI & Tools editor styles
    js/
      i18n.js                     i18n engine (window.NIJU.I18N)
      nav.js                      Module switcher (NIJU.NAV)
      config.js                   Configuration panel (NIJU.CONFIG)
      viewer.js                   Read-only renderer (NIJU.VIEWER)
      library.js                  Directory / index.json model (NIJU.LIB)
      tree.js                     Folder tree — editable + read-only (NIJU.TREE)
      map.js                      Process map — draggable boxes (NIJU.MAP)
      org.js                      Organisation Manager (NIJU.ORG)
      brain.js                    Process Brain d3 graph (NIJU.BRAIN)
      wissen.js                   AI & Tools data model + editor (NIJU.WISSEN)
      design.js                   Design Engine (NIJU.DESIGN)
      demo-library.js             Embedded demo content for offline first launch
      modules.js                  Module registry (enable/disable per deployment)
      backup.js                   Auto-backup helpers
    lang/
      en.js                       English (primary)
      de.js                       German
      ja.js                       Japanese
      _template.json              Template for adding new languages
    design/
      swiss-modular.js            Default design
      teal-soft.js
      mono-slate.js
      strategy-editorial.js
      executive-dark.js
      _template.json              Template for custom designs
    lib/
      d3.min.js                   D3 v7 — local copy, no CDN
    img/
      start-banner.jpg            Launcher background image
  modules/
    process-builder/index.html
    process-manager/index.html
    process-viewer/index.html
    process-brain/index.html
  data/
    processes/                    Process JSONs + index.json (structure, map, org, AI data)
    templates/
      standard.json               Blank process template
```

---

## Architecture Principles

- **No build step, no dependencies.** Pure Vanilla HTML/CSS/JS. The only third-party asset is D3 (local copy, MIT licence).
- **Offline-safe (`file://`):** no ES modules, no `fetch()` — shared code loaded via classic `<script src>`, file input via `<input type="file">` + `FileReader`.
- **Layout = CSS Grid** — maps the table 1:1, no canvas, no SVG diagram engine.
- **User content is never translated** — only the UI is multilingual.
- **Single-file deployment per module** — hand off `niju-ichi/` with unused modules disabled in `modules.js` (`enabled: false`).

---

## Data Model

### Process file (`*.json`)
Fields: `meta` (title, company, processId, version, date, processOwner, footer), `input`, `output`, `schritte[]` (steps; content as an ordered sequence of **blocks** — lists with an optional heading and sub-points, or text paragraphs), `rollen[]` (roles), `raci` (step-id → role → `["R","A","C","I"]`), `legende`, `design` (snapshot).

### Library file (`index.json`)
Central directory file. Contains:
- `cluster[]` — hierarchical folder/cluster tree referencing process filenames
- `landkarte` — process map (boxes with position, label, colour, link target)
- `organisation` — org chart nodes (functions + roles)
- `wissen` — tools/AI agents, knowledge resources, per-process AI assessments

---

## Selective Deployment

Modules can be individually disabled for distribution:

```js
// shared/js/modules.js
{ id: "brain", enabled: false }   // hides Process Brain from the switcher
```

Hand off only the module folders you need — the rest can be omitted entirely.

---

## Licence

[MIT](LICENSE) © 2026 niju-ichi@proton.me
