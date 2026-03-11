# Nhà Cung Cấp (NCC) — Vai trò & Quan hệ trong MedLogixManage

## NCC là ai?

**Nhà Cung Cấp (NCC / Supplier)** là các đơn vị bên ngoài cung cấp thiết bị y tế & dược phẩm cho công ty. NCC **KHÔNG có tài khoản** trong hệ thống — họ được quản lý như **Master Data** bởi Admin.

### 5 NCC hiện tại trong hệ thống:

| NCC | Quốc gia | Loại | Điều khoản TT |
|-----|----------|------|---------------|
| Dräger Vietnam | Germany 🌏 | Nhập khẩu | LC 90 ngày |
| B.Braun Vietnam | Germany 🌏 | Nhập khẩu | TT 60 ngày |
| Medtronic Vietnam | USA 🌏 | Nhập khẩu | LC 60 ngày |
| Việt Nhật Medical | Vietnam 🇻🇳 | Nội địa | COD |
| Dược phẩm TW 3 | Vietnam 🇻🇳 | Nội địa | TT 30 ngày |

---

## Cấu trúc dữ liệu NCC

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  name TEXT,           -- Tên NCC
  tax_code TEXT,       -- Mã số thuế
  address TEXT,        -- Địa chỉ
  phone TEXT,          -- Số điện thoại
  email TEXT,          -- Email
  contact_person TEXT, -- Người liên hệ
  country TEXT,        -- Quốc gia
  is_domestic BOOLEAN, -- true = Nội địa, false = Nhập khẩu
  payment_terms TEXT,  -- Điều khoản thanh toán
  is_active BOOLEAN    -- Đang hoạt động
);
```

---

## Quan hệ dữ liệu — NCC liên kết với các bảng

```mermaid
erDiagram
    SUPPLIERS ||--o{ PURCHASE_FORECAST_ITEMS : "nhóm mua theo NCC"
    SUPPLIERS ||--o{ PURCHASE_ORDERS : "1 NCC → nhiều PO"
    SUPPLIERS ||--o{ PRICE_LIST : "1 NCC → nhiều giá SP"
    PRODUCTS ||--o{ PRICE_LIST : "1 SP → nhiều giá NCC"
    PURCHASE_ORDERS ||--o{ PO_ITEMS : "1 PO → nhiều dòng SP"
    PURCHASE_ORDERS ||--o{ PO_DOCUMENTS : "chứng từ đối chiếu"
    PURCHASE_ORDERS ||--o{ IMPORT_SHIPMENTS : "lô nhập khẩu"
    IMPORT_SHIPMENTS ||--o{ WAREHOUSE_RECEIPTS : "nhập kho"

    SUPPLIERS {
        uuid id PK
        text name
        text tax_code
        boolean is_domestic
        text country
        text payment_terms
        text contact_person
    }

    PRICE_LIST {
        uuid id PK
        uuid product_id FK
        uuid supplier_id FK
        numeric unit_price
        numeric price_ceiling
        numeric price_floor
        date valid_from
        date valid_to
    }

    PURCHASE_FORECAST_ITEMS {
        uuid id PK
        uuid supplier_id FK
        integer approved_qty
        text priority
    }

    PURCHASE_ORDERS {
        uuid id PK
        uuid supplier_id FK
        boolean is_domestic
        text status
        numeric grand_total
        date expected_delivery
    }
```

---

## NCC xuất hiện ở đâu trong quy trình?

```mermaid
flowchart TD
    subgraph "M1: Dự trù Sales"
        A1["Sales tạo phiếu dự trù"]
        A2["QL Sales duyệt"]
    end

    subgraph "M2: Dự trù Tổng hợp"
        B1["Tổng hợp SP theo Code"]
        B2["Nhóm theo NCC"]
        B3["QL Logistics duyệt"]
        style B2 fill:#FDCB6E,color:#333,stroke:#333,stroke-width:2px
    end

    subgraph "M3: Đặt hàng PO"
        C1["Tạo PO cho NCC"]
        C2["Tra cứu Price List NCC"]
        C3["Giám đốc duyệt PO"]
        C4["Gửi PO cho NCC"]
        C5["NCC xác nhận"]
        C6["Theo dõi tiến độ NCC"]
        style C1 fill:#6C5CE7,color:#fff,stroke:#333,stroke-width:2px
        style C2 fill:#6C5CE7,color:#fff,stroke:#333,stroke-width:2px
        style C4 fill:#E17055,color:#fff,stroke:#333,stroke-width:2px
        style C5 fill:#E17055,color:#fff,stroke:#333,stroke-width:2px
        style C6 fill:#E17055,color:#fff,stroke:#333,stroke-width:2px
    end

    subgraph "M4: Nhập khẩu (chỉ NCC nước ngoài)"
        D1["NCC giao hàng → Cảng"]
        D2["Kiểm tra chứng từ NCC"]
        D3["Đối chiếu Invoice/PL/BL từ NCC vs PO"]
        D4["Thông quan"]
        style D1 fill:#D63031,color:#fff,stroke:#333,stroke-width:2px
        style D2 fill:#D63031,color:#fff,stroke:#333,stroke-width:2px
        style D3 fill:#D63031,color:#fff,stroke:#333,stroke-width:2px
    end

    subgraph "M5: Nhập kho"
        E1["Nhận hàng từ NCC/cảng"]
        E2["Kiểm đếm đối chiếu vs PO"]
        E3["Nhập kho + cập nhật tồn"]
        style E1 fill:#00B894,color:#fff,stroke:#333,stroke-width:2px
    end

    subgraph "Master Data"
        MD1["Price List SP × NCC"]
        MD2["CRUD thông tin NCC"]
        style MD1 fill:#0984E3,color:#fff,stroke:#333,stroke-width:2px
        style MD2 fill:#0984E3,color:#fff,stroke:#333,stroke-width:2px
    end

    A1 --> A2 --> B1 --> B2 --> B3
    B3 --> C1 --> C2 --> C3 --> C4 --> C5 --> C6
    C6 -->|NCC nước ngoài| D1 --> D2 --> D3 --> D4
    C6 -->|NCC nội địa| E1
    D4 --> E1 --> E2 --> E3

    MD1 -.->|tra cứu giá| C2
    MD2 -.->|dropdown NCC| B2
    MD2 -.->|dropdown NCC| C1
```

> [!TIP]
> Các ô có **viền đậm & màu nổi** là nơi NCC trực tiếp liên quan.

---

## Phân luồng: NCC Nội địa vs NCC Nước ngoài

```mermaid
flowchart TD
    PO["PO Đã duyệt"] --> CHECK{"is_domestic?"}
    
    CHECK -->|"🇻🇳 true (VN)"| DOM["NCC nội địa giao thẳng đến kho"]
    DOM --> M5["Module 5: Nhập kho"]
    
    CHECK -->|"🌏 false (ngoại)"| IMP["NCC nước ngoài giao qua cảng"]
    IMP --> M4["Module 4: Nhập khẩu + Hải quan"]
    M4 --> M5
    
    style DOM fill:#00B894,color:#fff
    style IMP fill:#FDCB6E,color:#333
```

---

## Chi tiết vai trò NCC theo Module

### Module 2: NCC là tiêu chí nhóm đơn hàng

- QL Logistics **chọn NCC** cho mỗi dòng SP trong dự trù
- Hệ thống gom các dòng **cùng NCC** để tạo 1 PO chung → giảm phí vận chuyển

### Module 3: NCC là đối tác nhận PO

| Bước | Ai thực hiện | NCC liên quan |
|------|-------------|---------------|
| Tạo PO | QL Logistics | Chọn NCC, xem giá NCC |
| Tra giá | Hệ thống auto | Price List theo NCC × SP |
| Duyệt PO | Giám đốc | Xem thông tin NCC |
| Gửi PO | QL Logistics | Gửi PO cho NCC (ngoài hệ thống) |
| Xác nhận | **NCC** (bên ngoài) | NCC xác nhận qua email/ĐT |
| Giao hàng | **NCC** (bên ngoài) | NCC giao hàng đến cảng/kho |

### Module 4: Chứng từ từ NCC (chỉ NCC nước ngoài)

| Chứng từ | Từ NCC? | Dùng để |
|----------|---------|---------|
| Commercial Invoice | ✅ | Đối chiếu Code, Tên, SL, Giá vs PO |
| Packing List | ✅ | Đối chiếu Code, SL, Lot, HSD vs PO |
| Bill of Lading / AWB | ✅ | Ngày giao + SL vs PO |
| Certificate of Origin | ✅ | Chứng nhận xuất xứ |
| ISO 13485 Certificate | ✅ | Chứng nhận nhà SX |
| Free Sale Certificate | ✅ | Bắt buộc cho TBYT loại C,D |

---

## Tổng kết: NCC chạm vào 5 bảng, 4 modules

| Bảng DB | Trường liên kết | Vai trò |
|---------|----------------|---------|
| `suppliers` | — | Bảng chính, Master Data |
| `purchase_forecast_items` | `supplier_id` | Nhóm dự trù theo NCC |
| `purchase_orders` | `supplier_id` + `is_domestic` | PO gửi cho NCC |
| `price_list` | `supplier_id` | Giá chuẩn theo SP × NCC |
| `import_shipments` | qua `po_id` | Lô hàng NK từ NCC nước ngoài |

| Module | Vai trò NCC |
|--------|------------|
| M2: Dự trù | Tiêu chí nhóm đơn hàng |
| M3: Đặt hàng | Đối tác nhận PO, xác nhận, giao hàng |
| M4: Nhập khẩu | Nguồn cung cấp chứng từ để cross-check |
| M5: Nhập kho | Nguồn gốc hàng hóa nhập kho |

> [!IMPORTANT]
> **NCC là thực thể bên ngoài hệ thống** — không có tài khoản, không login. Mọi tương tác NCC đều qua QL Logistics (gửi PO qua email/ĐT, nhận xác nhận, cập nhật trạng thái thủ công).
