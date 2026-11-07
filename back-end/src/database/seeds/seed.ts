import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../common/constants/permissions.constant';
import { RoleKey } from '../../common/enums/role.enum';
import { dataSource } from '../../config/data-source';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { Translation } from '../../modules/translations/entities/translation.entity';
import { PartnerApiKey } from '../../modules/partner-api-keys/entities/partner-api-key.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { User } from '../../modules/users/entities/user.entity';

/** Tên hiển thị cho các role hệ thống. */
const ROLE_NAMES: Record<RoleKey, string> = {
  [RoleKey.ADMIN]: 'Quản trị viên',
  [RoleKey.MODERATOR]: 'Kiểm duyệt viên',
  [RoleKey.EDITOR]: 'Biên tập viên',
};

async function seedPermissions(): Promise<Map<string, Permission>> {
  const repo = dataSource.getRepository(Permission);
  const byCode = new Map<string, Permission>();
  for (const code of ALL_PERMISSIONS) {
    let permission = await repo.findOne({ where: { code } });
    if (!permission) {
      permission = await repo.save(repo.create({ code, description: null }));
      console.log(`  + permission ${code}`);
    }
    byCode.set(code, permission);
  }
  return byCode;
}

export interface SeedRolesOptions {
  roleRepo?: Pick<
    import('typeorm').Repository<Role>,
    'findOne' | 'create' | 'save'
  >;
  linkRepo?: Pick<
    import('typeorm').Repository<RolePermission>,
    'count' | 'delete' | 'create' | 'save'
  >;
  /**
   * Khi `true` (hoặc `SEED_RESET_RBAC=true`), khôi phục quyền mặc định cho cả
   * các role đã tồn tại (`moderator`, `editor`). Mặc định `false` để bảo toàn
   * cấu hình RBAC tùy chỉnh của quản trị viên khi chạy lại seed.
   */
  resetCustomRbac?: boolean;
}

export async function seedRoles(
  permissions: Map<string, Permission>,
  options?: SeedRolesOptions,
): Promise<Map<RoleKey, Role>> {
  const roleRepo = options?.roleRepo ?? dataSource.getRepository(Role);
  const linkRepo = options?.linkRepo ?? dataSource.getRepository(RolePermission);
  const resetCustomRbac =
    options?.resetCustomRbac ?? process.env.SEED_RESET_RBAC === 'true';
  const byKey = new Map<RoleKey, Role>();

  for (const key of Object.values(RoleKey)) {
    let role = await roleRepo.findOne({ where: { code: key, isDeleted: false } });
    const isNewRole = !role;
    if (!role) {
      role = await roleRepo.save(roleRepo.create({ code: key, name: ROLE_NAMES[key] }));
      console.log(`  + role ${key}`);
    }
    byKey.set(key, role);

    // Role admin luôn nhận đủ ALL_PERMISSIONS; các role mặc định khác (moderator, editor)
    // chỉ gán quyền mặc định khi mới khởi tạo hoặc khi bật cờ tường minh SEED_RESET_RBAC=true.
    if (!isNewRole && key !== RoleKey.ADMIN && !resetCustomRbac) {
      const existingCount = await linkRepo.count({ where: { roleId: role.id } });
      console.log(
        `  = role ${key}: bảo toàn ${existingCount} quyền hiện có (đặt SEED_RESET_RBAC=true để reset mặc định)`,
      );
      continue;
    }

    await linkRepo.delete({ roleId: role.id });
    const codes = DEFAULT_ROLE_PERMISSIONS[key];
    const links = codes
      .map((code) => permissions.get(code))
      .filter((permission): permission is Permission => Boolean(permission))
      .map((permission) => linkRepo.create({ roleId: role!.id, permissionId: permission.id }));
    if (links.length > 0) await linkRepo.save(links);
    console.log(`  = role ${key}: ${links.length} quyền`);
  }
  return byKey;
}

async function seedAdmin(roles: Map<RoleKey, Role>): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('  ! Bỏ qua tạo admin: thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD');
    return;
  }

  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  let admin = await userRepo.findOne({ where: { email } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        email,
        passwordHash: await bcrypt.hash(password, rounds),
        displayName: 'Administrator',
      }),
    );
    console.log(`  + admin ${email}`);
  }

  const adminRole = roles.get(RoleKey.ADMIN)!;
  const hasRole = await userRoleRepo.count({
    where: { userId: admin.id, roleId: adminRole.id },
  });
  if (hasRole === 0) {
    await userRoleRepo.save(userRoleRepo.create({ userId: admin.id, roleId: adminRole.id }));
    console.log('  = gán role admin cho tài khoản seed');
  }
}

/** Chuỗi giao diện công khai; `vi` trùng giá trị dự phòng ở front-end. Admin dịch thêm trong CMS. */
export const PUBLIC_UI_STRINGS: [namespace: string, context: string, vi: string, en: string][] = [
  ['ui.skip-link', 'Liên kết bỏ qua điều hướng', 'Đến nội dung chính', 'Skip to main content'],
  ['ui.nav.home', 'Menu chính', 'Trang chủ', 'Home'],
  ['ui.nav.collection', 'Menu chính', 'Bộ sưu tập', 'Collection'],
  ['ui.nav.tour', 'Menu chính', 'Tham quan 3D', '3D Tour'],
  ['ui.cta.enter-3d', 'Nút ở header', 'Vào không gian 3D', 'Enter the 3D space'],
  ['ui.language.label', 'Nhãn ô chọn ngôn ngữ', 'Ngôn ngữ', 'Language'],
  ['ui.footer.manifesto', 'Chân trang', 'Bảo tồn và kể lại câu chuyện di sản bằng không gian số 3D WebXR — để mọi người, ở bất cứ đâu, đều có thể chạm tới nghệ thuật và lịch sử.', 'Preserving and retelling heritage stories in a 3D WebXR digital space, so that everyone, anywhere, can reach art and history.'],
  ['ui.collection.title', 'Tiêu đề trang Bộ sưu tập', 'Bộ sưu tập', 'Collection'],
  ['ui.collection.intro', 'Mô tả trang Bộ sưu tập', 'Dành một chút thời gian cho mỗi câu chuyện. Khám phá nội dung hiện vật trong giao diện 2D, không cần mở không gian 3D.', 'Take a moment with each story. Explore the exhibits in 2D, without opening the 3D space.'],
  ['ui.collection.search', 'Gợi ý ô tìm kiếm', 'Tìm hiện vật theo tên hoặc từ khóa…', 'Search exhibits by name or keyword…'],
  ['ui.collection.refresh', 'Nút làm mới', 'Làm mới', 'Refresh'],
  ['ui.collection.details', 'Nút trên thẻ hiện vật', 'Xem chi tiết', 'View details'],
  ['ui.collection.other-rooms', 'Tiêu đề kết quả tìm kiếm', 'Ở các phòng khác', 'In other rooms'],
  ["ui.action.retry", "Giao diện công khai", "Thử lại", "Try again"],
  ["ui.audio.captions.current.aria", "Trình phát thuyết minh", "Phụ đề hiện tại", "Current subtitles"],
  ["ui.audio.captions.disable", "Trình phát thuyết minh", "Tắt phụ đề", "Turn subtitles off"],
  ["ui.audio.captions.enable", "Trình phát thuyết minh", "Bật phụ đề", "Turn subtitles on"],
  ["ui.audio.captions.error", "Trình phát thuyết minh", "Không tải được phụ đề. Bạn vẫn có thể đọc bản thuyết minh.", "Could not load subtitles. You can still read the transcript."],
  ["ui.audio.captions.title", "Trình phát thuyết minh", "Phụ đề WebVTT", "WebVTT subtitles"],
  ["ui.audio.label", "Trình phát thuyết minh", "Thuyết minh audio", "Audio narration"],
  ["ui.audio.pause", "Trình phát thuyết minh", "Tạm dừng", "Pause"],
  ["ui.audio.play", "Trình phát thuyết minh", "Phát", "Play"],
  ["ui.audio.resume", "Trình phát thuyết minh", "Tiếp tục", "Resume"],
  ["ui.audio.retry", "Trình phát thuyết minh", "Thử lại", "Try again"],
  ["ui.audio.seek.aria", "Trình phát thuyết minh", "Tua âm thanh", "Seek audio"],
  ["ui.audio.status.empty", "Trình phát thuyết minh", "Chưa có audio", "No audio available"],
  ["ui.audio.status.ended", "Trình phát thuyết minh", "Đã phát xong", "Playback complete"],
  ["ui.audio.status.error", "Trình phát thuyết minh", "Không phát được audio. Vui lòng thử lại.", "Could not play audio. Please try again."],
  ["ui.audio.status.loading", "Trình phát thuyết minh", "Đang mở audio…", "Loading audio…"],
  ["ui.audio.status.paused", "Trình phát thuyết minh", "Đã tạm dừng", "Paused"],
  ["ui.audio.status.playing", "Trình phát thuyết minh", "Đang phát", "Playing"],
  ["ui.audio.status.ready", "Trình phát thuyết minh", "Sẵn sàng phát", "Ready to play"],
  ["ui.audio.stop", "Trình phát thuyết minh", "Dừng", "Stop"],
  ["ui.audio.time.current.aria", "Trình phát thuyết minh", "Thời gian hiện tại", "Current time"],
  ["ui.audio.time.total.aria", "Trình phát thuyết minh", "Tổng thời lượng", "Total duration"],
  ["ui.audio.volume.aria", "Trình phát thuyết minh", "Âm lượng", "Volume"],
  ["ui.brand.home-aria", "Thương hiệu", "Aura Museum — Trang chủ", "Aura Museum — Home"],
  ["ui.collection.compare.action", "Bộ sưu tập", "So sánh", "Compare"],
  ["ui.collection.compare.aria", "Bộ sưu tập", "So sánh {name}", "Compare {name}"],
  ["ui.collection.count.filtered", "Bộ sưu tập", "{matched}/{total} hiện vật khớp tìm kiếm", "{matched}/{total} exhibits match search"],
  ["ui.collection.count.published", "Bộ sưu tập", "{count} hiện vật đã xuất bản", "{count} published exhibits"],
  ["ui.collection.details.aria", "Bộ sưu tập", "Xem chi tiết {name}", "View details {name}"],
  ["ui.collection.empty.exhibits", "Bộ sưu tập", "Phòng này chưa có hiện vật được xuất bản.", "This gallery has no published exhibits yet."],
  ["ui.collection.empty.favorites-search", "Bộ sưu tập", "Không có hiện vật yêu thích khớp trong phòng này. Hãy đánh dấu yêu thích hoặc thay đổi tìm kiếm.", "No favorite exhibits match in this gallery. Favorite an exhibit or change your search."],
  ["ui.collection.empty.rooms", "Bộ sưu tập", "Chưa có phòng trưng bày công khai.", "No public galleries yet."],
  ["ui.collection.empty.search", "Bộ sưu tập", "Không có hiện vật nào khớp với “{query}”.", "No exhibits match “{query}”."],
  ["ui.collection.error.exhibits", "Bộ sưu tập", "Không tải được hiện vật", "Could not load exhibits"],
  ["ui.collection.error.room-unavailable", "Bộ sưu tập", "Phòng được chọn không có trong danh sách công khai. Hãy chọn phòng khác.", "This gallery is not public. Choose another gallery."],
  ["ui.collection.error.rooms", "Bộ sưu tập", "Không tải được danh sách phòng", "Could not load galleries"],
  ["ui.collection.exhibit.badge", "Bộ sưu tập", "Hiện vật {number}", "Exhibit {number}"],
  ["ui.collection.exhibit.image-missing", "Bộ sưu tập", "Chưa có ảnh", "No image"],
  ["ui.collection.exhibit.preview", "Bộ sưu tập", "Hình minh họa thay thế", "Exhibit preview"],
  ["ui.collection.exhibits.aria", "Bộ sưu tập", "Hiện vật trong bộ sưu tập", "Exhibits in this collection"],
  ["ui.collection.eyebrow", "Bộ sưu tập", "Aura Museum / Khám phá hiện vật", "Aura Museum / Discover exhibits"],
  ["ui.collection.favorites.only", "Bộ sưu tập", "Chỉ hiện vật yêu thích trong phòng này", "Show only favorites in this gallery"],
  ["ui.collection.loading.aria", "Bộ sưu tập", "Trạng thái tải bộ sưu tập", "Collection loading status"],
  ["ui.collection.loading.exhibits", "Bộ sưu tập", "Đang tải hiện vật của phòng {name}…", "Loading exhibits in {name}…"],
  ["ui.collection.loading.rooms", "Bộ sưu tập", "Đang tải danh sách phòng trưng bày…", "Loading galleries…"],
  ["ui.collection.loading.updated", "Bộ sưu tập", "Đang cập nhật hiện vật…", "Updating exhibits…"],
  ["ui.collection.report", "Bộ sưu tập", "Báo nội dung", "Report content"],
  ["ui.collection.rooms.label", "Bộ sưu tập", "Chọn phòng trưng bày", "Choose a gallery"],
  ["ui.collection.rooms.unavailable", "Bộ sưu tập", "Phòng không khả dụng", "Selected gallery is unavailable"],
  ["ui.collection.search.aria", "Bộ sưu tập", "Tìm kiếm hiện vật", "Search exhibits"],
  ["ui.collection.search.count.many", "Bộ sưu tập", "Tìm thấy {count} hiện vật ở phòng khác", "Found {count} exhibits in other galleries"],
  ["ui.collection.search.count.one", "Bộ sưu tập", "Tìm thấy {count} hiện vật ở phòng khác", "Found {count} exhibit in other galleries"],
  ["ui.collection.search.empty", "Bộ sưu tập", "Không có hiện vật khớp “{query}” ở phòng khác.", "No exhibits match “{query}” in other galleries."],
  ["ui.collection.search.error", "Bộ sưu tập", "Không tìm được ở các phòng khác", "Could not search other galleries"],
  ["ui.collection.search.loading", "Bộ sưu tập", "Đang tìm trong toàn bảo tàng…", "Searching the museum…"],
  ["ui.collection.search.more", "Bộ sưu tập", "Xem thêm kết quả", "Show more results"],
  ["ui.collection.search.results.aria", "Bộ sưu tập", "Kết quả ở các phòng khác", "Results in other galleries"],
  ["ui.collection.tour.room", "Bộ sưu tập", "Tham quan phòng này trong 3D", "Visit this gallery in 3D"],
  ["ui.detail.back", "Chi tiết hiện vật", "Quay lại bộ sưu tập của phòng này", "Back to this gallery’s collection"],
  ["ui.detail.back-to-collection", "Chi tiết hiện vật", "Về bộ sưu tập", "Back to collection"],
  ["ui.detail.description.empty", "Chi tiết hiện vật", "Chưa có mô tả.", "No description available."],
  ["ui.detail.error.exhibit.message", "Chi tiết hiện vật", "Hiện vật không có trong bộ sưu tập công khai của phòng này.", "This exhibit is not in the gallery’s public collection."],
  ["ui.detail.error.exhibit.title", "Chi tiết hiện vật", "Không tìm thấy hiện vật", "Exhibit not found"],
  ["ui.detail.error.invalid.message", "Chi tiết hiện vật", "Mã hiện vật trong đường dẫn không đúng định dạng.", "The exhibit ID in the URL is not valid."],
  ["ui.detail.error.invalid.title", "Chi tiết hiện vật", "Đường dẫn hiện vật không hợp lệ", "Invalid exhibit URL"],
  ["ui.detail.error.load", "Chi tiết hiện vật", "Không tải được nội dung", "Could not load content"],
  ["ui.detail.error.room.message", "Chi tiết hiện vật", "Phòng trong đường dẫn không có trong danh sách công khai.", "The gallery in this URL is not public."],
  ["ui.detail.error.room.title", "Chi tiết hiện vật", "Không tìm thấy phòng trưng bày", "Gallery not found"],
  ["ui.detail.loading.exhibit", "Chi tiết hiện vật", "Đang tải hiện vật…", "Loading exhibit…"],
  ["ui.detail.loading.rooms", "Chi tiết hiện vật", "Đang tải danh sách phòng…", "Loading galleries…"],
  ["ui.detail.loading.title", "Chi tiết hiện vật", "Chi tiết hiện vật", "Exhibit details"],
  ["ui.detail.report", "Chi tiết hiện vật", "Báo nội dung", "Report content"],
  ["ui.detail.retry", "Chi tiết hiện vật", "Thử lại", "Try again"],
  ["ui.detail.section.credits", "Chi tiết hiện vật", "Nguồn & bản quyền", "Sources & copyright"],
  ["ui.detail.section.hotspots", "Chi tiết hiện vật", "Điểm chú ý", "Points of interest"],
  ["ui.detail.section.hotspots.aria", "Chi tiết hiện vật", "Điểm chú ý của hiện vật", "Points of interest for this exhibit"],
  ["ui.detail.section.story", "Chi tiết hiện vật", "Câu chuyện hiện vật", "Exhibit story"],
  ["ui.detail.section.transcript", "Chi tiết hiện vật", "Bản thuyết minh", "Narration transcript"],
  ["ui.detail.tour", "Chi tiết hiện vật", "Xem trong không gian 3D", "View in 3D space"],
  ["ui.drawer.title", "Ngăn điều hướng", "Điều hướng", "Navigation"],
  ["ui.footer.accessibility", "Chân trang", "Cam kết tiếp cận WCAG 2.2 AA", "Accessibility commitment: WCAG 2.2 AA"],
  ["ui.footer.admin", "Chân trang", "Cổng Quản trị viên", "Administrator portal"],
  ["ui.footer.collection", "Chân trang", "Bộ sưu tập 2D", "2D Collection"],
  ["ui.footer.copyright", "Chân trang", "© 2026 Aura Museum · Dự án bảo tàng số · Nhóm ailabs26", "© 2026 Aura Museum · Digital museum project · ailabs26 team"],
  ["ui.footer.design-credit", "Chân trang", "Thiết kế theo Aura Design System 2.0", "Designed with Aura Design System 2.0"],
  ["ui.footer.explore", "Chân trang", "Khám phá", "Explore"],
  ["ui.footer.home", "Chân trang", "Trang chủ", "Home"],
  ["ui.footer.system", "Chân trang", "Hệ thống", "System"],
  ["ui.footer.tour", "Chân trang", "Tham quan 3D WebXR", "3D WebXR Tour"],
  ["ui.home.about.accessibility.description", "Trang chủ", "100% điều hướng bàn phím, tương phản đạt chuẩn và chế độ dự phòng 2D mượt mà khi thiết bị không hỗ trợ WebGL.", "Fully keyboard navigable, standards-compliant contrast, and a smooth 2D fallback when WebGL is unavailable."],
  ["ui.home.about.accessibility.title", "Trang chủ", "Tiếp cận toàn diện (WCAG 2.2 AA)", "Accessible to everyone (WCAG 2.2 AA)"],
  ["ui.home.about.audio.description", "Trang chủ", "Audio Player với phụ đề WebVTT song ngữ đồng bộ từng câu nói.", "Audio player with bilingual WebVTT subtitles synchronized to every sentence."],
  ["ui.home.about.audio.title", "Trang chủ", "Thuyết minh âm thanh & sóng nhạc động", "Audio guides with animated sound waves"],
  ["ui.home.about.eyebrow", "Trang chủ", "Về Aura Museum", "About Aura Museum"],
  ["ui.home.about.heritage.description", "Trang chủ", "Soi rõ hoa văn, chất liệu gốm sứ / đồng thau cùng các điểm chú thích thông minh.", "Explore ceramic and bronze patterns, materials, and smart annotations in detail."],
  ["ui.home.about.heritage.title", "Trang chủ", "Tái hiện di sản độ chi tiết cao", "High-detail heritage recreations"],
  ["ui.home.about.title.primary", "Trang chủ", "Không gian số.", "Digital spaces."],
  ["ui.home.about.title.secondary", "Trang chủ", "Kết nối thật.", "Real connection."],
  ["ui.home.about.webxr.description", "Trang chủ", "Dạo bước giữa phòng triển lãm 3D ngay trên trình duyệt. Tương thích kính VR (Quest, Pico, HTC Vive) và điều khiển linh hoạt WASD / cảm ứng.", "Walk through 3D exhibition rooms in your browser. Compatible with VR headsets (Quest, Pico, HTC Vive) and flexible WASD / touch controls."],
  ["ui.home.about.webxr.title", "Trang chủ", "Không gian thực tế ảo WebXR nhập vai", "Immersive WebXR virtual space"],
  ["ui.home.featured.description", "Trang chủ", "Một số hiện vật theo thứ tự trưng bày", "A selection of exhibits in display order"],
  ["ui.home.featured.empty-exhibits", "Trang chủ", "Phòng này chưa có hiện vật được xuất bản.", "This gallery has no published exhibits yet."],
  ["ui.home.featured.empty-rooms", "Trang chủ", "Chưa có phòng trưng bày công khai.", "No public galleries yet."],
  ["ui.home.featured.exhibits-error", "Trang chủ", "Không tải được hiện vật nổi bật", "Could not load featured exhibits"],
  ["ui.home.featured.eyebrow", "Trang chủ", "Từ bộ sưu tập", "From the collection"],
  ["ui.home.featured.loading-exhibits", "Trang chủ", "Đang tải hiện vật nổi bật…", "Loading featured exhibits…"],
  ["ui.home.featured.loading-rooms", "Trang chủ", "Đang tải danh sách phòng…", "Loading galleries…"],
  ["ui.home.featured.retry", "Trang chủ", "Thử lại", "Try again"],
  ["ui.home.featured.room-collection", "Trang chủ", "Xem bộ sưu tập của phòng này", "View this gallery’s collection"],
  ["ui.home.featured.rooms-error", "Trang chủ", "Không tải được danh sách phòng", "Could not load galleries"],
  ["ui.home.featured.title", "Trang chủ", "Hiện vật nổi bật", "Featured exhibits"],
  ["ui.home.hero.badge", "Trang chủ", "Bảo tàng số 3D WebXR thế hệ mới", "The next-generation 3D WebXR museum"],
  ["ui.home.hero.cta.collection", "Trang chủ", "Xem Danh mục Bộ sưu tập", "Browse the collection"],
  ["ui.home.hero.cta.tour", "Trang chủ", "Khám phá Không gian 3D (WebXR)", "Explore the 3D space"],
  ["ui.home.hero.introduction", "Trang chủ", "Bước vào không gian triển lãm 3D tương tác thực tế ảo, lắng nghe câu chuyện nghìn năm qua âm thanh thuyết minh sống động — ngay trên trình duyệt của bạn.", "Explore interactive 3D galleries and hear stories from history in your browser."],
  ["ui.home.hero.title.primary", "Trang chủ", "Chạm vào Di sản.", "Touch Heritage."],
  ["ui.home.hero.title.secondary", "Trang chủ", "Khám phá Không giới hạn.", "Explore without limits."],
  ["ui.home.showcase.tag", "Trang chủ", "Mô hình 3D tương tác", "Interactive 3D model"],
  ["ui.home.stats.audio", "Trang chủ", "Thuyết minh & Phụ đề", "Audio guide & subtitles"],
  ["ui.home.stats.audio-value", "Trang chủ", "Song ngữ", "Bilingual"],
  ["ui.home.stats.exploration", "Trang chủ", "Khám phá 3D & WebXR", "3D & WebXR exploration"],
  ["ui.home.stats.rooms", "Trang chủ", "Phòng trưng bày ảo", "Virtual galleries"],
  ["ui.home.stats.setup", "Trang chủ", "Không cần cài đặt", "No setup required"],
  ["ui.nav.main", "Điều hướng", "Điều hướng chính", "Main navigation"],
  ["ui.nav.open", "Điều hướng", "Mở menu điều hướng", "Open navigation menu"],
  ["ui.report.cancel", "Báo cáo nội dung", "Hủy", "Cancel"],
  ["ui.report.category", "Báo cáo nội dung", "Danh mục", "Category"],
  ["ui.report.category.placeholder", "Báo cáo nội dung", "Chọn danh mục", "Select a category"],
  ["ui.report.close", "Báo cáo nội dung", "Đóng biểu mẫu báo cáo", "Close report form"],
  ["ui.report.message", "Báo cáo nội dung", "Nội dung bổ sung", "Additional details"],
  ["ui.report.submit", "Báo cáo nội dung", "Gửi báo cáo", "Submit report"],
  ["ui.report.success", "Báo cáo nội dung", "Đã gửi báo cáo nội dung", "Report submitted"],
  ["ui.report.title", "Báo cáo nội dung", "Báo cáo nội dung", "Report content"],
  ["ui.report.category.wrong_info", "Danh mục báo cáo", "Sai thông tin", "Incorrect information"],
  ["ui.report.category.typo", "Danh mục báo cáo", "Lỗi chính tả", "Typo"],
  ["ui.report.category.inappropriate_content", "Danh mục báo cáo", "Ảnh/nội dung không phù hợp", "Inappropriate image/content"],
  ["ui.report.category.other", "Danh mục báo cáo", "Khác", "Other"],
  ["ui.report.validation.message-required", "Báo cáo nội dung", "Vui lòng nhập nội dung báo cáo.", "Please enter report details."],
  ["ui.report.validation.message-too-long", "Báo cáo nội dung", "Nội dung báo cáo không được vượt quá 2000 ký tự.", "Report details must not exceed 2000 characters."],
  ["ui.report.validation.category-required", "Báo cáo nội dung", "Vui lòng chọn danh mục báo cáo.", "Select a report category."],
  ["ui.media.credit.author", "Ghi công media", "Tác giả", "Author"],
  ["ui.media.credit.source", "Ghi công media", "Nguồn", "Source"],
  ["ui.media.credit.license", "Ghi công media", "Giấy phép", "License"],
  ["ui.media.type.model", "Ghi công media", "Mô hình 3D", "3D model"],
  ["ui.media.type.image", "Ghi công media", "Hình ảnh", "Image"],
  ["ui.media.type.narration.vi", "Ghi công media", "Thuyết minh tiếng Việt", "Vietnamese narration"],
  ["ui.media.type.narration.en", "Ghi công media", "Thuyết minh tiếng Anh", "English narration"],
  ["ui.media.type.subtitle.vi", "Ghi công media", "Phụ đề tiếng Việt", "Vietnamese subtitles"],
  ["ui.media.type.subtitle.en", "Ghi công media", "Phụ đề tiếng Anh", "English subtitles"],
  ["ui.theme.to-dark", "Giao diện", "Chuyển sang giao diện tối", "Switch to dark theme"],
  ["ui.theme.to-light", "Giao diện", "Chuyển sang giao diện sáng", "Switch to light theme"],
  ["ui.tour.camera.controls", "Tham quan 3D", "Điều khiển góc nhìn", "View controls"],
  ["ui.tour.camera.focus", "Tham quan 3D", "Tập trung hiện vật", "Focus exhibit"],
  ["ui.tour.camera.focus.title", "Tham quan 3D", "Tập trung hiện vật (F)", "Focus exhibit (F)"],
  ["ui.tour.camera.more", "Tham quan 3D", "Thêm điều khiển", "More controls"],
  ["ui.tour.camera.photo", "Tham quan 3D", "Chụp ảnh", "Take a photo"],
  ["ui.tour.camera.reset", "Tham quan 3D", "Góc nhìn ban đầu", "Initial view"],
  ["ui.tour.camera.reset.title", "Tham quan 3D", "Góc nhìn ban đầu (Home)", "Initial view (Home)"],
  ["ui.tour.camera.zoom.in", "Tham quan 3D", "Đến gần", "Zoom in"],
  ["ui.tour.camera.zoom.out", "Tham quan 3D", "Lùi xa", "Zoom out"],
  ["ui.tour.canvas.aria", "Tham quan 3D", "Phòng trưng bày 3D", "3D gallery view"],
  ["ui.tour.canvas.fallback", "Tham quan 3D", "Trình duyệt không hiển thị được canvas. Nội dung hiện vật vẫn có trong danh mục bên dưới.", "Your browser cannot display the canvas. Exhibit information remains available in the catalogue below."],
  ["ui.tour.catalogue.empty", "Tham quan 3D", "Phòng này chưa có hiện vật được xuất bản.", "This gallery has no published exhibits."],
  ["ui.tour.catalogue.exhibits", "Tham quan 3D", "Các hiện vật", "Exhibits"],
  ["ui.tour.catalogue.item", "Tham quan 3D", "Hiện vật {number}", "Exhibit {number}"],
  ["ui.tour.catalogue.models", "Tham quan 3D", "Các mô hình hiện vật có thể khám phá trong phòng 3D. Danh mục vẫn đọc được khi không dùng 3D.", "Exhibit models can be explored in 3D. The catalogue remains readable without 3D."],
  ["ui.tour.catalogue.outside", "Tham quan 3D", "Một số hiện vật chỉ có thể đọc trong danh mục bên dưới vì nằm ngoài phạm vi phòng 3D.", "Some exhibits are only available in the catalogue below because they are outside the 3D gallery."],
  ["ui.tour.catalogue.outside-room", "Tham quan 3D", "Hiện vật này nằm ngoài phạm vi phòng 3D. Bạn có thể đọc thông tin tại đây.", "This exhibit is outside the 3D gallery. You can read its information here."],
  ["ui.tour.catalogue.placeholders", "Tham quan 3D", "Chưa có ảnh hoặc mô hình 3D; đang hiển thị hình khối thay thế.", "There are no images or 3D models yet; placeholder shapes are shown."],
  ["ui.tour.catalogue.select", "Tham quan 3D", "Xem chi tiết", "View details"],
  ["ui.tour.catalogue.select.aria", "Tham quan 3D", "Xem chi tiết {name}", "View details for {name}"],
  ["ui.tour.catalogue.selected", "Tham quan 3D", "Đang xem chi tiết", "Viewing details"],
  ["ui.tour.catalogue.summary", "Tham quan 3D", "Danh mục hiện vật", "Exhibit catalogue"],
  ["ui.tour.catalogue.title", "Tham quan 3D", "Trong phòng trưng bày", "In the gallery"],
  ["ui.tour.controls.help", "Tham quan 3D", "Giữ và kéo chuột hoặc vuốt để nhìn · Joystick trái để đi trên thiết bị cảm ứng. Chọn hiện vật để xem chi tiết. Khi chọn khung 3D: WASD di chuyển, Shift đi nhanh, mũi tên xoay, +/− đến gần/lùi xa, F tập trung hiện vật đã chọn, Home về ban đầu. Escape đóng chi tiết · Tab để rời khung.", "Hold and drag or swipe to look · Left joystick to move on touch devices. Select an exhibit to see details. In the 3D view: WASD moves, Shift runs, arrow keys turn, +/− zoom, F focuses the selected exhibit, Home resets. Escape closes details · Tab leaves the view."],
  ["ui.tour.controls.help.short", "Tham quan 3D", "WASD di chuyển, kéo chuột hoặc vuốt để nhìn, F tập trung, Home đặt lại. Escape đóng chi tiết rồi thoát tham quan.", "WASD moves, drag or swipe to look, F focuses, Home resets. Escape closes details, then leaves the tour."],
  ["ui.tour.dialog.brand", "Tham quan 3D", "AURA MUSEUM / KHÔNG GIAN DI SẢN", "AURA MUSEUM / HERITAGE SPACE"],
  ["ui.tour.dialog.exit", "Tham quan 3D", "Thoát tham quan", "Exit tour"],
  ["ui.tour.dialog.label", "Tham quan 3D", "Tham quan bảo tàng", "Museum tour"],
  ["ui.tour.dock.focus", "Tham quan 3D", "Lia camera tới {name}", "Point camera at {name}"],
  ["ui.tour.dock.group", "Tham quan 3D", "Chọn nhanh hiện vật", "Quick exhibit selection"],
  ["ui.tour.empty", "Tham quan 3D", "Chưa có phòng trưng bày công khai.", "No public galleries yet."],
  ["ui.tour.error.loading.title", "Tham quan 3D", "Không tải được phòng trưng bày", "Could not load gallery"],
  ["ui.tour.error.room.title", "Tham quan 3D", "Không tải được phòng trưng bày", "Could not load gallery"],
  ["ui.tour.error.rooms.title", "Tham quan 3D", "Không tải được danh sách phòng", "Could not load galleries"],
  ["ui.tour.exhibit.invalid", "Tham quan 3D", "Mã hiện vật trong đường dẫn không hợp lệ.", "The exhibit ID in the URL is invalid."],
  ["ui.tour.exhibit.missing", "Tham quan 3D", "Không tìm thấy hiện vật trong phòng này.", "Exhibit not found in this gallery."],
  ["ui.tour.eyebrow", "Tham quan 3D", "Aura / Tham quan bảo tàng", "AURA / MUSEUM TOUR"],
  ["ui.tour.fallback.catalogue", "Tham quan 3D", "Đọc nội dung phòng trưng bày", "Read the gallery catalogue"],
  ["ui.tour.fallback.description", "Tham quan 3D", "Thiết bị có thể không hỗ trợ WebGL hoặc phần hiển thị chưa tải được.", "Your device may not support WebGL, or the view may not have loaded."],
  ["ui.tour.fallback.exhausted", "Tham quan 3D", "Đã hết lượt thử 3D. Bạn vẫn có thể đọc toàn bộ nội dung 2D.", "No 3D attempts remain. You can still read all 2D content."],
  ["ui.tour.fallback.read2d", "Tham quan 3D", "Tiếp tục đọc trong giao diện 2D", "Continue reading in the 2D view"],
  ["ui.tour.fallback.retries", "Tham quan 3D", "Còn {count} lượt thử 3D trong lần tham quan này.", "{count} 3D attempts remain in this visit."],
  ["ui.tour.fallback.retry", "Tham quan 3D", "Thử lại 3D", "Retry 3D"],
  ["ui.tour.fallback.title", "Tham quan 3D", "Không thể mở không gian 3D", "Could not open 3D gallery"],
  ["ui.tour.hotspot.aria", "Tham quan 3D", "Điểm tương tác {name}", "Interactive point {name}"],
  ["ui.tour.hotspot.select", "Tham quan 3D", "Chọn để khám phá", "Select to explore"],
  ["ui.tour.hotspots.group", "Tham quan 3D", "Điểm tương tác hiện vật", "Exhibit interactive points"],
  ["ui.tour.hotspots.summary", "Tham quan 3D", "Điểm tương tác", "Interactive points"],
  ["ui.tour.intro.description", "Tham quan 3D", "Khám phá {name} trong không gian 3D.", "Explore {name} in 3D space."],
  ["ui.tour.intro.eyebrow", "Tham quan 3D", "KHÔNG GIAN KHÁM PHÁ", "DISCOVER"],
  ["ui.tour.intro.title", "Tham quan 3D", "Bước vào phòng trưng bày", "Step into the gallery"],
  ["ui.tour.lead", "Tham quan 3D", "Nội dung bảo tàng đã xuất bản", "Published museum content"],
  ["ui.tour.loading.room", "Tham quan 3D", "Đang tải phòng trưng bày…", "Loading gallery…"],
  ["ui.tour.loading.rooms", "Tham quan 3D", "Đang tải danh sách phòng…", "Loading galleries…"],
  ["ui.tour.minimap.go", "Tham quan 3D", "Đi tới {name}", "Go to {name}"],
  ["ui.tour.minimap.group", "Tham quan 3D", "Sơ đồ mặt bằng phòng trưng bày", "Gallery floor plan"],
  ["ui.tour.minimap.svg", "Tham quan 3D", "Sơ đồ {count} hiện vật trong phòng", "Map of {count} exhibits in the gallery"],
  ["ui.tour.minimap.title", "Tham quan 3D", "Sơ đồ phòng", "Gallery map"],
  ["ui.tour.model.cooldown", "Tham quan 3D", "Vui lòng chờ trước khi thử lại.", "Wait before trying again."],
  ["ui.tour.model.error", "Tham quan 3D", "Không tải được mô hình: {name}. {error}", "Could not load model: {name}. {error}"],
  ["ui.tour.model.failure.download", "Tham quan 3D", "Không tải được mô hình. Vui lòng thử lại.", "The 3D model could not be downloaded. Please try again."],
  ["ui.tour.model.failure.format", "Tham quan 3D", "Tệp mô hình bị hỏng hoặc có định dạng chưa hỗ trợ.", "The 3D model file is corrupted or uses an unsupported format."],
  ["ui.tour.model.exhausted", "Tham quan 3D", "Đã hết lượt thử. Vui lòng mở lại 3D hoặc liên hệ quản trị.", "No retries left. Reopen 3D or contact an administrator."],
  ["ui.tour.model.loaded", "Tham quan 3D", "Đã tải {ready}/{total} mô hình 3D", "Loaded {ready}/{total} 3D models"],
  ["ui.tour.model.loading", "Tham quan 3D", "Đang tải mô hình 3D", "Loading 3D model"],
  ["ui.tour.model.placeholder", "Tham quan 3D", "Hình khối minh họa cho hiện vật chưa có mô hình", "Placeholder shapes stand in for exhibits without a model"],
  ["ui.tour.model.progress", "Tham quan 3D", "Tiến độ tải mô hình", "Model loading progress"],
  ["ui.tour.model.read", "Tham quan 3D", "Chọn để đọc thông tin hiện vật", "Select to read about this exhibit"],
  ["ui.tour.model.render-error", "Tham quan 3D", "Lỗi hiển thị mô hình.", "Model rendering error."],
  ["ui.tour.model.retries", "Tham quan 3D", "Còn {count} lượt thử.", "{count} attempts left."],
  ["ui.tour.model.retry", "Tham quan 3D", "Thử lại {name}", "Retry {name}"],
  ["ui.tour.model.status", "Tham quan 3D", "Trạng thái mô hình 3D", "3D model status"],
  ["ui.tour.model.unavailable", "Tham quan 3D", "Mô hình 3D không khả dụng", "3D model unavailable"],
  ["ui.tour.navigation.help.hide", "Tham quan 3D", "Ẩn hướng dẫn", "Hide instructions"],
  ["ui.tour.navigation.help.show", "Tham quan 3D", "Hướng dẫn di chuyển", "Movement instructions"],
  ["ui.tour.navigation.joystick", "Tham quan 3D", "Di chuyển bằng joystick", "Move with joystick"],
  ["ui.tour.navigation.keyboard", "Tham quan 3D", "WASD để đi · Giữ và kéo chuột để nhìn · Shift đi nhanh · F tập trung · Home đặt lại", "WASD moves · Hold and drag to look · Shift runs · F focuses · Home resets"],
  ["ui.tour.navigation.status.focusing", "Tham quan 3D", "Đang tập trung hiện vật", "Focusing exhibit"],
  ["ui.tour.navigation.status.idle", "Tham quan 3D", "Chọn khung 3D để bắt đầu di chuyển", "Select the 3D view to start moving"],
  ["ui.tour.navigation.status.inspect", "Tham quan 3D", "Đang xem hiện vật · Di chuyển để khám phá tiếp", "Viewing exhibit · Move to keep exploring"],
  ["ui.tour.navigation.status.ready", "Tham quan 3D", "Sẵn sàng khám phá", "Ready to explore"],
  ["ui.tour.navigation.status.touch", "Tham quan 3D", "Chạm joystick hoặc vuốt để khám phá", "Touch the joystick or swipe to explore"],
  ["ui.tour.navigation.touch", "Tham quan 3D", "Joystick trái để đi · Vuốt vùng nhìn bên phải để quay · Chạm hiện vật để xem", "Use the left joystick to move · Swipe the right view area to turn · Tap an exhibit to see it"],
  ["ui.tour.open", "Tham quan 3D", "Mở phòng 3D", "Open 3D gallery"],
  ["ui.tour.panel.close", "Tham quan 3D", "Đóng chi tiết hiện vật", "Close exhibit details"],
  ["ui.tour.panel.close.action", "Tham quan 3D", "Đóng", "Close"],
  ["ui.tour.panel.credits", "Tham quan 3D", "Nguồn & bản quyền", "Sources & copyright"],
  ["ui.tour.panel.credits.aria", "Tham quan 3D", "Nguồn và bản quyền", "Sources and copyright"],
  ["ui.tour.panel.description", "Tham quan 3D", "Mô tả hiện vật", "Exhibit description"],
  ["ui.tour.panel.empty", "Tham quan 3D", "Chưa có mô tả.", "No description available."],
  ["ui.tour.panel.help", "Tham quan 3D", "Escape để đóng · Chọn hiện vật khác để tiếp tục khám phá", "Press Escape to close · Select another exhibit to keep exploring"],
  ["ui.tour.panel.hotspots", "Tham quan 3D", "Điểm chú ý", "Points of interest"],
  ["ui.tour.panel.label", "Tham quan 3D", "Chi tiết hiện vật", "Exhibit details"],
  ["ui.tour.panel.model", "Tham quan 3D", "Khám phá mô hình hiện vật trong phòng 3D.", "Explore the exhibit model in the 3D gallery."],
  ["ui.tour.panel.outside-room", "Tham quan 3D", "Hiện vật nằm ngoài phạm vi phòng 3D. Thông tin vẫn có thể đọc tại đây.", "This exhibit is outside the 3D gallery. You can still read its information here."],
  ["ui.tour.panel.read2d", "Tham quan 3D", "Đọc chi tiết 2D", "Read 2D details"],
  ["ui.tour.panel.report", "Tham quan 3D", "Báo nội dung", "Report content"],
  ["ui.tour.panel.story", "Tham quan 3D", "Câu chuyện hiện vật", "Exhibit story"],
  ["ui.tour.panel.transcript", "Tham quan 3D", "Bản thuyết minh", "Narration transcript"],
  ["ui.tour.panel.viewing", "Tham quan 3D", "Đang xem", "Viewing"],
  ["ui.tour.photo.error", "Tham quan 3D", "Chưa chụp được ảnh. Hãy thử lại sau khi khung 3D hiển thị xong.", "Could not take a photo. Try again after the 3D view finishes loading."],
  ["ui.tour.photo.success", "Tham quan 3D", "Đã lưu ảnh kỷ niệm không gian 3D", "Saved a 3D gallery photo"],
  ["ui.tour.readable", "Tham quan 3D", "Bạn cũng có thể đọc toàn bộ nội dung ngay bên dưới.", "You can also read everything below."],
  ["ui.tour.refresh", "Tham quan 3D", "Làm mới", "Refresh"],
  ["ui.tour.retry", "Tham quan 3D", "Thử lại", "Try again"],
  ["ui.tour.room.missing", "Tham quan 3D", "Phòng được chọn không có trong danh sách công khai. Hãy chọn phòng khác.", "The selected gallery is not public. Choose another gallery."],
  ["ui.tour.room.page", "Tham quan 3D", "Phòng trưng bày (trang)", "Gallery page"],
  ["ui.tour.room.select", "Tham quan 3D", "Chọn phòng trưng bày", "Select gallery"],
  ["ui.tour.room.unavailable", "Tham quan 3D", "Phòng không khả dụng", "Gallery unavailable"],
  ["ui.tour.room.unavailable.message", "Tham quan 3D", "Phòng này không còn trong danh sách công khai. Hãy chọn phòng khác hoặc thoát tham quan.", "This gallery is no longer public. Choose another gallery or leave the tour."],
  ["ui.tour.room.unavailable.title", "Tham quan 3D", "Phòng không khả dụng", "Gallery unavailable"],
  ["ui.tour.room.updating", "Tham quan 3D", "Đang cập nhật phòng…", "Updating gallery…"],
  ["ui.tour.scene.loading", "Tham quan 3D", "Đang mở phòng 3D…", "Opening 3D gallery…"],
  ["ui.tour.scene.recovering", "Tham quan 3D", "Đang khôi phục không gian 3D. Bạn có thể tiếp tục đọc danh mục.", "Restoring the 3D gallery. You can keep reading the catalogue."],
  ["ui.tour.scene.restart", "Tham quan 3D", "Đang khởi tạo lại phần hiển thị sau lỗi VR.", "Restarting the view after a VR error…"],
  ["ui.tour.summary.exhibits", "Tham quan 3D", "{count} hiện vật", "{count} exhibits"],
  ["ui.tour.summary.models", "Tham quan 3D", "Mở phòng 3D để khám phá mô hình hiện vật", "Open 3D to explore exhibit models"],
  ["ui.tour.summary.placeholders", "Tham quan 3D", "Hình khối thay thế cho ảnh hoặc mô hình chưa khả dụng", "Placeholder shapes stand in for unavailable images or models"],
  ["ui.tour.title", "Tham quan 3D", "Tham quan bảo tàng", "Museum tour"],
  ["ui.tour.vr.checking", "Tham quan 3D", "Đang kiểm tra VR…", "Checking VR…"],
  ["ui.tour.vr.enter", "Tham quan 3D", "Enter VR", "Enter VR"],
  ["ui.tour.vr.enter.error", "Tham quan 3D", "Không thể vào VR. Bạn vẫn có thể tham quan 3D và thử lại.", "Could not start VR. You can still explore in 3D and try again."],
  ["ui.tour.vr.entering", "Tham quan 3D", "Đang vào VR…", "Starting VR…"],
  ["ui.tour.vr.exit", "Tham quan 3D", "Exit VR", "Exit VR"],
  ["ui.tour.vr.exit-error", "Tham quan 3D", "Hãy dùng nút thoát VR của thiết bị hoặc thử thoát lại.", "Use the headset’s exit button or try leaving VR again."],
  ["ui.tour.vr.instructions", "Tham quan 3D", "Ngắm điểm tương tác và bóp cò để chọn hiện vật. Ngắm sàn trống và bóp cò để dịch chuyển (tối đa 8 m, đường thẳng không bị bệ chắn). Cần điều khiển bên phải: xoay từng bước 30°.\n\nKhông có controller: nhìn giữ 1,5 giây để chọn hoặc dùng thao tác chọn của thiết bị. Nhìn giữ không tự dịch chuyển.", "Look at an interactive point and press the trigger to select an exhibit. Look at empty floor and press the trigger to teleport (up to 8 m, with no plinth in the way). Use the right controller stick to turn in 30° steps.\n\nWithout controllers: gaze for 1.5 seconds to select, or use your device’s selection action. Gaze does not teleport."],
  ["ui.tour.vr.instructions.title", "Tham quan 3D", "Tham quan VR", "VR tour"],
  ["ui.tour.vr.page.exit", "Tham quan 3D", "Thoát VR", "Exit VR"],
  ["ui.tour.vr.page.next", "Tham quan 3D", "Sau", "Next"],
  ["ui.tour.vr.page.previous", "Tham quan 3D", "Trước", "Previous"],
  ["ui.tour.vr.unavailable", "Tham quan 3D", "VR không khả dụng trong trình duyệt hoặc thiết bị này. Bạn vẫn có thể tham quan 3D.", "VR is not available in this browser or device. You can still explore in 3D."],
  ["ui.visitor.compare.clear", "Công cụ khách tham quan", "Xóa lựa chọn so sánh", "Clear comparison selection"],
  ["ui.visitor.compare.description", "Công cụ khách tham quan", "Mô tả", "Description"],
  ["ui.visitor.compare.instructions", "Công cụ khách tham quan", "Chọn 2–3 hiện vật, có thể từ các phòng khác nhau.", "Choose 2–3 exhibits, including exhibits from different galleries."],
  ["ui.visitor.compare.insufficient", "Công cụ khách tham quan", "Không còn đủ 2 hiện vật công khai để so sánh.", "At least 2 public exhibits are needed to compare."],
  ["ui.visitor.compare.load-error", "Công cụ khách tham quan", "Không tải được một số nội dung. Dùng Làm mới để thử lại.", "Could not load some content. Use Refresh to try again."],
  ["ui.visitor.compare.loading", "Công cụ khách tham quan", "Đang kiểm tra nội dung so sánh…", "Checking comparison content…"],
  ["ui.visitor.compare.message.added", "Công cụ khách tham quan", "Đã thêm hiện vật vào so sánh.", "Added to comparison."],
  ["ui.visitor.compare.message.cleared", "Công cụ khách tham quan", "Đã xóa lựa chọn so sánh.", "Comparison selection cleared."],
  ["ui.visitor.compare.message.maximum", "Công cụ khách tham quan", "Tối đa 3 hiện vật. Hãy bỏ một lựa chọn trước khi thêm.", "You can compare up to 3 exhibits. Remove one before adding another."],
  ["ui.visitor.compare.message.removed", "Công cụ khách tham quan", "Đã bỏ hiện vật khỏi so sánh.", "Removed from comparison."],
  ["ui.visitor.compare.missing", "Công cụ khách tham quan", "Hiện vật không khả dụng", "Exhibit unavailable"],
  ["ui.visitor.compare.modal.close", "Công cụ khách tham quan", "Đóng so sánh", "Close comparison"],
  ["ui.visitor.compare.modal.title", "Công cụ khách tham quan", "So sánh hiện vật", "Compare exhibits"],
  ["ui.visitor.compare.no-description", "Công cụ khách tham quan", "Chưa có mô tả.", "No description yet."],
  ["ui.visitor.compare.open", "Công cụ khách tham quan", "Mở so sánh ({count})", "Open comparison ({count})"],
  ["ui.visitor.compare.region", "Công cụ khách tham quan", "Nội dung so sánh, cuộn ngang trên màn hình nhỏ", "Comparison content, scroll horizontally on small screens"],
  ["ui.visitor.compare.remove", "Công cụ khách tham quan", "Bỏ", "Remove"],
  ["ui.visitor.compare.remove.aria", "Công cụ khách tham quan", "Bỏ so sánh {name}", "Remove {name} from comparison"],
  ["ui.visitor.compare.resolving", "Công cụ khách tham quan", "Đang xác minh hiện vật", "Verifying exhibit"],
  ["ui.visitor.compare.status", "Công cụ khách tham quan", "Trạng thái so sánh", "Comparison status"],
  ["ui.visitor.compare.title", "Công cụ khách tham quan", "Lựa chọn so sánh", "Comparison selections"],
  ["ui.visitor.favorite.add", "Công cụ khách tham quan", "Yêu thích", "Add to favorites"],
  ["ui.visitor.favorite.aria-add", "Công cụ khách tham quan", "Thêm {name} vào yêu thích", "Add {name} to favorites"],
  ["ui.visitor.favorite.aria-remove", "Công cụ khách tham quan", "Bỏ yêu thích {name}", "Remove {name} from favorites"],
  ["ui.visitor.favorite.saved", "Công cụ khách tham quan", "Đã yêu thích", "Favorited"],
  ["ui.visitor.notes.clear", "Công cụ khách tham quan", "Xóa ghi chú", "Delete note"],
  ["ui.visitor.notes.count", "Công cụ khách tham quan", "{count}/2000 ký tự · Tự động lưu khi nhập.", "{count}/2000 characters · Saved automatically as you type."],
  ["ui.visitor.notes.description", "Công cụ khách tham quan", "Ghi chú chỉ được lưu trên trình duyệt này", "Notes are stored only in this browser"],
  ["ui.visitor.notes.empty", "Công cụ khách tham quan", "Chưa có ghi chú.", "No note yet."],
  ["ui.visitor.notes.full", "Công cụ khách tham quan", "Đã đủ 100 ghi chú. Hãy xóa một ghi chú ở hiện vật khác trước khi tạo mới.", "You have 100 notes. Delete a note from another exhibit before creating a new one."],
  ["ui.visitor.notes.label", "Công cụ khách tham quan", "Ghi chú của bạn", "Your note"],
  ["ui.visitor.notes.retry", "Công cụ khách tham quan", "Thử lưu lại ghi chú", "Try saving note again"],
  ["ui.visitor.notes.saved", "Công cụ khách tham quan", "Đã lưu ghi chú trên trình duyệt.", "Note saved in this browser."],
  ["ui.visitor.notes.section", "Công cụ khách tham quan", "Ghi chú riêng", "Private notes"],
  ["ui.visitor.notes.status.aria", "Công cụ khách tham quan", "Trạng thái ghi chú", "Note status"],
  ["ui.visitor.notes.unsaved", "Công cụ khách tham quan", "Ghi chú chưa được lưu trên trình duyệt.", "Note is not saved in this browser."],
  ["ui.visitor.reading.decrease", "Công cụ khách tham quan", "Giảm cỡ chữ", "Decrease text size"],
  ["ui.visitor.reading.increase", "Công cụ khách tham quan", "Tăng cỡ chữ", "Increase text size"],
  ["ui.visitor.reading.reset", "Công cụ khách tham quan", "Đặt lại chế độ đọc", "Reset reading preferences"],
  ["ui.visitor.reading.section", "Công cụ khách tham quan", "Tùy chọn đọc hiện vật", "Exhibit reading preferences"],
  ["ui.visitor.reading.size", "Công cụ khách tham quan", "Cỡ chữ {percent}%", "Text size {percent}%"],
  ["ui.visitor.reading.size.aria", "Công cụ khách tham quan", "Cỡ chữ đọc", "Reading text size"],
  ["ui.visitor.reading.toggle", "Công cụ khách tham quan", "Chế độ đọc", "Reading mode"],
  ["ui.visitor.recent.clear", "Công cụ khách tham quan", "Xóa lịch sử", "Clear history"],
  ["ui.visitor.recent.continue", "Công cụ khách tham quan", "Tiếp tục khám phá: {exhibit} — {room}", "Continue exploring: {exhibit} — {room}"],
  ["ui.visitor.recent.empty", "Công cụ khách tham quan", "Chưa có hiện vật đã xem.", "No recently viewed exhibits yet."],
  ["ui.visitor.recent.loading", "Công cụ khách tham quan", "Đang kiểm tra hiện vật gần đây…", "Checking recently viewed exhibits…"],
  ["ui.visitor.recent.missing", "Công cụ khách tham quan", "Một số hiện vật không còn khả dụng hoặc chưa xác minh được.", "Some exhibits are no longer available or could not be verified."],
  ["ui.visitor.recent.reload-help", "Công cụ khách tham quan", "Hãy dùng Làm mới để thử tải lại nội dung công khai.", "Use Refresh to load public content again."],
  ["ui.visitor.recent.rooms-unavailable", "Công cụ khách tham quan", "Chưa xác minh được danh sách công khai.", "The public gallery list could not be verified."],
  ["ui.visitor.recent.title", "Công cụ khách tham quan", "Đã xem gần đây", "Recently viewed"],
  ["ui.visitor.storage.invalid", "Công cụ khách tham quan", "Dữ liệu đã lưu không hợp lệ hoặc thuộc phiên bản khác. Đang dùng giá trị mặc định.", "Saved data is invalid or from another version. Using defaults."],
  ["ui.visitor.storage.limit", "Công cụ khách tham quan", "Đã đạt giới hạn lưu trữ. Hãy xóa bớt mục trước khi thêm.", "Storage is full. Remove an item before adding another."],
  ["ui.visitor.storage.unavailable", "Công cụ khách tham quan", "Không thể lưu trên trình duyệt. Thay đổi chỉ giữ trong trang đang mở và có thể mất khi tải lại.", "This browser cannot save changes. They may be lost when you reload."],
];

/** Thêm chuỗi còn thiếu, không ghi đè bản dịch Admin đã sửa (chạy lại an toàn). */
async function seedPublicUiStrings(): Promise<void> {
  const repo = dataSource.getRepository(Translation);
  await repo.createQueryBuilder().insert().values(PUBLIC_UI_STRINGS.map(([namespace, context, vi, en]) => ({
    namespace, context, category: 'ui' as const, values: { vi, en },
  }))).orIgnore().execute();
}

/** Dữ liệu mẫu CMS i18n — chỉ seed khi bảng trống (idempotent). */
async function seedTranslations(): Promise<void> {
  const repo = dataSource.getRepository(Translation);
  if ((await repo.count()) > 0) return;
  await repo.save([
    repo.create({
      namespace: 'exhibit.trong-dong-dong-son.name', category: 'exhibit',
      context: 'Tên hiện vật hiển thị trên thẻ và trang chi tiết',
      values: { vi: 'Trống đồng Đông Sơn', en: 'Dong Son Bronze Drum' },
    }),
    repo.create({
      namespace: 'exhibit.trong-dong-dong-son.description', category: 'exhibit',
      context: 'Mô tả ngắn hiện vật (1-2 câu)',
      values: {
        vi: 'Bảo vật biểu trưng cho văn minh Đông Sơn, niên đại khoảng 2.500 năm.',
        en: 'A treasure symbolizing the Dong Son civilization, dated to around 2,500 years ago.',
      },
    }),
    repo.create({
      namespace: 'ui.cta.explore-3d', category: 'ui',
      context: 'Nút kêu gọi vào không gian 3D ở trang chủ',
      values: { vi: 'Khám phá Không gian 3D', en: 'Explore the 3D Space', fr: 'Explorer l’espace 3D' },
    }),
    repo.create({
      namespace: 'ui.collection.empty', category: 'ui',
      context: 'Thông báo khi phòng chưa có hiện vật',
      values: { vi: 'Phòng này chưa có hiện vật được xuất bản.' },
    }),
  ]);
  console.log('  + 4 chuỗi dịch mẫu');
}

/** Dữ liệu mẫu API key đối tác — khóa thô bị loại bỏ, chỉ giữ hash + phần che. */
async function seedPartnerApiKeys(): Promise<void> {
  const repo = dataSource.getRepository(PartnerApiKey);
  if ((await repo.count()) > 0) return;
  const makeHash = () => {
    const token = randomBytes(24).toString('hex');
    return { hash: createHash('sha256').update('ak_live_' + token).digest('hex'), last4: token.slice(-4) };
  };
  const a = makeHash();
  const b = makeHash();
  await repo.save([
    repo.create({
      partnerName: 'VietnamPlus', label: 'Nhúng tour cho báo điện tử',
      scopes: ['public:read', 'exhibits:read', 'tour:embed'], status: 'active',
      keyPrefix: 'ak_live_', keyHash: a.hash, last4: a.last4,
      expiresAt: new Date(Date.now() + 323 * 86_400_000), lastUsedAt: new Date(), revokedAt: null,
    }),
    repo.create({
      partnerName: 'EduTech Labs', label: 'Tích hợp giáo trình số',
      scopes: ['public:read', 'media:read', 'analytics:read'], status: 'active',
      keyPrefix: 'ak_live_', keyHash: b.hash, last4: b.last4,
      expiresAt: null, lastUsedAt: null, revokedAt: null,
    }),
  ]);
  console.log('  + 2 API key đối tác mẫu');
}

async function run(): Promise<void> {
  await dataSource.initialize();
  console.log('Seed: permissions...');
  const permissions = await seedPermissions();
  console.log('Seed: roles + role_permissions...');
  const roles = await seedRoles(permissions);
  console.log('Seed: admin đầu tiên...');
  await seedAdmin(roles);
  console.log('Seed: dữ liệu CMS mẫu (i18n + API key)...');
  await seedTranslations();
  await seedPublicUiStrings();
  await seedPartnerApiKeys();
  await dataSource.destroy();
  console.log('Seed xong.');
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Seed lỗi:', error);
    process.exitCode = 1;
  });
}
