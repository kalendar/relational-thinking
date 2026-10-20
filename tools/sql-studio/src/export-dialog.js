// SQL Studio: the "Copy for homework" dialog (pick an exercise, preview, copy or download). Same pattern as the Query Explorer's.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h } = SS;

  let current = null;
  const closeHomeworkDialog = () => { if (current) current.close(); };

  // schema: current schema; list: exercises (empty for uploads); index: current exercise;
  // sql: the statement to copy; result: SS.runQuery(...) of it, or null if there is none.
  function showHomeworkDialog({ schema, list, index, sql, result, opener }) {
    closeHomeworkDialog();
    const appEl = document.getElementById('app');
    const previous = opener || document.activeElement;
    const datasetLabel = schema.number ? `${schema.number}. ${schema.name}` : `${schema.name} (${schema.description})`;
    let done = false;

    const pickId = 'ss-hw-pick';
    const pick = list.length
      ? h('select', { id: pickId, onchange: update }, list.map((ex, i) => h('option', { value: String(i), selected: i === index }, `${SS.exerciseLabel(schema.number, i)} – ${ex.text}`)))
      : h('input', { id: pickId, type: 'text', placeholder: 'For example: Which customers spent the most?', oninput: update });
    const preview = h('pre', { class: 'hw-preview', tabindex: '0', 'aria-label': 'Preview of what will be copied' });
    const status = h('p', { class: 'hw-status', role: 'status' });
    const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: onCopy }, 'Copy');
    const dlBtn = h('button', { class: 'btn', type: 'button', onclick: onDownload }, 'Download .txt');
    const closeBtn = h('button', { class: 'btn', type: 'button', onclick: close }, 'Close');
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ss-hw-title' },
      h('h2', { id: 'ss-hw-title' }, 'Copy for homework'),
      h('p', { class: 'modal-body' }, 'This copies your SQL and your result as plain text, so you can paste them into your homework.'),
      h('label', { for: pickId, class: 'hw-label' }, list.length ? 'Which exercise is this an answer to?' : 'What question does this answer?'),
      pick,
      h('p', { class: 'hw-small' }, 'Preview'),
      preview,
      h('div', { class: 'modal-actions' }, copyBtn, dlBtn, closeBtn),
      status);
    const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

    let text = '';
    let label = '';
    function update() {
      if (list.length) {
        const i = Number(pick.value);
        label = SS.exerciseLabel(schema.number, i);
        text = SS.homeworkText({ datasetLabel, exerciseLabel: label, question: list[i].text, sql, result });
      } else {
        label = 'my-question';
        text = SS.homeworkText({ datasetLabel, exerciseLabel: '(your own question)', question: pick.value || '(type your question above)', sql, result });
      }
      preview.textContent = text;
      status.textContent = '';
    }

    async function onCopy() {
      const how = await SS.copyText(text);
      if (done) return;
      if (how === 'copied') status.textContent = 'Copied! Paste it into your homework.';
      else {
        const range = document.createRange();
        range.selectNodeContents(preview);
        const sel = root.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        preview.focus({ preventScroll: true });
        status.textContent = `Your browser would not let us copy. The text is selected. Press ${SS.modKey}+C to copy it.`;
      }
    }

    function onDownload() {
      const name = SS.homeworkFilename(label);
      SS.downloadText(name, text);
      status.textContent = `Saved as ${name}.`;
    }

    function close() {
      if (done) return;
      done = true;
      current = null;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
      backdrop.remove();
      if (appEl) appEl.inert = false;
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const order = [pick, preview, copyBtn, dlBtn, closeBtn];
      const i = order.indexOf(document.activeElement);
      const n = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : (i === order.length - 1 ? 0 : i + 1);
      e.preventDefault();
      order[n].focus();
    }
    function onFocusIn(e) { if (!dialog.contains(e.target)) pick.focus({ preventScroll: true }); }

    current = { close };
    if (appEl) appEl.inert = true;
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    update();
    pick.focus({ preventScroll: true });
  }

  root.SS = Object.assign(SS, { showHomeworkDialog, closeHomeworkDialog });
})(this);
