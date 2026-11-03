import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Job upload media bất đồng bộ (VT-078). Unique (created_by, idempotency_key) là chốt chặn
 * thật cho retry: hai request đồng thời cùng key chỉ một request insert được, request còn lại
 * nhận lỗi 23505 và đọc lại job đã có. `created_by` NOT NULL vì NULL không bằng nhau trong
 * unique index của PostgreSQL.
 */
export class AddMediaUploadJobs1793800000000 implements MigrationInterface {
    name = 'AddMediaUploadJobs1793800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "media_upload_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_by" uuid NOT NULL, "idempotency_key" character varying(128) NOT NULL, "request_checksum" character(64) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'queued', "progress" smallint NOT NULL DEFAULT 0, "media_id" uuid, "error_code" character varying(40), "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_media_upload_jobs_actor_key" UNIQUE ("created_by", "idempotency_key"), CONSTRAINT "CHK_media_upload_jobs_status" CHECK ("status" IN ('queued', 'processing', 'succeeded', 'failed')), CONSTRAINT "CHK_media_upload_jobs_progress" CHECK ("progress" BETWEEN 0 AND 100), CONSTRAINT "PK_media_upload_jobs" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "media_upload_jobs" ADD CONSTRAINT "FK_media_upload_jobs_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "media_upload_jobs" ADD CONSTRAINT "FK_media_upload_jobs_media" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media_upload_jobs" DROP CONSTRAINT "FK_media_upload_jobs_media"`);
        await queryRunner.query(`ALTER TABLE "media_upload_jobs" DROP CONSTRAINT "FK_media_upload_jobs_created_by"`);
        await queryRunner.query(`DROP TABLE "media_upload_jobs"`);
    }
}
