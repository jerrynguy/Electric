/* Giao diện vẽ mạch */
(function () {
  'use strict';
  const EC = globalThis.EC;
  const { COMP, G } = EC;
  const U = EC.units;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svg = $('#canvas'), layer = $('#layer');
  const STORE = 'mach-dien-lab-v1';

  let model = { comps: [], wires: [] };
  let sel = null; // {kind:'comp'|'wire', id}
  let mode = 'select', placeType = null;
  let ghost = { x: 0, y: 0, rot: 0, flip: false };
  let wireStart = null;
  let cursor = { x: 0, y: 0 };
  let view = { x: -120, y: -100, scale: 1 };
  let drag = null, pan = null;
  let built = null, result = null;
  let resMode = 'dc';
  let tab = 'props';
  let undoStack = [], redoStack = [];
  let seq = 1;
  let toolState = { goal: null, sweep: null, goalOut: '', sweepOut: '' };

  /* ---------- tiện ích mô hình ---------- */
  const snap = () => JSON.stringify(model);
  function pushUndo() { undoStack.push(snap()); if (undoStack.length > 200) undoStack.shift(); redoStack = []; }
  function restore(s) { model = JSON.parse(s); fixSeq(); sel = null; changed(false); }
  function fixSeq() {
    let m = 0;
    for (const o of [...model.comps, ...model.wires]) { const n = parseInt(String(o.id).slice(1), 10); if (n > m) m = n; }
    seq = m + 1;
  }
  const comp = (id) => model.comps.find((c) => c.id === id);
  function nextName(type) {
    const def = COMP[type];
    if (type === 'LABEL') {
      const used = new Set(model.comps.filter((c) => c.type === 'LABEL').map((c) => c.name));
      for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(ch)) return ch;
      return 'X' + seq;
    }
    const used = new Set(model.comps.map((c) => c.name));
    for (let i = 1; ; i++) if (!used.has(def.prefix + i)) return def.prefix + i;
  }
  function addComp(type, x, y, rot, flip) {
    const c = { id: 'c' + seq++, type, name: nextName(type), x, y, rot: rot || 0, flip: !!flip, params: EC.defaultParams(type) };
    model.comps.push(c);
    return c;
  }
  function addWire(x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return;
    model.wires.push({ id: 'w' + seq++, x1, y1, x2, y2 });
  }
  function splitAndClean() {
    // gộp dây trùng và bỏ dây độ dài 0
    const seen = new Set();
    model.wires = model.wires.filter((w) => {
      if (w.x1 === w.x2 && w.y1 === w.y2) return false;
      const k = [w.x1, w.y1, w.x2, w.y2].join(',');
      const k2 = [w.x2, w.y2, w.x1, w.y1].join(',');
      if (seen.has(k) || seen.has(k2)) return false;
      seen.add(k);
      return true;
    });
  }

  /* ---------- giải mạch ---------- */
  function solve() {
    const r = EC.tools.run(model);
    built = r.build;
    result = r.result;
    const modes = [['dc', 'DC (một chiều)']];
    if (result && result.ok) result.ac.forEach((a) => modes.push(['ac:' + a.ctx.freq, 'AC ' + U.fmt(a.ctx.freq, 'Hz') + ' (hiệu dụng)']));
    if (!resMode || !modes.some((m) => m[0] === resMode)) resMode = modes.length > 1 && !model.comps.some((c) => c.type === 'V' || c.type === 'I') ? modes[1][0] : 'dc';
    const ms = $('#modeSel');
    ms.innerHTML = modes.map(([v, t]) => `<option value="${v}" ${v === resMode ? 'selected' : ''}>${t}</option>`).join('');
  }
  function curRes() {
    if (!result || !result.ok) return null;
    if (resMode === 'dc') return result.dc;
    const f = parseFloat(resMode.slice(3));
    return result.ac.find((a) => Math.abs(a.ctx.freq - f) < 1e-9) || result.dc;
  }
  const isAC = () => { const r = curRes(); return !!(r && r.ctx.ac); };
  const TINY = { A: 1e-10, W: 1e-9, var: 1e-9 };
  function clean(v, unit) {
    const t = TINY[unit];
    if (!t || v == null) return v;
    if (typeof v === 'number') return Math.abs(v) < t ? 0 : v;
    return Math.hypot(v.re, v.im) < t ? { re: 0, im: 0 } : v;
  }
  function fv(v, unit) {
    v = clean(v, unit);
    if (v == null) return '—';
    if (typeof v === 'number') return U.fmt(v, unit);
    return isAC() ? U.fmtC(v, unit) : U.fmt(v.re, unit);
  }
  function fshort(v, unit) {
    v = clean(v, unit);
    if (v == null) return '—';
    if (typeof v === 'number') return U.fmt(v, unit, 3);
    return isAC() ? U.fmt(Math.hypot(v.re, v.im), unit, 3) : U.fmt(v.re, unit, 3);
  }
  const UNIT = { U: 'V', V: 'V', I: 'A', P: 'W', Q: 'var' };
  const unitOf = (k) => UNIT[k[0]] || '';
  const QLABEL = { U: 'Điện áp U', I: 'Dòng điện I', P: 'Công suất P', Q: 'Công suất phản kháng Q', VBE: 'V_BE', VCE: 'V_CE', IB: 'I_B', IC: 'I_C', IE: 'I_E', Vout: 'V_out', Vp: 'V+', Vm: 'V−', Vd: 'V+ − V−', Iout: 'I_out (ra khỏi chân Out)' };

  function changed(record) {
    if (record) pushUndo();
    splitAndClean();
    solve();
    render();
    renderPanel();
    try { localStorage.setItem(STORE, snap()); } catch (e) { /* bỏ qua */ }
  }

  /* ---------- vẽ ---------- */
  function labelBlock(c, lines) {
    const b = EC.worldBox(c);
    const horiz = b.x2 - b.x1 >= b.y2 - b.y1;
    let x, y, anchor;
    if (COMP[c.type].labelBelow && horiz) { x = ((b.x1 + b.x2) / 2) * G; y = b.y2 * G + 16; anchor = 'middle'; }
    else if (horiz) { x = ((b.x1 + b.x2) / 2) * G; y = b.y1 * G - 6 - (lines.length - 1) * 14; anchor = 'middle'; }
    else { x = b.x2 * G + 8; y = ((b.y1 + b.y2) / 2) * G - ((lines.length - 1) * 14) / 2 + 4; anchor = 'start'; }
    return `<text class="clabel" x="${x}" y="${y}" text-anchor="${anchor}">` +
      lines.map((l, i) => `<tspan x="${x}" dy="${i ? 14 : 0}" class="${l[1]}">${esc(l[0])}</tspan>`).join('') + '</text>';
  }
  function tag(x, y, text, cls) {
    const w = text.length * 6.6 + 10;
    return `<g class="${cls}" pointer-events="none"><rect x="${x}" y="${y - 9}" width="${w}" height="18" rx="4"/><text x="${x + 5}" y="${y + 4}">${esc(text)}</text></g>`;
  }
  function compSVG(c, cls) {
    const def = COMP[c.type];
    const b = def.box;
    const tr = `translate(${c.x * G},${c.y * G}) rotate(${(c.rot || 0) * 90}) scale(1,${c.flip ? -1 : 1})`;
    let h = `<g class="comp ${cls || ''}" data-cid="${c.id}"><g transform="${tr}"><rect class="hit" x="${b[0] * G - 4}" y="${b[1] * G - 4}" width="${(b[2] - b[0]) * G + 8}" height="${(b[3] - b[1]) * G + 8}"/><g class="sym">${def.draw(c)}</g></g>`;
    if (c.type === 'LABEL') {
      const p = EC.pinPositions(c)[0];
      const t = c.name || '?';
      const w = t.length * 7.5 + 12;
      h += `<g class="ltag" pointer-events="none"><line x1="${p.x * G}" y1="${p.y * G}" x2="${p.x * G}" y2="${p.y * G - 14}"/><rect x="${p.x * G - w / 2}" y="${p.y * G - 32}" width="${w}" height="18" rx="9"/><text x="${p.x * G}" y="${p.y * G - 19}" text-anchor="middle">${esc(t)}</text></g>`;
    } else if (!def.noLabel && cls !== 'ghost') {
      const lines = [[c.name, 'nm']];
      const pv = parsedParams(c);
      if (def.value && pv) lines.push([def.value(pv, (v, u) => U.fmt(v, u, 4)), 'vl']);
      const r = curRes();
      if ($('#showV').checked && r && r.el[c.id]) {
        const e = r.el[c.id];
        if (e.q.I !== undefined && !['V', 'ACV', 'I', 'ACI'].includes(c.type)) lines.push(['I = ' + fshort(e.q.I, 'A'), 'rs']);
        else if (['V', 'ACV'].includes(c.type)) lines.push(['I = ' + fshort(EC.solver.cx(-e.q.I.re, -e.q.I.im), 'A'), 'rs']);
        else if (['I', 'ACI'].includes(c.type)) lines.push(['U = ' + fshort(e.q.U, 'V'), 'rs']);
        if (e.q.IC !== undefined) lines.push(['I_C = ' + fshort(e.q.IC, 'A'), 'rs']);
        if (e.state) lines.push([EC.solver.STATE_NAMES[e.state], 'rs']);
      }
      h += labelBlock(c, lines);
    }
    return h + '</g>';
  }
  function parsedParams(c) {
    const p = {};
    for (const d of COMP[c.type].params) {
      if (d.type === 'bool') { p[d.k] = !!c.params[d.k]; continue; }
      const v = U.parseValue(c.params[d.k]);
      if (!isFinite(v)) return null;
      p[d.k] = v;
    }
    return p;
  }
  function lRoute(a, b) {
    if (a.x === b.x || a.y === b.y) return [[a.x, a.y, b.x, b.y]];
    const horizFirst = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const m = horizFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    return [[a.x, a.y, m.x, m.y], [m.x, m.y, b.x, b.y]];
  }

  function render() {
    const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
    const vw = W / view.scale, vh = H / view.scale;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${vw} ${vh}`);
    const bg = $('#gridbg');
    bg.setAttribute('x', Math.floor(view.x / G) * G - G); bg.setAttribute('y', Math.floor(view.y / G) * G - G);
    bg.setAttribute('width', vw + 3 * G); bg.setAttribute('height', vh + 3 * G);

    let h = '';
    for (const w of model.wires) {
      const s = sel && sel.kind === 'wire' && sel.id === w.id ? ' sel' : '';
      const a = `x1="${w.x1 * G}" y1="${w.y1 * G}" x2="${w.x2 * G}" y2="${w.y2 * G}"`;
      h += `<g class="wire${s}" data-wid="${w.id}"><line class="hit" ${a}/><line class="w" ${a}/></g>`;
    }
    for (const c of model.comps) h += compSVG(c, sel && sel.kind === 'comp' && sel.id === c.id ? 'sel' : '');
    // chấm nối & chân chưa nối
    if (built) {
      for (const [k, n] of built.count) {
        const [x, y] = k.split(',').map(Number);
        if (n >= 3) h += `<circle class="junc" cx="${x * G}" cy="${y * G}" r="3.6"/>`;
        else if (n === 1) {
          const onWire = model.wires.some((w) => EC.netlist.onInterior({ x, y }, w));
          const isPin = model.comps.some((c) => c.type !== 'LABEL' && c.type !== 'GND' && EC.pinPositions(c).some((p) => p.x === x && p.y === y));
          if (!onWire && isPin) h += `<circle class="freepin" cx="${x * G}" cy="${y * G}" r="4"/>`;
        }
      }
    }
    // điện thế nút
    const r = curRes();
    if ($('#showV').checked && r && built) {
      const shown = new Set();
      for (const c of model.comps) if (c.type === 'LABEL') {
        const n = built.compNodes[c.id][0];
        if (n == null) continue;
        const p = EC.pinPositions(c)[0];
        const w = (c.name || '?').length * 7.5 + 12;
        h += tag(p.x * G + w / 2 + 4, p.y * G - 23, fshort(r.nodeV[n], 'V'), 'vtag');
        shown.add(n);
      }
    }
    // xem trước
    if (mode === 'place' && placeType) h += compSVG(Object.assign({ id: 'ghost', type: placeType, name: '', params: EC.defaultParams(placeType) }, ghost), 'ghost');
    if (mode === 'wire') {
      h += `<circle class="cursor-dot" cx="${cursor.x * G}" cy="${cursor.y * G}" r="4"/>`;
      if (wireStart) for (const s of lRoute(wireStart, cursor)) h += `<g class="wire preview"><line class="w" x1="${s[0] * G}" y1="${s[1] * G}" x2="${s[2] * G}" y2="${s[3] * G}"/></g>`;
    }
    layer.innerHTML = h;
  }

  /* ---------- sự kiện chuột ---------- */
  function worldPt(ev) {
    const rc = svg.getBoundingClientRect();
    return { px: view.x + (ev.clientX - rc.left) / view.scale, py: view.y + (ev.clientY - rc.top) / view.scale };
  }
  const gridPt = (w) => ({ x: Math.round(w.px / G), y: Math.round(w.py / G) });
  function connectedAt(p) {
    if (!built) return false;
    const k = p.x + ',' + p.y;
    return (built.count.get(k) || 0) > 0 || model.wires.some((w) => EC.netlist.onInterior(p, w));
  }

  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('pointerdown', (ev) => {
    const w = worldPt(ev), g = gridPt(w);
    cursor = g;
    if (ev.button === 2) { if (mode === 'wire' && wireStart) wireStart = null; else setMode('select'); render(); return; }
    if (ev.button === 1) { pan = { cx: ev.clientX, cy: ev.clientY, vx: view.x, vy: view.y }; svg.setPointerCapture(ev.pointerId); return; }
    if (mode === 'place') {
      pushUndo();
      const c = addComp(placeType, g.x, g.y, ghost.rot, ghost.flip);
      sel = { kind: 'comp', id: c.id };
      changed(false);
      return;
    }
    if (mode === 'wire') {
      if (!wireStart) { wireStart = g; render(); return; }
      if (g.x === wireStart.x && g.y === wireStart.y) { wireStart = null; render(); return; }
      const hit = connectedAt(g);
      pushUndo();
      for (const s of lRoute(wireStart, g)) addWire(...s);
      wireStart = hit ? null : g;
      changed(false);
      return;
    }
    // chế độ chọn
    const t = ev.target.closest('[data-cid],[data-wid]');
    if (t && t.dataset.cid) {
      const c = comp(t.dataset.cid);
      sel = { kind: 'comp', id: c.id };
      const pins = EC.pinPositions(c);
      const ends = [];
      for (const wr of model.wires) pins.forEach((p) => {
        if (wr.x1 === p.x && wr.y1 === p.y) ends.push([wr, 1]);
        if (wr.x2 === p.x && wr.y2 === p.y) ends.push([wr, 2]);
      });
      drag = { id: c.id, start: g, ox: c.x, oy: c.y, before: snap(), moved: false, ends: ends.map(([wr, i]) => [wr, i, wr['x' + i], wr['y' + i]]) };
      svg.setPointerCapture(ev.pointerId);
      tab = 'props';
      render(); renderPanel();
    } else if (t && t.dataset.wid) {
      sel = { kind: 'wire', id: t.dataset.wid };
      render(); renderPanel();
    } else {
      sel = null;
      pan = { cx: ev.clientX, cy: ev.clientY, vx: view.x, vy: view.y };
      svg.setPointerCapture(ev.pointerId);
      render(); renderPanel();
    }
  });
  svg.addEventListener('pointermove', (ev) => {
    const w = worldPt(ev), g = gridPt(w);
    if (pan) { view.x = pan.vx - (ev.clientX - pan.cx) / view.scale; view.y = pan.vy - (ev.clientY - pan.cy) / view.scale; render(); return; }
    if (drag) {
      const dx = g.x - drag.start.x, dy = g.y - drag.start.y;
      const c = comp(drag.id);
      if (c.x !== drag.ox + dx || c.y !== drag.oy + dy) {
        c.x = drag.ox + dx; c.y = drag.oy + dy; drag.moved = true;
        for (const [wr, i, x0, y0] of drag.ends) { wr['x' + i] = x0 + dx; wr['y' + i] = y0 + dy; }
        built = EC.netlist.build(model);
        render();
      }
      return;
    }
    const moved = g.x !== cursor.x || g.y !== cursor.y;
    cursor = g;
    if (mode === 'place') { ghost.x = g.x; ghost.y = g.y; if (moved) render(); }
    else if (mode === 'wire' && moved) render();
    hoverInfo(w, ev);
  });
  svg.addEventListener('pointerup', () => {
    if (drag) {
      if (drag.moved) { undoStack.push(drag.before); redoStack = []; drag = null; changed(false); }
      drag = null;
    }
    pan = null;
  });
  svg.addEventListener('dblclick', (ev) => {
    const t = ev.target.closest('[data-cid]');
    if (t) { tab = 'props'; renderPanel(); const inp = document.querySelector('#tab-props input[type=text]'); if (inp) { inp.focus(); inp.select(); } }
  });
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const w = worldPt(ev);
    const k = Math.exp(-ev.deltaY * 0.0015);
    const ns = Math.min(4, Math.max(0.25, view.scale * k));
    view.x = w.px - (w.px - view.x) * (view.scale / ns);
    view.y = w.py - (w.py - view.y) * (view.scale / ns);
    view.scale = ns;
    render();
  }, { passive: false });
  window.addEventListener('resize', render);

  function hoverInfo(w, ev) {
    const hv = $('#hover');
    const r = curRes();
    if (!built || !r) { hv.textContent = ''; return; }
    const g = gridPt(w);
    const near = Math.hypot(w.px - g.x * G, w.py - g.y * G) < 8;
    let n = near ? built.nodeAt(g.x, g.y) : undefined;
    if (n === undefined) {
      const t = ev.target.closest && ev.target.closest('[data-wid]');
      if (t) { const wr = model.wires.find((x) => x.id === t.dataset.wid); if (wr) n = built.nodeAt(wr.x1, wr.y1); }
    }
    if (n !== undefined) { hv.textContent = `Nút ${built.nodeNames[n]}: V = ${fv(r.nodeV[n], 'V')}`; return; }
    const t = ev.target.closest && ev.target.closest('[data-cid]');
    if (t) {
      const c = comp(t.dataset.cid), e = c && r.el[c.id];
      if (e) { hv.textContent = c.name + ': ' + Object.keys(e.q).filter((k) => ['U', 'I', 'P', 'IB', 'IC', 'VCE', 'Vout'].includes(k)).map((k) => k + '=' + fshort(e.q[k], unitOf(k))).join('  '); return; }
    }
    hv.textContent = '';
  }

  /* ---------- chế độ / phím tắt ---------- */
  function setMode(m, type) {
    mode = m; placeType = type || null; wireStart = null;
    if (m === 'place') { ghost.rot = 0; ghost.flip = false; ghost.x = cursor.x; ghost.y = cursor.y; }
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    document.querySelectorAll('[data-place]').forEach((b) => b.classList.toggle('on', m === 'place' && b.dataset.place === type));
    $('#status').textContent = m === 'place' ? `Đặt ${COMP[type].label}: bấm lên lưới (R xoay, F lật, Esc thôi)` :
      m === 'wire' ? 'Vẽ dây: bấm điểm đầu rồi điểm cuối. Bấm chuột phải hoặc Esc để dừng' : 'Chọn: bấm để chọn, kéo để di chuyển, kéo nền để cuộn, lăn chuột để phóng to';
    svg.style.cursor = m === 'select' ? 'default' : 'crosshair';
    render();
  }
  function rotateSel() {
    if (mode === 'place') { ghost.rot = (ghost.rot + 1) & 3; render(); return; }
    if (sel && sel.kind === 'comp') { pushUndo(); const c = comp(sel.id); c.rot = ((c.rot || 0) + 1) & 3; changed(false); }
  }
  function flipSel() {
    if (mode === 'place') { ghost.flip = !ghost.flip; render(); return; }
    if (sel && sel.kind === 'comp') { pushUndo(); const c = comp(sel.id); c.flip = !c.flip; changed(false); }
  }
  function deleteSel() {
    if (!sel) return;
    pushUndo();
    if (sel.kind === 'comp') model.comps = model.comps.filter((c) => c.id !== sel.id);
    else model.wires = model.wires.filter((w) => w.id !== sel.id);
    sel = null;
    changed(false);
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); }

  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); redo(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === 'r') rotateSel();
    else if (k === 'f') flipSel();
    else if (k === 'delete' || k === 'backspace') { ev.preventDefault(); deleteSel(); }
    else if (k === 'escape') { if (mode === 'wire' && wireStart) { wireStart = null; render(); } else setMode('select'); }
    else if (k === 'w') setMode('wire');
    else if (k === 'v' || k === 's') setMode('select');
  });

  /* ---------- bảng bên phải ---------- */
  function renderMsgs() {
    const box = $('#msgs');
    let h = '';
    if (built) built.errors.forEach((e) => (h += `<div class="msg err">⚠ ${esc(e)}</div>`));
    if (result && !result.ok && !(built && built.errors.length)) h += `<div class="msg err">⚠ ${esc(result.error)}</div>`;
    const warns = [...(built ? built.warnings : []), ...(result && result.warnings ? result.warnings : [])];
    if (warns.length) h += `<div class="msg warn">${warns.slice(0, 4).map(esc).join('<br>')}${warns.length > 4 ? '<br>…' : ''}</div>`;
    box.innerHTML = h;
  }
  function renderPanel() {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    ['props', 'results', 'tools'].forEach((t) => ($('#tab-' + t).hidden = t !== tab));
    renderMsgs();
    if (tab === 'props') renderProps();
    else if (tab === 'results') renderResults();
    else renderTools();
  }

  function renderProps() {
    const box = $('#tab-props');
    if (!sel) {
      box.innerHTML = `<p class="empty">Bấm vào một linh kiện để xem và sửa thông số, cùng cách tính U, I, P.</p>
      <p class="empty">Mới bắt đầu thì chọn một mạch trong <b>📘 Ví dụ (đề thi)</b> ở thanh trên cùng.</p>` + summaryHTML();
      return;
    }
    if (sel.kind === 'wire') {
      const w = model.wires.find((x) => x.id === sel.id);
      const r = curRes();
      const n = built && w ? built.nodeAt(w.x1, w.y1) : undefined;
      box.innerHTML = `<h3>Dây dẫn</h3>` + (n !== undefined && r ? `<p>Thuộc nút <b>${esc(built.nodeNames[n])}</b>: V = <b>${fv(r.nodeV[n], 'V')}</b></p>` : '') +
        `<div class="row"><button id="pDel">✕ Xoá dây</button></div>`;
      $('#pDel').onclick = deleteSel;
      return;
    }
    const c = comp(sel.id);
    if (!c) { sel = null; renderProps(); return; }
    const def = COMP[c.type];
    let h = `<h3>${esc(def.label)}</h3>`;
    h += `<div class="field"><label>${c.type === 'LABEL' ? 'Tên nút' : 'Tên'}</label><input type="text" id="pName" value="${esc(c.name)}"></div>`;
    def.params.forEach((d) => {
      if (d.type === 'bool') h += `<div class="field"><label>${esc(d.label)}</label><input type="checkbox" data-p="${d.k}" ${c.params[d.k] ? 'checked' : ''}></div>`;
      else h += `<div class="field ${isFinite(U.parseValue(c.params[d.k])) ? '' : 'bad'}"><label>${esc(d.label)}${d.unit ? ' (' + d.unit + ')' : ''}</label><input type="text" data-p="${d.k}" value="${esc(c.params[d.k])}"></div>`;
    });
    if (def.hint) h += `<div class="hint">${esc(def.hint)}</div>`;
    h += `<div class="hint">Chân: ${def.pinNames.map((p, i) => `${esc(p)} → nút <b>${built && built.compNodes[c.id] && built.compNodes[c.id][i] != null ? esc(built.nodeNames[built.compNodes[c.id][i]]) : '?'}</b>`).join(', ')}</div>`;
    h += `<div class="row"><button id="pRot">⟳ Xoay</button><button id="pFlip">⇅ Lật</button><button id="pDel">✕ Xoá</button></div>`;
    h += explainHTML(c);
    box.innerHTML = h;
    $('#pRot').onclick = rotateSel; $('#pFlip').onclick = flipSel; $('#pDel').onclick = deleteSel;
    const nm = $('#pName');
    nm.onchange = () => {
      const v = nm.value.trim();
      if (!v) { nm.value = c.name; return; }
      if (c.type !== 'LABEL' && model.comps.some((o) => o !== c && o.name === v)) { alert('Tên đã được dùng'); nm.value = c.name; return; }
      pushUndo(); c.name = v; changed(false);
    };
    box.querySelectorAll('[data-p]').forEach((inp) => {
      if (inp.type === 'checkbox') inp.onchange = () => { pushUndo(); c.params[inp.dataset.p] = inp.checked; changed(false); };
      else {
        inp.onfocus = () => { inp._before = snap(); };
        inp.oninput = () => {
          c.params[inp.dataset.p] = inp.value;
          inp.parentElement.classList.toggle('bad', !isFinite(U.parseValue(inp.value)));
          solve(); render(); renderMsgs();
          const ex = $('#explain'); if (ex) ex.outerHTML = explainHTML(c);
        };
        inp.onchange = () => { if (inp._before && inp._before !== snap()) { undoStack.push(inp._before); redoStack = []; inp._before = snap(); } changed(false); };
      }
    });
  }

  function summaryHTML() {
    const r = curRes();
    if (!r || !built) return '';
    let h = '<h4>Điện thế các nút</h4><table>';
    built.nodeNames.forEach((nm, i) => { if (i > 0) h += `<tr><td>${esc(nm)}</td><td class="num">${fv(r.nodeV[i], 'V')}</td></tr>`; });
    return h + '</table>';
  }

  /* Giải thích cách tính cho linh kiện được chọn */
  function explainHTML(c) {
    const r = curRes();
    if (!r || !r.el[c.id]) {
      if (c.type === 'LABEL' && r && built) { const n = built.compNodes[c.id][0]; return `<div id="explain" class="explain"><div>V(${esc(c.name)}) = <span class="big">${fv(r.nodeV[n], 'V')}</span> (so với GND)</div></div>`; }
      return '<div id="explain"></div>';
    }
    const e = r.el[c.id], q = e.q, p = parsedParams(c) || {};
    const ac = r.ctx.ac;
    const nodes = built.compNodes[c.id].map((n) => built.nodeNames[n]);
    const L = [];
    const V = (k) => fv(q[k], unitOf(k));
    const two = q.U !== undefined;
    if (e.state) L.push(`Trạng thái: <span class="badge">${EC.solver.STATE_NAMES[e.state]}</span>`);
    if (two) L.push(`U = V(${esc(nodes[0])}) − V(${esc(nodes[1])}) = <b>${V('U')}</b>`);
    const f = r.ctx.freq, w = r.ctx.omega;
    switch (c.type) {
      case 'R':
        L.push(`I = U / R = ${V('U')} / ${U.fmt(p.R, 'Ω')} = <b>${V('I')}</b>`);
        L.push(`P = U·I = I²·R = <b>${fv(q.P, 'W')}</b>`);
        break;
      case 'C':
        if (!ac) L.push('Ở DC tụ điện hở mạch nên I = 0');
        else { const X = 1 / (w * p.C); L.push(`X_C = 1/(2πfC) = 1/(2π·${U.fmt(f, 'Hz')}·${U.fmt(p.C, 'F')}) = <b>${U.fmt(X, 'Ω')}</b>`); L.push(`Z_C = −j${U.num(X, 4)} Ω ; I = U / Z_C = <b>${V('I')}</b>`); L.push(`Q = <b>${fv(q.Q, 'var')}</b> (P = 0)`); }
        break;
      case 'L':
        if (!ac) L.push(`Ở DC cuộn cảm ngắn mạch nên U = 0. I = <b>${V('I')}</b>`);
        else { const X = w * p.L; L.push(`X_L = 2πfL = 2π·${U.fmt(f, 'Hz')}·${U.fmt(p.L, 'H')} = <b>${U.fmt(X, 'Ω')}</b>`); L.push(`Z_L = j${U.num(X, 4)} Ω ; I = U / Z_L = <b>${V('I')}</b>`); L.push(`Q = <b>${fv(q.Q, 'var')}</b>`); }
        break;
      case 'Z': {
        const Z = ac ? { re: p.R, im: p.X } : { re: p.R, im: 0 };
        L.push(`Z = ${U.fmtRect(Z, 'Ω')} = ${U.fmtC(Z, 'Ω')}${ac ? '' : ' (ở DC chỉ còn R)'}`);
        L.push(`I = U / Z = <b>${V('I')}</b>`);
        L.push(`P = I²·R = <b>${fv(q.P, 'W')}</b>${ac ? ` ; Q = I²·X = <b>${fv(q.Q, 'var')}</b>` : ''}`);
        break;
      }
      case 'V': case 'ACV': case 'I': case 'ACI': {
        const Iout = { re: -q.I.re, im: -q.I.im };
        if (c.type === 'V' || c.type === 'ACV') L.push(`Dòng phát ra từ cực + : <b>${fv(Iout, 'A')}</b>`);
        else L.push(`I = <b>${V('I')}</b>`);
        L.push(`Công suất nguồn phát ra: <b>${fv(-q.P, 'W')}</b>${ac ? ` ; Q = ${U.fmt(-(q.Q || 0), 'var')}` : ''}`);
        if (ac && (c.type === 'ACV')) L.push(`Biên độ đỉnh = √2 · ${U.fmt(p.V, 'V')} = ${U.fmt(p.V * Math.SQRT2, 'V')}`);
        break;
      }
      case 'SW':
        L.push(p.closed ? `Công tắc đóng (U = 0), I = <b>${V('I')}</b>` : 'Công tắc mở nên I = 0');
        break;
      case 'D':
        if (e.state === 'on') L.push(`Diode dẫn: U_D = Vf = ${U.fmt(p.Vf, 'V')}, dòng qua diode I = <b>${V('I')}</b> &gt; 0 ✓`);
        else L.push(`Diode tắt vì U_D = ${V('U')} &lt; Vf = ${U.fmt(p.Vf, 'V')}, nên I = 0`);
        L.push(`P = U·I = <b>${fv(q.P, 'W')}</b>`);
        break;
      case 'ZD':
        if (e.state === 'bd') L.push(`Zener ổn áp: U_KA = Vz = ${U.fmt(p.Vz, 'V')}. Dòng Zener (K → A) = <b>${fv({ re: -q.I.re, im: -q.I.im }, 'A')}</b>`);
        else if (e.state === 'fwd') L.push(`Zener phân cực thuận như diode thường: U = Vf, I = <b>${V('I')}</b>`);
        else L.push(`Zener tắt: −Vz &lt; U &lt; Vf nên I = 0`);
        L.push(`P = <b>${fv(q.P, 'W')}</b>`);
        break;
      case 'NPN': case 'PNP': {
        L.push(`I_B = <b>${V('IB')}</b> ; I_C = <b>${V('IC')}</b> ; I_E = I_B + I_C = ${V('IE')}`);
        L.push(`V_BE = ${V('VBE')} ; V_CE = <b>${V('VCE')}</b>`);
        if (!ac) {
          const bib = p.beta * q.IB.re;
          if (e.state === 'sat') L.push(`β·I_B = ${p.beta}·${U.fmt(q.IB.re, 'A')} = ${U.fmt(bib, 'A')} &gt; I_C = ${U.fmt(q.IC.re, 'A')} nên transistor <b>bão hòa</b>, V_CE = V_CE(sat)`);
          else if (e.state === 'act') L.push(`V_CE = ${U.fmt(q.VCE.re, 'V')} &gt; V_CE(sat) nên transistor ở vùng <b>khuếch đại</b>: I_C = β·I_B = ${U.fmt(bib, 'A')}`);
          else L.push(`V_BE chưa đạt ${U.fmt(p.Vbe, 'V')} nên transistor <b>ngưng dẫn</b> (I_B = I_C = 0)`);
        }
        L.push(`Công suất tiêu tán P = V_CE·I_C + V_BE·I_B = <b>${fv(q.P, 'W')}</b>`);
        break;
      }
      case 'OPAMP':
        L.push(`V+ = ${V('Vp')} ; V− = ${V('Vm')} ; <b>V_out = ${V('Vout')}</b>`);
        if (e.state === 'lin') L.push('Tuyến tính: V+ = V− (ngắn mạch ảo), dòng vào hai chân = 0');
        else L.push(`Đầu ra bị giới hạn ở mức ${e.state === 'pos' ? '+' : ''}${U.fmt(e.state === 'pos' ? p.Vpos : p.Vneg, 'V')} vì giá trị lý tưởng vượt khỏi nguồn nuôi`);
        L.push(`Dòng ra ở chân Out: ${V('Iout')}`);
        break;
    }
    if (ac && two && c.type !== 'V' && c.type !== 'ACV') L.push(`Dạng đại số: U = ${U.fmtRect(q.U, 'V')} ; I = ${U.fmtRect(q.I, 'A')}`);
    return `<h4>Kết quả ${ac ? '(AC ' + U.fmt(f, 'Hz') + ', hiệu dụng)' : '(DC)'}</h4><div id="explain" class="explain">${L.map((l) => `<div>${l}</div>`).join('')}</div>`;
  }

  function renderResults() {
    const box = $('#tab-results');
    const r = curRes();
    if (!r) { box.innerHTML = '<p class="empty">Chưa có kết quả. Hãy vẽ mạch có nguồn và GND.</p>'; return; }
    let h = summaryHTML();
    h += '<h4>Linh kiện</h4><table><tr><th>Tên</th><th>U</th><th>I</th><th>P</th></tr>';
    for (const c of model.comps) {
      const e = r.el[c.id];
      if (!e) continue;
      const q = e.q;
      let u = q.U !== undefined ? q.U : q.VCE !== undefined ? q.VCE : q.Vout;
      let i = q.I !== undefined ? q.I : q.IC !== undefined ? q.IC : q.Iout;
      const br = (t) => t.replace(' ∠ ', '<br>∠ ');
      h += `<tr class="click" data-sel="${c.id}"><td><b>${esc(c.name)}</b>${e.state ? '<br><span class="badge">' + EC.solver.STATE_NAMES[e.state] + '</span>' : ''}</td><td class="num">${br(fv(u, 'V'))}</td><td class="num">${br(fv(i, 'A'))}</td><td class="num">${fv(q.P, 'W')}</td></tr>`;
    }
    h += '</table><p class="hint">BJT: cột U là V_CE, cột I là I_C. Op-amp: U là V_out. P &lt; 0 nghĩa là linh kiện phát công suất. Bấm vào một dòng để xem chi tiết.</p>';
    if (r.ctx.ac) {
      let P = 0, Q = 0;
      for (const c of model.comps) if (['ACV', 'ACI'].includes(c.type) && r.el[c.id]) { P -= r.el[c.id].q.P; Q -= r.el[c.id].q.Q || 0; }
      h += `<h4>Tổng nguồn phát</h4><div class="explain"><div>P = ${U.fmt(P, 'W')} ; Q = ${U.fmt(Q, 'var')} ; S = ${U.fmt(Math.hypot(P, Q), 'VA')} ; cosφ = ${U.num(P / (Math.hypot(P, Q) || 1), 4)}</div></div>`;
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-sel]').forEach((tr) => (tr.onclick = () => { sel = { kind: 'comp', id: tr.dataset.sel }; tab = 'props'; render(); renderPanel(); }));
  }

  /* ---------- Công cụ ---------- */
  function paramOptions(selected) {
    let h = '';
    for (const c of model.comps) for (const d of COMP[c.type].params) {
      if (d.type === 'bool') continue;
      const v = c.name + '|' + d.k;
      h += `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(c.name)} – ${esc(d.label)}</option>`;
    }
    return h;
  }
  function quantityOptions(selected) {
    let h = '';
    if (!built) return h;
    built.nodeNames.forEach((nm, i) => { if (i > 0) { const v = 'n|' + nm; h += `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>V(${esc(nm)}) – điện thế nút</option>`; } });
    const r = result && result.ok ? result.dc : null;
    for (const c of model.comps) {
      const e = r && r.el[c.id];
      if (!e) continue;
      for (const k of Object.keys(e.q)) {
        const v = 'e|' + c.name + '|' + k;
        h += `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(c.name)} – ${esc(QLABEL[k] || k)}</option>`;
      }
    }
    return h;
  }
  function modeOptions(selected) {
    let h = `<option value="dc" ${selected === 'dc' ? 'selected' : ''}>DC</option>`;
    if (result && result.ok) result.ac.forEach((a) => { const v = 'ac:' + a.ctx.freq; h += `<option value="${v}" ${v === selected ? 'selected' : ''}>AC ${U.fmt(a.ctx.freq, 'Hz')} (độ lớn hiệu dụng)</option>`; });
    return h;
  }
  function specFrom(qv, mv) {
    const parts = qv.split('|');
    const mode = mv === 'dc' ? 'dc' : parseFloat(mv.slice(3));
    return parts[0] === 'n' ? { node: parts[1], mode } : { comp: parts[1], key: parts[2], mode };
  }
  function specLabel(s) { return s.node != null ? `V(${s.node})` : `${QLABEL[s.key] || s.key} của ${s.comp}`; }
  function specUnit(s) { return s.node != null ? 'V' : unitOf(s.key); }
  function specToVals(s) {
    if (!s) return {};
    return { q: s.node != null ? 'n|' + s.node : 'e|' + s.comp + '|' + s.key, m: s.mode === 'dc' || s.mode == null ? 'dc' : 'ac:' + s.mode };
  }

  function renderTools() {
    const box = $('#tab-tools');
    if (!model.comps.length) { box.innerHTML = '<p class="empty">Hãy vẽ mạch trước.</p>'; return; }
    const gs = toolState.goal || {}, sw = toolState.sweep || {};
    const gv = specToVals(gs.spec), sv = specToVals(sw.spec);
    box.innerHTML = `
    <div class="tool-box"><h3>🎯 Tìm giá trị</h3>
      <div class="hint">Tìm giá trị một thông số sao cho đại lượng đạt mục tiêu. Ví dụ: tìm R3 để V(A) = 8,5 V.</div>
      <div class="field"><label>Thay đổi</label><select id="gP">${paramOptions(gs.comp ? gs.comp + '|' + gs.param : '')}</select></div>
      <div class="field"><label>Để cho</label><select id="gQ">${quantityOptions(gv.q)}</select></div>
      <div class="field"><label>Chế độ</label><select id="gM">${modeOptions(gv.m || 'dc')}</select></div>
      <div class="field"><label>Bằng</label><input type="text" id="gT" value="${esc(gs.target != null ? gs.target : '')}" placeholder="ví dụ 8.5"></div>
      <div class="field"><label>Khoảng tìm</label><input type="text" id="gR" value="${esc(gs.range || '')}" placeholder="tự động (vd: 1 - 1M)"></div>
      <div class="row"><button class="primary" id="gGo">Tìm</button></div>
      <div id="gOut">${toolState.goalOut}</div>
    </div>
    <div class="tool-box"><h3>📈 Quét tham số</h3>
      <div class="hint">Cho một thông số chạy trong một khoảng và vẽ đồ thị một đại lượng. App tự tìm ngưỡng mà diode/BJT/op-amp đổi trạng thái (ví dụ Câu 8: miền R_B để transistor bão hòa).</div>
      <div class="field"><label>Thông số</label><select id="sP">${paramOptions(sw.comp ? sw.comp + '|' + sw.param : '')}</select></div>
      <div class="field"><label>Từ</label><input type="text" id="sF" value="${esc(sw.from != null ? U.fmt(sw.from).trim().replace(/\s/g, '') : '')}" placeholder="vd 1k"></div>
      <div class="field"><label>Đến</label><input type="text" id="sT" value="${esc(sw.to != null ? U.fmt(sw.to).trim().replace(/\s/g, '') : '')}" placeholder="vd 1M"></div>
      <div class="field"><label>Số bước</label><input type="text" id="sN" value="${sw.steps || 50}"></div>
      <div class="field"><label>Thang log</label><input type="checkbox" id="sL" ${sw.log ? 'checked' : ''}></div>
      <div class="field"><label>Đại lượng</label><select id="sQ">${quantityOptions(sv.q)}</select></div>
      <div class="field"><label>Chế độ</label><select id="sM">${modeOptions(sv.m || 'dc')}</select></div>
      <div class="row"><button class="primary" id="sGo">Quét</button></div>
      <div id="sOut">${toolState.sweepOut}</div>
    </div>`;
    $('#gGo').onclick = runGoal;
    $('#sGo').onclick = runSweep;
    box.querySelectorAll('[data-apply]').forEach((b) => (b.onclick = () => applyParam(b.dataset.apply, b.dataset.val)));
  }
  function applyParam(cp, val) {
    const [cn, pk] = cp.split('|');
    const c = model.comps.find((x) => x.name === cn);
    if (!c) return;
    pushUndo();
    c.params[pk] = val;
    changed(false);
  }
  function readGoal() {
    const [comp, param] = $('#gP').value.split('|');
    const rg = $('#gR').value.trim();
    let min, max;
    if (rg) { const m = rg.split(/\s*(?:-|–|…|\.\.|đến|to)\s*(?=[+\d.])/); if (m.length === 2) { min = U.parseValue(m[0]); max = U.parseValue(m[1]); } }
    toolState.goal = { comp, param, spec: specFrom($('#gQ').value, $('#gM').value), target: $('#gT').value, range: rg, min, max };
    return toolState.goal;
  }
  function runGoal() {
    const g = readGoal();
    const target = U.parseValue(g.target);
    if (!g.comp || !$('#gQ').value || !isFinite(target)) { toolState.goalOut = '<div class="msg err">Hãy chọn đủ thông số, đại lượng và nhập giá trị mục tiêu.</div>'; renderTools(); return; }
    $('#gOut').innerHTML = '<p class="empty">Đang tính…</p>';
    setTimeout(() => {
      const res = EC.tools.goalSeek({ model, comp: g.comp, param: g.param, spec: g.spec, target, min: g.min, max: g.max });
      const d = COMP[model.comps.find((c) => c.name === g.comp).type].params.find((p) => p.k === g.param);
      const unit = d ? d.unit : '';
      if (res.ok) {
        const valStr = U.num(res.x, 6);
        toolState.goalOut = `<div class="explain"><div>${esc(g.comp)} = <span class="big">${U.fmt(res.x, unit, 5)}</span></div><div>Khi đó ${esc(specLabel(g.spec))} = ${U.fmt(res.value, specUnit(g.spec), 5)}</div>` +
          (res.roots.length > 1 ? `<div class="hint">Còn ${res.roots.length - 1} nghiệm khác: ${res.roots.slice(1, 4).map((x) => U.fmt(x, unit)).join(', ')}</div>` : '') +
          `<div class="row"><button data-apply="${esc(g.comp + '|' + g.param)}" data-val="${valStr}">Áp dụng vào mạch</button></div></div>`;
      } else {
        toolState.goalOut = `<div class="msg warn">Không tìm thấy nghiệm trong khoảng ${U.fmt(res.range[0], unit)} – ${U.fmt(res.range[1], unit)}.` +
          (isFinite(res.best.x) ? ` Gần nhất: ${esc(g.comp)} = ${U.fmt(res.best.x, unit)} (sai lệch ${U.fmt(res.best.f, specUnit(g.spec))}).` : '') + ' Thử nhập "Khoảng tìm" khác.</div>';
      }
      renderTools();
    }, 10);
  }
  function runSweep() {
    const [comp, param] = $('#sP').value.split('|');
    const from = U.parseValue($('#sF').value), to = U.parseValue($('#sT').value);
    const steps = Math.min(400, Math.max(2, parseInt($('#sN').value, 10) || 50));
    let log = $('#sL').checked;
    const spec = specFrom($('#sQ').value || 'n|x', $('#sM').value);
    toolState.sweep = { comp, param, from, to, steps, log, spec };
    if (!comp || !isFinite(from) || !isFinite(to) || from === to || !$('#sQ').value) { toolState.sweepOut = '<div class="msg err">Hãy chọn thông số, đại lượng và nhập khoảng hợp lệ.</div>'; renderTools(); return; }
    if (log && (from <= 0 || to <= 0)) log = false;
    $('#sOut').innerHTML = '<p class="empty">Đang tính…</p>';
    setTimeout(() => {
      const res = EC.tools.sweep({ model, comp, param, from, to, steps, log, spec });
      const d = COMP[model.comps.find((c) => c.name === comp).type].params.find((p) => p.k === param);
      const unit = d ? d.unit : '', yu = specUnit(spec);
      let h = chartSVG(res, log, unit, yu);
      if (res.transitions.length) {
        h += '<h4>Ngưỡng đổi trạng thái</h4><div class="explain">';
        res.transitions.forEach((t) => (h += `<div>${esc(comp)} = <b>${U.fmt(t.x, unit, 5)}</b>: ${esc(t.from)} → ${esc(t.to)}</div>`));
        h += '</div>';
      }
      const pts = res.pts.filter((_, i) => res.pts.length <= 12 || i % Math.ceil(res.pts.length / 12) === 0 || i === res.pts.length - 1);
      h += `<h4>Bảng giá trị</h4><table><tr><th>${esc(comp)}</th><th>${esc(specLabel(spec))}</th><th>Trạng thái</th></tr>` +
        pts.map((p) => `<tr><td class="num">${U.fmt(p.x, unit)}</td><td class="num">${U.fmt(p.y, yu)}</td><td style="font-size:11.5px">${esc(p.sig.replace(/:(\w+)/g, (m, s) => ': ' + (EC.solver.STATE_NAMES[s] || s)))}</td></tr>`).join('') + '</table>';
      toolState.sweepOut = h;
      renderTools();
    }, 10);
  }
  function chartSVG(res, log, xu, yu) {
    const W = 300, H = 180, L = 46, R = 8, T = 10, B = 24;
    const pts = res.pts.filter((p) => isFinite(p.y));
    if (pts.length < 2) return '<p class="empty">Không có dữ liệu để vẽ.</p>';
    const xs = res.pts.map((p) => p.x);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    if (y1 - y0 < 1e-15) { y0 -= 1; y1 += 1; }
    const sx = (x) => L + (log ? Math.log(x / x0) / Math.log(x1 / x0) : (x - x0) / (x1 - x0)) * (W - L - R);
    const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    let d = '';
    pts.forEach((p, i) => (d += (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)));
    let h = `<svg class="chart" viewBox="0 0 ${W} ${H}"><path class="ax" d="M${L} ${T}V${H - B}H${W - R}"/>`;
    h += `<text x="${L - 4}" y="${T + 8}" text-anchor="end">${esc(U.fmt(y1, yu, 3))}</text><text x="${L - 4}" y="${H - B}" text-anchor="end">${esc(U.fmt(y0, yu, 3))}</text>`;
    h += `<text x="${L}" y="${H - 8}">${esc(U.fmt(x0, xu, 3))}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${esc(U.fmt(x1, xu, 3))}${log ? ' (log)' : ''}</text>`;
    res.transitions.forEach((t) => (h += `<line class="tr" x1="${sx(t.x)}" x2="${sx(t.x)}" y1="${T}" y2="${H - B}"/>`));
    return h + `<path class="ln" d="${d}"/></svg>`;
  }

  /* ---------- thanh công cụ ---------- */
  function buildPalette() {
    const groups = {};
    for (const [t, d] of Object.entries(COMP)) (groups[d.group] = groups[d.group] || []).push(t);
    let h = '';
    for (const [g, ts] of Object.entries(groups)) {
      h += `<h4>${g}</h4>`;
      for (const t of ts) {
        const d = COMP[t];
        const b = d.box;
        const vb = `${b[0] * G - 6} ${Math.min(b[1], -1) * G - 6} ${(b[2] - b[0]) * G + 12} ${(Math.max(b[3], 1) - Math.min(b[1], -1)) * G + 12}`;
        const ic = t === 'LABEL' ? '<path d="M0 0V-12" /><rect x="-12" y="-28" width="24" height="16" rx="8"/>' : d.draw({ params: EC.defaultParams(t) });
        h += `<button data-place="${t}" title="${esc(d.label)}"><svg viewBox="${vb}">${ic}</svg>${esc(d.label)}</button>`;
      }
    }
    $('#palette').innerHTML = h;
    document.querySelectorAll('[data-place]').forEach((b) => (b.onclick = () => (mode === 'place' && placeType === b.dataset.place ? setMode('select') : setMode('place', b.dataset.place))));
  }
  function loadModel(m, keepView) {
    model = JSON.parse(JSON.stringify(m));
    fixSeq(); sel = null; built = null; result = null; resMode = null;
    if (!keepView) fitView();
    changed(false);
  }
  function fitView() {
    if (!model.comps.length) { view = { x: -120, y: -100, scale: 1 }; return; }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const c of model.comps) { const b = EC.worldBox(c); x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2); }
    for (const w of model.wires) { x1 = Math.min(x1, w.x1, w.x2); y1 = Math.min(y1, w.y1, w.y2); x2 = Math.max(x2, w.x1, w.x2); y2 = Math.max(y2, w.y1, w.y2); }
    const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
    const bw = (x2 - x1 + 8) * G, bh = (y2 - y1 + 8) * G;
    const s = Math.min(1.4, Math.max(0.4, Math.min(W / bw, H / bh)));
    view.scale = s;
    view.x = ((x1 + x2) / 2) * G - W / s / 2;
    view.y = ((y1 + y2) / 2) * G - H / s / 2;
  }
  function showBanner(html) {
    const b = $('#banner');
    if (!html) { b.hidden = true; return; }
    b.innerHTML = html + '<button class="x" title="Đóng">✕</button>';
    b.hidden = false;
    b.querySelector('.x').onclick = () => (b.hidden = true);
  }

  function init() {
    buildPalette();
    document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
    $('#btnRot').onclick = rotateSel; $('#btnFlip').onclick = flipSel; $('#btnDel').onclick = deleteSel;
    $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
    document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderPanel(); }));
    $('#modeSel').onchange = (e) => { resMode = e.target.value; render(); renderPanel(); };
    $('#showV').onchange = () => render();
    const ex = $('#exSelect');
    EC.EXAMPLES.forEach((e) => (ex.innerHTML += `<option value="${e.id}">${esc(e.title)}</option>`));
    ex.onchange = () => {
      const e = EC.EXAMPLES.find((x) => x.id === ex.value);
      ex.value = '';
      if (!e) return;
      if (model.comps.length) pushUndo();
      toolState = { goal: e.goal ? Object.assign({}, e.goal) : null, sweep: e.sweep ? Object.assign({}, e.sweep) : null, goalOut: '', sweepOut: '' };
      loadModel(e.build());
      showBanner(`<b>${esc(e.title)}</b><br>${esc(e.note)}`);
      tab = e.goal || e.sweep ? 'tools' : 'results';
      renderPanel();
    };
    $('#btnNew').onclick = () => { if (model.comps.length && !confirm('Xoá mạch hiện tại để vẽ mạch mới?')) return; pushUndo(); toolState = { goal: null, sweep: null, goalOut: '', sweepOut: '' }; showBanner(''); loadModel({ comps: [], wires: [] }); };
    $('#btnSave').onclick = () => {
      const blob = new Blob([JSON.stringify(model, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mach-dien.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#btnOpen').onclick = () => $('#fileIn').click();
    $('#fileIn').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((t) => { try { const m = JSON.parse(t); if (!Array.isArray(m.comps) || !Array.isArray(m.wires)) throw 0; pushUndo(); loadModel(m); } catch (err) { alert('File không hợp lệ'); } });
      e.target.value = '';
    };
    $('#helpBody').innerHTML = EC.HELP_HTML;
    $('#btnHelp').onclick = () => ($('#help').hidden = false);
    $('#helpClose').onclick = () => ($('#help').hidden = true);
    $('#help').onclick = (e) => { if (e.target.id === 'help') $('#help').hidden = true; };

    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) { /* bỏ qua */ }
    let m = null;
    if (saved) { try { m = JSON.parse(saved); if (!m.comps || !m.comps.length) m = null; } catch (e) { m = null; } }
    if (m) loadModel(m);
    else {
      const e = EC.EXAMPLES[1];
      loadModel(e.build());
      showBanner(`<b>Chào mừng!</b> Đây là mạch Câu 2 của đề. Bấm vào linh kiện để xem cách tính, hoặc chọn mạch khác ở <b>📘 Ví dụ</b>. Bấm <b>? Công thức</b> để xem hướng dẫn và bảng công thức.`);
    }
    setMode('select');
  }
  init();
})();
