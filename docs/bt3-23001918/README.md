# BT3 VT-077 — Public Exhibit Search (Filter, Pagination, Stable Ordering)

**Sinh viên:** Nguyễn Đức Quang (23001918) · **Nhóm:** SE2026-T20 · **Đề tài:** 3D-WEB-03 (Aura Museum)
**Nhánh:** `feat/VT-077-public-exhibit-search` · **PR:** [#130](https://github.com/ailabs26/ailabs-museum/pull/130) · **Baseline:** `6e937c5` (từ `dev` @ `a9591858`)

---

## 1. Cấu trúc tài liệu & minh chứng (Evidence) trong thư mục này

| File / Thư mục | Nội dung |
|---|---|
| [`PLAN_BT3_23001918_VT-077.md`](PLAN_BT3_23001918_VT-077.md) | Đặc tả yêu cầu (AC-1..AC-5, NFR-1..NFR-3), bất biến (Total Order + Backward-compatible envelope), kế hoạch AI-assisted và chiến lược kiểm thử theo rủi ro |
| [`TRACEABILITY_VT-077.md`](TRACEABILITY_VT-077.md) | Bảng truy vết AC/Risk → Test case → File → Commit → Kết quả thực thi, phân tích coverage, flaky test và các điểm AI-generated chưa đáng tin |
| [`ADDENDUM_review-round-2_VT-077.md`](ADDENDUM_review-round-2_VT-077.md) | Phụ lục phản hồi Review của nhóm (`@nguyenthangdev`), chu trình RED → GREEN vòng 2 và bài học "Who tests the tests" ở tầng SQL |
| [`evidence/`](evidence/) | Log thực thi vòng 1: `01-RED-test-fail.log`, `02-GREEN-test-pass.log`, `03-MUTATION-killed.log`, `04-PERF-load-150.log`, `05-COVERAGE.log`, `06-FLAKY-determinism-3runs.log` |
| [`evidence/round2/`](evidence/round2/) | Log thực thi vòng 2 (sau review): `01-RED-before-fix.log`, `02-GREEN-after-fix.log`, `03-MUTATION-killed.log`, `04-PERF-load-150.log`, `05-COVERAGE.log`, `05-COVERAGE-full-exhibits.log`, `06-FLAKY-3runs.log` |

---

## 2. Tài liệu kiến trúc & nhật ký task chung của dự án

- **Hợp đồng API & Bất biến SQL:** [`docs/architecture/be/public-exhibit-search.md`](../architecture/be/public-exhibit-search.md) và [`docs/architecture/06-api-contract.md`](../architecture/06-api-contract.md)
- **Nhật ký Task Backend & Hướng dẫn chạy kiểm thử:** [`docs/tasks/be/public-exhibit-search.md`](../tasks/be/public-exhibit-search.md)

