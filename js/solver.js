/*
 * Bộ giải mạch theo phương pháp nút cải tiến (Modified Nodal Analysis - MNA).
 *  - DC: nguồn DC, tụ hở mạch, cuộn cảm ngắn mạch.
 *  - AC: phasor hiệu dụng (RMS) tại tần số của nguồn AC, nguồn DC = 0.
 *  - Linh kiện phi tuyến dùng mô hình tuyến tính từng đoạn giống sách giáo khoa:
 *      Diode: dẫn (sụt áp Vf) / tắt.
 *      Zener: dẫn thuận / đánh thủng (Vz) / tắt.
 *      BJT: ngưng dẫn / khuếch đại (IC = β·IB, VBE) / bão hòa (VCE = VCE(sat)).
 *      Op-amp lý tưởng: tuyến tính (V+ = V−) / bão hòa dương / bão hòa âm.
 *    Trạng thái được tìm bằng cách lặp "giả sử – kiểm tra" cho tới khi nhất quán.
 */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});
  const GMIN = 1e-12; // điện dẫn rất nhỏ từ mỗi nút xuống đất để tránh nút "lơ lửng"
  const RS = 1e-6; // điện trở nối tiếp rất nhỏ của diode/BJT để tránh vòng nguồn áp
  const BR = 1000000;
  const EPS_I = 1e-12, EPS_V = 1e-9;

  const cx = (re, im) => ({ re, im: im || 0 });
  const csub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const cadd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const cscale = (a, k) => cx(a.re * k, a.im * k);
  const cabs = (a) => Math.hypot(a.re, a.im);
  const polar = (mag, deg) => cx(mag * Math.cos((deg * Math.PI) / 180), mag * Math.sin((deg * Math.PI) / 180));

  class CircuitError extends Error {}

  class Sys {
    constructor(nn) { this.nn = nn; this.nb = 0; this.ent = []; this.rhs = []; }
    add(r, c, re, im) { if (r < 0 || c < 0) return; this.ent.push(r, c, re, im || 0); }
    addR(r, re, im) { if (r < 0) return; this.rhs.push(r, re, im || 0); }
    admit(a, b, re, im) {
      im = im || 0; const i = a - 1, j = b - 1;
      this.add(i, i, re, im); this.add(j, j, re, im); this.add(i, j, -re, -im); this.add(j, i, -re, -im);
    }
    /* Nhánh nguồn áp: V(a) − V(b) − Z·I = v ; I chảy từ a qua phần tử sang b */
    vsrc(a, b, vre, vim, zre, zim) {
      const k = BR + this.nb++, i = a - 1, j = b - 1;
      this.add(i, k, 1); this.add(j, k, -1); this.add(k, i, 1); this.add(k, j, -1);
      if (zre || zim) this.add(k, k, -(zre || 0), -(zim || 0));
      this.addR(k, vre || 0, vim || 0);
      return k;
    }
    /* Nguồn dòng: dòng I chảy từ a qua phần tử sang b (đẩy ra ở chân b) */
    isrc(a, b, ire, iim) { this.addR(a - 1, -ire, -(iim || 0)); this.addR(b - 1, ire, iim || 0); }
    cccs(k, c, e, beta) { this.add(c - 1, k, beta); this.add(e - 1, k, -beta); }
    opampLin(p, m, out) {
      const k = BR + this.nb++;
      this.add(out - 1, k, 1); this.add(k, p - 1, 1); this.add(k, m - 1, -1);
      return k;
    }
    solve() {
      const nn = this.nn, N = nn - 1 + this.nb;
      const map = (i) => (i >= BR ? nn - 1 + (i - BR) : i);
      const Ar = new Float64Array(N * N), Ai = new Float64Array(N * N);
      const br = new Float64Array(N), bi = new Float64Array(N);
      for (let i = 0; i < nn - 1; i++) Ar[i * N + i] += GMIN;
      const e = this.ent;
      for (let t = 0; t < e.length; t += 4) { const r = map(e[t]), c = map(e[t + 1]); Ar[r * N + c] += e[t + 2]; Ai[r * N + c] += e[t + 3]; }
      const h = this.rhs;
      for (let t = 0; t < h.length; t += 3) { const r = map(h[t]); br[r] += h[t + 1]; bi[r] += h[t + 2]; }
      for (let k = 0; k < N; k++) {
        let p = k, best = -1;
        for (let i = k; i < N; i++) { const m = Math.abs(Ar[i * N + k]) + Math.abs(Ai[i * N + k]); if (m > best) { best = m; p = i; } }
        if (best < 1e-14) throw new CircuitError('singular');
        if (p !== k) {
          for (let j = 0; j < N; j++) {
            let t = Ar[k * N + j]; Ar[k * N + j] = Ar[p * N + j]; Ar[p * N + j] = t;
            t = Ai[k * N + j]; Ai[k * N + j] = Ai[p * N + j]; Ai[p * N + j] = t;
          }
          let t = br[k]; br[k] = br[p]; br[p] = t; t = bi[k]; bi[k] = bi[p]; bi[p] = t;
        }
        const pr = Ar[k * N + k], pi = Ai[k * N + k], d = pr * pr + pi * pi;
        for (let i = k + 1; i < N; i++) {
          const ar = Ar[i * N + k], ai = Ai[i * N + k];
          if (ar === 0 && ai === 0) continue;
          const fr = (ar * pr + ai * pi) / d, fi = (ai * pr - ar * pi) / d;
          for (let j = k; j < N; j++) {
            const xr = Ar[k * N + j], xi = Ai[k * N + j];
            if (xr === 0 && xi === 0) continue;
            Ar[i * N + j] -= fr * xr - fi * xi; Ai[i * N + j] -= fr * xi + fi * xr;
          }
          const yr = br[k], yi = bi[k];
          br[i] -= fr * yr - fi * yi; bi[i] -= fr * yi + fi * yr;
        }
      }
      const xr = new Float64Array(N), xi = new Float64Array(N);
      for (let i = N - 1; i >= 0; i--) {
        let sr = br[i], si = bi[i];
        for (let j = i + 1; j < N; j++) {
          const ar = Ar[i * N + j], ai = Ai[i * N + j];
          sr -= ar * xr[j] - ai * xi[j]; si -= ar * xi[j] + ai * xr[j];
        }
        const pr = Ar[i * N + i], pi = Ai[i * N + i], d = pr * pr + pi * pi;
        xr[i] = (sr * pr + si * pi) / d; xi[i] = (si * pr - sr * pi) / d;
      }
      return {
        V: (n) => (n <= 0 ? cx(0) : cx(xr[n - 1], xi[n - 1])),
        I: (k) => cx(xr[map(k)], xi[map(k)]),
        Vd(a, b) { return csub(this.V(a), this.V(b)); },
        nodeCount: nn,
      };
    }
  }

  /* ---------- Mô tả từng loại linh kiện ---------- */
  const two = (q) => q; // tiện ích đặt tên
  function acSource(e, ctx) {
    if (!ctx.ac || Math.abs(ctx.freq - e.p.f) > 1e-9) return cx(0);
    return polar(e.p.V !== undefined ? e.p.V : e.p.I, e.p.ph || 0);
  }

  const DEV = {
    R: {
      stamp(s, e) { const [a, b] = e.nodes; if (Math.abs(e.p.R) < 1e-12) return { k: s.vsrc(a, b, 0) }; s.admit(a, b, 1 / e.p.R); return {}; },
      res(sol, e, info) { const [a, b] = e.nodes; const U = sol.Vd(a, b); return two({ U, I: info.k != null ? sol.I(info.k) : cscale(U, 1 / e.p.R) }); },
    },
    C: {
      stamp(s, e, ctx) { if (ctx.ac) s.admit(e.nodes[0], e.nodes[1], 0, ctx.omega * e.p.C); return {}; },
      res(sol, e, info, ctx) { const U = sol.Vd(e.nodes[0], e.nodes[1]); return { U, I: ctx.ac ? cmul(U, cx(0, ctx.omega * e.p.C)) : cx(0) }; },
    },
    L: {
      stamp(s, e, ctx) { return { k: s.vsrc(e.nodes[0], e.nodes[1], 0, 0, 0, ctx.ac ? ctx.omega * e.p.L : 0) }; },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: sol.I(info.k) }; },
    },
    Z: {
      stamp(s, e, ctx) {
        const [a, b] = e.nodes; const z = ctx.ac ? cx(e.p.R, e.p.X) : cx(e.p.R);
        if (cabs(z) < 1e-12) return { k: s.vsrc(a, b, 0) };
        const y = cdiv(cx(1), z); s.admit(a, b, y.re, y.im); return { y };
      },
      res(sol, e, info) { const U = sol.Vd(e.nodes[0], e.nodes[1]); return { U, I: info.k != null ? sol.I(info.k) : cmul(U, info.y) }; },
    },
    SW: {
      stamp(s, e) { return e.p.closed ? { k: s.vsrc(e.nodes[0], e.nodes[1], 0) } : {}; },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: info.k != null ? sol.I(info.k) : cx(0) }; },
    },
    V: {
      stamp(s, e, ctx) { return { k: s.vsrc(e.nodes[0], e.nodes[1], ctx.ac ? 0 : e.p.V) }; },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: sol.I(info.k) }; },
    },
    ACV: {
      stamp(s, e, ctx) { const v = acSource(e, ctx); return { k: s.vsrc(e.nodes[0], e.nodes[1], v.re, v.im) }; },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: sol.I(info.k) }; },
    },
    I: {
      stamp(s, e, ctx) { if (!ctx.ac) s.isrc(e.nodes[0], e.nodes[1], e.p.I); return {}; },
      res(sol, e, info, ctx) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: cx(ctx.ac ? 0 : e.p.I) }; },
    },
    ACI: {
      stamp(s, e, ctx) { const i = acSource(e, ctx); s.isrc(e.nodes[0], e.nodes[1], i.re, i.im); return { i }; },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: info.i }; },
    },
    D: {
      states: ['off', 'on'], init: 'off',
      stamp(s, e, ctx, st) { return st === 'on' ? { k: s.vsrc(e.nodes[0], e.nodes[1], ctx.ac ? 0 : e.p.Vf, 0, RS) } : {}; },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: info.k != null ? sol.I(info.k) : cx(0) }; },
      check(sol, e, info, st) {
        if (st === 'on') return sol.I(info.k).re < -EPS_I ? 'off' : null;
        return sol.Vd(e.nodes[0], e.nodes[1]).re > e.p.Vf + EPS_V ? 'on' : null;
      },
    },
    ZD: {
      states: ['off', 'fwd', 'bd'], init: 'off',
      stamp(s, e, ctx, st) {
        if (st === 'fwd') return { k: s.vsrc(e.nodes[0], e.nodes[1], ctx.ac ? 0 : e.p.Vf, 0, RS) };
        if (st === 'bd') return { k: s.vsrc(e.nodes[0], e.nodes[1], ctx.ac ? 0 : -e.p.Vz, 0, RS) };
        return {};
      },
      res(sol, e, info) { return { U: sol.Vd(e.nodes[0], e.nodes[1]), I: info.k != null ? sol.I(info.k) : cx(0) }; },
      check(sol, e, info, st) {
        if (st === 'fwd') return sol.I(info.k).re < -EPS_I ? 'off' : null;
        if (st === 'bd') return sol.I(info.k).re > EPS_I ? 'off' : null;
        const v = sol.Vd(e.nodes[0], e.nodes[1]).re;
        if (v > e.p.Vf + EPS_V) return 'fwd';
        if (v < -e.p.Vz - EPS_V) return 'bd';
        return null;
      },
    },
    NPN: null, PNP: null,
    OPAMP: {
      states: ['lin', 'pos', 'neg'], init: 'lin',
      // nodes: [in−, in+, out]
      stamp(s, e, ctx, st) {
        const [m, p, o] = e.nodes;
        if (st === 'lin') return { k: s.opampLin(p, m, o) };
        return { k: s.vsrc(o, 0, ctx.ac ? 0 : st === 'pos' ? e.p.Vpos : e.p.Vneg) };
      },
      res(sol, e, info) {
        const [m, p, o] = e.nodes;
        const Vout = sol.V(o), Vp = sol.V(p), Vm = sol.V(m), Iout = cscale(sol.I(info.k), -1);
        return { Vout, Vp, Vm, Vd: csub(Vp, Vm), Iout, P: -(Vout.re * Iout.re + Vout.im * Iout.im) };
      },
      check(sol, e, info, st) {
        const [m, p, o] = e.nodes;
        if (st === 'lin') { const v = sol.V(o).re; if (v > e.p.Vpos + EPS_V) return 'pos'; if (v < e.p.Vneg - EPS_V) return 'neg'; return null; }
        const vd = sol.V(p).re - sol.V(m).re;
        if (st === 'pos') return vd < -EPS_V ? 'lin' : null;
        return vd > EPS_V ? 'lin' : null;
      },
    },
  };

  function bjt(sign) {
    return {
      states: ['cut', 'act', 'sat'], init: 'act',
      // nodes: [B, C, E]
      stamp(s, e, ctx, st) {
        const [B, C, E] = e.nodes;
        if (st === 'cut') return {};
        const kbe = s.vsrc(B, E, ctx.ac ? 0 : sign * e.p.Vbe, 0, RS);
        if (st === 'act') { s.cccs(kbe, C, E, e.p.beta); return { kbe }; }
        return { kbe, kce: s.vsrc(C, E, ctx.ac ? 0 : sign * e.p.Vcesat, 0, RS) };
      },
      res(sol, e, info, ctx, st) {
        const [B, C, E] = e.nodes;
        let IB = cx(0), IC = cx(0);
        if (st !== 'cut') { IB = sol.I(info.kbe); IC = st === 'act' ? cscale(IB, e.p.beta) : sol.I(info.kce); }
        const VBE = sol.Vd(B, E), VCE = sol.Vd(C, E);
        const P = VBE.re * IB.re + VBE.im * IB.im + VCE.re * IC.re + VCE.im * IC.im;
        // Với PNP hiển thị dòng theo chiều quy ước (chảy ra khỏi B và C) để luôn dương
        const s2 = sign;
        return { VBE, VCE, IB: cscale(IB, s2), IC: cscale(IC, s2), IE: cscale(cadd(IB, IC), s2), P };
      },
      check(sol, e, info, st) {
        const [B, C, E] = e.nodes;
        if (st === 'cut') return sign * sol.Vd(B, E).re > e.p.Vbe + EPS_V ? 'act' : null;
        const ib = sign * sol.I(info.kbe).re;
        if (ib < -EPS_I) return 'cut';
        if (st === 'act') return sign * sol.Vd(C, E).re < e.p.Vcesat - EPS_V ? 'sat' : null;
        const ic = sign * sol.I(info.kce).re;
        if (ic > e.p.beta * ib + EPS_I || ic < -EPS_I) return 'act';
        return null;
      },
    };
  }
  DEV.NPN = bjt(1);
  DEV.PNP = bjt(-1);

  const STATE_NAMES = {
    on: 'Dẫn', off: 'Tắt', fwd: 'Dẫn thuận', bd: 'Đánh thủng (ổn áp)',
    cut: 'Ngưng dẫn', act: 'Khuếch đại (tích cực)', sat: 'Bão hòa',
    lin: 'Tuyến tính', pos: 'Bão hòa dương', neg: 'Bão hòa âm',
  };

  /* ---------- Giải với một tổ hợp trạng thái cố định ---------- */
  function solveFixed(net, ctx, states) {
    const s = new Sys(net.nodeCount);
    const infos = {};
    for (const e of net.elements) infos[e.id] = DEV[e.type].stamp(s, e, ctx, states[e.id]);
    const sol = s.solve();
    return { sol, infos };
  }

  function collect(net, ctx, states, fixed) {
    const { sol, infos } = fixed;
    const nodeV = [];
    for (let n = 0; n < net.nodeCount; n++) nodeV.push(sol.V(n));
    const el = {};
    for (const e of net.elements) {
      const q = DEV[e.type].res(sol, e, infos[e.id], ctx, states[e.id]);
      if (q.U && q.I && q.P === undefined) {
        q.P = q.U.re * q.I.re + q.U.im * q.I.im;
        if (ctx.ac) q.Q = q.U.im * q.I.re - q.U.re * q.I.im;
      }
      el[e.id] = { q, state: states[e.id] || null };
    }
    return { nodeV, el, states: Object.assign({}, states), ctx };
  }

  function solveDC(net, warnings) {
    const ctx = { ac: false, freq: 0, omega: 0 };
    const nl = net.elements.filter((e) => DEV[e.type].states);
    const states = {};
    nl.forEach((e) => (states[e.id] = (e.initState) || DEV[e.type].init));
    const keyOf = (st) => nl.map((e) => st[e.id]).join('|');

    const tryStates = (st) => {
      let f;
      try { f = solveFixed(net, ctx, st); } catch (err) { if (err instanceof CircuitError) return { ok: false }; throw err; }
      const changes = [];
      for (const e of nl) { const nx = DEV[e.type].check(f.sol, e, f.infos[e.id], st[e.id]); if (nx) changes.push([e.id, nx]); }
      return { ok: true, f, changes };
    };

    if (!nl.length) {
      let f;
      try { f = solveFixed(net, ctx, states); } catch (err) { throw singularMsg(err); }
      return collect(net, ctx, states, f);
    }

    const seen = new Set();
    let cur = Object.assign({}, states);
    for (let it = 0; it < 300; it++) {
      const r = tryStates(cur);
      if (!r.ok) break;
      if (!r.changes.length) return collect(net, ctx, cur, r.f);
      seen.add(keyOf(cur));
      let next = Object.assign({}, cur);
      r.changes.forEach(([id, st]) => (next[id] = st));
      if (seen.has(keyOf(next))) {
        let found = false;
        for (const [id, st] of r.changes) {
          next = Object.assign({}, cur); next[id] = st;
          if (!seen.has(keyOf(next))) { found = true; break; }
        }
        if (!found) break;
      }
      cur = next;
    }
    // Vét cạn mọi tổ hợp trạng thái (mạch nhỏ)
    const counts = nl.map((e) => DEV[e.type].states.length);
    const total = counts.reduce((a, b) => a * b, 1);
    if (total <= 200000) {
      const idx = new Array(nl.length).fill(0);
      for (let t = 0; t < total; t++) {
        const st = {};
        nl.forEach((e, i) => (st[e.id] = DEV[e.type].states[idx[i]]));
        const r = tryStates(st);
        if (r.ok && !r.changes.length) return collect(net, ctx, st, r.f);
        for (let i = 0; i < idx.length; i++) { idx[i]++; if (idx[i] < counts[i]) break; idx[i] = 0; }
      }
    }
    throw new CircuitError('Không tìm được trạng thái nhất quán cho các linh kiện phi tuyến (diode/BJT/op-amp). Kiểm tra lại cách nối mạch.');
  }

  function singularMsg(err) {
    if (err instanceof CircuitError && err.message === 'singular')
      return new CircuitError('Mạch không giải được: có vòng chỉ gồm nguồn áp / cuộn cảm (DC) / dây nối tắt, hoặc nguồn dòng bị hở mạch.');
    return err;
  }

  function analyze(net) {
    const out = { ok: true, error: null, warnings: [], dc: null, ac: [] };
    try {
      out.dc = solveDC(net, out.warnings);
    } catch (err) {
      out.ok = false;
      out.error = singularMsg(err).message;
      return out;
    }
    const freqs = [];
    for (const e of net.elements) {
      if ((e.type === 'ACV' || e.type === 'ACI') && e.p.f > 0 && !freqs.some((f) => Math.abs(f - e.p.f) < 1e-9)) freqs.push(e.p.f);
    }
    if (freqs.length > 1) out.warnings.push('Có nhiều tần số khác nhau: kết quả AC được tính riêng cho từng tần số (xếp chồng).');
    const hasNL = net.elements.some((e) => ['D', 'ZD', 'NPN', 'PNP'].includes(e.type));
    if (freqs.length && hasNL) out.warnings.push('Phân tích AC với diode/BJT dùng trạng thái DC (mô hình gần đúng).');
    for (const f of freqs) {
      const ctx = { ac: true, freq: f, omega: 2 * Math.PI * f };
      try {
        out.ac.push(collect(net, ctx, out.dc.states, solveFixed(net, ctx, out.dc.states)));
      } catch (err) {
        out.warnings.push('AC ' + f + ' Hz: ' + singularMsg(err).message);
      }
    }
    const big = out.dc.nodeV.some((v) => Math.abs(v.re) > 1e7);
    if (big) out.warnings.push('Có điện áp cực lớn: có thể nguồn dòng đang bị hở mạch hoặc nút bị bỏ lửng.');
    return out;
  }

  EC.solver = { analyze, DEV, STATE_NAMES, cx, cabs, cadd, csub, cmul, cdiv, polar };
})();
