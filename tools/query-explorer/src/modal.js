// Query Explorer: one small dialog at a time, used by the join walkthrough.
(function (root) {
  'use strict';
  const QE = root.QE;
  const { h, rich } = QE;

  let current = null; // { backdrop, finish }

  function closeModal() {
    if (current) current.finish('skip');
  }

  // Resolves to 'ok' or 'skip'. Escape and "Skip the rest" both mean 'skip'.
  function showModal({ title, body, okLabel = 'Got it', skipLabel = 'Skip the rest', stepText = null, step = null, steps = null }) {
    closeModal();
    return new Promise(resolve => {
      const previous = document.activeElement;
      const appEl = document.getElementById('app');
      const titleId = 'qe-modal-title';
      const bodyId = 'qe-modal-body';
      let done = false;

      function finish(answer) {
        if (done) return;
        done = true;
        current = null;
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('focusin', onFocusIn, true);
        backdrop.remove();
        if (appEl) appEl.inert = false;
        if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus();
        resolve(answer);
      }

      const ok = h('button', { class: 'btn primary', type: 'button', onclick: () => finish('ok') }, okLabel);
      const skip = h('button', { class: 'btn-link', type: 'button', onclick: () => finish('skip') }, skipLabel);
      const dots = step !== null && steps
        ? h('span', { class: 'modal-dots', 'aria-hidden': 'true' }, Array.from({ length: steps }, (_, i) => h('span', { class: 'dot' + (i === step ? ' on' : '') })))
        : (stepText ? h('span', { class: 'modal-step' }, stepText) : null);
      const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': bodyId },
        h('div', { class: 'modal-head' }, h('h2', { id: titleId }, title), dots),
        h('p', { id: bodyId, class: 'modal-body' }, rich(body)),
        h('div', { class: 'modal-actions' }, ok, skip));
      const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish('skip');
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const order = [ok, skip];
          const i = order.indexOf(document.activeElement);
          const next = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : (i === order.length - 1 ? 0 : i + 1);
          order[next].focus();
        }
      }
      // If focus ever lands outside the dialog, bring it back.
      function onFocusIn(e) {
        if (!dialog.contains(e.target)) ok.focus();
      }

      current = { backdrop, finish };
      if (appEl) appEl.inert = true;
      document.body.append(backdrop);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('focusin', onFocusIn, true);
      ok.focus();
    });
  }

  root.QE = Object.assign(QE, { showModal, closeModal });
})(this);
