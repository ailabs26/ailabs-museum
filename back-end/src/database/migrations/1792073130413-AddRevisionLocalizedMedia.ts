import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Task 9 — gắn media theo ngôn ngữ vào revision (FR-57, §5.2).
 * - `audio_media_id` có sẵn giữ nghĩa audio tiếng Việt; thêm audio tiếng Anh và phụ đề vi/en.
 * - Index một phần trên từng slot media + `exhibits.published_revision_id` cho truy vấn
 *   BR-21 (đếm tham chiếu) và kiểm tra "media được revision public hiện hành tham chiếu".
 * Chỉ ADD COLUMN nullable + CREATE INDEX: không rewrite bảng.
 */
export class AddRevisionLocalizedMedia1792073130413 implements MigrationInterface {
    name = 'AddRevisionLocalizedMedia1792073130413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD "audio_en_media_id" uuid`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD "subtitle_vi_media_id" uuid`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD "subtitle_en_media_id" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "exhibit_revisions"."audio_media_id" IS 'Audio guide tiếng Việt'`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibits_published_revision" ON "exhibits" ("published_revision_id") WHERE "published_revision_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibit_revisions_subtitle_en_media" ON "exhibit_revisions" ("subtitle_en_media_id") WHERE "subtitle_en_media_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibit_revisions_subtitle_vi_media" ON "exhibit_revisions" ("subtitle_vi_media_id") WHERE "subtitle_vi_media_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibit_revisions_audio_en_media" ON "exhibit_revisions" ("audio_en_media_id") WHERE "audio_en_media_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibit_revisions_audio_media" ON "exhibit_revisions" ("audio_media_id") WHERE "audio_media_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibit_revisions_image_media" ON "exhibit_revisions" ("image_media_id") WHERE "image_media_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibit_revisions_model_media" ON "exhibit_revisions" ("model_media_id") WHERE "model_media_id" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_1f03b783c06522e71825eb7565e" FOREIGN KEY ("audio_en_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_545ca7a09efbe9e80e894802305" FOREIGN KEY ("subtitle_vi_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_db6b4b486a717fce1372a65daf0" FOREIGN KEY ("subtitle_en_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Không có chỗ chứa tương đương cho audio tiếng Anh / phụ đề trong schema cũ:
        // từ chối revert thay vì làm mất tham chiếu media âm thầm.
        const [{ count }] = await queryRunner.query(
            `SELECT COUNT(*)::int AS count FROM "exhibit_revisions"
             WHERE "audio_en_media_id" IS NOT NULL OR "subtitle_vi_media_id" IS NOT NULL OR "subtitle_en_media_id" IS NOT NULL`,
        );
        if (count > 0) {
            throw new Error(
                `Không thể revert AddRevisionLocalizedMedia: còn ${count} revision dùng audio tiếng Anh/phụ đề.`,
            );
        }
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_db6b4b486a717fce1372a65daf0"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_545ca7a09efbe9e80e894802305"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_1f03b783c06522e71825eb7565e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibit_revisions_model_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibit_revisions_image_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibit_revisions_audio_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibit_revisions_audio_en_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibit_revisions_subtitle_vi_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibit_revisions_subtitle_en_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibits_published_revision"`);
        await queryRunner.query(`COMMENT ON COLUMN "exhibit_revisions"."audio_media_id" IS NULL`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP COLUMN "subtitle_en_media_id"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP COLUMN "subtitle_vi_media_id"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP COLUMN "audio_en_media_id"`);
    }
}
