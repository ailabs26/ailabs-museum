import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Thông tin thiết bị cho màn "Phiên đăng nhập" + index cho ActiveSessionGuard (tra mỗi request).
 * - `created_at`: thời điểm tạo row (mỗi lần xoay vòng) → "hoạt động cuối" của family.
 * - `signed_in_at`: thời điểm đăng nhập, chép nguyên qua mọi lần xoay vòng của family.
 * Row cũ nhận now() — chấp nhận được vì chỉ dùng để hiển thị.
 */
export class AddRefreshSessionDeviceInfo1792943375524 implements MigrationInterface {
    name = 'AddRefreshSessionDeviceInfo1792943375524'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_sessions" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" ADD "signed_in_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" ADD "user_agent" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" ADD "ip" character varying(64)`);
        await queryRunner.query(`CREATE INDEX "IDX_refresh_sessions_family_live" ON "refresh_sessions" ("family_id") WHERE "revoked_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_family_live"`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP COLUMN "ip"`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP COLUMN "user_agent"`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP COLUMN "signed_in_at"`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP COLUMN "created_at"`);
    }
}
