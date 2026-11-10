// Constraint Gauntlet: the session. Every student action goes through here, so the browser and the
// tests drive the tool the same way (the levels test plays each level's scripted solution through it).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const CG = isNode ? Object.assign({}, require('./schema.js'), require('./db.js'), require('./statement.js'), require('./rowform-sql.js'),
    require('./probe.js'), require('./blast.js'), require('./constraint-errors.js'), require('./rules.js'), require('./goals.js'),
    require('./rebuild.js')) : root.CG;
  const SSE = isNode ? require('../../sql-studio/src/errors.js') : root.SS;

  const fixList = level => (!level.fix ? [] : Array.isArray(level.fix) ? level.fix : [level.fix]);

  function createSession(SQL, level) {
    let game = null;
    let log = [];
    let predictions = {};
    let fixes = [];
    let flags = {};
    let policies = {};
    let n = 0;

    function initialPolicies() {
      const out = {};
      for (const link of level.policyLinks || []) {
        const [t, c] = link.split('.');
        out[link] = CG.findColumn(CG.findTable(level.tables, t), c).fk.onDelete || 'RESTRICT';
      }
      return out;
    }
    function open(variant) { if (game) CG.closeLevel(game); game = CG.openLevel(SQL, level, { variant }); }
    function reset() {
      open(level.startVariant || null);
      log = []; predictions = {}; fixes = []; flags = {}; n = 0;
      policies = initialPolicies();
    }
    reset();

    const names = () => game.tables.map(t => t.name);
    const fixFor = table => fixList(level).find(f => !table || f.table === table) || null;

    // Write-statement mistakes SQL Studio never sees (it only runs SELECT), then SQL Studio's own messages.
    function writeSyntax(message) {
      let m;
      const code = s => '`' + s + '`';
      if ((m = /table (\w+) has no column named (\w+)/.exec(message))) {
        const t = CG.findTable(game.tables, m[1]);
        const near = t ? SSE.closest(m[2], t.columns.map(c => c.name)) : null;
        return `There's no column called ${code(m[2])} in the ${m[1]} table.${near ? ` Did you mean ${code(near)}?` : ''}`;
      }
      if ((m = /table (\w+) has (\d+) columns but (\d+) values were supplied/.exec(message))) {
        return `The ${m[1]} table has ${m[2]} columns, but you gave ${m[3]} ${m[3] === '1' ? 'value' : 'values'}. List the columns you're filling in, or give a value for every column.`;
      }
      if ((m = /(\d+) values for (\d+) columns/.exec(message))) {
        return `You gave ${m[1]} ${m[1] === '1' ? 'value' : 'values'} for ${m[2]} columns. Each column in the list needs exactly one value.`;
      }
      return null;
    }
    function syntax(text, message) {
      const own = writeSyntax(message);
      const explained = own ? { headline: own, raw: message, offset: null, length: 0 }
        : SSE.explainError({ kind: 'sqlite', message }, text, CG.toStudioSchema(game.tables));
      return { type: 'syntax', explained };
    }

    function run(text, source = 'sql') {
      const cls = CG.classify(text, names());
      if (!cls.ok) return { type: 'blocked', reason: cls.reason, message: cls.message };
      if (cls.kind === 'select') {
        try { const r = CG.readQuery(game, text); return { type: 'select', columns: r.columns, rows: r.rows }; } catch (e) { return syntax(text, e.message); }
      }
      const p = CG.probe(game, text, cls);
      if (!p.ok) return syntax(text, p.message);
      const broken = new Set();
      if (cls.kind === 'insert') for (const r of p.added) CG.brokenRules(level, cls.table, r, CG.makeCtx(game)).forEach(x => broken.add(x));
      if (cls.kind === 'update') for (const c of p.changed) CG.brokenRules(level, cls.table, c.after, CG.makeCtx(game, c.after._rowid)).forEach(x => broken.add(x));
      const before = cls.kind === 'delete' ? CG.snapshotCounts(game) : null;
      const attempt = {
        n: ++n, source, kind: cls.kind, table: cls.table, sql: text.trim(),
        rows: cls.kind === 'delete' ? p.removed : cls.kind === 'insert' ? p.added : p.changed.map(c => c.after),
        changed: p.changed, outcome: 'accepted', error: null, broken: [...broken], blast: null,
        variant: game.variant, policies: Object.keys(policies).length ? Object.assign({}, policies) : null, tooStrict: false,
      };
      try {
        game.db.run(text);
        if (attempt.broken.length) attempt.outcome = 'slipped';
        if (before) attempt.blast = CG.blastBetween(before, CG.snapshotCounts(game));
      } catch (e) {
        attempt.outcome = 'rejected';
        attempt.error = /constraint failed/.test(e.message)
          ? CG.explainConstraint(game, { kind: cls.kind, table: cls.table, probe: p }, e.message)
          : { kind: 'other', headline: "Something went wrong. (SQLite's message is shown below.)", chips: { table: cls.table, rule: '', value: '' }, columns: [], raw: e.message };
        if (before) attempt.blast = { removed: {}, nulled: {}, total: 0, blocked: true };
        const fx = fixFor(cls.table);
        if (fx && fx.unlock === 'too-strict' && fx.table === cls.table && !attempt.broken.length && cls.kind !== 'delete') {
          attempt.tooStrict = true;
          flags.tooStrict = true;
        }
      }
      log.push(attempt);
      return { type: 'attempt', attempt };
    }

    function runForm(tableName, action, fields, keyRow) {
      const t = CG.findTable(game.tables, tableName);
      if (action === 'delete') return run(CG.deleteSql(t, keyRow), 'form');
      const parsed = CG.parseForm(t, fields);
      if (!parsed.ok) return { type: 'form', problems: parsed.problems };
      if (action === 'edit') {
        const sql = CG.updateSql(t, parsed.row, keyRow);
        return sql ? run(sql, 'form') : { type: 'form', problems: {}, message: 'Nothing changed. Edit a field first.' };
      }
      return run(CG.insertSql(t, parsed.row), 'form');
    }

    function runAll(texts, source = 'sql') {
      const SST = isNode ? require('../../sql-studio/src/sql-text.js') : root.SS;
      const list = Array.isArray(texts) ? texts : SST.splitStatements(texts).filter(p => !p.empty).map(p => p.text);
      return list.map(t => run(t, source));
    }

    function predict(id, choice) {
      const p = (level.predict || []).find(x => x.id === id);
      if (!p) throw new Error(`Level ${level.id}: no prediction "${id}"`);
      const answer = typeof p.answer === 'function' ? p.answer(api) : p.answer;
      predictions[id] = choice;
      const why = typeof p.why === 'function' ? p.why(api, answer) : p.why;
      return { correct: choice === answer, answer, why };
    }

    function switchVariant(name) { open(name || null); return state(); }

    function newDefFor(choice) {
      const fx = fixFor(choice.table);
      if (!fx) throw new Error(`Level ${level.id} has no fix${choice.table ? ` for ${choice.table}` : ''}`);
      const def = CG.findTable(game.tables, fx.table);
      if (choice.optionId) {
        const opt = fx.options.find(o => o.id === choice.optionId);
        if (!opt) throw new Error(`Level ${level.id}: no fix option "${choice.optionId}"`);
        return { fx, opt, def: CG.applyOption(def, opt) };
      }
      const column = choice.column || fx.column;
      let expr = choice.expr;
      if (choice.builder) {
        const b = CG.buildExpression(def, Object.assign({ column }, choice.builder));
        if (!b.ok) return { fx, error: b.message };
        expr = b.expr;
      } else {
        const c = CG.checkExpression(game, expr, def);
        if (!c.ok) return { fx, error: c.message };
        expr = c.expr;
      }
      return { fx, opt: null, expr, def: CG.withCheck(def, column, expr) };
    }

    function tryFix(choice) {
      const d = newDefFor(choice);
      if (d.error) return { passed: false, error: d.error, rows: [] };
      const newTables = game.tables.map(t => (t.name === d.fx.table ? d.def : t));
      const res = d.fx.test === false ? { passed: true, rows: [] } : CG.fixTest(SQL, level, newTables, d.fx.table, log);
      fixes.push({ table: d.fx.table, optionId: choice.optionId || null, expr: d.expr || null, passed: res.passed });
      return Object.assign(res, { table: d.fx.table, expr: d.expr || null, why: d.opt ? d.opt.why : null, correct: d.opt ? d.opt.correct : null,
        shown: CG.createTableSql(d.def, { hidden: false }) });
    }

    function applyFix(choice, { cleanup = null } = {}) {
      const d = newDefFor(choice);
      if (d.error) return { ok: false, error: d.error };
      let r = CG.rebuildTable(game, d.def);
      if (!r.ok && cleanup === 'delete') {
        try {
          for (const pr of r.problems) {
            const t = CG.findTable(game.tables, r.reason === 'orphans' ? pr.explained.chips.table : d.fx.table);
            game.db.run(`DELETE FROM main.${t.name} WHERE rowid = ${Number(pr.row._rowid)}`);
          }
        } catch (e) {
          return Object.assign(r, { cleanupError: e.message });
        }
        r = CG.rebuildTable(game, d.def);
      } else if (!r.ok && cleanup === 'reset') {
        const keep = game.tables;
        CG.closeLevel(game);
        game = CG.openLevel(SQL, level, { tables: keep, variant: game.variant });
        r = CG.rebuildTable(game, d.def);
      }
      if (r.ok) flags[`applied:${d.fx.table}`] = true;
      return r.ok ? { ok: true, table: d.fx.table } : r;
    }

    function fixUnlocked(table) {
      const fx = fixFor(table);
      if (!fx) return false;
      const watch = fx.watch || [fx.table];
      if (fx.unlock === 'always') return true;
      if (fx.unlock === 'too-strict') return !!flags.tooStrict;
      if (fx.unlock === 'bounced') return log.some(a => a.outcome === 'rejected' && watch.includes(a.table));
      return log.some(a => a.outcome === 'slipped' && watch.includes(a.table));
    }

    // Level 2: choices = { 'Student.middle_name': { required: false, tag: 'na' }, … }
    function decide(choices) {
      const tables = level.tables.map(t => {
        const nt = CG.cloneTable(t);
        for (const c of nt.columns) { const ch = choices[`${t.name}.${c.name}`]; if (ch) c.notNull = !!ch.required; }
        return nt;
      });
      CG.closeLevel(game);
      game = CG.openLevel(SQL, level, { tables });
      const results = (level.batch || []).map(b => ({ b, r: run(CG.insertSql(CG.findTable(tables, b.table), b.row), 'batch') }));
      const tooStrict = results.filter(x => x.r.attempt && x.r.attempt.outcome === 'rejected' && !x.r.attempt.broken.length).map(x => x.b);
      const tooLoose = results.filter(x => x.r.attempt && x.r.attempt.outcome === 'slipped').map(x => x.b);
      const tagsWrong = (level.decisions || []).filter(d => {
        const ch = choices[`${d.table}.${d.column}`];
        return ch && !ch.required && d.key.tag && d.key.tag !== 'either' && ch.tag !== d.key.tag;
      });
      const clean = !tooStrict.length && !tooLoose.length && !tagsWrong.length &&
        (level.decisions || []).every(d => choices[`${d.table}.${d.column}`]);
      if (clean) flags.batchClean = true;
      return { tooStrict, tooLoose, tagsWrong, clean };
    }

    // Level 8: map = { 'Ticket.student_id': 'CASCADE', … }
    function setPolicies(map) {
      for (const [link, policy] of Object.entries(map)) {
        const [tn, cn] = link.split('.');
        const def = CG.cloneTable(CG.findTable(game.tables, tn));
        const col = CG.findColumn(def, cn);
        col.fk = Object.assign({}, col.fk, { onDelete: policy });
        const r = CG.rebuildTable(game, def);
        if (!r.ok) return r;
        policies[link] = policy;
        flags[`policy:${link}:${policy}`] = true;
      }
      return { ok: true, policies: Object.assign({}, policies) };
    }

    function softDelete(tableName, keyRow) {
      const t = CG.findTable(game.tables, tableName);
      const where = CG.pkColumns(t).map(k => `${k} = ${CG.literal(CG.findColumn(t, k), keyRow[k])}`).join(' AND ');
      const r = run(`UPDATE ${t.name} SET is_active = false WHERE ${where};`, 'form');
      if (r.type === 'attempt' && r.attempt.outcome !== 'rejected') flags.softDeleted = true;
      return r;
    }

    // Level 8 Round 3: map = { 'Ticket.student_id': 'RESTRICT', … } over level.policyKey.
    function judgePolicies(map) {
      const rows = (level.policyKey || []).map(k => {
        const choice = map[k.link];
        const ok = k.accept.includes(choice);
        return { link: k.link, label: k.label, choice, ok, best: k.best, note: (k.notes && k.notes[choice]) || '' };
      });
      const tables = level.tables.map(t => {
        const nt = CG.cloneTable(t);
        for (const c of nt.columns) if (c.fk && map[`${t.name}.${c.name}`]) c.fk.onDelete = map[`${t.name}.${c.name}`];
        return nt;
      });
      const g = CG.openLevel(SQL, level, { tables });
      const tests = (level.policyTests || []).map(pt => {
        const cls = CG.classify(pt.sql, tables.map(t => t.name));
        const p = CG.probe(g, pt.sql, cls);
        const sim = CG.simulateDelete(g, cls.table, p.removed);
        const total = Object.values(sim.removed).reduce((a, b) => a + b, 0);
        const text = sim.blocked ? 'Blocked. Nothing is deleted.'
          : `${total} ${total === 1 ? 'row' : 'rows'} deleted${Object.keys(sim.nulled).length ? `, and ${Object.entries(sim.nulled).map(([k, v]) => `${v} ${k} set to blank`).join(', ')}` : ''}.`;
        return { label: pt.label, text, blocked: !!sim.blocked, removed: sim.removed, nulled: sim.nulled };
      });
      CG.closeLevel(g);
      const passed = rows.length > 0 && rows.every(r => r.ok);
      if (passed) flags.policiesPassed = true;
      return { passed, rows, tests };
    }

    function report(id) {
      const r = (level.reports || []).find(x => x.id === id);
      if (!r) throw new Error(`Level ${level.id}: no report "${id}"`);
      return CG.readQuery(game, r.sql);
    }

    const goalState = () => ({ log, predictions, fixes, flags, policies, game, level, report: id => report(id).rows[0] });
    const goals = () => CG.evaluate(level, goalState());
    const complete = () => CG.complete(level, goalState());

    function state() {
      return {
        level, variant: game.variant, tables: game.tables,
        rows: Object.fromEntries(game.tables.map(t => [t.name, CG.tableRows(game, t.name)])),
        log: log.slice(), goals: goals(), complete: complete(), predictions: Object.assign({}, predictions),
        fixes: fixes.slice(), flags: Object.assign({}, flags), policies: Object.assign({}, policies),
      };
    }

    // Fresh data from the seed, keeping the current rules (Level 8 policies) and all progress.
    function resetData() {
      const keep = game.tables;
      const variant = game.variant;
      CG.closeLevel(game);
      game = CG.openLevel(SQL, level, { tables: keep, variant });
      return state();
    }

    function setFlag(name, value = true) { flags[name] = value; }
    function close() { CG.closeLevel(game); }

    const api = {
      level, get game() { return game; }, run, runForm, runAll, predict, switchVariant, fixList: () => fixList(level), fixFor, fixUnlocked,
      tryFix, applyFix, decide, setPolicies, softDelete, judgePolicies, report, goals, complete, state, reset, resetData, setFlag, close,
    };
    return api;
  }

  const api = { createSession, fixList };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
