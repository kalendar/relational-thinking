// Constraint Gauntlet: puts the level files (which push onto CG.LEVELS) in order, and checks there are no gaps.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  function sortLevels(list) {
    const levels = list.slice().sort((a, b) => a.id - b.id);
    levels.forEach((l, i) => { if (l.id !== i + 1) throw new Error(`Level ids must run 1, 2, 3 … with no gaps; found ${levels.map(x => x.id).join(', ')}`); });
    return levels;
  }

  if (isNode) module.exports = { sortLevels };
  else root.CG = Object.assign(root.CG || {}, { sortLevels, levels: sortLevels(root.CG.LEVELS || []) });
})(this);
