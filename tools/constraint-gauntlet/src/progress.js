// Constraint Gauntlet: saved progress (goals met per level, and the input mode). Never the data itself.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const STORAGE_KEY = 'constraintGauntlet.progress.v1';
  const MODES = ['form', 'sql'];
  const DEFAULT = () => ({ mode: 'form', levels: {} });

  function sanitize(raw) {
    const p = DEFAULT();
    if (!raw || typeof raw !== 'object') return p;
    if (MODES.includes(raw.mode)) p.mode = raw.mode;
    for (const [id, v] of Object.entries(raw.levels && typeof raw.levels === 'object' ? raw.levels : {})) {
      if (!/^\d+$/.test(id) || !v || typeof v !== 'object') continue;
      p.levels[id] = { goals: Array.isArray(v.goals) ? v.goals.filter(g => typeof g === 'string') : [], complete: v.complete === true };
    }
    return p;
  }

  function loadProgress(storage) {
    try { return sanitize(JSON.parse(storage.getItem(STORAGE_KEY))); } catch (_) { return DEFAULT(); }
  }
  function saveProgress(storage, p) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(sanitize(p))); return true; } catch (_) { return false; }
  }

  // Adds newly met goals; never removes any (Reset doesn't clear check marks).
  function markGoals(p, levelId, metIds, complete) {
    const key = String(levelId);
    const cur = p.levels[key] || { goals: [], complete: false };
    p.levels[key] = { goals: [...new Set([...cur.goals, ...metIds])], complete: cur.complete || !!complete };
    return p;
  }

  const api = { PROGRESS_KEY: STORAGE_KEY, loadProgress, saveProgress, markGoals, sanitizeProgress: sanitize };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
