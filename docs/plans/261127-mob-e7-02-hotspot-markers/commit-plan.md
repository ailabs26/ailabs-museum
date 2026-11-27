# Kế hoạch commit MOB-E7-02

| Thứ tự | Commit | Kiểm chứng |
| --- | --- | --- |
| 1 | `docs(mob): plan native hotspot selection [MOB-E7-02]` | Audit base, dependency, routing và staged diff. |
| 2 | `feat(mob): add native 3D hotspot markers [MOB-E7-02]` | Marker render state, tọa độ, typecheck và lint. |
| 3 | `fix(mob): route gallery taps through the navigation HUD [MOB-E7-02]` | Native responder, raycast, navigation, exhibit selection, typecheck và lint. |
| 4 | `feat(mob): connect gallery hotspot selection [MOB-E7-02]` | Tích hợp marker/normalization, selection lifecycle, 2D accessibility, typecheck và lint. |
| 5 | `docs(mob): record hotspot interaction verification [MOB-E7-02]` | Full verification, thiết bị và commit ledger. |

Marker có thể review riêng. Routing phải đi cùng hồi quy chọn exhibit vì thay đường nhận touch của cả gallery. Gallery marker, authored selection và nút 2D dùng chung handler và dữ liệu nên được kiểm chứng cùng nhau. Tất cả commit dùng nhánh nhiệm vụ và cùng một pull request vào `dev`.
