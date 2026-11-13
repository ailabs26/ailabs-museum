import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Nhật ký hệ thống ghi đúng thực tế thay vì id giả:
 * - `resource_id` cho phép NULL cho sự kiện không gắn tài nguyên (đăng nhập bằng email không tồn tại,
 *   bị chặn vì dò mật khẩu, truy cập bị từ chối ở route danh sách/tạo mới).
 * - `ip`, `user_agent`: nguồn của request để truy vết (đăng nhập, thao tác quản trị).
 * Bản ghi cũ giữ nguyên (append-only).
 */
export class AuditNullableResourceAndClientInfo1793500000000 implements MigrationInterface {
    name = 'AuditNullableResourceAndClientInfo1793500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "resource_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "ip" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "user_agent" character varying(512)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Không bịa id cho bản ghi đã có resource_id rỗng: từ chối revert để không làm sai lịch sử audit.
        const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "audit_logs" WHERE "resource_id" IS NULL`);
        if (count > 0) {
            throw new Error(`Không thể revert AuditNullableResourceAndClientInfo: có ${count} bản ghi audit không gắn tài nguyên.`);
        }
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "user_agent"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "ip"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "resource_id" SET NOT NULL`);
    }
}
