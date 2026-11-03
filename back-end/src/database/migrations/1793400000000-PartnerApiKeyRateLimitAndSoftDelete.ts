import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cổng API đối tác: giới hạn số request/phút cho từng key và xóa mềm key
 * (thống nhất chính sách xóa mềm; key đã xóa không dùng được nhưng vẫn truy vết được).
 */
export class PartnerApiKeyRateLimitAndSoftDelete1793400000000 implements MigrationInterface {
    name = 'PartnerApiKeyRateLimitAndSoftDelete1793400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partner_api_keys" ADD "rate_limit_per_minute" integer NOT NULL DEFAULT 60`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" ADD CONSTRAINT "CHK_partner_api_keys_rate_limit" CHECK ("rate_limit_per_minute" BETWEEN 1 AND 10000)`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" ADD "is_deleted" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" ADD CONSTRAINT "CHK_partner_api_keys_deleted" CHECK ("is_deleted" = ("deleted_at" IS NOT NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partner_api_keys" DROP CONSTRAINT "CHK_partner_api_keys_deleted"`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" DROP COLUMN "is_deleted"`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" DROP CONSTRAINT "CHK_partner_api_keys_rate_limit"`);
        await queryRunner.query(`ALTER TABLE "partner_api_keys" DROP COLUMN "rate_limit_per_minute"`);
    }
}
