import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Task 8 — CMS media upload pipeline.
 * - Metadata quyền sử dụng (FR-97): thêm `author` (đã có `source`, `license`).
 * - `original_name` để hiển thị trong thư viện media, `created_at` để sắp xếp.
 * - Kind `subtitle` (WebVTT) và trạng thái `quarantined` cho file nghi ngờ.
 */
export class ExtendMediaUploadPipeline1791948600000 implements MigrationInterface {
    name = 'ExtendMediaUploadPipeline1791948600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media" ADD "original_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "media" ADD "author" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "media" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "CHK_media_state"`);
        await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "CHK_media_state" CHECK ("processing_state" IN ('pending', 'ready', 'failed', 'quarantined'))`);
        await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "CHK_media_kind"`);
        await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "CHK_media_kind" CHECK ("kind" IN ('model', 'image', 'audio', 'subtitle'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Bản ghi quarantine trở về 'failed' để thỏa CHECK cũ. Bản ghi kind 'subtitle'
        // không có giá trị tương đương: CHECK cũ sẽ báo lỗi để tránh mất dữ liệu âm thầm.
        await queryRunner.query(`UPDATE "media" SET "processing_state" = 'failed' WHERE "processing_state" = 'quarantined'`);
        await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "CHK_media_kind"`);
        await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "CHK_media_kind" CHECK ("kind" IN ('model', 'image', 'audio'))`);
        await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "CHK_media_state"`);
        await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "CHK_media_state" CHECK ("processing_state" IN ('pending', 'ready', 'failed'))`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "author"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "original_name"`);
    }
}
