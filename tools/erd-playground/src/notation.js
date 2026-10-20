// ERD Playground: reads Chapter 6's crow's foot notation (a subset of Mermaid's erDiagram) into a model.
// Never throws: problems become plain-words errors with a line and column.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const END_KINDS = {
    left: { '||': 'one', '|o': 'zero-one', '}|': 'one-many', '}o': 'zero-many' },
    right: { '||': 'one', 'o|': 'zero-one', '|{': 'one-many', 'o{': 'zero-many' },
  };
  const LINES = { '--': false, '..': true }; // value: dashed?
  const ENDS_HELP = 'Line ends are `||`, `o|`, `|{`, or `o{`';
  const LABEL_NOTE = 'A line without a label works here. To use it in Mermaid or an AI tool, add a label, like `: "records"`.';
  const HEADER_NOTE = 'Add `erDiagram` as the first line to use this in Mermaid.';

  const NAME = '[A-Za-z_][A-Za-z0-9_-]*';
  // An entity: NAME, NAME["Alias"] (Mermaid), or "Quoted name" (Mermaid).
  const ENT = `(?:"[^"]+"|${NAME}(?:\\["[^"]*"\\])?)`;
  const RE_NAME_ONLY = new RegExp(`^(${ENT})$`);
  const RE_BLOCK_OPEN = new RegExp(`^(${ENT})\\s*\\{\\s*(\\})?$`);
  const RE_REL = new RegExp(`^(${ENT})\\s+(\\S+)(?:\\s+(.*))?$`);
  const RE_SECOND = new RegExp(`^(${ENT})\\s*(?::\\s*(.*))?$`);
  // Mermaid's word cardinalities: A one or more to zero or many B : label ("optionally to" = dashed line).
  const WORD_KINDS = {
    'only one': 'one', 'zero or one': 'zero-one', 'one or zero': 'zero-one', 'one or more': 'one-many', 'one or many': 'one-many',
    'many(1)': 'one-many', '1+': 'one-many', 'zero or more': 'zero-many', 'zero or many': 'zero-many', 'many(0)': 'zero-many', '0+': 'zero-many', 1: 'one',
  };
  const CARD = Object.keys(WORD_KINDS).sort((x, y) => y.length - x.length).map(w => w.replace(/[()+]/g, '\\$&')).join('|');
  const RE_WORDS = new RegExp(`^(${ENT})\\s+(${CARD})\\s+(optionally to|to)\\s+(${CARD})\\s+(${ENT})\\s*(?::\\s*(.*))?$`);
  const RE_IGNORED = /^(direction|style|classDef|class)\b/;
  const MIRROR = { 'o{': '}o', '|{': '}|', 'o|': '|o' };
  // "Big Box" → { name: 'Big Box' }; p["Person"] → { name: 'p', display: 'Person' }.
  function entityToken(tok) {
    const q = /^"([^"]+)"$/.exec(tok);
    if (q) return { name: q[1], display: q[1] };
    const a = /^([^[]+)\["([^"]*)"\]$/.exec(tok);
    return a ? { name: a[1], display: a[2] } : { name: tok, display: tok };
  }
  const RE_KEYS = /^((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*)?\s*(?:"([^"]*)")?$/;
  const looksLikeSymbol = tok => /[|{}]|--|\.\./.test(tok);

  // Checks a relationship symbol like ||--o{. Returns { aEnd, bEnd, dashed } or { error }.
  function readSymbol(tok, n) {
    if (/[\u2013\u2014]/.test(tok)) return { error: `Line ${n}: Use two hyphens \`--\` in the middle, not a long dash.` };
    const L = tok.slice(0, 2);
    const mid = tok.slice(2, 4);
    const R = tok.slice(4, 6);
    if (tok.length === 6 && END_KINDS.left[L] && mid in LINES && END_KINDS.right[R]) {
      return { aEnd: END_KINDS.left[L], bEnd: END_KINDS.right[R], dashed: LINES[mid] };
    }
    if (tok.length === 6 && MIRROR[L] && mid in LINES && END_KINDS.right[R]) {
      return { error: `Line ${n}: On the left side the symbols are mirrored: write \`${MIRROR[L]}\` instead of \`${L}\`.` };
    }
    if (tok.length === 5 && END_KINDS.left[tok.slice(0, 2)] && tok.slice(2, 4) in LINES) {
      return { error: `Line ${n}: \`${tok}\` is missing its last symbol. ${ENDS_HELP}.` };
    }
    if (tok.length === 5 && tok.slice(1, 3) in LINES && END_KINDS.right[tok.slice(3, 5)]) {
      return { error: `Line ${n}: \`${tok}\` is missing its first symbol. ${ENDS_HELP}.` };
    }
    return { error: `Line ${n}: \`${tok}\` isn't a relationship symbol. ${ENDS_HELP}, with \`--\` in the middle.` };
  }

  function readLabel(text) {
    const t = text.trim();
    const q = /^"([^"]*)"$/.exec(t);
    return q ? q[1] : t;
  }

  function parseErd(text) {
    const model = { hasHeader: false, entities: [], relationships: [], errors: [], notes: [] };
    const byName = new Map();
    // tok: the entity as written (NAME, NAME["Alias"], or "Quoted name").
    const ensure = (tok, line) => {
      const { name, display } = entityToken(tok);
      if (!byName.has(name)) {
        const e = { name, display, line, attributes: [] };
        byName.set(name, e);
        model.entities.push(e);
      } else if (display !== name) byName.get(name).display = display;
      return byName.get(name);
    };
    const addRel = (aTok, bTok, aEnd, bEnd, dashed, rawLabel, n, aSym, bSym) => {
      if (rawLabel === undefined) missingLabel = true;
      else if (!rawLabel.trim()) model.notes.push(`Line ${n} has a \`:\` but no label. To use it in Mermaid, add a label after the \`:\` or remove the \`:\`.`);
      const a = ensure(aTok, n).name;
      const b = ensure(bTok, n).name;
      model.relationships.push({ a, b, aEnd, bEnd, dashed, label: rawLabel === undefined ? '' : readLabel(rawLabel), line: n, aSym, bSym });
    };
    const fail = (n, col, length, message) => model.errors.push({ line: n, col, length, message });

    // Pasted text: Windows line endings, non-breaking spaces, and a word processor's curly quotes.
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ')
      .replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").split('\n');
    let seenContent = false;
    let block = null; // { entity, line }
    let missingLabel = false;

    lines.forEach((line, i) => {
      const n = i + 1;
      let t = line.trim();
      if (!t || t.startsWith('%%')) return;
      const lead = line.indexOf(t);

      // A line that starts a new block or is a relationship means the open block was never closed.
      if (block && (RE_BLOCK_OPEN.test(t) || RE_WORDS.test(t) || (RE_REL.test(t) && looksLikeSymbol(RE_REL.exec(t)[2])))) {
        fail(block.line, 1, lines[block.line - 1].length, `Line ${block.line}: This attribute block is missing its closing \`}\`.`);
        block = null;
      }
      if (block) {
        if (t === '}') { block = null; return; }
        const m = /^(\S+)\s+([A-Za-z_][A-Za-z0-9_-]*)(.*)$/.exec(t);
        const k = m && RE_KEYS.exec(m[3].trim());
        if (!m || !k) {
          fail(n, lead + 1, t.length, `Line ${n}: An attribute line looks like \`type name\`, for example \`int artist_id PK\`.`);
          return;
        }
        block.entity.attributes.push({ type: m[1], name: m[2], keys: k[1] ? k[1].split(/\s*,\s*/) : [], comment: k[2] || '' });
        return;
      }

      if (!seenContent) {
        seenContent = true;
        const h = /^erDiagram\b\s*(.*)$/.exec(t);
        if (h) {
          model.hasHeader = true;
          if (!h[1]) return;
          t = h[1];
        }
      }

      if (RE_IGNORED.test(t)) return; // Mermaid styling: doesn't change the picture

      let m = RE_BLOCK_OPEN.exec(t);
      if (m) {
        const entity = ensure(m[1], n);
        if (!m[2]) block = { entity, line: n };
        return;
      }
      m = RE_NAME_ONLY.exec(t);
      if (m) { ensure(m[1], n); return; }

      m = RE_WORDS.exec(t);
      if (m) {
        const aCol = line.indexOf(m[2], lead + m[1].length) + 1;
        const bCol = line.indexOf(m[4], aCol - 1 + m[2].length + m[3].length) + 1;
        addRel(m[1], m[5], WORD_KINDS[m[2]], WORD_KINDS[m[4]], m[3] === 'optionally to', m[6], n,
          { line: n, col: aCol, length: m[2].length }, { line: n, col: bCol, length: m[4].length });
        return;
      }

      m = RE_REL.exec(t);
      if (!m || !looksLikeSymbol(m[2])) {
        fail(n, lead + 1, t.length, `Line ${n}: This line isn't a relationship, an entity, or an attribute block.`);
        return;
      }
      const symCol = line.indexOf(m[2], lead + m[1].length) + 1;
      const sym = readSymbol(m[2], n);
      if (sym.error) { fail(n, symCol, m[2].length, sym.error); return; }
      const rest = m[3] || '';
      const second = RE_SECOND.exec(rest.trim());
      if (!second) {
        if (!rest.trim() || rest.trim().startsWith(':')) fail(n, symCol, m[2].length, `Line ${n}: This relationship needs an entity on each side.`);
        else fail(n, line.indexOf(rest.trim(), symCol) + 1, rest.trim().length, `Line ${n}: Put a \`:\` before the label.`);
        return;
      }
      addRel(m[1], second[1], sym.aEnd, sym.bEnd, sym.dashed, second[2], n,
        { line: n, col: symCol, length: 2 }, { line: n, col: symCol + 4, length: 2 });
    });

    if (block) fail(block.line, 1, lines[block.line - 1].length, `Line ${block.line}: This attribute block is missing its closing \`}\`.`);
    if (missingLabel) model.notes.push(LABEL_NOTE);
    if (seenContent && !model.hasHeader) model.notes.push(HEADER_NOTE);
    return model;
  }

  const api = { END_KINDS, parseErd };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
