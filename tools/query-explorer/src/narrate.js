// Query Explorer: plain-language text for the guided join walkthrough. No DOM.
(function (root) {
  'use strict';

  const n = x => x.toLocaleString('en-US');
  const rows = x => `${n(x)} ${x === 1 ? 'row' : 'rows'}`;
  const cols = x => `${n(x)} ${x === 1 ? 'column' : 'columns'}`;
  const size = t => `${rows(t.rows.length)} × ${cols(t.columns.length)}`;
  const title = i => `Join, step ${i} of 3`;

  function tableLabel(t) {
    return t.sources && t.sources.length > 1 ? 'your table so far' : `**${t.name}**`;
  }

  // Returns three { title, body } objects, one for each pause in the join animation.
  function joinNarration({ step, before, other, result }) {
    const trace = result.trace;
    const out = result.table;
    const left = tableLabel(before);
    const right = `**${other.name}**`;
    const leftN = before.rows.length;
    const rightN = other.rows.length;
    const sizeLine = `The result has **${size(out)}**.`;
    let first;
    let second;
    let third;

    if (trace.cartesian) {
      const product = leftN * rightN;
      first = `You are combining ${left} with ${right}. You chose not to match on anything, so every row of one table will be paired with every row of the other.`;
      second = product === 0
        ? `One of the tables has no rows, so there is nothing to pair up and the result will be empty.`
        : `Every row is paired with every row: ${n(leftN)} × ${n(rightN)} = ${rows(product)}. Most of these rows are meaningless, because nothing says the rows belong together.`;
      third = product === 0
        ? `The result is empty. ${sizeLine}`
        : `Each pair became one wider row. ${sizeLine} Because nothing was matched, most of those rows are meaningless. Try matching on a column the two tables share.`;
    } else {
      const same = step.leftColumn === step.rightColumn;
      const how = same
        ? `It will compare the \`${step.leftColumn}\` column in both tables.`
        : `It will do this by matching \`${step.leftColumn}\` to \`${step.rightColumn}\`.`;
      first = `You are combining ${left} with ${right}. Rows will be paired up when their values in the matching columns are the same. ${how}`;

      const matchedLeft = leftN - trace.unmatchedLeft.length;
      const matchedRight = rightN - trace.unmatchedRight.length;
      const lostLeft = trace.unmatchedLeft.length;
      const lostRight = trace.unmatchedRight.length;
      if (trace.pairs.length === 0) {
        second = `Nothing matched. No row in ${left} has a partner in ${right}, so every row would be dropped and the result will be empty.`;
        third = `Nothing matched, so the result is empty. ${sizeLine} Check the columns you picked. They should hold the same kind of value, like an id that both tables share.`;
      } else {
        const found = `${n(matchedLeft)} of ${rows(leftN)} in ${left} found a match, and ${n(matchedRight)} of ${rows(rightN)} in ${right} found a match.`;
        let dropped;
        if (!lostLeft && !lostRight) dropped = 'Every row found a partner, so no rows will be dropped.';
        else {
          const parts = [];
          if (lostLeft) parts.push(`${rows(lostLeft)} in ${left} found no match`);
          if (lostRight) parts.push(`${rows(lostRight)} in ${right} found no match`);
          const one = lostLeft + lostRight === 1;
          dropped = `${parts.join(' and ')}. ${one ? 'That row has' : 'Those rows have'} a dashed outline and will be dropped, because only matching rows are kept.`;
        }
        second = `Rows with the same color and number are partners. ${found} ${dropped}`;
        third = `Each matched pair became one wider row. ${sizeLine}`
          + (same ? ` The \`${step.leftColumn}\` column appears only once, because both tables had it.` : '');
      }
    }
    return [
      { title: title(1), body: first },
      { title: title(2), body: second },
      { title: title(3), body: third },
    ];
  }

  const api = { joinNarration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QE = Object.assign(root.QE || {}, api);
})(this);
