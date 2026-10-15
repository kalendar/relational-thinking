// Query Explorer: the "Copy for homework" dialog (pick a question, preview, copy or download).
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h } = QE;

  let current = null; // { close }

  function closeExportDialog() {
    if (current) current.close();
  }

  // Tries rich + plain together, then plain text alone. Returns 'rich', 'plain', or 'failed'.
  async function copyAnswer(answer) {
    const nav = root.navigator;
    try {
      if (nav.clipboard && nav.clipboard.write && root.ClipboardItem) {
        await nav.clipboard.write([new root.ClipboardItem({
          'text/html': new Blob([answer.html], { type: 'text/html' }),
          'text/plain': new Blob([answer.markdown], { type: 'text/plain' }),
        })]);
        return 'rich';
      }
    } catch (e) { /* fall through to plain text */ }
    try {
      await nav.clipboard.writeText(answer.markdown);
      return 'plain';
    } catch (e) {
      return 'failed';
    }
  }

  function downloadFile(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showExportDialog({ dataset, recipe, opener }) {
    closeExportDialog();
    const appEl = document.getElementById('app');
    const previous = opener || document.activeElement;
    const placeholder = 'Choose a question to see what will be copied.';
    let answer = null;
    let done = false;

    const select = h('select', { id: 'qe-hw-question', onchange: onPick },
      h('option', { value: '', disabled: true, selected: true }, 'Choose…'),
      dataset.questions.map((q, i) => h('option', { value: String(i) }, `${dataset.number}.${i + 1} – ${q.text}`)));
    const preview = h('pre', { class: 'hw-preview', tabindex: '0', 'aria-label': 'Preview of what will be copied' }, placeholder);
    const status = h('p', { class: 'hw-status', role: 'status' });
    const copyBtn = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: onCopy }, 'Copy');
    const dlBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: onDownload }, 'Download .md');
    const closeBtn = h('button', { class: 'btn', type: 'button', onclick: close }, 'Close');
    const dialog = h('div', { class: 'modal hw-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'qe-hw-title' },
      h('div', { class: 'modal-head' }, h('h2', { id: 'qe-hw-title' }, 'Copy for homework')),
      h('p', { class: 'modal-body' }, 'This copies your recipe and your result so you can paste them into your homework.'),
      h('label', { for: 'qe-hw-question', class: 'hw-label' }, 'Which question is this an answer to?'),
      select,
      h('p', { class: 'hw-small' }, 'Preview'),
      preview,
      h('div', { class: 'modal-actions' }, copyBtn, dlBtn, closeBtn),
      status);
    const backdrop = h('div', { class: 'modal-backdrop hw-backdrop' }, dialog);

    function onPick() {
      answer = QE.buildAnswer({ dataset, recipe, questionIndex: Number(select.value) });
      preview.textContent = answer.markdown;
      copyBtn.disabled = false;
      dlBtn.disabled = false;
      status.textContent = '';
    }

    async function onCopy() {
      if (!answer) return;
      const how = await copyAnswer(answer);
      if (done) return;
      if (how === 'rich') status.textContent = 'Copied! Paste it into your homework.';
      else if (how === 'plain') status.textContent = 'Copied as plain text! Paste it into your homework.';
      else {
        const range = document.createRange();
        range.selectNodeContents(preview);
        const sel = root.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        preview.focus({ preventScroll: true });
        status.textContent = 'Your browser would not let us copy. The text is selected. Press Ctrl+C (Cmd+C on a Mac) to copy it.';
      }
    }

    function onDownload() {
      if (!answer) return;
      downloadFile(answer.filename, answer.markdown);
      status.textContent = `Saved as ${answer.filename}.`;
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
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab') {
        const order = [select, preview, copyBtn, dlBtn, closeBtn].filter(el => !el.disabled);
        const i = order.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : (i === order.length - 1 ? 0 : i + 1);
        e.preventDefault();
        order[next].focus();
      }
    }
    function onFocusIn(e) {
      if (!dialog.contains(e.target)) select.focus({ preventScroll: true });
    }

    current = { close };
    if (appEl) appEl.inert = true;
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    select.focus({ preventScroll: true });
  }

  QE.onCloseModal(closeExportDialog);
  root.QE = Object.assign(QE, { showExportDialog, closeExportDialog });
})(this);
