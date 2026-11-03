import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2FA TOTP tùy chọn: cột trên users (secret đã mã hóa, secret chờ xác nhận, bước mã dùng gần nhất chống dùng lại,
 * thời điểm bật) + bảng mã khôi phục dùng một lần (chỉ lưu SHA-256).
 */
export class AddTwoFactor1793700000000 implements MigrationInterface {
    name = 'AddTwoFactor1793700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_recovery_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "code_hash" character(64) NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_411939add58ed0eceffd39973cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_recovery_codes_user" ON "user_recovery_codes" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_enabled_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_secret_enc" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_pending_enc" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_last_step" bigint`);
        await queryRunner.query(`ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "FK_f659216e26d0ef1238379cbf40c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_recovery_codes" DROP CONSTRAINT "FK_f659216e26d0ef1238379cbf40c"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_last_step"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_pending_enc"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_secret_enc"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_enabled_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_recovery_codes_user"`);
        await queryRunner.query(`DROP TABLE "user_recovery_codes"`);
    }

}
