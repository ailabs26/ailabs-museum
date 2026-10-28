import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hai bảng cho CMS mở rộng:
 * - translations: chuỗi dịch đa ngôn ngữ (values jsonb theo locale, vi là nguồn).
 * - partner_api_keys: khóa API đối tác (lưu SHA-256 hash, không lưu khóa thô).
 */
export class AddTranslationsAndPartnerApiKeys1793300000000 implements MigrationInterface {
    name = 'AddTranslationsAndPartnerApiKeys1793300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "translations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "namespace" character varying(160) NOT NULL, "context" character varying(255) NOT NULL DEFAULT '', "category" character varying(16) NOT NULL, "values" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_translations_category" CHECK ("category" IN ('exhibit', 'room', 'ui', 'audio')), CONSTRAINT "PK_translations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_translations_namespace" ON "translations" ("namespace")`);

        await queryRunner.query(`CREATE TABLE "partner_api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "partner_name" character varying(120) NOT NULL, "label" character varying(160) NOT NULL DEFAULT '', "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb, "status" character varying(16) NOT NULL DEFAULT 'active', "key_prefix" character varying(16) NOT NULL, "key_hash" character(64) NOT NULL, "last4" character varying(8) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE, "last_used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_partner_api_keys_status" CHECK ("status" IN ('active', 'revoked')), CONSTRAINT "PK_partner_api_keys" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_partner_api_keys_hash" ON "partner_api_keys" ("key_hash")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_partner_api_keys_hash"`);
        await queryRunner.query(`DROP TABLE "partner_api_keys"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_translations_namespace"`);
        await queryRunner.query(`DROP TABLE "translations"`);
    }
}
