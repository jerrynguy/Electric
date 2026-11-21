/* Công cụ: phân tích một mô hình, tìm giá trị tham số (goal seek), quét tham số */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});

  function run(model) {
    const b = EC.netlist.build(model);
    if (b.errors.length) return { build: b, result: { ok: false, error: b.errors.join('; '), warnings: [], ac: [] } };
    if (!b.net.elements.length) return { build: b, result: null };
    return { build: b, result: EC.solver.analyze(b.net) };
  }

  /* spec: { node: 'A' } hoặc { comp: 'R4' (tên), key: 'I' } ; mode: 'dc' | số tần số */
  function pickRes(result, mode) {
    if (!result || !result.ok) return null;
    if (mode === 'dc' || mode == null) return result.dc;
    return result.ac.find((r) => Math.abs(r.ctx.freq - mode) < 1e-9) || null;
  }

  function extract(model, run_, spec) {
    const { build, result } = run_;
    const r = pickRes(result, spec.mode);
    if (!r) return NaN;
    let v;
    if (spec.node != null) {
      const n = build.nodeNames.indexOf(spec.node);
      if (n < 0) return NaN;
      v = r.nodeV[n];
    } else {
      const c = model.comps.find((c) => c.name === spec.comp);
      if (!c || !r.el[c.id]) return NaN;
      v = r.el[c.id].q[spec.key];
    }
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    return spec.mode === 'dc' || spec.mode == null ? v.re : Math.hypot(v.re, v.im);
  }

  function signature(model, run_) {
    const r = run_.result;
    if (!r || !r.ok) return 'lỗi';
    const parts = [];
    for (const c of model.comps) { const st = r.dc.states[c.id]; if (st) parts.push(c.name + ':' + st); }
    return parts.join(', ');
  }

  function withParam(model, compName, param, x) {
    const m = JSON.parse(JSON.stringify(model));
    const c = m.comps.find((c) => c.name === compName);
    if (c) c.params[param] = String(x);
    return m;
  }

  function evalAt(model, compName, param, x, spec) {
    const m = withParam(model, compName, param, x);
    const r = run(m);
    return { value: extract(m, r, spec), sig: signature(m, r), run: r, model: m };
  }

  function goalSeek(o) {
    const { model, comp, param, spec, target } = o;
    const c = model.comps.find((c) => c.name === comp);
    const x0 = EC.units.parseValue(c.params[param]);
    let lo = o.min, hi = o.max, log;
    if (lo == null || hi == null || !isFinite(lo) || !isFinite(hi)) {
      if (x0 > 0) { lo = x0 / 1e5; hi = x0 * 1e5; } else { const s = Math.max(1, Math.abs(x0)) * 1000; lo = -s; hi = s; }
    }
    log = lo > 0 && hi > 0;
    const N = 400;
    const xs = [], fs = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = log ? lo * Math.pow(hi / lo, t) : lo + (hi - lo) * t;
      xs.push(x); fs.push(evalAt(model, comp, param, x, spec).value - target);
    }
    const brackets = [];
    let best = { x: NaN, f: Infinity };
    for (let i = 0; i <= N; i++) {
      if (isFinite(fs[i]) && Math.abs(fs[i]) < Math.abs(best.f)) best = { x: xs[i], f: fs[i] };
      if (i < N && isFinite(fs[i]) && isFinite(fs[i + 1]) && (fs[i] === 0 || fs[i] * fs[i + 1] < 0)) brackets.push(i);
    }
    const dist = (x) => (log && x0 > 0 ? Math.abs(Math.log(x / x0)) : Math.abs(x - x0));
    const roots = [];
    for (const i of brackets) {
      let a = xs[i], b = xs[i + 1], fa = fs[i];
      if (fa === 0) { roots.push(a); continue; }
      for (let it = 0; it < 100; it++) {
        const m = log ? Math.sqrt(a * b) : (a + b) / 2;
        const fm = evalAt(model, comp, param, m, spec).value - target;
        if (!isFinite(fm)) break;
        if (fm === 0) { a = b = m; break; }
        if (fa * fm < 0) b = m; else { a = m; fa = fm; }
      }
      const x = log ? Math.sqrt(a * b) : (a + b) / 2;
      const f = evalAt(model, comp, param, x, spec).value - target;
      if (Math.abs(f) <= 1e-6 * Math.max(1, Math.abs(target))) roots.push(x);
    }
    roots.sort((a, b) => dist(a) - dist(b));
    if (roots.length) {
      const x = roots[0];
      return { ok: true, x, roots, value: evalAt(model, comp, param, x, spec).value, range: [lo, hi] };
    }
    return { ok: false, best, range: [lo, hi] };
  }

  function sweep(o) {
    const { model, comp, param, from, to, steps, log, spec } = o;
    const pts = [];
    const n = Math.max(2, steps | 0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = log ? from * Math.pow(to / from, t) : from + (to - from) * t;
      const r = evalAt(model, comp, param, x, spec);
      pts.push({ x, y: r.value, sig: r.sig });
    }
    const transitions = [];
    for (let i = 0; i < n; i++) {
      if (pts[i].sig === pts[i + 1].sig) continue;
      let a = pts[i].x, b = pts[i + 1].x;
      const sa = pts[i].sig;
      for (let it = 0; it < 80; it++) {
        const m = log ? Math.sqrt(a * b) : (a + b) / 2;
        if (evalAt(model, comp, param, m, spec).sig === sa) a = m; else b = m;
      }
      transitions.push({ x: log ? Math.sqrt(a * b) : (a + b) / 2, from: sa, to: pts[i + 1].sig });
    }
    return { pts, transitions };
  }

  EC.tools = { run, extract, goalSeek, sweep, evalAt, pickRes, signature };
})();
