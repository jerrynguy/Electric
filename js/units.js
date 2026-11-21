/* Đọc / hiển thị giá trị có tiền tố SI (k, m, µ, ...) */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});
  const PREFIX = { T: 1e12, G: 1e9, M: 1e6, meg: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, n: 1e-9, p: 1e-12 };

  function parseValue(str) {
    if (typeof str === 'number') return str;
    if (str == null) return NaN;
    const s = String(str).trim().replace(/,/g, '.').replace(/\s+/g, '');
    if (!s) return NaN;
    const m = s.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(meg|[TGMkKmuµμnp])?([a-zA-ZΩ°]*)$/);
    if (!m) return NaN;
    let v = parseFloat(m[1]);
    if (m[2]) v *= PREFIX[m[2]];
    return v;
  }

  const STEPS = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];

  function num(x, digits) {
    let s = x.toPrecision(digits);
    if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  function fmt(v, unit, digits) {
    unit = unit || '';
    digits = digits || 4;
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a < 1e-13) return '0 ' + unit;
    for (let i = 0; i < STEPS.length; i++) {
      const f = STEPS[i][0];
      if (a >= f * (1 - 5e-5) || i === STEPS.length - 1) {
        let s = num(v / f, digits);
        if (Math.abs(parseFloat(s)) >= 1000 && i > 0) s = num(v / STEPS[i - 1][0], digits), i = i - 1;
        return s + ' ' + STEPS[i][1] + unit;
      }
    }
    return v.toExponential(3) + ' ' + unit;
  }

  function fmtDeg(d) {
    if (!isFinite(d)) return '—';
    return num(Math.abs(d) < 5e-4 ? 0 : d, 4) + '°';
  }

  /* Số phức dạng {re, im} -> "12.3 V ∠ -45°" */
  function fmtC(c, unit, digits) {
    const mag = Math.hypot(c.re, c.im);
    if (mag < 1e-13) return '0 ' + (unit || '');
    return fmt(mag, unit, digits) + ' ∠ ' + fmtDeg((Math.atan2(c.im, c.re) * 180) / Math.PI);
  }

  function fmtRect(c, unit) {
    const s = c.im < 0 ? ' − j' : ' + j';
    return num(c.re, 4) + s + num(Math.abs(c.im), 4) + (unit ? ' ' + unit : '');
  }

  EC.units = { parseValue, fmt, fmtC, fmtDeg, fmtRect, num };
})();
