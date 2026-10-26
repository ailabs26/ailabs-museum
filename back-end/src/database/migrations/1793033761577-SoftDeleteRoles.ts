import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Vai trò chuyển sang xóa mềm (thống nhất với users/rooms/media/exhibits).
 * Unique `code` chỉ áp dụng cho vai trò chưa xóa để tạo lại được vai trò cùng mã sau khi xóa.
 */
export class SoftDeleteRoles1793033761577 implements MigrationInterface {
    name = 'SoftDeleteRoles1793033761577'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" ADD "is_deleted" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "roles" ADD CONSTRAINT "CHK_roles_deleted" CHECK ("is_deleted" = ("deleted_at" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_roles_code_active" ON "roles" ("code") WHERE "is_deleted" = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Không gộp/xóa dữ liệu âm thầm: từ chối revert khi đã có vai trò trùng mã (một bản đã xóa mềm).
        const [{ count }] = await queryRunner.query(
            `SELECT COUNT(*)::int AS count FROM (SELECT "code" FROM "roles" GROUP BY "code" HAVING COUNT(*) > 1) d`,
        );
        if (count > 0) {
            throw new Error(`Không thể revert SoftDeleteRoles: có ${count} mã vai trò bị trùng giữa vai trò đã xóa và đang dùng.`);
        }
        await queryRunner.query(`DROP INDEX "public"."UQ_roles_code_active"`);
        await queryRunner.query(`ALTER TABLE "roles" ADD CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE ("code")`);
        await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "CHK_roles_deleted"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "is_deleted"`);
    }
}
