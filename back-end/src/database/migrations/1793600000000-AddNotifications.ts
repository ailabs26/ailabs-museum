import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Thông báo trong CMS theo từng người dùng (gửi duyệt, duyệt/từ chối, báo cáo mới).
 * Index: danh sách mới nhất theo user + đếm chưa đọc (partial).
 */
export class AddNotifications1793600000000 implements MigrationInterface {
    name = 'AddNotifications1793600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" character varying(40) NOT NULL, "title" character varying(200) NOT NULL, "body" text, "link" character varying(300), "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_user_unread" ON "notifications" ("user_id") WHERE "read_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_unread"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
