/* ============================================================
   NIJU ICHI — Backup & Restore
   Creates / reads ZIP files (STORE method, no compression).
   Preserves folder structure: data/processes/, data/templates/,
   plus niju-settings.json for all niju.* localStorage entries.

   NIJU.BACKUP.create({ prozesse, index, name })
   NIJU.BACKUP.restore(file, callback(err, {prozesse,index,settings}))
   NIJU.BACKUP.getSettings()
   NIJU.BACKUP.applySettings(map)
   ============================================================ */
(function () {
  'use strict';
  window.NIJU = window.NIJU || {};
  if (window.NIJU.BACKUP) return;

  /* ---- CRC-32 lookup table ---- */
  var CRC = (function () {
    var t = new Uint32Array(256), i, j, c;
    for (i = 0; i < 256; i++) {
      c = i;
      for (j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  }());
  function crc32(buf) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < buf.length; i++) c = (CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---- UTF-8 encode / decode ---- */
  function encode(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) { out.push(c); }
      else if (c < 0x800) { out.push(0xC0 | (c >> 6)); out.push(0x80 | (c & 0x3F)); }
      else { out.push(0xE0 | (c >> 12)); out.push(0x80 | ((c >> 6) & 0x3F)); out.push(0x80 | (c & 0x3F)); }
    }
    return new Uint8Array(out);
  }
  function decode(bytes) {
    var s = '', i = 0, b;
    while (i < bytes.length) {
      b = bytes[i];
      if (b < 0x80) { s += String.fromCharCode(b); i++; }
      else if (b < 0xE0) { s += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F)); i += 2; }
      else { s += String.fromCharCode(((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)); i += 3; }
    }
    return s;
  }

  /* ---- Integer serialisation ---- */
  function u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
  function u32(n) { n = n >>> 0; return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }
  function readU16(b, o) { return b[o] | (b[o + 1] << 8); }
  function readU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] * 0x1000000)) >>> 0; }

  /* ---- Concatenate Uint8Arrays ---- */
  function concat(parts) {
    var total = 0, off = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total);
    for (i = 0; i < parts.length; i++) { out.set(parts[i], off); off += parts[i].length; }
    return out;
  }
  function fromArr(arr) { return new Uint8Array(arr); }

  /* ============================================================
     createZip(files)
     files = { "path/file.json": "utf-8 string content" }
     Returns Uint8Array — ZIP archive (STORE, UTF-8 filenames)
     ============================================================ */
  function createZip(files) {
    var locals = [], centrals = [], offset = 0;

    Object.keys(files).forEach(function (path) {
      var nameBytes = encode(path);
      var dataBytes = encode(files[path]);
      var crc = crc32(dataBytes);
      var sz = dataBytes.length;
      var nl = nameBytes.length;

      /* Local file header */
      var lh = fromArr([0x50, 0x4B, 0x03, 0x04].concat(
        u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(sz), u32(sz), u16(nl), u16(0)));
      /* Central directory entry */
      var cd = fromArr([0x50, 0x4B, 0x01, 0x02].concat(
        u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(sz), u32(sz), u16(nl), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset)));

      locals.push(lh, nameBytes, dataBytes);
      centrals.push(cd, nameBytes);
      offset += lh.length + nl + sz;
    });

    var cdSize = centrals.reduce(function (a, p) { return a + p.length; }, 0);
    var n = Object.keys(files).length;
    var eocd = fromArr([0x50, 0x4B, 0x05, 0x06].concat(
      u16(0), u16(0), u16(n), u16(n), u32(cdSize), u32(offset), u16(0)));

    return concat(locals.concat(centrals).concat([eocd]));
  }

  /* ============================================================
     readZip(buffer)
     Sequential scan of local file headers (works for STORE ZIPs
     we created ourselves). Returns { "path": "content" } or null.
     ============================================================ */
  function readZip(buffer) {
    var bytes = new Uint8Array(buffer);
    var files = {}, pos = 0;
    while (pos + 30 <= bytes.length) {
      var sig = readU32(bytes, pos);
      if (sig !== 0x04034B50) break;           /* not a local-file header */
      var nl = readU16(bytes, pos + 26);
      var el = readU16(bytes, pos + 28);
      var sz = readU32(bytes, pos + 18);
      var name = decode(bytes.slice(pos + 30, pos + 30 + nl));
      var dataStart = pos + 30 + nl + el;
      if (name.charAt(name.length - 1) !== '/') {  /* skip directory entries */
        files[name] = decode(bytes.slice(dataStart, dataStart + sz));
      }
      pos = dataStart + sz;
    }
    return Object.keys(files).length ? files : null;
  }

  /* ============================================================
     Public helpers
     ============================================================ */
  function dlBlob(name, bytes) {
    var blob = new Blob([bytes], { type: 'application/zip' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function getSettings() {
    var s = {}, i, k;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (k && k.indexOf('niju.') === 0) s[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return s;
  }

  function applySettings(map) {
    try {
      Object.keys(map).forEach(function (k) {
        if (k.indexOf('niju.') === 0) localStorage.setItem(k, map[k]);
      });
    } catch (e) {}
  }

  /* ============================================================
     create(data, zipName?)
     data = {
       prozesse : { "filename.json": { data:{…}, titel:"…" } },
       index    : parsed index.json object | null,
       name     : optional suggested ZIP name
     }
     ============================================================ */
  function create(data, zipName) {
    var files = {};

    /* App settings */
    files['niju-settings.json'] = JSON.stringify(getSettings(), null, 2);

    /* index.json */
    if (data.index) {
      files['data/processes/index.json'] = JSON.stringify(data.index, null, 2) + '\n';
    }

    /* Process JSONs */
    var prz = data.prozesse || {};
    Object.keys(prz).forEach(function (fn) {
      var entry = prz[fn];
      var d = (entry && entry.data) ? entry.data : entry;
      if (d && typeof d === 'object') {
        files['data/processes/' + fn] = JSON.stringify(d, null, 2) + '\n';
      }
    });

    if (!Object.keys(files).length) { alert('No data to back up.'); return; }

    var ts = new Date().toISOString().slice(0, 10);
    dlBlob((zipName || data.name || 'niju-backup') + '-' + ts + '.zip', createZip(files));
  }

  /* ============================================================
     restore(file, callback)
     callback(err | null, { prozesse, index, settings } | null)
     ============================================================ */
  function restore(file, callback) {
    var reader = new FileReader();
    reader.onerror = function () { callback(new Error('File could not be read'), null); };
    reader.onload = function (ev) {
      try {
        var files = readZip(ev.target.result);
        if (!files) { callback(new Error('Not a valid NIJU backup ZIP.'), null); return; }

        var settings = {};
        if (files['niju-settings.json']) {
          try { settings = JSON.parse(files['niju-settings.json']); } catch (e2) {}
        }

        var index = null;
        if (files['data/processes/index.json']) {
          try { index = JSON.parse(files['data/processes/index.json']); } catch (e3) {}
        }

        var prozesse = {};
        Object.keys(files).forEach(function (path) {
          var prefix = 'data/processes/';
          if (path.indexOf(prefix) !== 0) return;
          if (path === prefix + 'index.json') return;
          if (path.slice(-5) !== '.json') return;
          var fn = path.slice(prefix.length);
          try {
            var d = JSON.parse(files[path]);
            prozesse[fn] = { data: d, titel: (d.meta && d.meta.titel) ? d.meta.titel : fn };
          } catch (e4) {}
        });

        callback(null, { prozesse: prozesse, index: index, settings: settings });
      } catch (err) {
        callback(err, null);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  window.NIJU.BACKUP = { create: create, restore: restore, getSettings: getSettings, applySettings: applySettings };
}());
