# CMS Exhibit Edit — Stale Data Fix Implementation Plan

> **For agentic workers:** Người dùng đã duyệt. Dùng `executing-plans` triển khai tuần tự theo [task breakdown](../tasks/exhibit-edit-stale-data.md). Dùng chung nhánh `fix/exhibit-edit-stale-data` cho docs và code; mỗi task một commit có kiểm chứng. Chưa push hoặc tạo PR.

**Goal:** Mở lại form Sửa luôn đọc bản nháp mới nhất từ API chi tiết, không hiển thị hoặc lưu đè nội dung từ record danh sách cũ.

**Architecture:** `ExhibitsPage` sở hữu một phiên mở form và chỉ hydrate toàn bộ form một lần từ response chi tiết mới của phiên đó. Sau PATCH, đồng bộ các record danh sách đã cache từ response lưu, làm stale chi tiết rồi refetch danh sách để đối chiếu server. Giữ workflow draft → review → publish và không thay backend.

**Tech Stack:** React 18, TypeScript, Mantine 7, TanStack React Query 5 và Playwright đã cài.

## 1. Baseline và bằng chứng

- Baseline: `origin/dev` `37f5de7`; đã fetch và xác nhận local dev đồng bộ trước tạo nhánh.
- Nhánh duy nhất: `fix/exhibit-edit-stale-data`.
- Đã đọc AGENTS.md, frontend conventions, source form/service/query-client và backend update/revision/admin/public mapper trong phiên điều tra.
- `front-end/src/pages/admin/ExhibitsPage.tsx`:
  - `saveMutation.onSuccess` đóng Drawer rồi invalidate queries, không dùng response mới để cập nhật list cache.
  - `openEdit` hydrate từ `ExhibitRow` của danh sách.
  - `loadHotspots` đọc API detail nhưng chỉ cập nhật hotspots.
  - Guard hiện tại so sánh ID, không phân biệt hai lần mở cùng một hiện vật.
- Browser repro độc lập ngoài repo, API giả lập: roundtrip bình thường tên/mô tả/ảnh/audio PASS; giữ list refetch pending rồi mở Sửa → form vẫn dữ liệu cũ dù detail/list mới về; lưu form đó ghi đè text và media IDs mới bằng giá trị cũ.
- 317 backend tests service/DTO/media patch/mapper đã PASS khi điều tra, dùng mocks; chưa chứng minh persistence trên DB thật. Không cần chạy migration hoặc test ghi DB để sửa lỗi frontend này.

## 2. Global constraints

- PLAN/TASK đã được duyệt; triển khai trên nhánh fix, dừng trước push/PR để review.
- Khi triển khai: chỉ frontend, không sửa backend, API contract, database, migration, RBAC hoặc quy trình xuất bản.
- Không tích hợp ảnh/audio vào trang khách trong nhiệm vụ này; lưu nháp không tự public.
- Không thêm dependency, global form/focus manager, refactor diện rộng hoặc cache abstraction.
- Giữ payload 6 slot media, alt text/transcript song ngữ, transforms và hotspots theo contract hiện có; `null` tháo slot, bỏ field giữ nguyên theo API.
- Giữ đường gọi `openEdit(exhibit).then(() => showFieldErrors(err))` của submit-review 422; chỉ đánh dấu lỗi sau hydrate thành công của đúng phiên.
- Không tạo detail giả từ PATCH: PATCH trả `ExhibitRow`, không có đủ media descriptor, room, revisions và hotspots của `ExhibitDetail`.
- Test bằng mocked API/browser, không tạo/sửa/xóa nội dung CMS thật. Không sử dụng hoặc in credentials thật.
- Sau mỗi task sửa source: focused browser tests + `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`; helpers thay đổi thì chạy unit liên quan.

## 3. Thiết kế đã triển khai

### 3.1 Một nguồn dữ liệu cho toàn form

- Click Sửa chỉ dùng ID từ list để xác định record; không dùng `exhibit.content` làm nội dung editable.
- Mở Drawer với trạng thái loading, không render form cũ có thể thao tác.
- Lấy detail mới qua query key `['admin-exhibit-detail', id]` với freshness bắt buộc (`staleTime: 0`); không cho cache 30 giây mặc định trở thành nguồn hydrate.
- Nếu query detail cũ cùng key đang pending từ trước khi lưu/phiên mở cũ, hủy kết quả query cũ trước khi bắt đầu request mới, tránh `fetchQuery` tái sử dụng promise cũ. Dùng `queryClient.cancelQueries` theo exact key; không cần thêm fetch tự do ngoài service.
- Khi thành công, hydrate nguyên bộ từ **cùng một `ExhibitDetail`**: roomId, name/description vi/en, displayOrder, position/rotation/scale, shape/color, model/image/audio vi/en/subtitle vi/en, altText/transcript và hotspots.
- Sử dụng `getLocalizedText` cho từng ngôn ngữ khi điền form; không lấy tiếng Việt để tự điền ô tiếng Anh rỗng. Giữ tương thích audioViId/audioId hiện có.
- Hydrate xong mới cho chỉnh sửa và Lưu. Lỗi GET: thông báo inline + Thử lại, không cho lưu từ giá trị cũ.
- Không tự hydrate lại khi background refetch hoặc query cache thay đổi: không ghi đè người dùng đang nhập.

### 3.2 Phiên mở form và request đến muộn

- Tạo token tăng đơn điệu cho mỗi lần mở Sửa, Thử lại, Tạo mới và đóng form; token ref nội bộ ngay trong page.
- Response chỉ được cập nhật form/state khi token còn khớp và phiên vẫn đang sửa ID đó.
- Quyền sửa/khóa IN_REVIEW phải được đối chiếu với detail mới trước khi cho Lưu; không dựa trạng thái row cũ để mở đường chỉnh sửa bản đang chờ duyệt. Backend vẫn là chốt chặn quyền/trạng thái.
- Kiểm tra token cả trước khi bắt đầu fetch sau bước await cancel và sau khi fetch thành công/thất bại.
- A → B, A → đóng → mở lại A và A → Tạo mới đều không được nhận response của phiên cũ. So sánh ID đơn thuần không đủ.
- Giữ loading/error và save guard tách biệt: `canSave` chỉ true khi tạo mới hoặc detail của phiên sửa đã ready, và không có mutation save pending.
- Không thay đổi field validation hay focus trap; loading/error dùng `role="status"`/`role="alert"` và retry native button.
- `openEdit` vẫn trả Promise để caller 422 hoạt động; kết quả stale/error không được gọi `showFieldErrors` lên form khác. Có thể trả `Promise<boolean>` biểu thị đúng phiên hydrate thành công và guard caller theo kết quả đó.
- Retry hotspots hiện hữu phải dùng nguồn detail/phiên thống nhất, không để một loader cũ thay hotspots của phiên mới.

### 3.3 Đồng bộ sau lưu

- Response PATCH/POST là bản nháp đã lưu. Đổi toast sửa thành **“Đã lưu bản nháp hiện vật …”**, không hàm ý đã xuất bản.
- Với edit thành công, dùng React Query `setQueriesData<Page<ExhibitRow>>` trên prefix `['admin-exhibits']`: chỉ thay record trùng ID đã có; giữ nguyên meta/order và không tự chèn record vào cache tìm kiếm/lọc không chứa nó. Không thay toàn bộ list bằng PATCH response.
- Hủy các list request cũ liên quan trước khi seed cache để chúng không ghi lại response trước PATCH. Giữ invalidation/refetch sau seed để server quyết định membership/order của từng bộ lọc.
- Cancel query detail đang chạy trước khi invalidate; không dùng detail cũ hydrate lần mở lại. Chi tiết có thể được đánh stale với `refetchType: 'none'` để phiên mở tiếp theo chủ động lấy mới; nếu detail đang hiển thị cần refetch, phải giữ quy tắc không hydrate lại form đang dirty.
- Thứ tự onSuccess: bảo vệ phiên save → cancel stale queries cần thiết → seed list row → invalidate detail/list → đóng đúng phiên form đã lưu. Trong lúc xử lý success không mở phiên sửa mới để callback cũ đóng nhầm phiên đó.
- Tiếp tục dùng `saveMutation.isPending` để khóa thao tác liên quan tới hết Promise của onSuccess; cache callback chỉ dùng ID trong response/variables, không dùng `editing` có thể đã đổi do người dùng đóng/chuyển form.
- Không cần đợi toàn bộ list refetch hoàn tất mới cho xem danh sách; correctness của form phải do GET detail mới đảm bảo.
- Không ghi detail giả thiếu fields vào cache. Nếu list refetch lỗi, vẫn có record từ save response nhưng mở Sửa phải tải detail hoặc báo lỗi; tuyệt đối không fallback vào row cache để Lưu.

## 4. File map sau khi được duyệt

| File | Thay đổi dự kiến |
|---|---|
| `front-end/src/pages/admin/ExhibitsPage.tsx` | Hydrate detail toàn bộ form, loading/error/retry, session guard, onSuccess cache và toast |
| `front-end/tests/exhibit-edit-persistence.spec.ts` | Browser regression roundtrip, slow refetch, race, GET error, 422 |
| `front-end/tests/fixtures/exhibitEditApi.ts` | Stateful mocked API: old/new list/detail, deferred responses, capture PATCH, media options; tái dùng auth/response fixture có sẵn |
| `docs/plans/exhibit-edit-stale-data-plan.md` | Thiết kế, quyết định và verification status |
| `docs/tasks/exhibit-edit-stale-data.md` | Checklist task, acceptance và commit/test ledger |

Không dự kiến sửa schema/service/backend. Nếu cần truyền AbortSignal để thực sự dừng transport, chỉ bổ sung optional signal vào `exhibitsService.get` khi chứng minh cancel query chưa đáp ứng contract; không thay response signature hoặc query keys.

## 5. Kiểm chứng

Fixture phải giữ trạng thái như server: PATCH lưu bản mới, GET đọc bản đó; có gate trì hoãn từng list/detail request độc lập. Không dùng mock luôn trả một object cố định để khẳng định persistence.

| Case | Điều kiện / assertion |
|---|---|
| Reopen trong lúc list cũ refetch | PATCH lưu v2; list còn v1; reopen phải loading rồi hiển thị detail v2 ở mọi field |
| Media/audio + text | Chọn/tháo/thay UUID, lưu, reopen kiểm tra tên/mô tả/slot/altText/transcript/hotspots nhất quán |
| Không rollback do form cũ | Reopen rồi Lưu lần nữa; PATCH thứ hai vẫn mang v2, không gửi lại v1 |
| Detail GET lỗi | Form cũ không editable/Lưu không gửi PATCH; Retry thành công mới hydrate |
| Freshness | Detail cache v1 dưới 30 giây vẫn gọi GET mới; không nhận request detail pending từ trước save |
| A → B / đóng → A / Tạo mới | Response resolve/reject đảo thứ tự không đổi phiên mới hoặc đóng Drawer mới |
| Background update | Người dùng nhập chưa lưu rồi query refetch; nội dung nhập không bị ghi đè |
| 422 gửi duyệt | Hydrate đúng detail xong mới map field errors và chuyển tab; request lỗi/stale không map sang record khác |
| Filter/list cache | Chỉ thay đúng ID; giữ record khác/meta; refetch đưa record ra/vào bộ lọc theo server |
| Public workflow | Toast báo nháp; không phát sinh submit-review/publish request sau Lưu |

Lệnh dự kiến từ `front-end/`:

```powershell
npm.cmd test -- exhibit-edit-persistence.spec.ts admin-drawer-focus.spec.ts readonly-drawer-focus.spec.ts moderation-keyboard.spec.ts --reporter=line
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Regression trước merge còn kiểm tra `modal-responsive-focus.spec.ts` và `accessibility-modal.spec.ts` nếu thay lifecycle Drawer/shared fixtures. Preview/hotspot/tour-order smoke scripts có ghi CMS thật không được chạy tự động trong task này. Không tuyên bố test mock chứng minh DB production đã lưu.

## 6. Tự review

- [x] Sửa nguyên nhân form lấy row cũ và detail chỉ hydrate hotspots; không lẫn save với publish.
- [x] Token cho mỗi phiên, kể cả cùng ID mở lại; có guard trước/sau await và 422 caller.
- [x] Không để background refetch ghi đè dirty form hoặc PATCH tạo detail cache thiếu fields.
- [x] Cache list giữ meta/filter; invalidation vẫn lấy server làm nguồn đối chiếu.
- [x] Có test media/null semantics, delayed queries, retry, overwrite, filter và workflow public.
- [x] Giới hạn frontend, không thêm API/database/migration/dependency hoặc tích hợp player.
- [x] Người dùng duyệt trước triển khai/commit.

## 7. Verification sau triển khai

- Baseline `37f5de7`, branch `fix/exhibit-edit-stale-data`; không thay backend/API/schema/migration/dependency.
- `exhibit-edit-persistence.spec.ts`: **13/13 PASS**, stateful mocked API và browser Edge/Chromium trên Windows. Bao phủ detail mới toàn form, retry/error, cache fresh, cùng ID mở lại, A→B/create, IN_REVIEW, 422, slow list, null slots, dirty form, cache filters và payload hai lần lưu.
- Regression Drawer/keyboard: **31/31 PASS** với `--timeout=60000`; không nới từng assertion focus. Một lượt trước timeout tổng 30s ở ca nhiều bước Tab; chạy riêng và lượt cuối đều PASS.
- Typecheck/lint/build cuối: **PASS**. Build vẫn có cảnh báo chunk >500 kB hiện hữu.
- Fixture overlay cũ thiếu response list `/admin/media`, khiến MediaSlotSelect lỗi `items.find`; chỉ sửa fixture trả array rỗng đúng contract.
- Không chạy backend/live CMS/database mutation; tests mock không chứng minh persistence production. Không có QA screen reader/thiết bị thật hoặc browser khác Edge.
- Không thêm AbortSignal vào service: query cancellation chặn kết quả promise cũ và token phiên chặn hydrate; không tuyên bố request HTTP cũ được abort ở transport.
- Chưa có test thay đổi permission runtime trong lúc Drawer đang mở; UI dùng quyền hiện tại và backend vẫn là chốt kiểm tra quyền.
- Dừng trước push/PR/merge; ledger tại task document.
