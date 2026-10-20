// ERD Playground: reads a relationship aloud in both directions, using 6.1's rule:
// "say the first entity, then the cardinality closest to the second entity, then the second entity."
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  // Exactly 6.1's words for each line end.
  const MEANING = { one: 'one and only one', 'zero-one': 'zero or one', 'one-many': 'one or more', 'zero-many': 'zero or more' };
  const isMany = end => end === 'one-many' || end === 'zero-many';

  const article = name => (/^[AEIOaeio]/.test(name) ? 'An' : 'A');
  const plural = name => (/(s|x|z|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`);

  function sentence(first, end, second) {
    return `${article(first)} ${first} is associated with **${MEANING[end]}** ${isMany(end) ? plural(second) : second}.`;
  }

  // Returns [reading from a to b, reading from b to a]. `**…**` marks the cardinality words.
  // The label is left out on purpose: as 6.1 notes, a label usually reads well in only one direction.
  function readRelationship(rel, displayOf = n => n) {
    const a = displayOf(rel.a);
    const b = displayOf(rel.b);
    return [sentence(a, rel.bEnd, b), sentence(b, rel.aEnd, a)];
  }

  const api = { MEANING, readRelationship };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
