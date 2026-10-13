// Query Explorer: tiny DOM helpers. Never uses innerHTML.
(function (root) {
  'use strict';
  const QE = root.QE;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : String(c));
    }
    return el;
  }

  function rich(str) {
    return QE.parseRich(str).map(p => (p.kind === 'strong' ? h('strong', null, p.text) : p.kind === 'code' ? h('code', null, p.text) : p.text));
  }

  const ICON_PATHS = {
    filter: 'M3 4h18l-7 9v6l-4 2v-8z',
    project: 'M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z',
    join: 'M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6l-1.5 1.5M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6l1.5-1.5',
    aggregate: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  };

  function icon(op) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICON_PATHS[op]);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  root.QE = Object.assign(QE, { h, rich, icon });
})(this);
