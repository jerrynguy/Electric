/* Kiểm tra bộ giải bằng các câu trong đề thi. Chạy: node tests/run-tests.js */
'use strict';
for (const f of ['units', 'solver', 'components', 'netlist', 'tools', 'examples']) require('../js/' + f + '.js');
const EC = globalThis.EC;
let fail = 0, pass = 0;
function check(name, got, want, tol) {
  const ok = isFinite(got) && Math.abs(got - want) <= tol;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + ': ' + got + ' (mong đợi ' + want + ' ± ' + tol + ')');
  ok ? pass++ : fail++;
}
const ex = (id) => EC.EXAMPLES.find((e) => e.id === id).build();
const val = (m, spec) => { const r = EC.tools.run(m); if (!r.result || !r.result.ok) console.log('    lỗi:', r.result && r.result.error, r.build.errors); return EC.tools.extract(m, r, spec); };
const state = (m, name) => { const r = EC.tools.run(m); const c = m.comps.find((c) => c.name === name); return r.result.dc.states[c.id]; };

console.log('Câu 1');
{ const e = EC.EXAMPLES[0]; const m = e.build();
  const g = EC.tools.goalSeek(Object.assign({ model: m }, e.goal)); check('R3', g.x, 10, 1e-3);
  m.comps.find((c) => c.name === 'R3').params.R = '10'; check('V(A) khi R3=10', val(m, { node: 'A', mode: 'dc' }), 8.5, 1e-6); }
console.log('Câu 2');
check('P(R4)', val(ex('h2'), { comp: 'R4', key: 'P', mode: 'dc' }), 27.225, 1e-3);
console.log('Câu 3');
check('I(R9) hiệu dụng', val(ex('h3'), { comp: 'R9', key: 'I', mode: 50 }), 14.536, 0.01);
console.log('Câu 4');
{ const e = EC.EXAMPLES[3]; const g = EC.tools.goalSeek(Object.assign({ model: e.build() }, e.goal)); check('R đường dây', g.x, 1.409, 0.002);
  check('I(Rd_A) với R=1', val(e.build(), { comp: 'RdA', key: 'I', mode: 50 }), 120 / Math.hypot(4, 3), 1e-6);
  check('Tổng dòng 3 pha ≈ 0 (cân bằng)', (() => { const m = e.build(); const r = EC.tools.run(m); const ac = r.result.ac[0]; let s = { re: 0, im: 0 }; for (const p of ['RdA', 'RdB', 'RdC']) { const I = ac.el[m.comps.find((c) => c.name === p).id].q.I; s.re += I.re; s.im += I.im; } return Math.hypot(s.re, s.im); })(), 0, 1e-6); }
console.log('Câu 5');
check('I(D1)', val(ex('h5'), { comp: 'D1', key: 'I', mode: 'dc' }), 11.3 / 3000, 1e-8);
console.log('Câu 6');
check('I(Zener) (chiều ngược)', -val(ex('h6'), { comp: 'D2', key: 'I', mode: 'dc' }), 0.012, 1e-8);
console.log('Câu 7');
{ const m = ex('h7'); check('P(Q1)', val(m, { comp: 'Q1', key: 'P', mode: 'dc' }), 0.2 * 0.0138 + 1 * 6.2 / 5500, 1e-8);
  console.log('    trạng thái:', state(m, 'Q1')); if (state(m, 'Q1') !== 'sat') fail++; }
console.log('Câu 8');
{ const e = EC.EXAMPLES[6]; const s = EC.tools.sweep(Object.assign({ model: e.build() }, e.sweep));
  const t = s.transitions[0]; check('ngưỡng RB bão hòa', t && t.x, 6.2 / (13.8e-3 / 220), 1); console.log('    ', t && t.from, '→', t && t.to); }
console.log('Câu 9/10');
{ const m = ex('h8'); check('Vout (bão hòa)', val(m, { node: 'Vout', mode: 'dc' }), -15, 1e-9);
  m.comps.find((c) => c.name === 'Vi1').params.V = '0.1'; m.comps.find((c) => c.name === 'Vi2').params.V = '0.2';
  check('Vout tuyến tính = −20·Vi1 + 21·Vi2', val(m, { node: 'Vout', mode: 'dc' }), -2 + 4.2, 1e-6); }
console.log('Khác');
{ // PNP: emitter lên 10V, RB về đất, RC về đất
  const m = { comps: [], wires: [] }; let n = 1;
  const c = (type, name, x, y, rot, params, flip) => m.comps.push({ id: 'c' + n++, type, name, x, y, rot: rot || 0, flip: !!flip, params: Object.assign(EC.defaultParams(type), params) });
  c('PNP', 'Q1', 0, 0, 0, { beta: '100', Vbe: '0.7', Vcesat: '0.2' }, true); // lật: C ở dưới, E ở trên
  c('V', 'VCC', 1, -4, 1, { V: '10' }); // + tại (1,-6)?? kiểm tra bên dưới
  // E tại (1,-2) với lật; nối E -> + nguồn
  const pins = EC.pinPositions(m.comps[0]);
  m.comps[1].x = pins[2].x; m.comps[1].y = pins[2].y - 2; m.comps[1].rot = 3; // + ở dưới nối E
  c('R', 'RB', pins[0].x - 2, pins[0].y, 0, { R: '200k' });
  c('R', 'RC', pins[1].x, pins[1].y + 2, 1, { R: '1k' });
  c('GND', 'G1', pins[0].x - 4, pins[0].y); c('GND', 'G2', pins[1].x, pins[1].y + 4);
  const vs = EC.pinPositions(m.comps[1]); c('GND', 'G3', vs[1].x, vs[1].y);
  const r = EC.tools.run(m);
  if (!r.result.ok) console.log(r.result.error, r.build.warnings);
  const ib = (10 - 0.7) / 200000;
  check('PNP IB', EC.tools.extract(m, r, { comp: 'Q1', key: 'IB', mode: 'dc' }), ib, 1e-9);
  check('PNP IC', EC.tools.extract(m, r, { comp: 'Q1', key: 'IC', mode: 'dc' }), 100 * ib, 1e-7);
}
{ const u = EC.units; check('parse 5.5k', u.parseValue('5.5k'), 5500, 1e-9); check('parse 26,5mH', u.parseValue('26,5mH'), 0.0265, 1e-12); check('parse 2M', u.parseValue('2M'), 2e6, 1e-6); }
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
