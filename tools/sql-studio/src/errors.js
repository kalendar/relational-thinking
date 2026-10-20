// SQL Studio: rewrites SQLite error messages in plain words and finds where the problem starts.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const T = isNode ? require('./sql-text.js') : root.SS;

  const FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'ABS', 'UPPER', 'LOWER', 'LENGTH', 'SUBSTR', 'TRIM', 'REPLACE',
    'COALESCE', 'IFNULL', 'NULLIF', 'DATE', 'TIME', 'DATETIME', 'STRFTIME', 'JULIANDAY', 'CAST', 'TOTAL', 'GROUP_CONCAT', 'INSTR', 'PRINTF'];

  // Names students often guess from Excel or other databases.
  const SYNONYMS = { AVERAGE: 'AVG', MEAN: 'AVG', MAXIMUM: 'MAX', MINIMUM: 'MIN', CNT: 'COUNT', COUNTA: 'COUNT', LEN: 'LENGTH', MID: 'SUBSTR', SUBSTRING: 'SUBSTR', TODAY: 'DATE', NOW: 'DATETIME' };

  function distance(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Two swapped letters (FORM / FROM) count as one typo.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }

  function closest(word, candidates, maxDistance = 2) {
    let best = null;
    let bestD = maxDistance + 1;
    for (const c of candidates) {
      const dd = distance(word, c);
      if (dd > 0 && dd < bestD) { best = c; bestD = dd; }
    }
    return best;
  }

  const code = s => '`' + s + '`';
  const meaningful = text => T.tokenize(text).filter(t => t.type !== 'ws' && t.type !== 'comment');

  // Finds the first token matching `pred`, as {offset, length}.
  function findTok(text, pred) {
    const t = meaningful(text).find(pred);
    return t ? { offset: t.start, length: t.end - t.start } : { offset: null, length: 0 };
  }
  const sameWord = w => t => t.text.toLowerCase() === String(w).toLowerCase() || (t.type === 'qident' && t.text.slice(1, -1).toLowerCase() === String(w).toLowerCase());

  // Finds "alias.column" as one span (three tokens: word . word).
  function findQualified(text, qual, col) {
    const toks = meaningful(text);
    for (let i = 0; i + 2 < toks.length; i++) {
      if (sameWord(qual)(toks[i]) && toks[i + 1].text === '.' && sameWord(col)(toks[i + 2])) return { offset: toks[i].start, length: toks[i + 2].end - toks[i].start };
    }
    return findTok(text, sameWord(col));
  }

  // The word in "near X" can appear more than once. Ask SQLite which one: cut the query off right after each
  // copy, and the first cut that gives the same error (not "incomplete input") is where it really breaks.
  function findSyntaxSpot(text, word, message, probe) {
    const toks = meaningful(text).filter(sameWord(word));
    if (probe && toks.length > 1) {
      for (const t of toks) {
        if (probe(text.slice(0, t.end)) === message) return { offset: t.start, length: t.end - t.start };
      }
    }
    return toks.length ? { offset: toks[0].start, length: toks[0].end - toks[0].start } : { offset: null, length: 0 };
  }

  const tableNames = schema => (schema ? schema.tables.map(t => t.name) : []);
  const columnNames = schema => (schema ? [...new Set(schema.tables.flatMap(t => t.columns.map(c => c.name)))] : []);
  const didYouMean = s => (s ? ` Did you mean ${code(s)}?` : '');

  const RULES = [
    [/no such column: ([^.\s]+)\.(\S+)/, (m, text, schema) => {
      const table = T.aliasMap(text, tableNames(schema)).get(m[1].toLowerCase());
      const where = table ? `in the ${code(table)} table` : `in ${code(m[1])}`;
      const t = table && schema.tables.find(x => x.name === table);
      const hint = t ? didYouMean(closest(m[2], t.columns.map(c => c.name))) : '';
      return [`There's no column called ${code(m[2])} ${where}.${hint}`, findQualified(text, m[1], m[2])];
    }],
    [/no such column: (\S+)/, (m, text, schema) => [
      `There's no column called ${code(m[1])} in the tables this query uses.${didYouMean(closest(m[1], columnNames(schema))) || ' Check the spelling, or look at the ERD.'}`,
      findTok(text, sameWord(m[1]))]],
    [/no such table: (\S+)/, (m, text, schema) => [
      `There's no table called ${code(m[1])}.${didYouMean(closest(m[1], tableNames(schema)))}`,
      findTok(text, sameWord(m[1]))]],
    [/unrecognized token: "(.*)"$/, (m, text) => {
      const tok = T.tokenize(text).find(t => t.open);
      if (tok && tok.type === 'string') return [`There's a text value with no closing quote. Text values need a ${code("'")} on both sides.`, { offset: tok.start, length: tok.end - tok.start }];
      return [`SQL doesn't recognize ${code(m[1])}. Check for a stray symbol.`, findTok(text, t => t.text === m[1])];
    }],
    [/incomplete input/, (m, text) => [
      `The query stops too early. Is something missing at the end, like a closing ${code(')')} or ${code("'")}?`,
      { offset: text.replace(/\s+$/, '').length, length: 0 }]],
    [/near "(.+?)": syntax error/, (m, text, schema, opts) => {
      const loc = findSyntaxSpot(text, m[1], m[0], opts.probe);
      if (/^(SELECT|WITH)$/i.test(m[1]) && loc.offset > 0) {
        return [`SQL got confused at ${code(m[1].toUpperCase())}. Did you forget a ${code(';')} between two queries?`, loc];
      }
      const kw = /^[A-Za-z]+$/.test(m[1]) && !T.isKeyword(m[1]) ? closest(m[1].toUpperCase(), [...T.KEYWORDS], 1) : null;
      if (kw) return [`SQL didn't understand the word ${code(m[1])}. Did you mean ${code(kw)}?`, loc];
      return [`SQL got confused at ${code(m[1])}. Check the word just before it: a missing comma, quote, or keyword is common.`, loc];
    }],
    [/ambiguous column name: (?:(\S+)\.)?(\S+)/, (m, text, schema) => {
      // The first table named in FROM/JOIN that has this column.
      const used = schema ? [...new Set(T.aliasMap(text, tableNames(schema)).values())] : [];
      const owner = used.map(n => schema.tables.find(t => t.name === n)).find(t => t.columns.some(c => c.name.toLowerCase() === m[2].toLowerCase()));
      const example = `${owner ? owner.name : 'TableName'}.${m[2]}`;
      return [`More than one table has a column called ${code(m[2])}. Say which one you mean, like ${code(example)}.`, findTok(text, sameWord(m[2]))];
    }],
    [/misuse of aggregate(?: function)?:? (\w+)\(\)/, (m, text) => [
      `You can't use ${code(m[1].toUpperCase())} in ${code('WHERE')}. To filter on a total, use ${code('HAVING')} after ${code('GROUP BY')}.`,
      findTok(text, sameWord(m[1]))]],
    [/GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate query/, (m, text) => [
      `${code('HAVING')} filters groups, so it needs a ${code('GROUP BY')} first.`, findTok(text, sameWord('HAVING'))]],
    [/no such function: (\w+)/, (m, text) => [
      `SQLite doesn't have a function called ${code(m[1])}.${didYouMean(SYNONYMS[m[1].toUpperCase()] || closest(m[1].toUpperCase(), FUNCTIONS, 2))}`,
      findTok(text, sameWord(m[1]))]],
    [/wrong number of arguments to function (\w+)\(\)/, (m, text) => [
      `${code(m[1].toUpperCase())} was given the wrong number of values inside its parentheses.`, findTok(text, sameWord(m[1]))]],
    [/(\d+)\w* ORDER BY term out of range - should be between 1 and (\d+)/, (m, text) => {
      const toks = meaningful(text);
      const i = toks.findIndex((t, k) => t.text.toUpperCase() === 'ORDER' && toks[k + 1] && toks[k + 1].text.toUpperCase() === 'BY');
      const num = toks.slice(i + 2).find(t => t.type === 'number');
      const n = num ? num.text : m[1];
      const cols = Number(m[2]);
      return [`${code(`ORDER BY ${n}`)} means "sort by column ${n}," but your result only has ${cols} ${cols === 1 ? 'column' : 'columns'}.`,
        num ? { offset: num.start, length: num.end - num.start } : findTok(text, sameWord('ORDER'))];
    }],
    [/sub-select returns (\d+) columns - expected 1/, (m, text) => {
      const toks = meaningful(text);
      const inner = toks.find((t, k) => k > 0 && t.text.toUpperCase() === 'SELECT' && toks[k - 1].text === '(');
      return ['The query inside the parentheses should return just one column here.', inner ? { offset: inner.start, length: inner.end - inner.start } : { offset: null, length: 0 }];
    }],
  ];

  // opts.probe(sqlText) -> SQLite's error message or null (see db.probeError); optional, sharpens error locations.
  function explainError(error, statementText, schema, opts = {}) {
    const raw = (error && error.message) || '';
    if (error && error.kind === 'readonly') {
      return { headline: 'SQL Studio only runs queries that read data (SELECT). Changing data comes later in the course.', raw, ...findTok(statementText, () => true) };
    }
    if (error && error.kind === 'empty') return { headline: "There's no query here to run.", raw, offset: null, length: 0 };
    for (const [re, build] of RULES) {
      const m = re.exec(raw);
      if (m) {
        const [headline, loc] = build(m, statementText, schema, opts);
        return { headline, raw, offset: loc.offset, length: loc.length };
      }
    }
    return { headline: 'Something went wrong running this query.', raw, offset: null, length: 0 };
  }

  const api = { explainError, closest };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
