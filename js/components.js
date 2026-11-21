/* Định nghĩa linh kiện: chân, tham số, hình vẽ (toạ độ cục bộ, đơn vị px, lưới 20px) */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});
  const G = 20;
  const P2 = [[-2, 0], [2, 0]];
  const lead = (a, b) => `M-40 0H${a} M${b} 0H40`;

  const COMP = {
    R: {
      label: 'Điện trở', prefix: 'R', group: 'Cơ bản', pins: P2, pinNames: ['1', '2'], box: [-2, -0.6, 2, 0.6],
      params: [{ k: 'R', label: 'Điện trở R', unit: 'Ω', def: '1k' }],
      draw: () => `<path d="M-40 0H-24 l4 -8 l8 16 l8 -16 l8 16 l8 -16 l8 16 l4 -8 H40"/>`,
      value: (p, f) => f(p.R, 'Ω'),
    },
    C: {
      label: 'Tụ điện', prefix: 'C', group: 'Cơ bản', pins: P2, pinNames: ['1', '2'], box: [-2, -0.8, 2, 0.8],
      params: [{ k: 'C', label: 'Điện dung C', unit: 'F', def: '1u' }],
      draw: () => `<path d="${lead(-5, 5)} M-5 -14V14 M5 -14V14"/>`,
      value: (p, f) => f(p.C, 'F'),
    },
    L: {
      label: 'Cuộn cảm', prefix: 'L', group: 'Cơ bản', pins: P2, pinNames: ['1', '2'], box: [-2, -0.6, 2, 0.4],
      params: [{ k: 'L', label: 'Độ tự cảm L', unit: 'H', def: '10m' }],
      draw: () => `<path d="M-40 0H-24 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 H40"/>`,
      value: (p, f) => f(p.L, 'H'),
    },
    Z: {
      label: 'Trở kháng Z', prefix: 'Z', group: 'Cơ bản', pins: P2, pinNames: ['1', '2'], box: [-2, -0.6, 2, 0.6],
      params: [{ k: 'R', label: 'Phần thực R', unit: 'Ω', def: '3' }, { k: 'X', label: 'Phần ảo X (+ cảm, − dung)', unit: 'Ω', def: '3' }],
      draw: () => `<path d="${lead(-20, 20)}"/><rect x="-20" y="-9" width="40" height="18" rx="2"/><path class="thin" d="M-7 -4h14l-14 8h14"/>`,
      value: (p, f) => EC.units.num(p.R, 4) + (p.X < 0 ? ' − j' : ' + j') + EC.units.num(Math.abs(p.X), 4) + ' Ω',
      hint: 'Trở kháng cố định Z = R + jX (không phụ thuộc tần số). Ở DC chỉ còn R.',
    },
    SW: {
      label: 'Công tắc', prefix: 'S', group: 'Cơ bản', pins: P2, pinNames: ['1', '2'], box: [-2, -0.8, 2, 0.4],
      params: [{ k: 'closed', label: 'Đóng', type: 'bool', def: true }],
      draw: (c) => `<path d="M-40 0H-16 M16 0H40 ${c.params.closed ? 'M-16 0L16 0' : 'M-16 0L13 -13'}"/><circle class="pin-o" cx="-16" cy="0" r="2.5"/><circle class="pin-o" cx="16" cy="0" r="2.5"/>`,
      value: (p) => (p.closed ? 'đóng' : 'mở'),
    },
    V: {
      label: 'Nguồn áp DC', prefix: 'V', group: 'Nguồn', pins: P2, pinNames: ['+', '−'], box: [-2, -0.9, 2, 0.9],
      params: [{ k: 'V', label: 'Điện áp V', unit: 'V', def: '12' }],
      draw: () => `<path d="${lead(-5, 5)} M-5 -16V16"/><path class="thick" d="M5 -8V8"/><path class="thin" d="M-20 -14h8 M-16 -18v8"/>`,
      value: (p, f) => f(p.V, 'V'),
      hint: 'Chân có dấu + (vạch dài) là cực dương.',
    },
    ACV: {
      label: 'Nguồn áp AC', prefix: 'V', group: 'Nguồn', pins: P2, pinNames: ['+', '−'], box: [-2, -0.9, 2, 0.9],
      params: [
        { k: 'V', label: 'Điện áp hiệu dụng (RMS)', unit: 'V', def: '220' },
        { k: 'f', label: 'Tần số f', unit: 'Hz', def: '50' },
        { k: 'ph', label: 'Góc pha', unit: '°', def: '0' },
      ],
      draw: () => `<path d="${lead(-16, 16)}"/><circle cx="0" cy="0" r="16"/><path class="thin" d="M-9 0c3 -11 6 -11 9 0s6 11 9 0 M-30 -12h7 M-26.5 -15.5v7"/>`,
      value: (p, f) => f(p.V, 'V') + (p.ph ? ' ∠' + p.ph + '°' : '') + ', ' + f(p.f, 'Hz'),
      hint: 'Biên độ đỉnh = √2 × giá trị hiệu dụng. Kết quả AC hiển thị dạng hiệu dụng.',
    },
    I: {
      label: 'Nguồn dòng DC', prefix: 'I', group: 'Nguồn', pins: P2, pinNames: ['vào', 'ra'], box: [-2, -0.9, 2, 0.9],
      params: [{ k: 'I', label: 'Dòng điện I', unit: 'A', def: '1m' }],
      draw: () => `<path d="${lead(-16, 16)}"/><circle cx="0" cy="0" r="16"/><path class="thin" d="M-9 0H8 M2 -5L8 0L2 5"/>`,
      value: (p, f) => f(p.I, 'A'),
      hint: 'Dòng chảy theo chiều mũi tên (đi ra ở chân 2).',
    },
    ACI: {
      label: 'Nguồn dòng AC', prefix: 'I', group: 'Nguồn', pins: P2, pinNames: ['vào', 'ra'], box: [-2, -0.9, 2, 0.9],
      params: [
        { k: 'I', label: 'Dòng hiệu dụng (RMS)', unit: 'A', def: '1' },
        { k: 'f', label: 'Tần số f', unit: 'Hz', def: '50' },
        { k: 'ph', label: 'Góc pha', unit: '°', def: '0' },
      ],
      draw: () => `<path d="${lead(-16, 16)}"/><circle cx="0" cy="0" r="16"/><path class="thin" d="M-9 -3c3 -8 6 -8 9 0s6 8 9 0 M-6 8H6 M2 5L6 8L2 11"/>`,
      value: (p, f) => f(p.I, 'A') + ', ' + f(p.f, 'Hz'),
    },
    D: {
      label: 'Diode', prefix: 'D', group: 'Bán dẫn', pins: P2, pinNames: ['A (anode)', 'K (cathode)'], box: [-2, -0.7, 2, 0.7],
      params: [{ k: 'Vf', label: 'Điện áp thuận Vf', unit: 'V', def: '0.7' }],
      draw: () => `<path d="${lead(-8, 8)} M8 -10V10"/><path class="fill" d="M-8 -10L8 0L-8 10Z"/>`,
      value: (p, f) => 'Vf=' + f(p.Vf, 'V'),
      hint: 'Mô hình sụt áp hằng: dẫn thì U = Vf, tắt thì I = 0.',
    },
    ZD: {
      label: 'Diode Zener', prefix: 'DZ', group: 'Bán dẫn', pins: P2, pinNames: ['A (anode)', 'K (cathode)'], box: [-2, -0.7, 2, 0.7],
      params: [{ k: 'Vz', label: 'Điện áp Zener Vz', unit: 'V', def: '5.1' }, { k: 'Vf', label: 'Điện áp thuận Vf', unit: 'V', def: '0.7' }],
      draw: () => `<path d="${lead(-8, 8)} M4 -13L8 -10V10L12 13"/><path class="fill" d="M-8 -10L8 0L-8 10Z"/>`,
      value: (p, f) => 'Vz=' + f(p.Vz, 'V'),
      hint: 'Phân cực ngược (cathode dương hơn) với U ≥ Vz thì Zener ổn áp ở Vz.',
    },
    NPN: {
      label: 'BJT NPN', prefix: 'Q', group: 'Bán dẫn', pins: [[-2, 0], [1, -2], [1, 2]], pinNames: ['B', 'C', 'E'], box: [-2, -2, 1.6, 2],
      params: [
        { k: 'beta', label: 'Hệ số khuếch đại β (hFE)', unit: '', def: '100' },
        { k: 'Vbe', label: 'V_BE', unit: 'V', def: '0.7' },
        { k: 'Vcesat', label: 'V_CE(sat)', unit: 'V', def: '0.2' },
      ],
      draw: () => `<circle cx="4" cy="0" r="25"/><path d="M-40 0H-6 M-6 7L20 24V40 M-6 -7L20 -24V-40"/><path class="thick" d="M-6 -16V16"/><path class="fill" d="M14.8 20.6L5.9 19.6L10.3 12.9Z"/>`,
      value: (p) => 'β=' + p.beta,
    },
    PNP: {
      label: 'BJT PNP', prefix: 'Q', group: 'Bán dẫn', pins: [[-2, 0], [1, -2], [1, 2]], pinNames: ['B', 'C', 'E'], box: [-2, -2, 1.6, 2],
      params: [
        { k: 'beta', label: 'Hệ số khuếch đại β (hFE)', unit: '', def: '100' },
        { k: 'Vbe', label: '|V_BE|', unit: 'V', def: '0.7' },
        { k: 'Vcesat', label: '|V_CE(sat)|', unit: 'V', def: '0.2' },
      ],
      draw: () => `<circle cx="4" cy="0" r="25"/><path d="M-40 0H-6 M-6 7L20 24V40 M-6 -7L20 -24V-40"/><path class="thick" d="M-6 -16V16"/><path class="fill" d="M1.5 11.9L10.4 12.9L6 19.6Z"/>`,
      value: (p) => 'β=' + p.beta,
      hint: 'PNP: emitter thường nối lên nguồn dương; các dòng hiển thị theo chiều quy ước.',
    },
    OPAMP: {
      label: 'Op-amp', prefix: 'U', group: 'Bán dẫn', labelBelow: true, pins: [[-3, -1], [-3, 1], [3, 0]], pinNames: ['−', '+', 'Out'], box: [-3, -2, 3, 2],
      params: [{ k: 'Vpos', label: 'Mức bão hòa dương (+Vcc)', unit: 'V', def: '15' }, { k: 'Vneg', label: 'Mức bão hòa âm (−Vee)', unit: 'V', def: '-15' }],
      draw: () => `<path d="M-60 -20H-40 M-60 20H-40 M40 0H60"/><path d="M-40 -40L-40 40L40 0Z"/><path class="thin" d="M-34 -20h9 M-34 20h9 M-29.5 15.5v9"/>`,
      value: (p) => '±' + p.Vpos + 'V',
      hint: 'Op-amp lý tưởng: dòng vào = 0, khi tuyến tính V+ = V−. Lật (F) để đổi chỗ chân + / −.',
    },
    GND: {
      label: 'Đất (GND)', prefix: 'GND', group: 'Khác', pins: [[0, 0]], pinNames: ['0'], box: [-0.7, 0, 0.7, 1.2],
      params: [], noLabel: true,
      draw: () => `<path d="M0 0V12 M-12 12H12 M-7 17H7 M-2.5 22H2.5"/>`,
    },
    LABEL: {
      label: 'Nhãn nút', prefix: 'A', group: 'Khác', pins: [[0, 0]], pinNames: ['nút'], box: [-0.5, -0.5, 0.5, 0.5],
      params: [], noLabel: true,
      draw: () => `<circle class="fill" cx="0" cy="0" r="3"/>`,
      hint: 'Đặt tên cho nút (ví dụ A, B, Vout). Các nhãn trùng tên được coi là nối với nhau.',
    },
  };

  function xf(c, lx, ly) {
    let x = lx, y = c.flip ? -ly : ly;
    for (let i = 0; i < ((c.rot || 0) & 3); i++) { const t = x; x = -y; y = t; }
    return { x: c.x + x, y: c.y + y };
  }
  function pinPositions(c) { return COMP[c.type].pins.map(([x, y]) => xf(c, x, y)); }
  function worldBox(c) {
    const b = COMP[c.type].box;
    const ps = [xf(c, b[0], b[1]), xf(c, b[2], b[3])];
    return { x1: Math.min(ps[0].x, ps[1].x), y1: Math.min(ps[0].y, ps[1].y), x2: Math.max(ps[0].x, ps[1].x), y2: Math.max(ps[0].y, ps[1].y) };
  }
  function defaults(type) {
    const p = {};
    COMP[type].params.forEach((d) => (p[d.k] = d.def));
    return p;
  }

  EC.G = G;
  EC.COMP = COMP;
  EC.xf = xf;
  EC.pinPositions = pinPositions;
  EC.worldBox = worldBox;
  EC.defaultParams = defaults;
})();
