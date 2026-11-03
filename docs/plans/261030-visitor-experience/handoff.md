# Bàn giao Visitor Experience Toolkit — 30/10/2026

## A. Baseline

Base `origin/dev` = `a9591858d77312a36efb5b6e891ea400d55ac94f`; fetch đầu/cuối cùng SHA. Working tree ban đầu sạch. Đã khảo sát visitor pages, shared grid/media/report, hooks/query/service/Zod/router/layout, tests và backend public modules (chỉ đọc). Các gates baseline typecheck/lint/unit/build PASS; lint có1 warning memo, unit179. Conventions thực tế ở `docs/architecture/fe/coding-conventions.md`.

## B. Năm tính năng hoàn thành

| Tính năng | Hành vi và file chính |
|---|---|
| Favorites | Nút collection/detail, aria-pressed, local100 refs, filter theo phòng phối hợp search. `FavoriteButton.tsx`, `CollectionPage.tsx`, `ExhibitGrid.tsx` optional slot. |
| Recently viewed | Chỉ ghi sau valid success không fetching; mới nhất trước/dedupe/20 refs; collection có link đúng phòng + clear; resolve lại public data. `RecentlyViewed.tsx`, `useResolvedVisitorExhibits.ts`, `ExhibitDetailPage.tsx`. |
| So sánh2D | Chọn2–3 từ collection xuyên phòng; tray/remove/clear/limit; Modal responsive cuộn ngang, focus/Escape; chỉ tên/ảnh/mô tả/phòng/credits DTO. `ExhibitComparison.tsx`, `useExhibitComparison.ts`. |
| Reading | Toggle, font100–150%, line-height1.9/content72ch khi bật, reset/persist; chỉ CSS detail, giữ audio/transcript/headings. `ReadingControls.tsx`, detail CSS. |
| Notes | Plain-text autosave đồng bộ, room+exhibit,2000 ký tự/100 notes, create/edit/delete, RAM fallback/retry/quota/cross-tab; không HTTP writes. `VisitorNotes.tsx`. |

Nền dùng `visitorPersistence.ts`, `visitorState.ts`, `useVisitorStore.ts`: version1 strict validation, bounded payload, listener cleanup. Không có feature blocker; giới hạn nghiệm thu môi trường ở E/F.

## C. Bug fixes có bằng chứng

Memo là lỗi có sẵn trên base. Các lỗi recovery/focus/history tiếp theo được phát hiện trong implementation mới qua review và sửa trước bàn giao.

- Memo array tạo mới mỗi render: baseline ESLint warning; bọc sorted exhibits bằng useMemo([detail]). Static gate RED→GREEN; browser tiebreak ID/search/filter/refetch giữ đúng.
- Quota retry ghi đè dữ liệu tab khác: unit/browser repro, merge delta theo identity và refresh base từng thất bại. Giữ add/edit/delete của các bên.
- Cached detail refetch lỗi vẫn ghi history: browser repro; chỉ ghi sau list/detail settled success.
- Bỏ favorite cuối trong filter làm focus về BODY: browser repro; trả focus h1 ổn định.
- History retry resurrect dữ liệu tab khác clear: unit repro; merge chỉ prefix mới/moved, không suffix unchanged.

## D. Atomic commits

| SHA | Message / trách nhiệm |
|---|---|
| cc634a0 | docs(plan): define visitor experience scope and risk controls |
| b900c75 | feat(visitor): add validated browser persistence utilities |
| 2ecaa81 | feat(collection): support favorite exhibits and room filtering |
| bff8252 | feat(visitor): add recently viewed and continue exploring |
| 8c60411 | feat(collection): add accessible exhibit comparison |
| 47c6361 | feat(exhibit): add accessible reading preferences |
| a95bd58 | feat(exhibit): add private visitor notes |
| e7ba8fe | fix(collection): stabilize exhibit filtering dependencies |
| 98252e6 | fix(visitor): preserve state and focus through recovery |
| 957d495 | test(visitor): cover storage failure and cross-tab regressions |
| HEAD (commit bàn giao) | docs(visitor): record verification and handoff |

Revert consumers trước persistence/resolver; feature commits có tests cùng source. Revert ngược thứ tự khi rollback toàn toolkit; keys aura:visitor:*:v1 không ảnh hưởng auth/admin.

## E. Verification

Typecheck/lint/build PASS; unit194/194; production browser99/99 (21 mới +78 hiện có), dev recovery smoke1/1. Chi tiết lệnh, failures/RED/GREEN, screenshots và review: [verification.md](verification.md).

Lượt browser rộng đầu93/97: một assertion tổng live-region cũ được cập nhật đúng ngữ nghĩa và PASS; ba failures còn lại đã tái hiện cùng lỗi trên bản trích nguyên base:

1. `home-featured.spec.ts`: `homepage shows the first three...`, Canvas0 kỳ vọng nhưng HeroCanvas hiện có1.
2. `public-image-audio.spec.ts`: `API image decodes in /`, naturalWidth0.
3. `tour-exhibit-deep-link.spec.ts`: `opening 3D from a deep link keeps...`, locator nút catalogue không có khi immersive mở.

Ba bài trên được loại có ghi rõ khỏi gate production99; không sửa test hoặc3D/home để che lỗi. Không tuyên bố whole-suite xanh. Không chạy DB/live API/admin/full3D/headset/screen reader/native zoom200%; CSS zoom2 và responsive đã test. Cần human QA trên thiết bị thật.

## F. Team safety

Chỉ frontend visitor, focused tests và docs. Shared grid thêm optional action slot, home consumer giữ markup/behavior cũ. Không sửa backend/contracts/schema/migrations/seeds/auth/RBAC/audit/CMS/3D rendering/camera/WebXR/deployment/CI/env/package/lockfile. Không HTTP ghi production hoặc analytics.

[PR#130](https://github.com/ailabs26/ailabs-museum/pull/130) draft/open, ducqwang, chỉ backend public search; không giao file. Issues#110–113 ngoài phạm vi, không can thiệp. Review độc lập read-only đã tái hiện findings, author sửa và kiểm chứng; cần người phụ trách review private browser persistence và UI trước phát hành. Cùng mục ghi đồng thời last-write-wins; storage bị chặn chỉ giữ RAM. Chưa push/PR/merge.

## G. Handoff

Nhánh `feat/visitor-experience-toolkit`;10 commit triển khai/test +1 commit bàn giao. Trước commit bàn giao chỉ còn docs/evidence của nhiệm vụ; xác nhận working tree sau commit trong báo cáo chat cuối.

Các lệnh để người dùng review rồi tự push/mở PR vào dev (agent **chưa thực hiện**):

```powershell
git status --short --branch
git log --oneline origin/dev..HEAD
git diff --check origin/dev...HEAD
git diff origin/dev...HEAD
git push -u origin feat/visitor-experience-toolkit
gh pr create --base dev --head feat/visitor-experience-toolkit --title "feat(visitor): add personal visitor experience toolkit" --body-file docs/plans/261030-visitor-experience/handoff.md
```

PR URL: chưa tạo. Merge: chưa thực hiện. Không merge khi mandatory checks/acceptance đang fail hoặc chưa có human review theo quy định liên quan privacy. Có thể mở preview local bằng `cd front-end; npm.cmd run dev`.
