// SQL Studio: small DOM helpers. Never uses innerHTML.
(function (root) {
  'use strict';
  const SS = root.SS;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function setAttrs(el, attrs) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }

  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : String(c));
    }
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    setAttrs(el, attrs);
    append(el, children);
    return el;
  }

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    setAttrs(el, attrs);
    append(el, children);
    return el;
  }

  const clear = el => { while (el.firstChild) el.firstChild.remove(); return el; };

  // `code` in backticks becomes <code>; everything else is plain text.
  function rich(str) {
    const out = [];
    const re = /`([^`]+)`/g;
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(h('code', null, m[1]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }
  const plain = str => String(str).replace(/`([^`]+)`/g, '$1');

  // One polite live region for the whole page (index.html has <div id="live">).
  let liveTimer = null;
  function announce(text) {
    const live = document.getElementById('live');
    if (!live) return;
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = plain(text); }, 30);
  }

  // Returns 'copied' or 'failed'. Plain text only.
  async function copyText(text) {
    try {
      await root.navigator.clipboard.writeText(text);
      return 'copied';
    } catch (e) {
      // Older or locked-down browsers: a hidden textarea and execCommand.
      try {
        const ta = h('textarea', { style: { position: 'fixed', left: '-9999px' }, 'aria-hidden': 'true' });
        ta.value = text;
        document.body.append(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok ? 'copied' : 'failed';
      } catch (e2) {
        return 'failed';
      }
    }
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const downloadText = (filename, text, type = 'text/plain') => downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));

  const isMac = /Mac|iPhone|iPad/.test((root.navigator && (root.navigator.platform || root.navigator.userAgent)) || '');
  const modKey = isMac ? '⌘' : 'Ctrl';
  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Places an open popover against the window (position: fixed), just below its button, so the panel it sits in
  // can't clip it. It stays on screen: it moves left or up if needed and scrolls when it's taller than the space.
  function placePopover(button, panel) {
    const gap = 6;
    const margin = 8;
    const b = button.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    Object.assign(panel.style, { position: 'fixed', zIndex: '45', maxHeight: '', overflowY: '', left: '0px', top: '0px', right: 'auto' });
    const w = panel.offsetWidth;
    const left = Math.max(margin, Math.min(b.left, vw - w - margin));
    const below = vh - b.bottom - gap - margin;
    const above = b.top - gap - margin;
    const h = panel.scrollHeight;
    const goUp = h > below && above > below;
    const room = goUp ? above : below;
    panel.style.left = `${left}px`;
    panel.style.top = `${goUp ? Math.max(margin, b.top - gap - Math.min(h, room)) : b.bottom + gap}px`;
    if (h > room) { panel.style.maxHeight = `${Math.max(120, room)}px`; panel.style.overflowY = 'auto'; }
  }

  // A disclosure popover: a button that shows/hides a panel. Escape or a click outside closes it and returns focus.
  function popover(button, panel, { onOpen } = {}) {
    const wrap = h('span', { class: 'pop-wrap' }, button, panel);
    const id = panel.id || `pop-${Math.random().toString(36).slice(2, 8)}`;
    panel.id = id;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);
    const close = (refocus = true) => {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      if (refocus) button.focus();
    };
    const reposition = e => { if (!panel.hidden && !(e && e.target && panel.contains(e.target))) placePopover(button, panel); };
    const outside = e => { if (!wrap.contains(e.target)) close(false); };
    button.addEventListener('click', () => {
      if (!panel.hidden) { close(); return; }
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outside, true);
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      if (onOpen) onOpen();
      placePopover(button, panel);
      const first = panel.querySelector('input,button,select,[tabindex]');
      if (first) first.focus();
    });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); close(); } });
    return { wrap, close };
  }

  root.SS = Object.assign(SS, { h, s, clear, rich, plain, announce, copyText, downloadBlob, downloadText, isMac, modKey, reducedMotion, popover });
})(this);
