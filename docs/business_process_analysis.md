# Phân tích Quy trình Nghiệp vụ - MedLogixManage

## Tổng quan Hệ thống

Hệ thống MedLogixManage quản lý **chuỗi cung ứng thiết bị y tế & dược phẩm** từ khâu dự trù nhu cầu đến giao hàng cho cơ sở y tế, tuân thủ các tiêu chuẩn:

| Tiêu chuẩn | Mô tả | Áp dụng |
|---|---|---|
| **GSP** | Thực hành tốt bảo quản thuốc (TT 36/2018/TT-BYT) | Nhập kho, Bảo quản |
| **GDP** | Thực hành tốt phân phối thuốc (TT 03/2018/TT-BYT) | Vận chuyển, Giao hàng |
| **NĐ 98/2021** | Quản lý trang thiết bị y tế | Nhập khẩu, Phân loại |
| **ISO 13485** | Quản lý chất lượng thiết bị y tế | Toàn quy trình |
| **FIFO/FEFO** | Nhập trước xuất trước / Hết hạn trước xuất trước | Quản lý kho |

### Luồng quy trình tổng thể (End-to-End)

```mermaid
flowchart LR
    A["1. Dự trù từ Sales"] --> B["2. Dự trù"]
    B --> C["3. Đặt hàng"]
    C --> D["4. Nhập khẩu"]
    D --> E["5. Nhập kho"]
    E --> F["6. Vận chuyển & Giao hàng"]

    style A fill:#6C5CE7,color:#fff
    style B fill:#0984E3,color:#fff
    style C fill:#00B894,color:#fff
    style D fill:#FDCB6E,color:#333
    style E fill:#E17055,color:#fff
    style F fill:#D63031,color:#fff
```

---

## Module 1: Dự trù từ Sales (Sales Forecast Request)

### 1.1 Nhận định vấn đề

| Vấn đề | Mô tả | Hệ quả |
|---|---|---|
| **Nhu cầu phân tán** | Mỗi Sales gửi yêu cầu riêng lẻ cho từng bệnh viện | Khó tổng hợp, trùng lặp |
| **Thiếu thông tin chuẩn** | Sales có thể ghi sai Code hàng, bỏ qua hãng SX | Mua nhầm sản phẩm |
| **Không kiểm soát deadline** | Không rõ ngày cần hàng → không ưu tiên mua hàng đúng | Giao hàng trễ |
| **Phân bổ Sales chồng chéo** | Nhiều Sales cùng yêu cầu cho 1 bệnh viện | Đặt hàng thừa |

### 1.2 Quy trình nghiệp vụ

```mermaid
flowchart TD
    S1["Sales tạo Phiếu dự trù"] --> S2{"Kiểm tra\nCode hàng hợp lệ?"}
    S2 -- Có --> S3["Chọn Bệnh viện từ danh mục"]
    S2 -- Không --> S1
    S3 --> S4["Nhập số lượng + ngày cần"]
    S4 --> S5["Gửi phiếu → Trạng thái: CHỜ DUYỆT"]
    S5 --> S6{"Quản lý Sales\nduyệt?"}
    S6 -- Từ chối --> S7["Trả về Sales kèm lý do"]
    S7 --> S1
    S6 -- Duyệt --> S8["Trạng thái: ĐÃ DUYỆT"]
    S8 --> S9["Tự động chuyển → Module 2: Dự trù"]
```

### 1.3 Cấu trúc dữ liệu (từ Excel + bổ sung)

| Trường | Nguồn | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|---|
| Mã phiếu dự trù | Hệ thống | Auto ID | ✅ | VD: `DT-SALES-2026-0001` |
| Tên bảng dự trù | Excel R1 | Text | ✅ | "Tên SP cần dự trù - ngày yêu cầu" |
| STT | Excel C1 | Number | ✅ | Tự tăng |
| Code hàng | Excel C2 | Text | ✅ | Mã sản phẩm nội bộ |
| Tên hàng | Excel C3 | Text | ✅ | Tra cứu từ danh mục SP |
| Hãng sản xuất | Excel C4 | Text | ✅ | **Tự điền** khi chọn Code hàng |
| Quy cách đóng gói | Excel C5 | Text | ✅ | **Tự điền** khi chọn Code hàng |
| Đơn vị tính | Excel C6 | Text | ✅ | **Tự điền** khi chọn Code hàng |
| Số lượng | Excel C7 | Number | ✅ | Sales nhập tay |
| Bệnh viện/Cơ sở y tế | Excel C8-C11 | Dropdown | ✅ | 20 BV từ validation Excel |
| Nhân viên Sales | Excel C8-C11 | Dropdown | ✅ | A.Thái, A.Phương, A.Hoàng, A.Cao |
| **Lịch sử tiêu thụ** | Hệ thống | Table (readonly) | ✅ | Hiển thị SL tiêu thụ thực tế của Code hàng này tại BV được chọn, theo từng tháng/quý (lấy từ lịch sử giao hàng Module 6). Dùng làm căn cứ tham khảo khi duyệt phiếu |
| Ngày yêu cầu | Bổ sung | Date | ✅ | |
| Ngày cần hàng | Bổ sung | Date | ✅ | Deadline giao cho BV |
| Trạng thái | Bổ sung | Enum | ✅ | Mới → Chờ duyệt → Đã duyệt → Đã chuyển |
| Ghi chú | Bổ sung | Text | | |

### 1.4 Danh mục Bệnh viện (từ Excel Validation)

> [!NOTE]
> 20 cơ sở y tế trích từ dropdown validation trong cell C8R4 của sheet "Dự trù từ Sales":

BV Bắc Quảng Bình, BV C Đà Nẵng, BV CTCH Nghệ An, BV CuBa-Đồng Hới, BV Đà Nẵng, BV E Đà Nẵng, BV Hữu Nghị Nghệ An, BV Sản Nhi Nghệ An, BV Ung Bướu Nghệ An, BVĐK Cửa Đông, BVĐK Minh An, BVĐK Minh Thành, BVĐK Quang Khởi, BVĐK Quảng Trị, BVTW Huế, TTHHTM Nghệ An, TTKSBT Nghệ An, TTYT Anh Sơn, TTYT Nam Đàn, TTYT Qùy Châu

---

## Module 2: Dự trù (Purchase Forecast / Tổng hợp mua hàng)

### 2.1 Nhận định vấn đề

| Vấn đề | Mô tả | Hệ quả |
|---|---|---|
| **Tổng hợp thủ công** | Gộp nhiều phiếu Sales thành 1 kế hoạch mua | Sai sót, mất thời gian |
| **Không đối chiếu tồn kho** | Mua mà không biết tồn kho bao nhiêu | Tồn kho thừa, vốn đọng |
| **Không kiểm tra HSD tồn kho** | Tồn kho có nhưng hạn sử dụng quá sát → không dùng được | Giao hàng gần hết hạn cho BV, vi phạm chất lượng |
| **Không cảnh báo nhiệt độ bảo quản** | Mua hàng yêu cầu bảo quản đặc biệt nhưng không biết trước | Hư hỏng SP do bảo quản sai, tốn chi phí |
| **Không ưu tiên** | Mọi yêu cầu như nhau, không phân loại khẩn cấp | Thiếu SP quan trọng |
| **Thiếu dự báo** | Chỉ mua theo yêu cầu, không dự báo xu hướng | Phản ứng chậm |

### 2.2 Quy trình nghiệp vụ

```mermaid
flowchart TD
    P1["Nhận danh sách dự trù đã duyệt từ Sales"] --> P2["Tự động tổng hợp theo sản phẩm"]
    P2 --> P3["Kiểm tra tồn kho hiện tại"]
    P3 --> P4{"Tồn kho\n≥ Yêu cầu?"}
    P4 -- Có --> P5["Xuất kho trực tiếp → Module 6"]
    P4 -- Không --> P6["Tính SL cần mua"]
    P6 --> P7["Nhóm theo Nhà cung cấp"]
    P7 --> P8["Xác định mức ưu tiên"]
    P8 --> P9{"Trưởng phòng\nmua hàng duyệt?"}
    P9 -- Từ chối --> P10["Điều chỉnh số lượng"]
    P10 --> P6
    P9 -- Duyệt --> P11["Trạng thái: ĐÃ DUYỆT"]
    P11 --> P12["Tự động tạo Đơn đặt hàng → Module 3"]
```

### 2.3 Công thức tính toán

```
Số lượng cần mua = Tổng SL yêu cầu từ Sales - Tồn kho khả dụng - SL đang trên đường về
                 = MAX(0, ΣSL_YêuCầu - SL_TồnKho_KhảDụng - SL_ĐangVề)

# Tồn kho khả dụng: chỉ tính hàng có HSD còn ≥ 8 tháng (hoặc ≥ 12 tháng tùy cấu hình)
Tồn kho khả dụng = Tồn kho có HSD ≥ Ngưỡng_HSD_Tối_Thiểu

Mức tồn kho an toàn = Trung bình tiêu thụ 3 tháng × Hệ số an toàn (1.2~1.5)
```

#### Giải thích "Đề xuất mua thêm"

Đây là trường thông tin **bổ sung** ngoài "SL cần mua", giúp quản lý chủ động dự phòng:

```
Đề xuất mua thêm = MAX(0, Mức tồn kho an toàn - Tồn kho khả dụng - SL đang về)
```

- **Khi nào hiển thị?** Khi tồn kho khả dụng + SL đang về < Mức tồn kho an toàn
- **Ý nghĩa:** Dù đủ hàng cho đơn Sales hiện tại, nhưng nếu không mua thêm thì sẽ rơi dưới mức an toàn, dẫn đến nguy cơ thiếu hàng trong tương lai
- **Quyết định cuối:** Quản lý xem xét và quyết định có mua thêm hay không (trường "SL duyệt mua")

#### Cảnh báo HSD tồn kho

```
⚠️ Cảnh báo HSD sát:  HSD tồn kho - Ngày cần hàng ≤ 8 tháng  → CẢNH BÁO VÀNG
🔴 Cảnh báo HSD nguy hiểm: HSD tồn kho - Ngày cần hàng ≤ 12 tháng → CẢNH BÁO ĐỎ (khuyên mua mới)
```

> [!WARNING]
> Hàng tồn kho có HSD quá sát (dưới 8 hoặc 12 tháng so với ngày cần giao) sẽ **không được tính** vào tồn kho khả dụng → hệ thống tự động đề xuất mua mới.

#### Cảnh báo nhiệt độ bảo quản

```
❄️ Cảnh báo bảo quản đặc biệt: Nếu Code hàng yêu cầu nhiệt độ bảo quản ≠ "Thường"
   → Hiển thị: "SP này yêu cầu bảo quản [Mát 2-8°C / Lạnh -20°C]" (tham chiếu từ Packing List)
   → Kiểm tra kho có đủ capacity bảo quản đặc biệt không
```

### 2.4 Cấu trúc dữ liệu

| Trường | Kiểu | Công thức/Logic |
|---|---|---|
| Mã phiếu dự trù | Auto ID | `DT-2026-0001` |
| Ngày tổng hợp | Date | Ngày tạo phiếu |
| Code hàng | Text | Từ Module 1 |
| Tên hàng | Text | Từ danh mục |
| Hãng SX | Text | Từ danh mục |
| **Lịch sử tiêu thụ theo BV** | Table (readonly) | Hiển thị SL tiêu thụ thực tế của Code hàng tại từng BV theo tháng/quý (từ lịch sử giao hàng Module 6). Căn cứ để quản lý duyệt lần 2 |
| **Yêu cầu bảo quản** | Enum | Thường / Mát (2-8°C) / Lạnh (-20°C). Tham chiếu từ Packing List |
| Tổng SL yêu cầu | Number | `=SUM(SL từ tất cả phiếu Sales đã duyệt)` |
| Tồn kho hiện tại | Number | Từ Module 5 |
| **HSD tồn kho gần nhất** | Date | HSD ngắn nhất của các lô tồn kho. ⚠️ nếu < 8 tháng |
| **Tồn kho khả dụng** | Number | Chỉ tính lô có HSD ≥ 8 tháng |
| SL đang trên đường về | Number | Từ Module 4 (đang vận chuyển) |
| **SL cần mua** | Number | `=MAX(0, Tổng_YC - Tồn_KhảDụng - Đang_Về)` |
| **Đề xuất mua thêm** | Number | `=MAX(0, Mức_An_Toàn - Tồn_KhảDụng - Đang_Về)` |
| **SL duyệt mua** | Number | Quản lý quyết định cuối |
| Nhà cung cấp | Dropdown | Từ danh mục NCC |
| Mức ưu tiên | Enum | Khẩn / Bình thường / Thấp (xem giải thích bên dưới) |
| Trạng thái | Enum | Chờ duyệt → Đã duyệt → Đã tạo PO |

#### 2.5 Giải thích Mức độ ưu tiên

| Mức | Điều kiện | Lý do |
|---|---|---|
| 🔴 **Khẩn** | Ngày cần hàng ≤ 15 ngày tới **HOẶC** hàng đấu thầu có deadline **HOẶC** tồn kho = 0 | Ưu tiên đặt hàng ngay, chọn NCC giao nhanh nhất (kể cả giá cao hơn). BV chờ hàng khẩn cấp (phẫu thuật, cấp cứu) |
| 🟡 **Bình thường** | Ngày cần hàng 15-45 ngày **VÀ** tồn kho khả dụng < Mức an toàn | Quy trình mua hàng tiêu chuẩn, so giá NCC, tối ưu chi phí |
| 🟢 **Thấp** | Ngày cần hàng > 45 ngày **VÀ** tồn kho khả dụng ≥ Mức an toàn | Có thể gộp với đơn khác để tối ưu phí vận chuyển, chờ giá tốt |

---

## Module 3: Đặt hàng (Purchase Order)

### 3.1 Nhận định vấn đề

| Vấn đề | Mô tả | Hệ quả |
|---|---|---|
| **Thiếu kiểm soát giá** | Không so sánh giá giữa các NCC/lần mua, không có bảng giá chuẩn | Chi phí cao, mua giá sai |
| **Không đối chiếu chứng từ** | Không check thông tin PO vs Invoice vs Packing List vs B/L | Sai lệch SL, mã hàng không khớp |
| **Không theo dõi tiến độ** | Đặt rồi không biết NCC giao khi nào | Trễ hàng |
| **Đơn hàng phân tán** | Mỗi SP đặt 1 đơn riêng → phí vận chuyển cao | Lãng phí logistics |
| **Thiếu ràng buộc hợp đồng** | Không rõ điều khoản phạt chậm giao | NCC ít động lực giao đúng |
| **Thiếu quản lý Lot/HSD** | Mỗi code hàng có nhiều lot với HSD khác nhau, nhưng không theo dõi | Nhận hàng gần hết hạn mà không biết |

> [!IMPORTANT]
> **Bảng giá chuẩn (Price List):** Quản lý Logistics import vào hệ thống danh sách giá cho từng mã hàng. Khi tạo PO, hệ thống tự động tra cứu giá từ Price List + so sánh với giá mua lần gần nhất để cảnh báo biến động.

### 3.2 Quy trình nghiệp vụ

```mermaid
flowchart TD
    O1["Nhận dự trù đã duyệt từ Module 2"] --> O2["Gộp theo Nhà cung cấp"]
    O2 --> O3["Tra cứu giá gần nhất / báo giá"]
    O3 --> O4["Tạo Purchase Order"]
    O4 --> O5["Tính chi tiết đơn hàng"]
    O5 --> O6{"Giám đốc\nduyệt?"}
    O6 -- Từ chối --> O7["Điều chỉnh"]
    O7 --> O4
    O6 -- Duyệt --> O8["Gửi PO cho NCC"]
    O8 --> O9["NCC xác nhận ngày giao"]
    O9 --> O10["Theo dõi tiến độ giao hàng"]
    O10 --> O11{"NCC giao\nhàng?"}
    O11 -- Có --> O12["Chuyển → Module 4: Nhập khẩu"]
    O11 -- Chậm --> O13["Cảnh báo & Nhắc NCC"]
    O13 --> O10
```

### 3.3 Công thức tính toán

```
Thành tiền (1 dòng)  = Số lượng × Đơn giá
Tổng tiền hàng       = Σ(Thành tiền)
Thuế VAT             = Tổng tiền hàng × %VAT (thường 8% cho TBYT)
Phí vận chuyển (VND) = Theo thỏa thuận NCC hoặc theo hợp đồng
Tổng giá trị PO      = Tổng tiền hàng + Thuế VAT + Phí vận chuyển

Chênh lệch giá       = Đơn giá lần này - Đơn giá lần mua gần nhất
% Biến động giá       = (Chênh lệch giá / Đơn giá cũ) × 100%
```

### 3.4 Cấu trúc dữ liệu

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Số PO | Auto ID | `PO-2026-0001` |
| Ngày tạo PO | Date | |
| Nhà cung cấp | FK → NCC | Tên, MST, ĐC, SĐT |
| **Ngày giao dự kiến** | Date | Lấy từ B/L (Bill of Lading) hoặc AWB (Airway Bill) **+ 1 ngày**. Tài liệu B/L/AWB được import vào hệ thống sau |
| Ngày giao thực tế | Date | Cập nhật khi nhận hàng |
| **Chi tiết PO** | | |
| → Code hàng | Text | ✅ Check đối chiếu với Invoice & Packing List |
| → Tên hàng | Text | ✅ Check đối chiếu với Invoice & Packing List |
| → ĐVT | Text | ✅ Check đối chiếu với Invoice & Packing List |
| → Số lượng đặt | Number | ✅ Check đối chiếu với Invoice, Packing List & B/L |
| → **Lot No.** | Text | Mỗi code hàng có thể ≥ 2 lot khác nhau |
| → **Expired Date** | Date | Mỗi lot có HSD riêng |
| → Đơn giá | Currency | VND. Đối chiếu với Price List được import bởi QL Logistics |
| → **Giá Price List** | Currency | Giá chuẩn từ bảng giá import. ⚠️ Cảnh báo nếu đơn giá ≠ giá Price List |
| → **Thành tiền** | Currency | `= SL × Đơn giá` |
| Tổng tiền hàng | Currency | `= Σ Thành tiền` |
| VAT | Currency | `= Tổng × %VAT` |
| **Tổng giá trị PO** | Currency | `= Tổng + VAT + Ship` |
| Điều khoản thanh toán | Text | COD, 30 ngày, LC... |
| Trạng thái | Enum | Nháp → Đã gửi → Xác nhận → Đang giao → Đã nhận |

> [!IMPORTANT]
> **Cross-verification bắt buộc:** Khi import Invoice, Packing List, AWB/B/L vào hệ thống, các trường **Code hàng, Tên hàng, ĐVT, Số lượng** phải được hệ thống tự động đối chiếu với PO. Nếu không khớp → hiển cảnh báo và yêu cầu xác nhận thủ công.

---

## Module 4: Nhập khẩu (Import / Customs Clearance)

### 4.1 Nhận định vấn đề

| Vấn đề | Mô tả | Hệ quả |
|---|---|---|
| **Thủ tục phức tạp** | TBYT phân loại A/B/C/D, mỗi loại thủ tục khác | Chậm thông quan |
| **Nhiều chứng từ** | CFS, CO, Invoice, Packing List, Số lưu hành | Thiếu sót → giữ hàng |
| **Chi phí ẩn** | Thuế NK + VAT + phí lưu kho/bãi + demurrage | Vượt ngân sách |
| **Thời gian không xác định** | Không biết khi nào hàng qua cửa khẩu | Không lên kế hoạch được |

### 4.2 Quy trình nghiệp vụ (theo NĐ 98/2021/NĐ-CP)

```mermaid
flowchart TD
    I1["Nhận thông báo giao hàng từ NCC"] --> I2["Kiểm tra hồ sơ nhập khẩu"]
    I2 --> I3{"Phân loại\nTBYT?"}
    I3 -- "Loại A,B" --> I4["Công bố tiêu chuẩn tại Sở Y tế"]
    I3 -- "Loại C,D" --> I5["Số lưu hành từ Bộ Y tế"]
    I4 --> I6["Chuẩn bị chứng từ hải quan"]
    I5 --> I6
    I6 --> I7["Khai báo hải quan điện tử"]
    I7 --> I8["Thanh toán thuế NK + VAT"]
    I8 --> I9{"Kiểm tra\nhải quan?"}
    I9 -- "Luồng xanh" --> I10["Thông quan tự động"]
    I9 -- "Luồng vàng/đỏ" --> I11["Kiểm tra chứng từ/thực tế"]
    I11 --> I10
    I10 --> I12["Vận chuyển từ cảng → Kho"]
    I12 --> I13["Chuyển → Module 5: Nhập kho"]
```

### 4.3 Công thức tính toán

```
Giá CIF            = Giá FOB + Phí vận chuyển quốc tế (Freight) + Bảo hiểm (Insurance)
Thuế nhập khẩu     = Giá CIF × %Thuế NK (tra biểu thuế theo mã HS)
Giá tính thuế VAT  = Giá CIF + Thuế NK
Thuế VAT           = Giá tính thuế VAT × %VAT (5% cho TBYT có giấy phép, 8% khác)
Phí lưu kho/bãi    = Số ngày × Đơn giá lưu kho
Phí hải quan        = Theo biểu phí

Tổng chi phí NK     = Giá CIF + Thuế NK + VAT + Phí lưu kho + Phí hải quan + Phí khác
Giá vốn nhập kho    = Tổng chi phí NK / Tổng số lượng
```

### 4.4 Cấu trúc dữ liệu

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Mã lô nhập | Auto ID | `NK-2026-0001` |
| Liên kết PO | FK → PO | Số PO gốc |
| Số tờ khai hải quan | Text | |
| Ngày khai báo | Date | |
| Cảng đến | Text | Hải Phòng, Đà Nẵng... |
| Mã HS | Text | Mã hàng hóa hải quan |
| Phân loại TBYT | Enum | A / B / C / D |
| Số lưu hành / CBTA | Text | |
| **Checklist chứng từ** | | |
| → ☐ Commercial Invoice | Checkbox + File | ✅ Bắt buộc. Import file → hệ thống cross-check với PO |
| → ☐ Packing List | Checkbox + File | ✅ Bắt buộc. Cross-check: Code, Tên, SL, ĐVT, Lot, HSD |
| → ☐ Bill of Lading / Airway Bill | Checkbox + File | ✅ Bắt buộc. Cross-check: SL, ngày giao |
| → ☐ Certificate of Origin (C/O) | Checkbox + File | Tùy loại hàng |
| → ☐ Free Sale Certificate (CFS) | Checkbox + File | Bắt buộc với TBYT loại C, D |
| → ☐ ISO 13485 Certificate | Checkbox + File | Chứng nhận nhà SX |
| → ☐ Số lưu hành / CBTA | Checkbox + File | Theo phân loại TBYT |
| → ☐ Giấy phép nhập khẩu | Checkbox + File | Nếu cần |
| **Kết quả cross-check** | Auto | ✅ Khớp / ⚠️ Sai lệch (chi tiết trường nào không khớp) |
| **Chi phí** | | |
| → Giá FOB | Currency | USD |
| → Phí Freight | Currency | USD |
| → Phí Insurance | Currency | USD |
| → **Giá CIF** | Currency | `= FOB + Freight + Insurance` |
| → Tỷ giá | Number | VND/USD |
| → Giá CIF (VND) | Currency | `= CIF × Tỷ giá` |
| → Thuế NK | Currency | `= CIF_VND × %Thuế` |
| → VAT | Currency | `= (CIF_VND + Thuế_NK) × %VAT` |
| → Phí khác | Currency | Lưu kho, HC, vận chuyển nội địa |
| → **Tổng chi phí** | Currency | `= Σ tất cả chi phí` |
| Trạng thái | Enum | Đang vận chuyển → Đến cảng → Khai báo HQ → Thông quan → VC nội địa → Hoàn thành |

> [!WARNING]
> **Không cho phép khai báo hải quan** nếu checklist chứng từ chưa đủ (☐ còn trống với các mục bắt buộc). Hệ thống block chuyển trạng thái “Khai báo HQ” cho đến khi tất cả tài liệu bắt buộc đã được import và cross-check đạt.

---

## Module 5: Nhập kho (Warehouse Receipt)

### 5.1 Nhận định vấn đề

| Vấn đề | Mô tả | Hệ quả |
|---|---|---|
| **Không kiểm kê đối chiếu** | Nhận hàng không đếm/kiểm tra chất lượng | Thiếu hụt, hàng lỗi |
| **Thiếu truy xuất lô** | Không ghi Số lô, HSD → không thu hồi được | Vi phạm GSP |
| **Không theo FIFO/FEFO** | Xuất kho ngẫu nhiên → hàng hết hạn trong kho | Thiệt hại, rủi ro pháp lý |
| **Bảo quản không đúng** | TBYT nhạy cảm không đúng nhiệt độ/độ ẩm | Giảm chất lượng SP |
| **Tồn kho không chính xác** | Sổ sách và thực tế chênh lệch | Dự trù sai |

### 5.2 Quy trình nghiệp vụ (theo GSP - TT 36/2018/TT-BYT)

```mermaid
flowchart TD
    W1["Nhận hàng từ Module 4"] --> W2["Kiểm tra chứng từ vs PO"]
    W2 --> W3{"Chứng từ\nkhớp?"}
    W3 -- Không --> W4["Ghi nhận sai lệch, báo cáo"]
    W3 -- Có --> W5["Kiểm đếm số lượng thực tế"]
    W5 --> W6{"SL thực nhận\n= SL trên PO?"}
    W6 -- Không --> W7["Lập biên bản chênh lệch"]
    W6 -- Có --> W8["Kiểm tra chất lượng bên ngoài"]
    W7 --> W8
    W8 --> W9["Ghi nhận: Số lô, HSD, Số đăng ký"]
    W9 --> W10["Phân loại điều kiện bảo quản"]
    W10 --> W11["Xếp kho theo vị trí quy định"]
    W11 --> W12["Cập nhật tồn kho"]
    W12 --> W13["Trạng thái: ĐÃ NHẬP KHO"]
    W13 --> W14["Sẵn sàng xuất → Module 6"]
```

### 5.3 Công thức tính toán

```
SL thực nhận        = Kiểm đếm tay
Chênh lệch          = SL trên PO - SL thực nhận
% Chênh lệch        = (Chênh lệch / SL trên PO) × 100%

Tồn kho sau nhập    = Tồn kho trước + SL thực nhận
Giá vốn bình quân   = (Tồn cũ × Giá cũ + SL mới × Giá mới) / (Tồn cũ + SL mới)

Giá trị tồn kho     = Σ(SL tồn × Giá vốn bình quân)

Cảnh báo hết hạn    = HSD - Ngày hiện tại ≤ 90 ngày → ⚠️
Cảnh báo tồn kho thấp = Tồn kho ≤ Mức tồn kho an toàn → ⚠️
```

### 5.4 Cấu trúc dữ liệu

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Mã phiếu nhập | Auto ID | `PNK-2026-0001` |
| Liên kết NK / PO | FK | Từ Module 4 / Module 3 |
| Ngày nhập kho | Date | |
| Người nhận | Text | Thủ kho |
| **Chi tiết nhập** | | |
| → Code hàng | Text | ✅ Auto cross-check với Invoice & Packing List |
| → Tên hàng | Text | ✅ Auto cross-check với Invoice & Packing List |
| → **Số lô (Lot No.)** | Text | ✅ Bắt buộc theo GSP. Cross-check với Packing List |
| → **Hạn sử dụng (HSD)** | Date | ✅ Bắt buộc. Cross-check với Packing List |
| → Số đăng ký | Text | Số lưu hành BYT |
| → ĐVT | Text | ✅ Cross-check với Invoice & Packing List |
| → SL trên PO | Number | |
| → **SL thực nhận** | Number | Kiểm đếm. ✅ Cross-check với Packing List |
| → Chênh lệch | Number | `= SL_PO - SL_ThựcNhận` |
| → Đơn giá vốn | Currency | Từ Module 4 |
| → **Thành tiền** | Currency | `= SL × Đơn giá vốn` |
| **Kết quả cross-check** | Auto | ✅ Khớp / ⚠️ Sai lệch (liệt kê trường không khớp) |
| Vị trí kho | Text | Kệ, tầng, ô |
| Điều kiện bảo quản | Enum | Thường / Mát (2-8°C) / Lạnh (-20°C) |
| Trạng thái | Enum | Chờ kiểm tra → Đã nhập → Biệt trữ → Xuất kho |

> [!IMPORTANT]
> **Auto cross-verification sau nhập liệu:** Sau khi thủ kho nhập dữ liệu, hệ thống tự động đối chiếu các trường (Code hàng, Tên hàng, SL, ĐVT, Lot, HSD) với thông tin trên Invoice và Packing List đã import ở Module 4. Nếu có sai lệch → hiển cảnh báo chi tiết và yêu cầu xác nhận thủ công trước khi hoàn tất nhập kho.

---

## Module 6: Đơn vị vận chuyển (Shipping / Delivery)

### 6.1 Nhận định vấn đề

| Vấn đề | Mô tả | Hệ quả |
|---|---|---|
| **Giao hàng không đúng hẹn** | Không kiểm soát lịch giao | Mất uy tín, BV phàn nàn |
| **Không tối ưu tuyến** | Mỗi BV giao riêng → chi phí cao | Lãng phí |
| **Không theo dõi thực tế** | Không biết xe đang ở đâu | Khó xử lý sự cố |
| **Thiếu biên bản giao nhận** | Giao xong không có xác nhận | Tranh chấp |
| **Vi phạm GDP** | Vận chuyển TBYT cần bảo quản nhưng xe không đạt chuẩn | Vi phạm pháp luật |

### 6.2 Quy trình nghiệp vụ (theo GDP - TT 03/2018/TT-BYT)

```mermaid
flowchart TD
    D1["Nhận yêu cầu giao hàng từ Module 1 + Module 5"] --> D2["Lập phiếu xuất kho"]
    D2 --> D3["Kiểm tra điều kiện vận chuyển"]
    D3 --> D4{"Cần xe\nchuyên dụng?"}
    D4 -- "Có (hàng mát/lạnh)" --> D5["Bố trí xe lạnh"]
    D4 -- Không --> D6["Bố trí xe thường"]
    D5 --> D7["Tối ưu tuyến giao"]
    D6 --> D7
    D7 --> D8["Xuất kho + Cập nhật tồn"]
    D8 --> D9["Giao hàng cho BV"]
    D9 --> D10{"BV xác nhận\nnhận hàng?"}
    D10 -- "Đủ, đạt" --> D11["Ký biên bản giao nhận"]
    D10 -- "Thiếu/lỗi" --> D12["Lập biên bản sai lệch"]
    D12 --> D13["Xử lý: Giao bổ sung / Đổi trả"]
    D11 --> D14["Trạng thái: HOÀN THÀNH"]
    D14 --> D15["Cập nhật lịch sử giao hàng"]
```

### 6.3 Công thức tính toán

```
SL xuất kho          = Theo phiếu yêu cầu
Tồn kho sau xuất     = Tồn kho trước - SL xuất

Chi phí vận chuyển   = Khoảng cách × Đơn giá/km (hoặc phí cố định theo tuyến)
Thời gian giao hàng  = Ngày giao thực tế - Ngày xuất kho
% Giao đúng hẹn      = (Số đơn đúng hẹn / Tổng đơn) × 100%
```

#### Công thức chấm điểm đơn vị vận chuyển

```
Điểm = (PhảnHồiNhanh + GiaoDungHen + KhongBomHang + GiaoNguyenVen + KhongPhatSinhChi) / 5

Mỗi tiêu chí: Có = 1 điểm, Không = 0 điểm
Điểm trung bình tích lũy = Tổng điểm tất cả đơn / Tổng số đơn

Xếp hạng: ≥ 0.8 = ⭐ Xuất sắc | ≥ 0.6 = 👍 Tốt | ≥ 0.4 = ⚠️ Trung bình | < 0.4 = 🔴 Kém
```

### 6.4 Cấu trúc dữ liệu

| Trường | Kiểu | Ghi chú |
|---|---|---|
| Mã phiếu giao | Auto ID | `PGH-2026-0001` |
| Liên kết dự trù Sales | FK | Từ Module 1 |
| **Điểm giao hàng (xuất phát)** | Text | Địa chỉ kho xuất hàng |
| **Điểm nhận hàng (đích)** | Text | Địa chỉ BV nhận hàng |
| Bệnh viện nhận | FK → BV | Từ danh mục 20 BV |
| Ngày xuất kho | Date | |
| Ngày giao dự kiến | Date | |
| Ngày giao thực tế | Date | |
| **Đơn vị vận chuyển** | | Khi nhập tuyến (điểm giao + điểm nhận) → hệ thống **tự động gợi ý** đơn vị VC có điểm cao nhất trên tuyến này |
| → Tên đơn vị VC | Text | Nội bộ hoặc 3PL |
| → Biển số xe | Text | |
| → Tài xế | Text | |
| → SĐT tài xế | Text | |
| **Chi tiết giao** | | |
| → Code hàng | Text | |
| → Tên hàng | Text | |
| → Số lô | Text | Truy xuất từ Module 5 |
| → HSD | Date | |
| → SL giao | Number | |
| → SL BV xác nhận | Number | |
| Điều kiện vận chuyển | Enum | Thường / Mát / Lạnh |
| Biên bản giao nhận | File | Ảnh/scan |
| **Đánh giá chất lượng VC** | | Nhập sau khi giao hàng xong |
| → Phản hồi nhanh? | Boolean | Có / Không |
| → Giao hàng đúng hẹn? | Boolean | Có / Không |
| → Có bom hàng? | Boolean | Có / Không (Không = tốt) |
| → Giao hàng nguyên vẹn? | Boolean | Có / Không |
| → Phát sinh chi phí? | Boolean | Có / Không (Không = tốt) |
| → **Điểm lần này** | Auto Number | `= (5 tiêu chí) / 5` (0.0 - 1.0) |
| → **Điểm TB tích lũy** | Auto Number | Trung bình tất cả đơn của đơn vị VC này |
| Trạng thái | Enum | Chờ xuất kho → Đang giao → Đã giao → BV xác nhận → Hoàn thành |

---

## Liên kết dữ liệu giữa các Module

### Luồng dữ liệu chính

```mermaid
flowchart LR
    subgraph "Module 1: Dự trù Sales"
        A1["Phiếu dự trù\n(Code, SL, BV, Sales)"]
    end
    
    subgraph "Module 2: Dự trù"
        B1["Bảng tổng hợp\n+ Kiểm tra tồn kho"]
    end
    
    subgraph "Module 3: Đặt hàng"
        C1["Purchase Order\n+ Tính giá"]
    end
    
    subgraph "Module 4: Nhập khẩu"
        D1["Tờ khai HQ\n+ Chi phí CIF"]
    end
    
    subgraph "Module 5: Nhập kho"
        E1["Phiếu nhập kho\n+ Lot/HSD"]
    end
    
    subgraph "Module 6: Vận chuyển"
        F1["Phiếu giao hàng\n→ Bệnh viện"]
    end
    
    A1 -- "Duyệt → Tổng hợp" --> B1
    B1 -- "Duyệt → Tạo PO" --> C1
    C1 -- "NCC giao → Khai HQ" --> D1
    D1 -- "Thông quan → Nhập" --> E1
    E1 -- "Xuất kho → Giao" --> F1
    
    E1 -. "Cập nhật tồn kho" .-> B1
    F1 -. "Hoàn thành đơn" .-> A1
```

### Bảng tham chiếu khóa ngoại

| Từ Module | Sang Module | Khóa liên kết | Mục đích |
|---|---|---|---|
| 1 → 2 | Sales → Dự trù | `Mã phiếu dự trù Sales` | Tổng hợp nhu cầu |
| 2 → 3 | Dự trù → Đặt hàng | `Mã phiếu dự trù` | Tạo PO từ dự trù đã duyệt |
| 3 → 4 | Đặt hàng → Nhập khẩu | `Số PO` | Theo dõi lô hàng theo PO |
| 4 → 5 | Nhập khẩu → Nhập kho | `Mã lô nhập` | Nhập kho hàng đã thông quan |
| 5 → 6 | Nhập kho → Vận chuyển | `Mã phiếu nhập, Lot No.` | Truy xuất lô khi giao |
| 6 → 1 | Vận chuyển → Sales | `Mã phiếu dự trù Sales` | Đóng vòng: đã giao xong |
| 5 ↔ 2 | Nhập kho ↔ Dự trù | `Code hàng` | Kiểm tra tồn kho real-time |

---

## Tổng kết các trạng thái quy trình

```mermaid
stateDiagram-v2
    direction LR
    
    state "Module 1" as M1 {
        [*] --> Mới
        Mới --> Chờ_duyệt
        Chờ_duyệt --> Đã_duyệt
        Chờ_duyệt --> Từ_chối
        Đã_duyệt --> Đã_chuyển_DT
    }
    
    state "Module 2" as M2 {
        [*] --> Tổng_hợp
        Tổng_hợp --> Chờ_duyệt_MH
        Chờ_duyệt_MH --> Duyệt_MH
        Duyệt_MH --> Đã_tạo_PO
    }
    
    state "Module 3" as M3 {
        [*] --> PO_Nháp
        PO_Nháp --> Đã_gửi_NCC
        Đã_gửi_NCC --> NCC_Xác_nhận
        NCC_Xác_nhận --> Đang_giao
        Đang_giao --> Đã_nhận_hàng
    }
```

> [!TIP]
> **Nguyên tắc quản lý kho TBYT cốt lõi:**
> - **FEFO** (First Expired, First Out): Hàng hết hạn trước → xuất trước
> - **Truy xuất lô**: Mỗi SP phải có Số lô + HSD để thu hồi khi cần
> - **Biệt trữ**: Hàng nghi ngờ chất lượng → cách ly, chờ đánh giá
> - **Kiểm soát nhiệt độ**: Ghi nhận nhiệt độ bảo quản và vận chuyển liên tục
