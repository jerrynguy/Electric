/* Các mạch ví dụ – dựng lại đề thi (Hình 1 → Hình 7) */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});

  function mk(fn) {
    let n = 1;
    const m = { comps: [], wires: [] };
    const c = (type, name, x, y, rot, params, flip) => {
      m.comps.push({ id: 'c' + n++, type, name, x, y, rot: rot || 0, flip: !!flip, params: Object.assign(EC.defaultParams(type), params || {}) });
    };
    const w = (...p) => { for (let i = 0; i + 3 < p.length; i += 2) m.wires.push({ id: 'w' + n++, x1: p[i], y1: p[i + 1], x2: p[i + 2], y2: p[i + 3] }); };
    fn(c, w);
    return m;
  }

  const EXAMPLES = [
    {
      id: 'h1', title: 'Câu 1 – Hình 1: tìm R3 để V(A) = 8,5 V',
      note: 'V1=12V, V2=5V, R1=10Ω, R2=5Ω. Mở tab "Công cụ" → "Tìm giá trị" (đã điền sẵn) để tìm R3. Đáp án: R3 = 10 Ω.',
      goal: { comp: 'R3', param: 'R', spec: { node: 'A', mode: 'dc' }, target: 8.5 },
      build: () => mk((c, w) => {
        c('V', 'V1', 0, 3, 1, { V: '12' });
        c('R', 'R3', 5, 2, 1, { R: '20' });
        c('R', 'R1', 10, 2, 1, { R: '10' });
        c('V', 'V2', 10, 6, 1, { V: '5' });
        c('R', 'R2', 10, 10, 1, { R: '5' });
        c('LABEL', 'A', 14, 4); c('LABEL', 'B', 14, 8);
        c('GND', 'GND1', 10, 12);
        w(0, 1, 0, 0, 10, 0); w(5, 4, 14, 4); w(10, 8, 14, 8); w(0, 5, 0, 12, 10, 12);
      }),
    },
    {
      id: 'h2', title: 'Câu 2 – Hình 2: công suất trên R4',
      note: 'V3=24V, V4=12V, R4=10Ω, R5=5Ω, R6=5Ω, R7=10Ω, R8=10Ω. Bấm vào R4 để xem P. Đáp án: P(R4) ≈ 27,2 W.',
      build: () => mk((c, w) => {
        c('V', 'V3', 0, 3, 1, { V: '24' });
        c('R', 'R4', 3, 0, 0, { R: '10' });
        c('R', 'R5', 6, 3, 1, { R: '5' });
        c('R', 'R6', 9, 0, 0, { R: '5' });
        c('R', 'R7', 12, 3, 1, { R: '10' });
        c('R', 'R8', 15, 0, 0, { R: '10' });
        c('V', 'V4', 18, 3, 1, { V: '12' });
        c('GND', 'GND1', 9, 6);
        w(0, 1, 0, 0, 1, 0); w(5, 0, 7, 0); w(11, 0, 13, 0); w(17, 0, 18, 0, 18, 1); w(6, 0, 6, 1); w(12, 0, 12, 1);
        w(0, 5, 0, 6, 18, 6, 18, 5); w(6, 5, 6, 6); w(12, 5, 12, 6);
      }),
    },
    {
      id: 'h3', title: 'Câu 3 – Hình 3: dòng hiệu dụng qua R9 (AC)',
      note: 'V5 = 185V hiệu dụng, 50Hz; C1=6mF; L1=26,5mH; R9=10Ω; R10=5Ω. Xem kết quả ở chế độ AC 50 Hz. Đáp án: I(R9) ≈ 14,5 A.',
      build: () => mk((c, w) => {
        c('ACV', 'V5', 0, 3, 1, { V: '185', f: '50' });
        c('L', 'L1', 3, 0, 0, { L: '26.5m' });
        c('R', 'R9', 8, 0, 0, { R: '10' });
        c('R', 'R10', 11, 3, 1, { R: '5' });
        c('C', 'C1', 17, 3, 1, { C: '6m' });
        c('GND', 'GND1', 0, 6);
        w(0, 1, 0, 0, 1, 0); w(5, 0, 6, 0); w(10, 0, 17, 0, 17, 1); w(11, 0, 11, 1);
        w(0, 5, 0, 6, 17, 6, 17, 5); w(11, 5, 11, 6);
      }),
    },
    {
      id: 'h4', title: 'Câu 4 – Mạch 3 pha Y-Y: tìm điện trở đường dây',
      note: 'Nguồn 120V∠0°, ∠−120°, ∠−240°; tải 3+j3 Ω mỗi pha; dòng pha B = 22,5 A. Dùng "Tìm giá trị" (đã điền sẵn) cho Rd_B. Đáp án: ≈ 1,41 Ω.',
      goal: { comp: 'RdB', param: 'R', spec: { comp: 'RdB', key: 'I', mode: 50 }, target: 22.5 },
      build: () => mk((c, w) => {
        const rows = [['A', 0, '0'], ['B', 5, '-120'], ['C', 10, '-240']];
        for (const [ph, y, deg] of rows) {
          c('ACV', 'V' + ph, 2, y, 2, { V: '120', f: '50', ph: deg });
          c('R', 'Rd' + ph, 6, y, 0, { R: '1' });
          c('Z', 'Z' + ph, 10, y, 0, { R: '3', X: '3' });
        }
        c('GND', 'GND1', 0, 12);
        w(0, 0, 0, 12, 14, 12, 14, 0); w(12, 0, 14, 0); w(12, 5, 14, 5); w(12, 10, 14, 10);
        c('LABEL', 'N', 14, 12);
      }),
    },
    {
      id: 'h5', title: 'Câu 5 – Hình 4: dòng qua Diode D1',
      note: 'V6=36V, R11=6kΩ, R12=3kΩ, R13=1kΩ, Vf=0,7V. Đáp án: I(D1) ≈ 3,77 mA.',
      build: () => mk((c, w) => {
        c('V', 'V6', 0, 3, 1, { V: '36' });
        c('R', 'R11', 3, 0, 0, { R: '6k' });
        c('R', 'R12', 6, 3, 1, { R: '3k' });
        c('D', 'D1', 9, 0, 0, { Vf: '0.7' });
        c('R', 'R13', 13, 3, 1, { R: '1k' });
        c('GND', 'GND1', 0, 6);
        w(0, 1, 0, 0, 1, 0); w(5, 0, 7, 0); w(6, 0, 6, 1); w(11, 0, 13, 0, 13, 1);
        w(0, 5, 0, 6, 13, 6, 13, 5); w(6, 5, 6, 6);
      }),
    },
    {
      id: 'h6', title: 'Câu 6 – Hình 5: dòng qua Zener D2',
      note: 'Vz=24V, V7=32V, R14=250Ω, R15=1,2kΩ. Đáp án: I(Zener) ≈ 12 mA.',
      build: () => mk((c, w) => {
        c('V', 'V7', 0, 3, 1, { V: '32' });
        c('R', 'R14', 3, 0, 0, { R: '250' });
        c('ZD', 'D2', 6, 3, 3, { Vz: '24' });
        c('R', 'R15', 12, 3, 1, { R: '1.2k' });
        c('GND', 'GND1', 0, 6);
        w(0, 1, 0, 0, 1, 0); w(5, 0, 12, 0, 12, 1); w(6, 0, 6, 1);
        w(0, 5, 0, 6, 12, 6, 12, 5); w(6, 5, 6, 6);
      }),
    },
    {
      id: 'h7', title: 'Câu 7 & 8 – Hình 6: transistor bão hòa',
      note: 'VCC=14V, VBB=7,2V, RB=5,5kΩ, RC=1kΩ, β=220, VBE=1V, VCE(sat)=0,2V. Câu 7: bấm Q1 xem P ≈ 3,9 mW. Câu 8: tab "Công cụ" → "Quét tham số" RB để thấy ngưỡng bão hòa ≈ 98,8 kΩ.',
      sweep: { comp: 'RB', param: 'R', from: 1000, to: 1000000, steps: 60, log: true, spec: { comp: 'Q1', key: 'IC', mode: 'dc' } },
      build: () => mk((c, w) => {
        c('V', 'VBB', 0, 5, 1, { V: '7.2' });
        c('R', 'RB', 2, 3, 0, { R: '5.5k' });
        c('NPN', 'Q1', 6, 3, 0, { beta: '220', Vbe: '1', Vcesat: '0.2' });
        c('R', 'RC', 7, -1, 1, { R: '1k' });
        c('V', 'VCC', 13, 0, 1, { V: '14' });
        c('GND', 'GND1', 7, 7);
        w(7, -3, 13, -3, 13, -2); w(13, 2, 13, 7, 0, 7); w(7, 5, 7, 7);
      }),
    },
    {
      id: 'h8', title: 'Câu 9 & 10 – Hình 7: mạch op-amp',
      note: 'R1=1kΩ, R2=20kΩ, Vi1=4V, Vi2=2V, nguồn ±15V. Lý thuyết: Vout = −(R2/R1)·Vi1 + (1+R2/R1)·Vi2 = −38 V → bị giới hạn (bão hòa) ở −15 V.',
      build: () => mk((c, w) => {
        c('V', 'Vi1', -4, 3, 1, { V: '4' });
        c('R', 'R1', 0, 1, 0, { R: '1k' });
        c('V', 'Vi2', 1, 6, 1, { V: '2' });
        c('OPAMP', 'U1', 6, 2, 0, { Vpos: '15', Vneg: '-15' });
        c('R', 'R2', 6, -3, 0, { R: '20k' });
        c('LABEL', 'Vout', 12, 2);
        c('GND', 'GND1', 1, 9);
        w(-4, 1, -2, 1); w(1, 4, 1, 3, 3, 3); w(2, 1, 3, 1); w(3, 1, 3, -3, 4, -3); w(8, -3, 10, -3, 10, 2); w(9, 2, 12, 2);
        w(-4, 5, -4, 9, 1, 9); w(1, 8, 1, 9);
      }),
    },
  ];

  EC.EXAMPLES = EXAMPLES;
})();
