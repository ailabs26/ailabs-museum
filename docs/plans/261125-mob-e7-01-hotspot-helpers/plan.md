# Kế hoạch MOB-E7-01

- Base `origin/dev`: `97f4b9a9af2bbe5cf9ab439671f17b78d984dec5`.
- Nhánh `feat/mob-e7-01-hotspot-helpers`. Cây làm việc sạch trước khi chuyển từ `feat/3d-exhibit-search-navigation`.
- Phạm vi gồm hai helper thuần TypeScript, test Jest và tài liệu. Các task marker, story UI, camera, haptic, tour và AR có phạm vi riêng.

## Audit dependency

| Task | Bằng chứng trên base | Sử dụng |
| --- | --- | --- |
| MOB-E4-04 | Mapper `mapRoomDisplays` có trong `scene3d/gallerySlots.ts`. Test hiện có kiểm tra thứ tự hotspot. Màn phòng và AR sử dụng mapper này. | Test trực tiếp với payload và mapper mobile. |
| MOB-E6-03 | `normalizeModel` và `ModelNormalization` có test trong `glbValidation.ts` / `glbValidation.test.ts`, từ `754db3c` (MOB-E6-02). Hợp đồng scale, offset, size, center và radius tương đương web. | Dùng type hiện có và gọi normalizer thật trong test Three.js. |
| MOB-E6-04 | `4b3f9d8` có gallery slots, render gallery, `MuseumDisplay`, `MUSEUM_ROOM_SIZE` và `ARTIFACT_BASE_Y`. Mapper snap tọa độ vào tâm bục khi toàn phòng khớp slot. Gallery đặt GLB trên bục ở y = 1,14 m. | Dùng vị trí display đã resolve, phòng 14 × 16 × 5 m và cao độ bục hiện có. |
| MOB-E7-01 | Base có `arHotspots.ts` dùng hệ tọa độ AR có scale và giới hạn riêng. Hai helper cho gallery chưa có trên base. | Đặt hai helper cùng các domain helper trong `mobile/src/features/scene3d/`. |

Các dependency đáp ứng phần logic cần cho task. Chưa thấy blocker về contract.

## Port từ web

- `front-end/src/helpers/hotspotStory.ts` và test. Giữ identity room/exhibit/hotspot, đọc nội dung mới nhất từ `display.hotspots` và trả lại danh sách gốc kèm index. Callback native nhận `exhibitId` và `hotspotId`.
- `front-end/src/helpers/artifactHotspots.ts` và test. Giữ fallback bounds, ID tổng hợp, các nhánh GLB/primitive, độ phân tán marker và biên an toàn 0,2 m. Tọa độ GLB nguồn đi qua offset và scale rồi cộng độ cao bục cho Y. Chỉ world target cộng tọa độ display vào kết quả trả về. World target chỉ lấy từ annotation authored còn hợp lệ trong phòng.
- Đối chiếu `modelNormalization.ts`, `mapRoomDisplays.ts` và `interfaces/museumScene.ts` của web với các contract mobile kể trên. Dùng tuple ba phần tử để TypeScript kiểm tra theo `noUncheckedIndexedAccess`. Dùng globals Jest và điều chỉnh fixture API theo kiểu mobile.

## Ma trận test dự kiến

| Case web | Case Jest tương ứng |
| --- | --- |
| `hotspotStory` 1 · identity room/exhibit/hotspot | `hotspotStory.test.ts` · cùng tên và assertions |
| `hotspotStory` 2 · nội dung cập nhật, annotation thiếu/tổng hợp | `hotspotStory.test.ts` · cùng tên và assertions |
| `artifactHotspots` 1 · identity, metadata và fallback bounds | `artifactHotspots.test.ts` · cùng tên và assertions |
| `artifactHotspots` 2 · marker trên normalized bounds | Cùng tên và assertions, dùng `Group`, `Mesh`, `BoxGeometry` và `normalizeModel` mobile |
| `artifactHotspots` 3 · pivot/scale và fallback khi thiếu bounds | Cùng tên và assertions |
| `artifactHotspots` 4 · primitive và marker riêng cho điểm thiếu tọa độ | Cùng tên và assertions |
| `artifactHotspots` 5 · world target từ vị trí gallery và normalization | Cùng tên và assertions |
| `artifactHotspots` 6 · chỉ fallback marker cho target không hợp lệ | Cùng tên và assertions |
| `artifactHotspots` 7 · giữ revision và tọa độ API | Cùng tên và assertions, gọi mapper mobile. Thứ tự nhiều hotspot có thêm bằng chứng từ test sẵn có của mapper. |

Chạy hai file web làm baseline, kiểm chứng từng helper trước khi commit, rồi chạy lại hai suite Jest, typecheck, lint, full Jest và Hermes budget. Ghi riêng kết quả kiểm chứng native trên thiết bị/simulator.
