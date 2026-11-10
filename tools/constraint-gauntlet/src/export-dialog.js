// Constraint Gauntlet: the "Copy for homework" dialog. Same pattern as SQL Studio's: modal, focus trap,
// Escape closes, focus goes back, Copy with a select-the-text fallback, Download .txt.
(function (root) {
  'use strict';
  const CG = root.CG;
  const SS = root.SS;
  const { h } = SS;

  let current = null;

  function showHomework({ level, text, opener }) {
    if (current) current.close();
    const appEl = document.getElementById('app');
    const previous = opener || document.activeElement;
    let done = false;
    const preview = h('pre', { class: 'hw-preview', tabindex: '0', 'aria-label': 'Preview of what will be copied' }, text);
    const status = h('p', { class: 'hw-status', role: 'status' });
    const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: onCopy }, 'Copy');
    const dlBtn = h('button', { class: 'btn', type: 'button', onclick: onDownload }, 'Download .txt');
    const closeBtn = h('button', { class: 'btn', type: 'button', onclick: close }, 'Close');
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cg-hw-title' },
      h('h2', { id: 'cg-hw-title' }, `Copy for homework: Level ${level.id}`),
      h('p', { class: 'modal-body' }, 'This copies your goals, your attempts, your fix, and your predictions as plain text, so you can paste them into your homework.'),
      h('p', { class: 'hw-small' }, 'Preview'), preview,
      h('div', { class: 'modal-actions' }, copyBtn, dlBtn, closeBtn), status);
    const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

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
      const name = CG.homeworkFilename(level);
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
      const order = [preview, copyBtn, dlBtn, closeBtn];
      const i = order.indexOf(document.activeElement);
      const n = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : (i === order.length - 1 ? 0 : i + 1);
      e.preventDefault();
      order[n].focus();
    }
    function onFocusIn(e) { if (!dialog.contains(e.target)) copyBtn.focus({ preventScroll: true }); }

    current = { close };
    if (appEl) appEl.inert = true;
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);
    copyBtn.focus({ preventScroll: true });
  }

  CG.showHomework = showHomework;
})(this);
