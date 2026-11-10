// Constraint Gauntlet: fills the gaps in SQL Studio's shared files without editing them.
// panels.js needs SS.stepZoom (normally from SQL Studio's prefs.js), and the Gauntlet needs a few more icons.
(function (root) {
  'use strict';
  const SS = root.SS;
  if (!SS.stepZoom) SS.stepZoom = (v, dir) => Math.min(200, Math.max(70, Math.round(v / 10) * 10 + dir * 10));
  Object.assign(SS.ICON_PATHS, {
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.7-1.5',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
    pencil: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
    reset: 'M4 4v6h6M4.6 15a8 8 0 1 0 1.9-8.3L4 10',
    rows: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z',
    alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  });
})(this);
