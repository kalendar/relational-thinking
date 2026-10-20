// SQL Studio: layout preferences, cleaned up and saved in localStorage. Storage may be missing or blocked.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const Q = isNode ? require('./randomq.js') : root.SS;

  const STORAGE_KEY = 'sqlStudio.layout.v1';
  const PANELS = ['exercises', 'sql', 'results', 'erd', 'data'];
  const TEXT_ZOOM = { min: 70, max: 200, step: 10 };
  const ERD_ZOOM = { min: 30, max: 250, step: 10 };

  const DEFAULT_PREFS = Object.freeze({
    sqlWidth: 0.5,          // SQL panel's share of the top row (0.2–0.8)
    topHeight: 360,         // px, SQL + Results row
    erdHeight: 340,         // px
    dataHeight: 280,        // px
    collapsed: { exercises: true, sql: false, results: false, erd: false, data: false },
    zoom: { sql: 100, results: 100, data: 100 },
    erdZoom: 100,
    attributes: true,
    tidyOnRun: true,
    random: Q.DEFAULT_OPTIONS,
  });

  const clamp = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
  const bool = (v, dflt) => (typeof v === 'boolean' ? v : dflt);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const snap = (v, step) => Math.round(v / step) * step;

  // Anything missing, wrong, or out of range falls back to the default.
  function sanitizePrefs(raw) {
    const r = obj(raw);
    const d = DEFAULT_PREFS;
    const collapsed = obj(r.collapsed);
    const zoom = obj(r.zoom);
    const random = obj(r.random);
    return {
      sqlWidth: clamp(r.sqlWidth, 0.2, 0.8, d.sqlWidth),
      topHeight: clamp(r.topHeight, 160, 2000, d.topHeight),
      erdHeight: clamp(r.erdHeight, 160, 2000, d.erdHeight),
      dataHeight: clamp(r.dataHeight, 120, 2000, d.dataHeight),
      collapsed: Object.fromEntries(PANELS.map(p => [p, bool(collapsed[p], d.collapsed[p])])),
      zoom: Object.fromEntries(['sql', 'results', 'data'].map(p => [p, snap(clamp(zoom[p], TEXT_ZOOM.min, TEXT_ZOOM.max, 100), TEXT_ZOOM.step)])),
      erdZoom: snap(clamp(r.erdZoom, ERD_ZOOM.min, ERD_ZOOM.max, 100), ERD_ZOOM.step),
      attributes: bool(r.attributes, d.attributes),
      tidyOnRun: bool(r.tidyOnRun, d.tidyOnRun),
      random: Q.normalizeOptions(Object.fromEntries(Q.FEATURES.map(f => [f, bool(random[f], d.random[f])]))).options,
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

  // Returns true if saved.
  function savePrefs(storage, prefs) {
    try {
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitizePrefs(prefs)));
      return true;
    } catch (e) {
      return false;
    }
  }

  const stepZoom = (value, dir, range = TEXT_ZOOM) => clamp(snap(value, range.step) + dir * range.step, range.min, range.max, 100);

  const api = { STORAGE_KEY, PANELS, TEXT_ZOOM, ERD_ZOOM, DEFAULT_PREFS, sanitizePrefs, loadPrefs, savePrefs, stepZoom };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
