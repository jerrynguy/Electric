# Mạch Điện Lab

Ứng dụng web để **vẽ mạch điện và tự tính toán** điện áp, dòng điện, công suất. Toàn bộ app chạy trong trình duyệt, không cần cài đặt hay mạng.

## Cách mở

- Mở thẳng file `index.html` bằng trình duyệt (Chrome, Edge, Firefox…), **hoặc**
- Chạy `node build.js` để tạo một file duy nhất `dist/mach-dien-lab.html`, rồi gửi hoặc mở file đó ở bất kỳ đâu.

## Tính năng

- Kéo thả linh kiện lên lưới, nối dây, xoay (R), lật (F), hoàn tác (Ctrl+Z).
- Linh kiện: điện trở, tụ, cuộn cảm, trở kháng Z = R + jX, công tắc, nguồn áp/dòng DC và AC, diode, Zener, BJT NPN/PNP, op-amp, GND, nhãn nút.
- **Tự giải mạch** mỗi lần sửa:
  - DC: tụ hở mạch, cuộn cảm ngắn mạch.
  - AC: phasor hiệu dụng tại tần số nguồn (số phức), có P, Q, S, cosφ.
  - Diode / Zener / BJT / op-amp theo mô hình tuyến tính từng đoạn như trong giáo trình (Vf, Vz, β, V_BE, V_CE(sat), mức bão hòa op-amp). App tự xác định trạng thái: dẫn/tắt, khuếch đại/bão hòa/ngưng dẫn, tuyến tính/bão hòa.
- Bấm vào linh kiện để xem **cách tính từng bước** (Ôm, X_L, X_C, β·I_B so với I_C…).
- **Tìm giá trị (goal seek)**: ví dụ tìm R3 để V(A) = 8,5 V.
- **Quét tham số**: vẽ đồ thị một đại lượng theo tham số và tự tìm ngưỡng đổi trạng thái (ví dụ miền R_B để BJT bão hòa).
- 8 mạch ví dụ dựng lại đề thi (Câu 1 → 10), kèm bảng công thức tóm tắt.

## Kiểm tra

```bash
node tests/run-tests.js
```

Bộ test giải lại toàn bộ đề thi và so với đáp án:

| Câu | Kết quả app | Đáp án |
|----|----|----|
| 1 | R3 = 10 Ω | 10 Ω |
| 2 | P(R4) = 27,225 W | 27,2 W |
| 3 | I(R9) = 14,54 A | 14,5 A |
| 4 | R dây = 1,4096 Ω | 1,4 Ω |
| 5 | I(D1) = 3,767 mA | 3,8 mA |
| 6 | I(Zener) = 12 mA | 12 mA |
| 7 | P(Q1) = 3,887 mW | 3,9 mW |
| 8 | R_B < 98,84 kΩ | < 98,8 kΩ |
| 9 | Vout = −20·Vi1 + 21·Vi2 | như trên |
| 10 | Vout = −15 V (bão hòa) | −15 V |

## Cấu trúc mã

- `js/solver.js`: bộ giải MNA (số phức) và mô hình linh kiện phi tuyến.
- `js/netlist.js`: chuyển bản vẽ (dây + chân linh kiện) thành các nút điện.
- `js/components.js`: định nghĩa linh kiện (chân, tham số, hình vẽ).
- `js/tools.js`: tìm giá trị và quét tham số.
- `js/app.js`: giao diện vẽ mạch.
- `js/examples.js`, `js/help.js`: mạch ví dụ và hướng dẫn.
