# Kế hoạch commit MOB-E7-01

| Thứ tự | Commit | File | Kiểm chứng trước commit |
| --- | --- | --- | --- |
| 1 | `docs(mob): plan hotspot helper port [MOB-E7-01]` | `plan.md`, `commit-plan.md` | Đối chiếu base, source, các dependency và 9 case web. Review staged diff và `git diff --cached --check`. |
| 2 | `feat(mob): port hotspot story resolution [MOB-E7-01]` | `mobile/src/features/scene3d/hotspotStory.ts`, `hotspotStory.test.ts` | Hai case story Jest, mobile typecheck/lint và staged diff. |
| 3 | `feat(mob): port artifact hotspot calculations [MOB-E7-01]` | `mobile/src/features/scene3d/artifactHotspots.ts`, `artifactHotspots.test.ts` | Bảy case artifact Jest, suite mapper đã có, mobile typecheck/lint và staged diff. |
| 4 | `docs(mob): record hotspot parity verification [MOB-E7-01]` | `verification.md`, cập nhật kế hoạch nếu kết quả thực tế thay đổi | Hai suite web baseline, hai suite Jest port, full mobile Jest, typecheck, lint, Hermes budget, review diff và commit ledger. |

Hai helper có thể được review và revert độc lập. Mỗi helper đi cùng test của nó để từng commit có thể kiểm chứng. Contract và mapper hiện có đáp ứng yêu cầu nên không cần commit compatibility. Dùng kiểu tiêu đề `feat(mob)` / `docs(mob)` và `[MOB-...]` theo lịch sử `origin/dev`.
