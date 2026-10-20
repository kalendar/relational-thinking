// SQL Studio: the Random Query button and its Complexity popover.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, icon } = SS;

  // Appends [Random Query] [Complexity] to `toolbar`. prefs.random holds the allowed features.
  function createRandomControls(toolbar, { prefs, save, onGenerate }) {
    const randomBtn = h('button', { type: 'button', class: 'btn', title: 'Write a random query for this data set', onclick: () => onGenerate(prefs.random) }, icon('dice'), 'Random Query');
    const complexBtn = h('button', { type: 'button', class: 'btn', title: 'Choose what random queries can include' }, icon('sliders'), 'Complexity');
    const note = h('p', { class: 'added', role: 'status' });
    const boxes = {};
    const list = SS.FEATURES.map(f => {
      const cb = h('input', { type: 'checkbox', id: `rq-${f}` });
      boxes[f] = cb;
      cb.addEventListener('change', () => {
        const wanted = Object.fromEntries(SS.FEATURES.map(k => [k, boxes[k].checked]));
        const { options, added } = SS.normalizeOptions(wanted);
        prefs.random = options;
        sync();
        save();
        note.textContent = added.length ? `Also turned on: ${added.map(a => SS.FEATURE_LABELS[a]).join(', ')} (needed for ${SS.FEATURE_LABELS[f]}).` : '';
      });
      return h('label', { class: 'check-label', for: `rq-${f}` }, cb, SS.FEATURE_LABELS[f]);
    });
    const panel = h('div', { class: 'popover', role: 'group', 'aria-label': 'What random queries can include' },
      h('h3', null, 'Random queries can use'), list, note);
    function sync() { SS.FEATURES.forEach(f => { boxes[f].checked = !!prefs.random[f]; }); }
    sync();
    const pop = SS.popover(complexBtn, panel, { onOpen: () => { note.textContent = ''; } });
    toolbar.append(randomBtn, pop.wrap);
    return { randomBtn };
  }

  root.SS = Object.assign(SS, { createRandomControls });
})(this);
