# 🏥 MedLogixManage

> Hệ thống Quản lý Kho vận & Logistics Thiết bị Y tế & Dược phẩm

[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)

---

## Tổng quan

MedLogixManage quản lý **toàn bộ chuỗi cung ứng** thiết bị y tế & dược phẩm — từ dự trù nhu cầu tại bệnh viện đến giao hàng tận nơi, tuân thủ **GSP, GDP, ISO 13485, NĐ 98/2021**.

```
Sales đề xuất → Tổng hợp & Duyệt → Đặt hàng NCC → Nhập khẩu → Nhập kho → Giao hàng BV
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite 6 |
| Routing | React Router DOM 6 |
| UI Icons | Lucide React |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Excel | SheetJS (xlsx) |
| Deploy | Vercel |

## Cài đặt & Chạy

```bash
# Clone
git clone https://github.com/Hieu-vn/MedLogixManage.git
cd MedLogixManage

# Cài dependencies
npm install

# Tạo file .env.local với Supabase credentials
# VITE_SUPABASE_URL=<your-supabase-url>
# VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Chạy dev server
npm run dev
```

Truy cập: `http://localhost:5173`

## Cấu trúc dự án

```
MedLogixManage/
├── docs/                          # 📄 Tài liệu dự án
│   ├── business_process_analysis.md   # Phân tích quy trình nghiệp vụ (6 module)
│   ├── system_requirements.md         # Yêu cầu hệ thống (FR + NFR)
│   ├── ncc_supplier_analysis.md       # Phân tích vai trò NCC
│   └── architecture.md               # Kiến trúc hệ thống
├── src/
│   ├── components/                # 16 components tái sử dụng
│   │   ├── Layout.jsx                 # Sidebar + Theme
│   │   ├── DataTable.jsx              # Bảng tìm kiếm, sắp xếp, phân trang
│   │   ├── Modal.jsx                  # Dialog popup
│   │   ├── NotificationBell.jsx       # Cảnh báo real-time
│   │   ├── POTimeline.jsx             # Timeline PO 9 bước
│   │   ├── CrossVerificationPanel.jsx # Đối chiếu PO vs chứng từ
│   │   ├── ConsumptionHistoryPanel.jsx# Lịch sử tiêu thụ 12 tháng
│   │   ├── RoleGuard.jsx             # Phân quyền theo vai trò
│   │   ├── FilterBar.jsx             # Bộ lọc nâng cao
│   │   ├── StatCard.jsx              # Thẻ KPI
│   │   ├── Toast.jsx                 # Thông báo hành động
│   │   ├── ConfirmDialog.jsx         # Xác nhận hành động
│   │   ├── Badges.jsx                # Badge trạng thái
│   │   ├── SkeletonLoader.jsx        # Loading placeholder
│   │   ├── PageHeader.jsx            # Tiêu đề trang
│   │   └── EmptyState.jsx            # Trạng thái rỗng
│   ├── pages/                     # 10 trang chính
│   │   ├── LoginPage.jsx             # Đăng nhập (6 vai trò)
│   │   ├── DashboardPage.jsx         # Tổng quan KPI
│   │   ├── SalesForecastPage.jsx     # Module 1: Dự trù Sales
│   │   ├── PurchaseForecastPage.jsx  # Module 2: Dự trù tổng hợp
│   │   ├── PurchaseOrderPage.jsx     # Module 3: Đặt hàng PO
│   │   ├── ImportShipmentPage.jsx    # Module 4: Nhập khẩu
│   │   ├── WarehouseReceiptPage.jsx  # Module 5: Nhập kho
│   │   ├── MasterDataPage.jsx        # Master Data (5 tab)
│   │   ├── AuditTrailPage.jsx        # Nhật ký hệ thống
│   │   └── ProfilePage.jsx           # Trang cá nhân
│   ├── lib/
│   │   ├── auth.jsx                  # Auth context (Supabase Auth)
│   │   ├── supabase.js               # Supabase client
│   │   └── helpers.js                # Utilities (format, tính toán)
│   ├── styles/
│   │   ├── index.css                 # Design system & theme
│   │   └── layout.css                # Layout styles
│   ├── App.jsx                    # Routes + Protected Routes
│   └── main.jsx                   # Entry point
├── supabase/migrations/           # Database schema
│   ├── 001_initial_schema.sql        # Core tables + RLS Phase 1
│   ├── 002_seed_data.sql             # Dữ liệu mẫu
│   ├── 003_demo_users.sql            # User demo
│   ├── 003_phase2_schema.sql         # PO + Import + Warehouse + Cross-verify
│   ├── 004_phase2_seed.sql           # Dữ liệu mẫu Phase 2
│   └── 005_audit_trail.sql           # Audit trail
└── public/                        # Static assets
```

## Vai trò & Phân quyền

| Vai trò | Quyền chính |
|---|---|
| `sales` | Tạo phiếu dự trù cho BV mình phụ trách |
| `sales_manager` | Duyệt/từ chối phiếu dự trù Sales |
| `logistics_manager` | Tổng hợp, tạo PO, nhập khẩu, đánh giá VC |
| `warehouse_keeper` | Nhận hàng, nhập kho, kiểm đếm, xuất kho |
| `director` | Duyệt PO, xem Dashboard tổng quan |
| `admin` | Toàn quyền, quản lý Master Data, Audit |

## 6 Module nghiệp vụ

| # | Module | Mô tả |
|---|---|---|
| M1 | **Dự trù từ Sales** | Sales đề xuất hàng cho BV, auto-fill SP, workflow duyệt |
| M2 | **Dự trù tổng hợp** | Gộp nhu cầu, kiểm tồn kho, phân ưu tiên, auto tạo PO |
| M3 | **Đặt hàng (PO)** | Quản lý PO, tra giá Price List, cross-verify chứng từ |
| M4 | **Nhập khẩu** | Checklist 8 chứng từ, tính CIF, tracking 6 bước |
| M5 | **Nhập kho** | Kiểm đếm, Lot/HSD, cross-verify, FEFO, biệt trữ |
| M6 | **Vận chuyển** | Giao hàng BV, chấm điểm VC, biên bản giao nhận |

## Database Schema

**21+ bảng PostgreSQL** với Row Level Security (RLS):

- `profiles`, `products`, `hospitals`, `suppliers`, `carriers`
- `sales_forecasts` / `sales_forecast_items`
- `purchase_forecasts` / `purchase_forecast_items`
- `purchase_orders` / `po_items` / `po_documents` / `po_document_items`
- `verification_results`
- `import_shipments` / `import_documents`
- `warehouse_receipts` / `receipt_items`
- `inventory_lots`, `price_list`, `audit_logs`

## Tài liệu chi tiết

| Tài liệu | Mô tả |
|---|---|
| [Phân tích Quy trình Nghiệp vụ](docs/business_process_analysis.md) | 6 module, quy trình, công thức, cấu trúc dữ liệu |
| [Yêu cầu Hệ thống](docs/system_requirements.md) | 41 yêu cầu chức năng + phi chức năng, RACI, Use Case |
| [Phân tích Nhà Cung Cấp](docs/ncc_supplier_analysis.md) | Vai trò NCC, quan hệ dữ liệu, luồng NCC nội/ngoại |
| [Kiến trúc Hệ thống](docs/architecture.md) | Tech stack, component library, database schema, bảo mật |

## Tuân thủ quy định

- ✅ **GSP** (TT 36/2018/TT-BYT) — Truy xuất Lot + HSD, FEFO, bảo quản
- ✅ **GDP** (TT 03/2018/TT-BYT) — Hồ sơ vận chuyển, biên bản giao nhận
- ✅ **NĐ 98/2021** — Phân loại TBYT A-D, checklist chứng từ NK
- ✅ **ISO 13485** — Truy xuất nguồn gốc End-to-End

## License

Private — MedLogixManage © 2026
