// Constraint Gauntlet: state and wiring. One session per open level; every action goes through it,
// then the views re-render from session.state(). Met goals are saved (and never removed).
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  const memStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
  const storage = (() => { try { const s = root.localStorage; s.getItem('cg-probe'); return s; } catch (_) { return memStore(); } })();

  function decodeBase64(b64) {
    const bin = root.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function start() {
    const appEl = document.getElementById('app');
    let SQL;
    try { SQL = await root.initSqlJs({ wasmBinary: decodeBase64(root.CG_WASM_BASE64) }); } catch (e) {
      SS.clear(appEl).append(h('div', { class: 'err-box', role: 'alert', style: { margin: '24px' } },
        h('p', { class: 'headline' }, 'The Gauntlet couldn’t start its database.'),
        h('p', null, 'Try reloading, or use a recent version of Chrome, Edge, Firefox, or Safari.'),
        h('details', null, h('summary', null, 'Details'), h('code', null, String(e && e.message)))));
      return;
    }
    const levels = CG.levels;
    const progress = CG.loadProgress(storage);
    let ctx = null;
    const layout = CG.createLayout(appEl, { storage, levels, onPickLevel: id => pick(id), onResetLevel: () => resetLevel() });

    const freshUi = () => ({ mode: progress.mode, tableTab: null, selected: null, form: null, lastResult: null, flashN: 0, fix: {},
      predictOpen: null, predictSkipped: {}, bonusOpen: false, decisions: null, batch: null, cards: null, judge: null, judgeResult: null,
      readErrorAnswer: null, sql: null, focusAfter: null });

    function levelFromHash() {
      const m = /^#level-(\d+)$/.exec(root.location.hash || '');
      const id = m ? Number(m[1]) : 1;
      return levels.some(l => l.id === id) ? id : 1;
    }

    function open(id) {
      if (ctx) ctx.session.close();
      const level = levels.find(l => l.id === id);
      ctx = { level, session: CG.createSession(SQL, level), progress, layout, ui: freshUi(), render };
      ctx.act = actions(ctx);
      layout.picker.value = String(id);
      try { root.history.replaceState(null, '', `#level-${id}`); } catch (_) { /* file:// in some browsers */ }
      render();
      SS.announce(`Level ${level.id}: ${level.title}. ${level.mission}`);
    }

    function pick(id) {
      if (ctx && ctx.session.state().log.length &&
        !root.confirm('Leave this level? Your rows here will be cleared, but your check marks stay.')) {
        layout.picker.value = String(ctx.level.id);
        return;
      }
      open(id);
    }

    function resetLevel() {
      if (!root.confirm('Reset this level? Your rows go back to the start. Your check marks stay.')) return;
      const keepSql = ctx.ui.sql;
      ctx.session.reset();
      ctx.ui = Object.assign(freshUi(), { sql: keepSql });
      if (keepSql) CG.setSqlText(ctx, ctx.level.cards ? ctx.level.shuffled(ctx.level.cards).map(c => c.sql).join('\n') : ctx.level.sqlStart || '');
      ctx.ui.lastResult = { type: 'info', text: 'The level is back to its starting rows. Your check marks stay.' };
      render();
    }

    function saveGoals() {
      const goals = ctx.session.goals();
      const key = String(ctx.level.id);
      const before = new Set((progress.levels[key] || { goals: [] }).goals);
      const wasComplete = !!(progress.levels[key] && progress.levels[key].complete);
      const met = goals.filter(g => g.met).map(g => g.id);
      const all = new Set([...before, ...met]);
      const complete = goals.every(g => g.optional || all.has(g.id));
      const fresh = goals.filter(g => g.met && !before.has(g.id));
      CG.markGoals(progress, ctx.level.id, met, complete);
      if (fresh.length || (complete && !wasComplete)) CG.saveProgress(storage, progress);
      return { fresh, newlyComplete: complete && !wasComplete };
    }

    function renderModeTabs(panel) {
      if (CG.boardKind(ctx.level) === 'decide') { SS.clear(panel.headSlot); return; }
      const tab = (m, label) => h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(ctx.ui.mode === m),
        onclick: () => ctx.act.setMode(m) }, label);
      SS.clear(panel.headSlot).append(h('div', { class: 'tabs cg-modes', role: 'tablist', 'aria-label': 'How to enter data' }, tab('form', 'Row form'), tab('sql', 'SQL')));
    }

    function variantBar() {
      const vt = ctx.level.variantToggle;
      if (!vt) return null;
      const inVariant = ctx.session.game.variant === vt.name;
      if (!inVariant && !CG.goalMet(ctx, vt.unlockAfter)) return null;
      return h('div', { class: `cg-variant${inVariant ? ' on' : ''}` },
        h('span', null, icon(inVariant ? 'unlock' : 'lock'), ' ', inVariant ? h('strong', null, ctx.level.variants[vt.name].label) : 'Strict version: every column is NOT NULL.'),
        h('button', { type: 'button', class: 'btn', onclick: () => ctx.act.switchVariant(inVariant ? null : vt.name) }, inVariant ? vt.back : vt.label));
    }

    function renderInput() {
      const panel = layout.input;
      renderModeTabs(panel);
      const kind = CG.boardKind(ctx.level);
      const content = h('div', { class: 'cg-input-content' });
      const parts = [variantBar(), CG.renderBoard(ctx), content];
      SS.clear(panel.body).append(...parts.filter(Boolean));
      if (kind === 'decide') return;
      if (ctx.ui.mode === 'sql') { CG.renderSql(content, ctx); return; }
      if (kind === 'cards' || kind === 'policies') {
        const holder = h('div');
        const det = h('details', { class: 'cg-more', open: kind === 'cards' && ctx.session.fixUnlocked('Team') ? true : null },
          h('summary', null, kind === 'cards' ? 'Add or edit a row yourself (for the bonus)' : 'Add, edit, or delete rows yourself'), holder);
        content.append(det);
        CG.renderRowForm(holder, ctx);
        return;
      }
      CG.renderRowForm(content, ctx);
    }

    function renderHeader() {
      const goals = ctx.session.goals().filter(g => !g.optional);
      const met = goals.filter(g => g.met || CG.goalMet(ctx, g.id)).length;
      layout.mission.textContent = ctx.level.mission;
      layout.progressLine.textContent = `Chapter ${ctx.level.section} · ${met} of ${goals.length} goals`;
      Array.from(layout.picker.options).forEach(o => {
        const l = levels.find(x => String(x.id) === o.value);
        const done = progress.levels[o.value] && progress.levels[o.value].complete;
        o.textContent = `${l.id}. ${l.title}${done ? ' ✓' : ''}`;
      });
    }

    // Re-rendering rebuilds the panels, so remember which control had focus and put focus back on its match.
    const AREAS = '.goals-strip, .input-panel, .tables-panel, .cg-result-area, .rules-panel, .top';
    function focusKey() {
      const el = document.activeElement;
      if (!el || el === document.body || !el.closest || !el.closest('#app')) return null;
      const area = el.closest(AREAS);
      const AREA_NAMES = ['goals-strip', 'input-panel', 'tables-panel', 'cg-result-area', 'rules-panel', 'top'];
      return { area: area ? AREA_NAMES.find(c => area.classList.contains(c)) || null : null, id: el.id || null,
        tag: el.tagName, type: el.type || null, name: el.getAttribute('name'), value: el.type === 'radio' ? el.value : null,
        label: el.getAttribute('aria-label'), text: (el.textContent || '').trim().slice(0, 80), cm: !!el.closest('.CodeMirror') };
    }
    function restoreFocus(k) {
      if (!k || k.cm) return;
      if (k.id) { const el = document.getElementById(k.id); if (el) { el.focus({ preventScroll: true }); return; } }
      const scope = (k.area && document.querySelector(`.${k.area}`)) || document;
      const all = Array.from(scope.querySelectorAll(k.tag.toLowerCase()));
      const match = all.find(el => (k.value !== null ? el.name === k.name && el.value === k.value
        : k.label ? el.getAttribute('aria-label') === k.label : (el.textContent || '').trim().slice(0, 80) === k.text && k.text));
      if (match && !match.disabled) match.focus({ preventScroll: true });
    }

    function render() {
      const keep = focusKey();
      const { fresh, newlyComplete } = saveGoals();
      renderHeader();
      CG.renderGoals(layout.goals, ctx);
      renderInput();
      CG.renderTables(layout.tables, ctx);
      CG.renderResult(layout.resultArea, ctx);
      CG.renderRules(layout.rules, ctx);
      if (newlyComplete) SS.announce(`Level complete! ${SS.plain(ctx.level.done)}`);
      else if (fresh.length) setTimeout(() => SS.announce(`Goal done: ${SS.plain(fresh.map(g => g.text).join('. '))}`), 400);
      const after = ctx.ui.focusAfter && document.querySelector(ctx.ui.focusAfter);
      ctx.ui.focusAfter = null;
      if (after) after.focus({ preventScroll: true });
      else if (keep && (!document.activeElement || document.activeElement === document.body)) restoreFocus(keep);
    }

    function actions(c) {
      const ui = () => c.ui;
      const s = c.session;
      function after(r) {
        ui().lastResult = r;
        if (r && r.type === 'attempt') {
          ui().flashN = r.attempt.n;
          const a = r.attempt;
          SS.announce(a.outcome === 'rejected' ? `Rejected. ${SS.plain(a.error.headline)}` : a.outcome === 'slipped' ? 'Slipped through! The database accepted a row that breaks a business rule.' : `Accepted. Row ${a.kind === 'insert' ? 'added' : a.kind === 'update' ? 'changed' : 'deleted'}.`);
        } else if (r && r.type === 'syntax') SS.announce(SS.plain(r.explained.headline));
        else if (r && r.type === 'blocked') SS.announce(SS.plain(r.message));
        render();
        return r;
      }
      const info = (text, tone) => { ui().lastResult = { type: 'info', text, tone }; SS.announce(SS.plain(text)); render(); };
      return {
        runSql: (text, source = 'sql') => after(s.run(text, source)),
        runAll(text) {
          const results = s.runAll(text, 'sql');
          const last = results.filter(x => x.attempt).pop();
          if (last) ui().flashN = last.attempt.n;
          ui().lastResult = { type: 'many', results };
          SS.announce(`Ran ${results.length} statements.`);
          render();
        },
        submitForm() {
          const f = ui().form;
          if (!f) return;
          const st = s.state();
          const t = CG.findTable(st.tables, f.table);
          const sel = ui().selected && ui().selected.table === t.name ? st.rows[t.name].find(r => r._rowid === ui().selected.rowid) : null;
          if (f.action !== 'add' && !sel) return;
          const r = s.runForm(f.table, f.action, f.fields, sel);
          if (r.type === 'form') { f.problems = r.problems || {}; f.invalid = []; ui().lastResult = r; render(); return; }
          f.problems = {};
          f.invalid = r.type === 'attempt' && r.attempt.outcome === 'rejected' ? r.attempt.error.columns || [] : [];
          if (r.type === 'attempt' && r.attempt.outcome !== 'rejected') {
            if (f.action === 'add') f.fields = null;
            if (f.action === 'delete') { ui().selected = null; f.action = 'add'; f.fields = null; }
            if (f.action === 'edit') f.forRowid = null;
          }
          ui().tableTab = f.table;
          ui().focusAfter = '.input-panel .cg-actions .btn.primary';
          after(r);
        },
        selectRow(table, rowid) {
          const cur = ui().selected;
          ui().selected = cur && cur.table === table && cur.rowid === rowid ? null : { table, rowid };
          const f = ui().form;
          if (f && (c.level.formTables || s.game.tables.map(t => t.name)).includes(table)) {
            if (f.table !== table) { f.table = table; f.fields = null; }
            f.forRowid = null;
            if (f.action === 'add' && ui().selected) f.action = 'edit';
          }
          ui().focusAfter = ui().selected ? '.tables-panel tr[aria-selected="true"]' : null;
          render();
        },
        setMode(m) { ui().mode = m; progress.mode = m; CG.saveProgress(storage, progress); render(); },
        openInSql(text) {
          if (/^--/.test(text)) return;
          ui().mode = 'sql'; progress.mode = 'sql'; CG.saveProgress(storage, progress);
          render();
          CG.setSqlText(c, text);
        },
        predict(id, choice) {
          const r = s.predict(id, choice);
          const p = (c.level.predict || []).find(x => x.id === id);
          const then = ui().predictOpen && ui().predictOpen.id === id ? ui().predictOpen.then : p.then;
          ui().predictOpen = { id, then, result: { choice, answer: r.answer, why: r.why } };
          SS.announce(`${r.correct ? 'Right.' : 'Here’s what happens.'} ${SS.plain(r.why || '')}`);
          render();
        },
        runPredictThen() {
          const then = ui().predictOpen && ui().predictOpen.then;
          ui().predictOpen = null;
          if (then) after(s.run(then, 'sql'));
        },
        askDelete() { ui().predictOpen = { id: 'blast', result: null, then: 'DELETE FROM Student WHERE student_id = 2;' }; render(); },
        switchVariant(name) {
          s.switchVariant(name);
          ui().selected = null; ui().form = null;
          info(name ? `You’re in the ${SS.plain(c.level.variants[name].label).replace(/^Loose version: /, 'loose version, where ')}. The data is back to its starting rows.` : 'Back to the strict version. The data is back to its starting rows.');
        },
        tryFix(choice, f) {
          const r = s.tryFix(choice);
          f.result = r.error ? { error: r.error } : r;
          f.apply = null;
          if (r.passed) ui().focusAfter = '.cg-fix .cg-actions .btn.primary';
          SS.announce(r.error ? SS.plain(r.error) : r.passed ? 'This rule passes the test.' : 'This rule fails the test. Look at the rows marked with an X.');
          render();
        },
        applyFix(choice, f, cleanup) {
          const r = s.applyFix(choice, { cleanup });
          f.apply = r;
          if (r.ok) {
            ui().selected = null; ui().form = null;
            if (ui().sql) ui().sql.editor.setSchema(CG.toStudioSchema(s.game.tables));
            info(`Your new rule is on the ${r.table} table. Try a row that used to get through.`);
          } else { ui().focusAfter = '.cg-cleanup .cg-actions .btn'; SS.announce('Your table already has rows that break this rule.'); render(); }
        },
        decide(choices) {
          const r = s.decide(choices);
          ui().batch = r;
          ui().flashN = 0;
          info(r.clean ? 'Batch loaded. Every real row went in and every bad row was refused.' : 'Batch loaded, but some rows went the wrong way. Look at the lists on the board.', r.clean ? null : 'warn');
        },
        setPolicies(map) {
          const r = s.setPolicies(map);
          if (r.ok) info(Object.entries(map).map(([k, v]) => `\`${k}\` is now \`ON DELETE ${v}\`.`).join(' '));
          else info('That rule can’t be added to the current data.', 'bad');
        },
        resetData() { s.resetData(); ui().selected = null; ui().form = null; info('Fresh data loaded. Your rules and check marks stay.'); },
        softDelete: (table, key) => after(s.softDelete(table, key)),
        judge(map) {
          if (Object.values(map).some(v => !v)) { info('Choose a rule for every relationship first.', 'warn'); return; }
          ui().judgeResult = s.judgePolicies(map);
          info(ui().judgeResult.passed ? 'Good choices. Each relationship has a rule that fits it.' : 'Not yet. Look at the rows marked with an X.', ui().judgeResult.passed ? null : 'warn');
        },
        runCard(cd, bonus) {
          const r = s.run(cd.sql, 'card');
          const k = ui().cards;
          if (r.type === 'attempt' && r.attempt.outcome !== 'rejected') {
            (bonus ? k.bonusLoaded : k.loaded).push(cd.id);
            k.bounced = null;
          } else if (r.type === 'attempt') {
            k.bounced = { id: cd.id, message: r.attempt.error.headline };
            k.bounces += 1;
          }
          after(r);
        },
        readError(pickVals) { s.setFlag('readError'); ui().readErrorAnswer = { pick: pickVals }; render(); },
        openHomework(opener) {
          const st = s.state();
          const fixedLines = s.fixList().filter(fx => st.flags[`applied:${fx.table}`])
            .map(fx => ({ table: fx.table, shown: CG.createTableSql(CG.findTable(st.tables, fx.table), { hidden: false }) }));
          CG.showHomework({ level: c.level, text: CG.homeworkText(c.level, st, { fixedLines }), opener });
        },
      };
    }

    open(levelFromHash());
    root.addEventListener('hashchange', () => { const id = levelFromHash(); if (!ctx || id !== ctx.level.id) pick(id); });
  }

  start();
})(this);
