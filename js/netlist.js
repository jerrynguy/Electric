/* Chuyển bản vẽ (linh kiện + dây) thành danh sách nút cho bộ giải */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});
  const key = (x, y) => x + ',' + y;

  class UF {
    constructor() { this.p = new Map(); }
    add(a) { if (!this.p.has(a)) this.p.set(a, a); }
    find(a) { this.add(a); let r = a; while (this.p.get(r) !== r) r = this.p.get(r); let c = a; while (this.p.get(c) !== r) { const n = this.p.get(c); this.p.set(c, r); c = n; } return r; }
    union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
  }

  function onInterior(p, w) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const cross = (p.x - w.x1) * dy - (p.y - w.y1) * dx;
    if (cross !== 0) return false;
    const dot = (p.x - w.x1) * dx + (p.y - w.y1) * dy;
    return dot > 0 && dot < dx * dx + dy * dy;
  }

  function build(model) {
    const COMP = EC.COMP, parse = EC.units.parseValue;
    const uf = new UF();
    const errors = [], warnings = [];
    const pts = [];
    const pinsOf = {};
    const count = new Map();
    const bump = (k, n) => count.set(k, (count.get(k) || 0) + n);
    for (const c of model.comps) {
      const ps = EC.pinPositions(c);
      pinsOf[c.id] = ps;
      ps.forEach((p) => { uf.add(key(p.x, p.y)); pts.push(p); bump(key(p.x, p.y), 1); });
    }
    for (const w of model.wires) {
      uf.union(key(w.x1, w.y1), key(w.x2, w.y2));
      pts.push({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      bump(key(w.x1, w.y1), 1); bump(key(w.x2, w.y2), 1);
    }
    const seenPt = new Set();
    for (const p of pts) {
      const k = key(p.x, p.y);
      if (seenPt.has(k)) continue;
      seenPt.add(k);
      for (const w of model.wires) if (onInterior(p, w)) { uf.union(k, key(w.x1, w.y1)); bump(k, 2); }
    }
    // Nhãn trùng tên -> nối với nhau
    const labelKey = {};
    for (const c of model.comps) if (c.type === 'LABEL') {
      const k = key(pinsOf[c.id][0].x, pinsOf[c.id][0].y);
      const nm = (c.name || '').trim();
      if (!nm) continue;
      if (labelKey[nm]) uf.union(labelKey[nm], k); else labelKey[nm] = k;
    }

    // Đánh số nút
    const rootNode = new Map();
    const nodeNames = ['GND'];
    const nodeRep = [null];
    const grounds = model.comps.filter((c) => c.type === 'GND');
    for (const g of grounds) { const r = uf.find(key(pinsOf[g.id][0].x, pinsOf[g.id][0].y)); rootNode.set(r, 0); if (!nodeRep[0]) nodeRep[0] = pinsOf[g.id][0]; }
    let refAuto = null;
    if (!grounds.length) {
      const src = model.comps.find((c) => ['V', 'ACV', 'I', 'ACI'].includes(c.type)) || model.comps.find((c) => COMP[c.type].pins.length > 1);
      if (src) {
        const p = pinsOf[src.id][src.type === 'V' || src.type === 'ACV' ? 1 : 0];
        rootNode.set(uf.find(key(p.x, p.y)), 0);
        nodeRep[0] = p;
        refAuto = src.name;
      }
    }
    for (const c of model.comps) {
      for (const p of pinsOf[c.id]) {
        const r = uf.find(key(p.x, p.y));
        if (!rootNode.has(r)) { rootNode.set(r, nodeNames.length); nodeNames.push('N' + nodeNames.length); nodeRep.push(p); }
      }
    }
    // Tên nút theo nhãn
    for (const c of model.comps) if (c.type === 'LABEL' && (c.name || '').trim()) {
      const n = rootNode.get(uf.find(key(pinsOf[c.id][0].x, pinsOf[c.id][0].y)));
      if (n > 0) nodeNames[n] = c.name.trim();
      else if (n === 0) nodeNames[0] = 'GND (' + c.name.trim() + ')';
    }
    // tránh trùng tên tự động với tên nhãn
    const used = new Set();
    nodeNames.forEach((nm, i) => { let n = nm, j = 2; while (used.has(n)) n = nm + '_' + j++; used.add(n); nodeNames[i] = n; });

    const nodeAt = (x, y) => {
      const k = key(x, y);
      if (uf.p.has(k)) { const r = rootNode.get(uf.find(k)); if (r !== undefined) return r; }
      for (const w of model.wires) if (onInterior({ x, y }, w)) { const r = rootNode.get(uf.find(key(w.x1, w.y1))); if (r !== undefined) return r; }
      return undefined;
    };

    const elements = [];
    const compNodes = {};
    for (const c of model.comps) {
      const def = COMP[c.type];
      const nodes = pinsOf[c.id].map((p) => rootNode.get(uf.find(key(p.x, p.y))));
      compNodes[c.id] = nodes;
      if (c.type === 'GND' || c.type === 'LABEL') continue;
      const p = {};
      let bad = false;
      for (const d of def.params) {
        if (d.type === 'bool') { p[d.k] = !!c.params[d.k]; continue; }
        const v = parse(c.params[d.k]);
        if (!isFinite(v)) { errors.push(`${c.name}: giá trị "${d.label}" không hợp lệ`); bad = true; }
        p[d.k] = v;
      }
      if (bad) continue;
      if ((c.type === 'C' && p.C <= 0) || (c.type === 'L' && p.L < 0) || (c.type === 'R' && p.R < 0)) { errors.push(`${c.name}: giá trị phải dương`); continue; }
      if ((c.type === 'V' || c.type === 'ACV') && nodes[0] === nodes[1]) { errors.push(`${c.name}: nguồn áp bị nối tắt hai cực`); continue; }
      pinsOf[c.id].forEach((pp, i) => { if ((count.get(key(pp.x, pp.y)) || 0) < 2) warnings.push(`${c.name}: chân ${def.pinNames[i]} chưa được nối`); });
      elements.push({ id: c.id, type: c.type, name: c.name, nodes, p });
    }
    if (refAuto && elements.length) warnings.push(`Chưa có GND: lấy cực âm của ${refAuto} làm mốc 0 V.`);

    return { net: { nodeCount: nodeNames.length, elements, nodeNames }, nodeNames, nodeRep, nodeAt, compNodes, pinsOf, count, errors, warnings, onInterior };
  }

  EC.netlist = { build, onInterior, key };
})();
