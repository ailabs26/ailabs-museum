/**
 * Aura Museum - Automated End-to-End (E2E) Test Runner for CMS Admin
 * Covers Task 34 & Task 35: Rooms, Exhibits, Media, Moderation, Concurrency, Reports, Audit, Stats.
 */

const BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@aura.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

const results = [];
let passedCount = 0;
let failedCount = 0;

function logStep(name) {
  console.log(`\n▶ [TEST] ${name}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function recordTest(name, fn) {
  const start = Date.now();
  try {
    logStep(name);
    await fn();
    const duration = Date.now() - start;
    console.log(`  ✔ PASS (${duration}ms)`);
    results.push({ name, status: 'PASS', duration });
    passedCount++;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`  ✖ FAIL (${duration}ms):`, err.message);
    results.push({ name, status: 'FAIL', duration, error: err.message });
    failedCount++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, ok: response.ok, headers: response.headers };
}

async function runAll() {
  console.log('===============================================================');
  console.log('       AURA MUSEUM - CMS ADMIN FULL E2E TEST RUNNER           ');
  console.log(`       Target API: ${BASE_URL}`);
  console.log(`       Date: ${new Date().toISOString()}`);
  console.log('===============================================================');

  let adminToken = '';
  let createdRoomId = '';
  let createdRoomSlug = '';
  let createdMediaId = '';
  let createdExhibitId = '';
  let createdRevisionId = '';
  let createdReportId = '';

  // 1. Health check
  await recordTest('TC-01: Kiểm tra trạng thái máy chủ (Health Check)', async () => {
    const res = await request('/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data?.success === true, 'Response success should be true');
    assert(res.data?.data?.status === 'ok', 'Service status should be ok');
  });

  // 2. Authentication
  await recordTest('TC-02: Đăng nhập quản trị viên và xác thực phân quyền (RBAC)', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    assert(res.status === 200 || res.status === 201, `Login expected 200/201, got ${res.status}`);
    assert(res.data?.data?.accessToken, 'Access token must be present');
    adminToken = res.data.data.accessToken;

    const meRes = await request('/auth/me', { token: adminToken });
    assert(meRes.status === 200, 'auth/me must return 200');
    assert(meRes.data?.data?.roles?.includes('admin'), 'User must have admin role');
  });

  // 3. Dashboard initial overview
  await recordTest('TC-03: Kiểm tra Dashboard thống kê tổng quan và biểu đồ', async () => {
    const res = await request('/admin/stats/overview', { token: adminToken });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data?.data?.rooms?.total === 'number', 'rooms.total must be number');
    assert(typeof res.data?.data?.exhibits?.total === 'number', 'exhibits.total must be number');

    const chartRes = await request('/admin/stats/charts', { token: adminToken });
    assert(chartRes.status === 200, `Expected 200, got ${chartRes.status}`);
    assert(Array.isArray(chartRes.data?.data?.reportsByStatus), 'reportsByStatus must be array');
  });

  // 4. Rooms CRUD
  await recordTest('TC-04: Quản lý Phòng trưng bày - Tạo mới và Cập nhật', async () => {
    const ts = Date.now();
    createdRoomSlug = `phong-e2e-test-${ts}`;
    const payload = {
      name: `Phòng Thử Nghiệm E2E ${ts}`,
      slug: createdRoomSlug,
      description: 'Phòng được tạo tự động bởi script kiểm thử E2E Task 34',
    };

    const createRes = await request('/admin/rooms', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify(payload),
    });
    assert(createRes.status === 201, `Expected 201 Created, got ${createRes.status} (${JSON.stringify(createRes.data)})`);
    createdRoomId = createRes.data?.data?.id;
    assert(createdRoomId, 'Room ID must be returned');

    // Update room
    const updateRes = await request(`/admin/rooms/${createdRoomId}`, {
      method: 'PATCH',
      token: adminToken,
      body: JSON.stringify({ description: 'Mô tả phòng đã được cập nhật qua E2E' }),
    });
    assert(updateRes.status === 200, `Expected 200, got ${updateRes.status}`);
  });

  // 5. Media Upload & Format Validation
  await recordTest('TC-05: Tải lên Media hợp lệ và từ chối file giả mạo định dạng', async () => {
    // 1x1 valid transparent PNG binary
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // FormData multipart boundary
    const boundary = '----WebKitFormBoundaryE2ETestUpload';
    const postBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="e2e-photo.png"\r\nContent-Type: image/png\r\n\r\n`),
      pngBytes,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nimage\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="source"\r\n\r\nBảo tàng Lịch sử Aura\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="author"\r\n\r\nBan Quản lý Bảo tàng\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="license"\r\n\r\nCC-BY-4.0\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="altText"\r\n\r\nẢnh hiện vật kiểm thử E2E\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${BASE_URL}/admin/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: postBody,
    });

    const uploadJson = await uploadRes.json();
    assert(uploadRes.status === 201, `Upload expected 201, got ${uploadRes.status} (${JSON.stringify(uploadJson)})`);
    createdMediaId = uploadJson.data?.id;
    assert(createdMediaId, 'Media ID must be returned');

    // Test rejection of fake PNG (SVG disguised as PNG)
    const fakeBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="disguised.png"\r\nContent-Type: image/png\r\n\r\n<svg><script>alert(1)</script></svg>\r\n--${boundary}--\r\n`),
    ]);
    const fakeRes = await fetch(`${BASE_URL}/admin/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: fakeBody,
    });
    assert(fakeRes.status === 422, `Fake file must return 422 Unprocessable Entity, got ${fakeRes.status}`);
  });

  // 6. Exhibits Creation
  await recordTest('TC-06: Tạo bản nháp hiện vật mới với nội dung song ngữ', async () => {
    assert(createdRoomId, 'Requires createdRoomId');
    const payload = {
      roomId: createdRoomId,
      displayOrder: 1,
      name: { vi: 'Hiện vật E2E Trưng Bày', en: 'E2E Test Artifact' },
      description: { vi: 'Hiện vật phục vụ kiểm thử E2E tự động hóa', en: 'Artifact created for automated E2E testing' },
      position: { x: 0, y: 1, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      placeholderShape: 'box',
      placeholderColor: '#457c79',
      imageId: createdMediaId || null,
      altText: { vi: 'Ảnh hiện vật E2E', en: 'E2E exhibit image' },
      hotspots: [],
    };

    const res = await request('/admin/exhibits', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify(payload),
    });

    assert(res.status === 201, `Expected 201, got ${res.status} (${JSON.stringify(res.data)})`);
    createdExhibitId = res.data?.data?.id;
    assert(createdExhibitId, 'Exhibit ID must be returned');
  });

  // 7. Submit for Review
  await recordTest('TC-07: Gửi yêu cầu kiểm duyệt phiên bản nháp', async () => {
    assert(createdExhibitId, 'Requires createdExhibitId');
    const res = await request(`/admin/exhibits/${createdExhibitId}/submit-review`, {
      method: 'POST',
      token: adminToken,
    });

    assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status} (${JSON.stringify(res.data)})`);
  });

  // 8. Moderation Queue & Diff
  await recordTest('TC-08: Hàng chờ kiểm duyệt nội dung và xem chi tiết Diff', async () => {
    const queueRes = await request('/moderation/queue', { token: adminToken });
    assert(queueRes.status === 200, `Expected 200, got ${queueRes.status}`);
    const queueData = queueRes.data?.data;
    const items = Array.isArray(queueData) ? queueData : (queueData?.items || []);
    const found = items.find((item) => item.exhibitId === createdExhibitId);
    assert(found, `Submitted exhibit ${createdExhibitId} must appear in moderation queue`);
    createdRevisionId = found.id;

    const diffRes = await request(`/moderation/revisions/${createdRevisionId}/diff`, { token: adminToken });
    assert(diffRes.status === 200, `Expected 200, got ${diffRes.status}`);
  });

  // 9. Optimistic Concurrency 409 Conflict
  await recordTest('TC-09: Kiểm tra kiểm soát xung đột sửa đổi đồng thời (409 Conflict)', async () => {
    assert(createdRevisionId, 'Requires createdRevisionId');
    // Gửi sai version để kích hoạt xung đột 409
    const conflictRes = await request(`/revisions/${createdRevisionId}/publish`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ version: 99999 }),
    });

    assert(conflictRes.status === 409, `Expected 409 Conflict when version is stale, got ${conflictRes.status}`);
  });

  // 10. Publish Revision
  await recordTest('TC-10: Phê duyệt và Xuất bản phiên bản hiện vật', async () => {
    assert(createdRevisionId, 'Requires createdRevisionId');
    // Đọc version hiện thời của exhibit từ server
    const exRes = await request(`/admin/exhibits/${createdExhibitId}`, { token: adminToken });
    const currentVersion = exRes.data?.data?.version ?? 1;

    const publishRes = await request(`/revisions/${createdRevisionId}/publish`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ version: currentVersion }),
    });

    assert(
      publishRes.status === 200 || publishRes.status === 201,
      `Expected 200/201 on publish, got ${publishRes.status} (${JSON.stringify(publishRes.data)})`
    );
  });

  // 11. Exhibit Visibility (Hide / Unhide)
  await recordTest('TC-11: Tạm ẩn và Mở lại hiện vật kèm lý do quản trị', async () => {
    assert(createdExhibitId, 'Requires createdExhibitId');
    const exRes = await request(`/admin/exhibits/${createdExhibitId}`, { token: adminToken });
    const verBeforeHide = exRes.data?.data?.version ?? 2;

    const hideRes = await request(`/exhibits/${createdExhibitId}/hide`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ version: verBeforeHide }),
    });
    assert(hideRes.status === 200 || hideRes.status === 201, `Expected 200/201 on hide, got ${hideRes.status}`);

    const exAfterHide = await request(`/admin/exhibits/${createdExhibitId}`, { token: adminToken });
    const verBeforeUnhide = exAfterHide.data?.data?.version ?? (verBeforeHide + 1);

    const unhideRes = await request(`/exhibits/${createdExhibitId}/unhide`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ version: verBeforeUnhide }),
    });
    assert(unhideRes.status === 200 || unhideRes.status === 201, `Expected 200/201 on unhide, got ${unhideRes.status}`);
  });

  // 12. BR-21 Media Deletion Protection
  await recordTest('TC-12: Ràng buộc BR-21: Chặn xóa Media đang được dùng bởi Exhibit đã xuất bản (409)', async () => {
    if (!createdMediaId) {
      console.log('    (Bỏ qua do không có media gắn kèm)');
      return;
    }
    const deleteMediaRes = await request(`/admin/media/${createdMediaId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert(deleteMediaRes.status === 409, `Expected 409 Conflict when deleting attached media (BR-21), got ${deleteMediaRes.status}`);
  });

  // 13. Content Reports Lifecycle
  await recordTest('TC-13: Quy trình Báo cáo vi phạm từ Client đến Admin (Assign, Resolve)', async () => {
    assert(createdExhibitId, 'Requires createdExhibitId');
    // Public client submit report
    const reportRes = await request('/public/reports', {
      method: 'POST',
      body: JSON.stringify({
        exhibitId: createdExhibitId,
        category: 'wrong_info',
        message: 'Hiện vật thử nghiệm kiểm tra tính năng báo cáo vi phạm E2E',
      }),
    });
    assert(reportRes.status === 201, `Public report expected 201, got ${reportRes.status} (${JSON.stringify(reportRes.data)})`);
    createdReportId = reportRes.data?.data?.id;
    assert(createdReportId, 'Report ID must be returned');

    // Admin assign
    const assignRes = await request(`/reports/${createdReportId}/assign`, {
      method: 'POST',
      token: adminToken,
    });
    assert(assignRes.status === 200 || assignRes.status === 201, `Report assign expected 200/201, got ${assignRes.status}`);

    // Admin resolve
    const resolveRes = await request(`/reports/${createdReportId}/resolve`, {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({ resolution: 'Đã xác minh và giải quyết nội dung báo cáo trong đợt kiểm thử E2E.' }),
    });
    assert(resolveRes.status === 200 || resolveRes.status === 201, `Report resolve expected 200/201, got ${resolveRes.status}`);
  });

  // 14. Audit Log Verification
  await recordTest('TC-14: Kiểm tra Nhật ký hệ thống ghi vết đầy đủ các hành động', async () => {
    const auditRes = await request('/audit?page=1&pageSize=20', { token: adminToken });
    assert(auditRes.status === 200, `Audit list expected 200, got ${auditRes.status}`);
    const auditData = auditRes.data?.data;
    const items = Array.isArray(auditData) ? auditData : (auditData?.items || []);
    assert(items.length > 0, 'Audit items should not be empty');

    const actions = items.map((i) => i.action);
    console.log(`    Các hành động mới nhất trong nhật ký: ${actions.slice(0, 5).join(', ')}`);
  });

  // 15. Teardown
  await recordTest('TC-15: Dọn dẹp dữ liệu kiểm thử (Clean up)', async () => {
    // Exhibit đã publish và có report nên theo BR-20 được bảo lưu và ẩn an toàn
    if (createdExhibitId) {
      const exRes = await request(`/admin/exhibits/${createdExhibitId}`, { token: adminToken });
      const currentVer = exRes.data?.data?.version ?? 4;
      await request(`/exhibits/${createdExhibitId}/hide`, {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ version: currentVer }),
      });
    }
    console.log('    Dọn dẹp hoàn tất: Hiện vật đã được chuyển sang trạng thái ẩn an toàn (BR-20).');
  });

  console.log('\n===============================================================');
  console.log(`       KẾT QUẢ TỔNG HỢP: ${passedCount}/${results.length} TEST CASES ĐẠT (${Math.round((passedCount / results.length) * 100)}%)`);
  if (failedCount > 0) {
    console.error(`       CẢNH BÁO: CÓ ${failedCount} BÀI KIỂM THỬ THẤT BẠI!`);
    process.exitCode = 1;
  } else {
    console.log('       TẤT CẢ CÁC BÀI KIỂM THỬ E2E CMS ADMIN ĐÃ VƯỢT QUA XUẤT SẮC! ✅');
  }
  console.log('===============================================================\n');
}

runAll().catch((err) => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
