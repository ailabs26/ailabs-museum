import { MigrationInterface, QueryRunner } from "typeorm";

export class AlignMuseumMvpSchema1791483209234 implements MigrationInterface {
    name = 'AlignMuseumMvpSchema1791483209234'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Extension bắt buộc: uuid_generate_v4() (uuid-ossp) và kiểu citext (email không phân biệt hoa thường).
        // Phải tạo trước mọi CREATE TABLE bên dưới, nếu không migration sẽ fail trên DB mới.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
        await queryRunner.query(`CREATE TABLE "refresh_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character(64) NOT NULL, "replaced_by_id" uuid, "used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_d76f5941d821678137ef15d9651" UNIQUE ("token_hash"), CONSTRAINT "UQ_f273e5043a6a9b3d259a1ea49fc" UNIQUE ("replaced_by_id"), CONSTRAINT "REL_f273e5043a6a9b3d259a1ea49f" UNIQUE ("replaced_by_id"), CONSTRAINT "PK_9190032f6967b7971dca07d69f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_refresh_sessions_user_family" ON "refresh_sessions" ("user_id", "family_id") `);
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(100) NOT NULL, "description" character varying(240), CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role_permissions" ("role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id"))`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(64) NOT NULL, "name" character varying(120) NOT NULL, CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE ("code"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_roles" ("user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" citext NOT NULL, "password_hash" text NOT NULL, "display_name" character varying(160) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'active', "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "CHK_users_deleted" CHECK ("is_deleted" = ("deleted_at" IS NOT NULL)), CONSTRAINT "CHK_users_status" CHECK ("status" IN ('active', 'disabled')), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "content_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "exhibit_id" uuid NOT NULL, "reported_revision_id" uuid, "category" character varying(40) NOT NULL, "message" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'open', "assigned_to" uuid, "resolution" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_content_reports_status" CHECK ("status" IN ('open', 'in_progress', 'resolved', 'dismissed')), CONSTRAINT "PK_6c59a68146cdde8de564ee649c1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_content_reports_status_created" ON "content_reports" ("status", "created_at") `);
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(120) NOT NULL, "name" character varying(200) NOT NULL, "description" text, "status" character varying(12) NOT NULL DEFAULT 'active', "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4a252a005ce573079b47a4f38e3" UNIQUE ("slug"), CONSTRAINT "CHK_rooms_deleted" CHECK ("is_deleted" = ("deleted_at" IS NOT NULL)), CONSTRAINT "CHK_rooms_status" CHECK ("status" IN ('active', 'archived')), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exhibits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "room_id" uuid NOT NULL, "published_revision_id" uuid, "visibility" character varying(12) NOT NULL DEFAULT 'hidden', "version" integer NOT NULL DEFAULT '0', "display_order" integer NOT NULL DEFAULT '0', "archived_at" TIMESTAMP WITH TIME ZONE, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_exhibits_deleted" CHECK ("is_deleted" = ("deleted_at" IS NOT NULL)), CONSTRAINT "CHK_exhibits_display_order" CHECK ("display_order" >= 0), CONSTRAINT "CHK_exhibits_version" CHECK ("version" >= 0), CONSTRAINT "CHK_exhibits_visibility" CHECK ("visibility" IN ('visible', 'hidden')), CONSTRAINT "PK_63888935e8c674f871d4f851eea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_exhibits_room_order_id" ON "exhibits" ("room_id", "display_order", "id") `);
        await queryRunner.query(`CREATE TABLE "hotspots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "revision_id" uuid NOT NULL, "label" character varying(200) NOT NULL, "body" text NOT NULL, "position_x" numeric NOT NULL, "position_y" numeric NOT NULL, "position_z" numeric NOT NULL, "display_order" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_hotspots_display_order" CHECK ("display_order" >= 0), CONSTRAINT "PK_38da794bf4baf98298c651c5ee3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(12) NOT NULL, "storage_key" text NOT NULL, "mime_type" character varying(120) NOT NULL, "size_bytes" bigint NOT NULL, "checksum_sha256" character(64) NOT NULL, "processing_state" character varying(12) NOT NULL DEFAULT 'pending', "alt_text" character varying(240), "source" text, "license" text, "created_by" uuid, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_9ba0d5268d6f75eca1b62cf10bd" UNIQUE ("storage_key"), CONSTRAINT "CHK_media_deleted" CHECK ("is_deleted" = ("deleted_at" IS NOT NULL)), CONSTRAINT "CHK_media_size" CHECK ("size_bytes" > 0), CONSTRAINT "CHK_media_state" CHECK ("processing_state" IN ('pending', 'ready', 'failed')), CONSTRAINT "CHK_media_kind" CHECK ("kind" IN ('model', 'image', 'audio')), CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exhibit_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "exhibit_id" uuid NOT NULL, "revision_no" integer NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'draft', "content" jsonb NOT NULL, "model_media_id" uuid, "image_media_id" uuid, "audio_media_id" uuid, "created_by" uuid NOT NULL, "reviewed_by" uuid, "reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reviewed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_exhibit_revisions_state" CHECK ("state" IN ('draft', 'in_review', 'approved', 'rejected')), CONSTRAINT "CHK_exhibit_revisions_no" CHECK ("revision_no" >= 1), CONSTRAINT "PK_fa2132a8d7097c85d36e9e53858" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_exhibit_revisions_exhibit_no" ON "exhibit_revisions" ("exhibit_id", "revision_no") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "action" character varying(100) NOT NULL, "resource_type" character varying(40) NOT NULL, "resource_id" uuid NOT NULL, "revision_id" uuid, "reason" text, "request_id" character varying(100) NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_resource_time" ON "audit_logs" ("resource_type", "resource_id", "occurred_at") `);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" ADD CONSTRAINT "FK_a7ab4fd82c654c85b9de53d971a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" ADD CONSTRAINT "FK_f273e5043a6a9b3d259a1ea49fc" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_reports" ADD CONSTRAINT "FK_dc8e088a635df56a465fd9c13f6" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_reports" ADD CONSTRAINT "FK_383a70b7d3e64c7eeb13e85caf7" FOREIGN KEY ("reported_revision_id") REFERENCES "exhibit_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_reports" ADD CONSTRAINT "FK_5b5299ff2f1e518a4dca01341e8" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibits" ADD CONSTRAINT "FK_b9bb2231c1cdbd770692c916879" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibits" ADD CONSTRAINT "FK_43371fa507c38702a1e840b222d" FOREIGN KEY ("published_revision_id") REFERENCES "exhibit_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hotspots" ADD CONSTRAINT "FK_83139234107b19df833a464113c" FOREIGN KEY ("revision_id") REFERENCES "exhibit_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "FK_d28b47b98808a620a766196d676" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_f30e2e885074bc0e8524b143db6" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_ac4ad822596f8963eefbdbcf4fd" FOREIGN KEY ("model_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_3814b37e3893ef4c3ef43a24a83" FOREIGN KEY ("image_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_4910d7764ed637b5f6405a84ef6" FOREIGN KEY ("audio_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_5278506d1a3b02863c67642beba" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" ADD CONSTRAINT "FK_3be9d9eea5c96786a466176535b" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_5ffa3925630e23ebf4f9240a51c" FOREIGN KEY ("revision_id") REFERENCES "exhibit_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_5ffa3925630e23ebf4f9240a51c"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_3be9d9eea5c96786a466176535b"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_5278506d1a3b02863c67642beba"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_4910d7764ed637b5f6405a84ef6"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_3814b37e3893ef4c3ef43a24a83"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_ac4ad822596f8963eefbdbcf4fd"`);
        await queryRunner.query(`ALTER TABLE "exhibit_revisions" DROP CONSTRAINT "FK_f30e2e885074bc0e8524b143db6"`);
        await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "FK_d28b47b98808a620a766196d676"`);
        await queryRunner.query(`ALTER TABLE "hotspots" DROP CONSTRAINT "FK_83139234107b19df833a464113c"`);
        await queryRunner.query(`ALTER TABLE "exhibits" DROP CONSTRAINT "FK_43371fa507c38702a1e840b222d"`);
        await queryRunner.query(`ALTER TABLE "exhibits" DROP CONSTRAINT "FK_b9bb2231c1cdbd770692c916879"`);
        await queryRunner.query(`ALTER TABLE "content_reports" DROP CONSTRAINT "FK_5b5299ff2f1e518a4dca01341e8"`);
        await queryRunner.query(`ALTER TABLE "content_reports" DROP CONSTRAINT "FK_383a70b7d3e64c7eeb13e85caf7"`);
        await queryRunner.query(`ALTER TABLE "content_reports" DROP CONSTRAINT "FK_dc8e088a635df56a465fd9c13f6"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP CONSTRAINT "FK_f273e5043a6a9b3d259a1ea49fc"`);
        await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP CONSTRAINT "FK_a7ab4fd82c654c85b9de53d971a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_resource_time"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_exhibit_revisions_exhibit_no"`);
        await queryRunner.query(`DROP TABLE "exhibit_revisions"`);
        await queryRunner.query(`DROP TABLE "media"`);
        await queryRunner.query(`DROP TABLE "hotspots"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_exhibits_room_order_id"`);
        await queryRunner.query(`DROP TABLE "exhibits"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_content_reports_status_created"`);
        await queryRunner.query(`DROP TABLE "content_reports"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TABLE "role_permissions"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_user_family"`);
        await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    }

}
