// Constraint Gauntlet: the SQL tab (spec §5.2). SQL Studio's CodeMirror editor, made once per level and
// kept between renders. Run runs the statement the cursor is in; Run all (Level 7) runs every statement.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h, icon } = SS;

  function ensureEditor(ctx) {
    const ui = ctx.ui;
    if (ui.sql && ui.sql.levelId === ctx.level.id) return ui.sql;
    const host = h('div', { class: 'editor-host' });
    const editor = SS.createEditor(host, { onRun: () => runCurrent(ctx), onFormat: () => {}, onChange: () => {} });
    // Level 7: the cards, in the same shuffled order the Row form shows.
    const start = ctx.level.cards ? ctx.level.shuffled(ctx.level.cards).map(c => c.sql).join('\n') : (ctx.level.sqlStart || '');
    editor.setText(start, null, { keepHistory: false });
    editor.setSchema(CG.toStudioSchema(ctx.session.game.tables));
    ui.sql = { levelId: ctx.level.id, host, editor };
    return ui.sql;
  }

  function runCurrent(ctx) {
    const { editor } = ensureEditor(ctx);
    const text = editor.getText();
    const stmt = SS.statementAt(text, editor.getCursorIndex());
    if (!stmt) { ctx.act.runSql('', 'sql'); return; }
    editor.flash(stmt.start, stmt.end);
    const r = ctx.act.runSql(stmt.text, 'sql');
    if (r && r.type === 'syntax' && r.explained.offset !== null && r.explained.offset !== undefined) {
      editor.markError(stmt.start + r.explained.offset, r.explained.length);
    }
  }

  function runAll(ctx) {
    const { editor } = ensureEditor(ctx);
    ctx.act.runAll(editor.getText());
  }

  function renderSql(body, ctx) {
    const { host, editor } = ensureEditor(ctx);
    editor.setSchema(CG.toStudioSchema(ctx.session.game.tables));
    const runBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => runCurrent(ctx), 'aria-keyshortcuts': SS.isMac ? 'Meta+Enter' : 'Control+Enter',
      title: `Run the statement your cursor is in (${SS.modKey}+Enter)` }, icon('play'), 'Run');
    const allBtn = ctx.level.cards ? h('button', { type: 'button', class: 'btn', onclick: () => runAll(ctx), title: 'Run every statement, top to bottom' }, icon('rows'), 'Run all') : null;
    const bar = h('div', { class: 'run-row cg-run-row' },
      h('span', { class: 'hint-text' }, icon('info'), `${SS.modKey}+Enter runs the statement your cursor is in.`),
      allBtn, runBtn);
    SS.clear(body).append(h('div', { class: 'cg-sql' }, bar, host));
    setTimeout(() => editor.refresh(), 0);
  }

  function setSqlText(ctx, text) {
    const { editor } = ensureEditor(ctx);
    editor.setText(text);
  }

  CG.renderSql = renderSql;
  CG.setSqlText = setSqlText;
  CG.runCurrentSql = runCurrent;
})(this);
