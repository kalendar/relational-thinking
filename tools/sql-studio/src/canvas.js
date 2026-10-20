// SQL Studio (shared with the ERD Playground): an SVG drawing area with zoom, pan, pinch, fit, and PNG copy.
// The caller draws into `viewport` in diagram units; the canvas handles the view transform.
(function (root) {
  'use strict';
  const SS = root.SS;
  const { h, s } = SS;

  const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-weight', 'opacity'];

  // options:
  //   label               accessible name of the drawing
  //   getPreferredScale() the zoom to use when the drawing fits (e.g. from saved prefs), as 1 = 100%
  //   onScale(scale)      called when the student zooms (save it)
  //   onView(view)        called after every view change (update a zoom readout)
  //   canPan(target)      false for elements that handle their own pointer drags
  //   minScale, maxScale  zoom limits
  function createCanvas(host, { label = 'Diagram', getPreferredScale = () => 1, onScale = () => {}, onView = () => {}, canPan = () => true, minScale = 0.3, maxScale = 2.5 } = {}) {
    const viewport = s('g', { class: 'viewport' });
    const svg = s('svg', { role: 'group', 'aria-label': label }, viewport);
    const canvas = h('div', { class: 'erd-canvas' }, svg);
    host.append(canvas);
    const view = { scale: getPreferredScale(), tx: 0, ty: 0 }; // mutated in place, so callers can keep a reference

    function applyView() {
      viewport.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.scale})`);
      onView(view);
    }
    function zoomAt(newScale, cx, cy) {
      const sc = Math.min(maxScale, Math.max(minScale, newScale));
      view.tx = cx - ((cx - view.tx) * sc) / view.scale;
      view.ty = cy - ((cy - view.ty) * sc) / view.scale;
      view.scale = sc;
      onScale(sc);
      applyView();
    }
    function zoomBy(dir) {
      const r = svg.getBoundingClientRect();
      const range = { min: Math.round(minScale * 100), max: Math.round(maxScale * 100), step: 10 };
      zoomAt(SS.stepZoom(Math.round(view.scale * 100), dir, range) / 100, r.width / 2, r.height / 2);
    }
    // Centers `bounds` ({ minX, minY, maxX, maxY } in diagram units), zoomed out if needed so it all shows.
    function fitTo(bounds) {
      const r = svg.getBoundingClientRect();
      Object.assign(view, SS.fitView(bounds, { width: r.width, height: r.height }, getPreferredScale()));
      applyView();
    }
    // Converts a pointer position to diagram units.
    function toLocal(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      return { x: (clientX - r.left - view.tx) / view.scale, y: (clientY - r.top - view.ty) / view.scale };
    }

    // ---- pan, wheel zoom, pinch ----
    const pointers = new Map();
    let pinch = null;
    svg.addEventListener('pointerdown', e => {
      if (!canPan(e.target)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      svg.setPointerCapture(e.pointerId);
      canvas.classList.add('panning');
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const r = svg.getBoundingClientRect();
        zoomAt(pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (pointers.size === 1) {
        view.tx += e.clientX - prev.x;
        view.ty += e.clientY - prev.y;
        applyView();
      }
    });
    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) canvas.classList.remove('panning');
    };
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls the page as usual.
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(view.scale * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // ---- PNG ----
    // Draws `bounds` (diagram units) at 2× with the current theme's colors, then copies it to the clipboard,
    // or downloads `filename` when the browser won't copy images. Resolves to 'copied', 'downloaded', or 'failed'.
    async function copyPng(filename, bounds, pad = 30) {
      const minX = bounds.minX - pad;
      const minY = bounds.minY - pad;
      const w = bounds.maxX + pad - minX;
      const hgt = bounds.maxY + pad - minY;
      const clone = svg.cloneNode(true);
      // Copy computed colors and fonts so the picture matches the screen (and the current theme).
      const src = svg.querySelectorAll('*');
      const dst = clone.querySelectorAll('*');
      src.forEach((el, i) => {
        const cs = getComputedStyle(el);
        dst[i].setAttribute('style', STYLE_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';'));
      });
      clone.querySelector('.viewport').removeAttribute('transform');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', `${minX} ${minY} ${w} ${hgt}`);
      clone.setAttribute('width', String(w * 2));
      clone.setAttribute('height', String(hgt * 2));
      const bg = getComputedStyle(canvas).backgroundColor;
      clone.insertBefore(s('rect', { x: minX, y: minY, width: w, height: hgt, fill: bg }), clone.firstChild);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      try {
        const img = new Image();
        await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
        const cv = document.createElement('canvas');
        cv.width = w * 2;
        cv.height = hgt * 2;
        cv.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
        try {
          await root.navigator.clipboard.write([new root.ClipboardItem({ 'image/png': blob })]);
          return 'copied';
        } catch (e) {
          SS.downloadBlob(filename, blob);
          return 'downloaded';
        }
      } catch (e) {
        return 'failed';
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (root.ResizeObserver) new root.ResizeObserver(() => applyView()).observe(canvas);
    applyView();

    return { svg, viewport, canvas, view, applyView, zoomAt, zoomBy, fitTo, toLocal, copyPng };
  }

  root.SS = Object.assign(SS, { createCanvas });
})(this);
