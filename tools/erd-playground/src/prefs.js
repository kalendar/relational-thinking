// ERD Playground: layout preferences, cleaned up and saved in localStorage. Storage may be missing or blocked.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const STORAGE_KEY = 'erdPlayground.layout.v1';
  const TEXT_ZOOM = { min: 70, max: 200, step: 10 };
  const DIAGRAM_ZOOM = { min: 30, max: 250, step: 10 };

  const DEFAULT_PREFS = Object.freeze({
    notationWidth: 0.42,     // Notation panel's share of the row (0.2–0.8)
    height: 560,             // px, the two panels' height on wide screens
    collapsed: { notation: false, diagram: false },
    zoom: { notation: 100 }, // text zoom, %
    diagramZoom: 100,        // %
    cheatSheetOpen: false,
  });

  const clamp = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
  const bool = (v, dflt) => (typeof v === 'boolean' ? v : dflt);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const snap = (v, step) => Math.round(v / step) * step;

  function sanitizePrefs(raw) {
    const r = obj(raw);
    const d = DEFAULT_PREFS;
    const collapsed = obj(r.collapsed);
    const zoom = obj(r.zoom);
    return {
      notationWidth: clamp(r.notationWidth, 0.2, 0.8, d.notationWidth),
      height: clamp(r.height, 320, 2000, d.height),
      collapsed: { notation: bool(collapsed.notation, false), diagram: bool(collapsed.diagram, false) },
      zoom: { notation: snap(clamp(zoom.notation, TEXT_ZOOM.min, TEXT_ZOOM.max, 100), TEXT_ZOOM.step) },
      diagramZoom: snap(clamp(r.diagramZoom, DIAGRAM_ZOOM.min, DIAGRAM_ZOOM.max, 100), DIAGRAM_ZOOM.step),
      cheatSheetOpen: bool(r.cheatSheetOpen, d.cheatSheetOpen),
    };
  }

  function loadPrefs(storage) {
    try {
      const text = storage && storage.getItem(STORAGE_KEY);
      return sanitizePrefs(text ? JSON.parse(text) : {});
    } catch (e) {
      return sanitizePrefs({});
    }
  }

  function savePrefs(storage, prefs) {
    try {
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitizePrefs(prefs)));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Used by the shared panels.js (text zoom) and canvas.js (diagram zoom).
  const stepZoom = (value, dir, range = TEXT_ZOOM) => clamp(snap(value, range.step) + dir * range.step, range.min, range.max, 100);

  const api = { STORAGE_KEY, TEXT_ZOOM, DIAGRAM_ZOOM, DEFAULT_PREFS, sanitizePrefs, loadPrefs, savePrefs, stepZoom };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
