// SQL Studio: simple line icons as inline SVG (24×24, stroke = currentColor).
(function (root) {
  'use strict';
  const SS = root.SS;

  const PATHS = {
    db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    chevron: 'M6 9l6 6 6-6',
    play: 'M7 4l13 8-13 8z',
    wand: 'M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3 1.3.7-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z',
    dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
    sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
    copy: 'M9 9h10v12H9zM5 15H4V3h12v1',
    download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
    key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z',
    link: 'M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6l-1.5 1.5M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6l1.5-1.5',
    image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    check: 'M5 12l5 5 9-10',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
    table: 'M3 4h18v16H3zM3 10h18M9 10v10',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1',
    x: 'M6 6l12 12M18 6L6 18',
    tidy: 'M4 5h6v5H4zM14 14h6v5h-6zM10 7.5h2a2 2 0 0 1 2 2v7',
    prev: 'M15 6l-6 6 6 6',
    next: 'M9 6l6 6-6 6',
    results: 'M4 5h16M4 10h16M4 15h10M4 20h7',
    homework: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  };

  function icon(name, { label } = {}) {
    const svg = SS.s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null },
      SS.s('path', { d: PATHS[name] || PATHS.info }));
    return svg;
  }

  // An icon-only button with a visible tooltip (title) and an accessible name.
  const iconButton = (name, label, attrs = {}) => SS.h('button', Object.assign({ type: 'button', class: 'btn icon-only', 'aria-label': label, title: label }, attrs), icon(name));

  root.SS = Object.assign(SS, { ICON_PATHS: PATHS, icon, iconButton });
})(this);
