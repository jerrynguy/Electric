/* Nội dung hướng dẫn & bảng công thức */
(function () {
  'use strict';
  const EC = (globalThis.EC = globalThis.EC || {});
  EC.HELP_HTML = `
<h2>Hướng dẫn nhanh</h2>
<ol>
  <li><b>Đặt linh kiện:</b> bấm vào linh kiện ở cột trái rồi bấm lên lưới. Phím <code>R</code> xoay, <code>F</code> lật, <code>Esc</code> để thôi.</li>
  <li><b>Nối dây:</b> chọn <b>Dây</b> (phím <code>W</code>), bấm điểm đầu rồi bấm điểm cuối. Dây tự đi theo hình chữ L. Bấm trúng chân linh kiện hoặc dây khác thì nét vẽ kết thúc, còn nếu không thì vẽ tiếp đoạn sau. Bấm chuột phải hoặc <code>Esc</code> để dừng.</li>
  <li>Đầu dây hoặc chân linh kiện chạm vào <b>giữa</b> một dây khác thì được nối (có chấm tròn). Hai dây chỉ cắt chéo nhau thì <b>không</b> nối.</li>
  <li>Luôn đặt một <b>GND</b> làm mốc 0 V. Dùng <b>Nhãn nút</b> để đặt tên điểm (A, B, Vout…). Hai nhãn trùng tên được coi là nối với nhau.</li>
  <li>Mạch được giải <b>tự động</b> mỗi khi bạn sửa. Bấm vào linh kiện để xem U, I, P và cách tính. Rê chuột lên dây để xem điện thế nút.</li>
  <li>Giá trị nhập được tiền tố: <code>5.5k</code> = 5500, <code>26,5m</code> = 0,0265, <code>6m</code>, <code>10u</code> (micro), <code>2M</code> (mega), <code>100n</code>, <code>22p</code>.</li>
  <li>Tab <b>Công cụ</b>: <b>Tìm giá trị</b> (ví dụ tìm R3 để V(A) = 8,5 V) và <b>Quét tham số</b> (xem một đại lượng thay đổi theo tham số, tự tìm ngưỡng đổi trạng thái của BJT/diode/op-amp).</li>
</ol>
<h3>Quy ước dấu</h3>
<ul>
  <li><b>U</b> của linh kiện 2 chân = V(chân 1) − V(chân 2). <b>I</b> là dòng chảy từ chân 1 qua linh kiện sang chân 2.</li>
  <li><b>P &gt; 0</b>: linh kiện tiêu thụ. <b>P &lt; 0</b>: linh kiện phát công suất (thường là nguồn).</li>
  <li>Ở chế độ AC, mọi giá trị là <b>phasor hiệu dụng</b> (RMS), dạng độ lớn ∠ góc pha.</li>
</ul>

<h2>Bảng công thức</h2>
<h3>Mạch một chiều (DC)</h3>
<ul>
  <li>Định luật Ôm: <span class="f">U = I·R</span>. Công suất: <span class="f">P = U·I = I²R = U²/R</span></li>
  <li>Nối tiếp: <span class="f">R = R1 + R2 + …</span>. Song song: <span class="f">1/R = 1/R1 + 1/R2 + …</span>, hai điện trở thì <span class="f">R1·R2/(R1+R2)</span></li>
  <li>Phân áp: <span class="f">U2 = U·R2/(R1+R2)</span>. Phân dòng: <span class="f">I1 = I·R2/(R1+R2)</span></li>
  <li>Kirchhoff 1 (KCL): tổng dòng vào một nút = tổng dòng ra. Kirchhoff 2 (KVL): tổng điện áp quanh một vòng kín = 0</li>
  <li>Thevenin: thay phần mạch bằng <span class="f">Vth</span> (điện áp hở mạch) nối tiếp <span class="f">Rth</span> (điện trở nhìn vào khi tắt nguồn)</li>
  <li>Ở DC: tụ điện = hở mạch, cuộn cảm = ngắn mạch</li>
</ul>
<h3>Mạch xoay chiều (AC)</h3>
<ul>
  <li><span class="f">ω = 2πf</span>. <span class="f">X_L = ωL</span>, <span class="f">Z_L = jX_L</span>. <span class="f">X_C = 1/(ωC)</span>, <span class="f">Z_C = −jX_C</span></li>
  <li>Trở kháng nối tiếp và song song tính giống điện trở, nhưng bằng số phức. <span class="f">|Z| = √(R² + X²)</span>, <span class="f">φ = arctan(X/R)</span></li>
  <li>Giá trị hiệu dụng: <span class="f">U_hd = U_max/√2</span>. Định luật Ôm phức: <span class="f">I = U/Z</span></li>
  <li><span class="f">P = U·I·cosφ = I²R</span> (W). <span class="f">Q = U·I·sinφ</span> (var). <span class="f">S = U·I</span> (VA)</li>
</ul>
<h3>Ba pha (đấu Y cân bằng)</h3>
<ul>
  <li><span class="f">U_dây = √3·U_pha</span>, <span class="f">I_dây = I_pha</span>. Đấu Δ: <span class="f">I_dây = √3·I_pha</span></li>
  <li>Hệ cân bằng thì tính trên <b>một pha</b>: <span class="f">I = U_pha/|Z_dây + Z_tải|</span>. Dòng dây trung tính = 0</li>
  <li><span class="f">P = 3·U_pha·I·cosφ = √3·U_dây·I·cosφ</span></li>
</ul>
<h3>Diode</h3>
<ul>
  <li>Mô hình sụt áp hằng: dẫn thì <span class="f">U_D = Vf</span> (Si ≈ 0,7 V), tắt thì <span class="f">I = 0</span></li>
  <li>Cách giải: giả sử một trạng thái, tính mạch, rồi kiểm tra (dẫn thì phải có I &gt; 0, tắt thì phải có U &lt; Vf)</li>
  <li>Zener phân cực ngược ổn áp ở <span class="f">Vz</span> khi điện áp đặt vào ≥ Vz: <span class="f">I_Z = I_R(nối tiếp) − I_tải</span></li>
</ul>
<h3>Transistor BJT</h3>
<ul>
  <li><span class="f">I_E = I_B + I_C</span>. Vùng khuếch đại: <span class="f">I_C = β·I_B</span>, <span class="f">V_BE ≈ 0,7 V</span></li>
  <li>Mạch như Hình 6: <span class="f">I_B = (V_BB − V_BE)/R_B</span>, <span class="f">I_C(sat) = (V_CC − V_CE(sat))/R_C</span></li>
  <li>Bão hòa khi <span class="f">β·I_B ≥ I_C(sat)</span>, suy ra <span class="f">R_B ≤ β·(V_BB − V_BE)/I_C(sat)</span></li>
  <li>Công suất tiêu tán: <span class="f">P = V_CE·I_C + V_BE·I_B</span></li>
</ul>
<h3>Op-amp lý tưởng</h3>
<ul>
  <li>Dòng vào hai chân = 0. Khi có hồi tiếp âm và chưa bão hòa: <span class="f">V+ = V−</span> (ngắn mạch ảo)</li>
  <li>Đảo: <span class="f">Vout = −(R2/R1)·Vin</span>. Không đảo: <span class="f">Vout = (1 + R2/R1)·Vin</span></li>
  <li>Mạch trừ như Hình 7: <span class="f">Vout = −(R2/R1)·Vi1 + (1 + R2/R1)·Vi2</span></li>
  <li>Vout bị giới hạn trong khoảng nguồn nuôi (±Vcc), vượt quá thì bão hòa</li>
</ul>
<h3>Cách app giải mạch</h3>
<p>App dùng <b>phương pháp điện thế nút cải tiến (MNA)</b>, giống SPICE: viết phương trình KCL cho từng nút, thêm một phương trình cho mỗi nguồn áp, rồi giải hệ phương trình tuyến tính (số phức nếu là AC). Diode, BJT và op-amp được giải bằng cách thử lần lượt các trạng thái cho tới khi mọi điều kiện kiểm tra đều thoả, giống cách làm bằng tay trên giấy.</p>
`;
})();
