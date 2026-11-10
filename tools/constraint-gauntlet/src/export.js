// Constraint Gauntlet: the "Copy for homework" text for one level (spec §10).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const S = isNode ? require('./schema.js') : root.CG;

  const CAP = 20;
  const oneLine = s => String(s).replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const plain = s => String(s).replace(/`([^`]+)`/g, '$1');
  const LABEL = { accepted: '✓ ACCEPTED', rejected: '✗ REJECTED', slipped: '! SLIPPED ' };

  // st: session.state(); fixedLines: [{ table, shown }] from applied or passed fixes (optional).
  function homeworkText(level, st, { fixedLines = [] } = {}) {
    const goals = st.goals.filter(g => !g.optional);
    const met = goals.filter(g => g.met).length;
    const counts = { accepted: 0, rejected: 0, slipped: 0 };
    st.log.forEach(a => { counts[a.outcome] += 1; });
    const out = [];
    out.push(`Constraint Gauntlet — Level ${level.id}: ${level.title} (Chapter ${level.section})`);
    out.push(`Goals: ${met} of ${goals.length} complete${st.complete ? ' — level complete' : ''}`);
    for (const g of st.goals) out.push(`  [${g.met ? 'x' : ' '}] ${plain(g.text)}${g.optional ? ' (bonus)' : ''}`);
    out.push('');
    out.push(`Attempts (${st.log.length}): ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.slipped} slipped through`);
    const shown = st.log.slice().reverse().slice(0, CAP);
    for (const a of shown) {
      out.push(`  ${LABEL[a.outcome]}  ${cut(oneLine(a.sql), 100)}`);
      if (a.outcome === 'rejected' && a.error) out.push(`              ${oneLine(plain(a.error.chips.rule || a.error.kind))} on ${a.error.chips.table}`);
      if (a.outcome === 'slipped') out.push(`              breaks: ${a.broken.map(id => oneLine(((level.rules || []).find(r => r.id === id) || { text: id }).text)).join('; ')}`);
      if (a.blast && a.blast.total) out.push(`              removed ${a.blast.total} ${a.blast.total === 1 ? 'row' : 'rows'}`);
    }
    if (st.log.length > CAP) out.push(`  (showing ${CAP} of ${st.log.length} attempts)`);
    const passed = st.fixes.filter(f => f.passed);
    if (passed.length || fixedLines.length) {
      out.push('');
      out.push('My fix:');
      for (const f of fixedLines) out.push(...f.shown.split('\n').map(l => `  ${l}`));
      if (!fixedLines.length) for (const f of passed) out.push(`  ${f.table}: ${f.expr || f.optionId}`);
    }
    const preds = Object.entries(st.predictions);
    if (preds.length) {
      out.push('');
      out.push('Predictions:');
      for (const [id, choice] of preds) {
        const p = (level.predict || []).find(x => x.id === id);
        if (!p) continue;
        const text = cid => { const c = p.choices.find(x => x.id === cid); return c ? (c.text || c.id) : cid; };
        out.push(`  "${plain(p.question)}"`);
        out.push(`  I said: ${text(choice)}.`);
      }
    }
    return out.join('\n');
  }

  const homeworkFilename = level => `constraint-gauntlet-level-${level.id}.txt`;

  const api = { homeworkText, homeworkFilename };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
