import { MigrationInterface, QueryRunner } from "typeorm";

/** Bản dịch tên và mô tả phòng. `name`, `description` hiện có vẫn là tiếng Việt, dữ liệu cũ không đổi. */
export class AddRoomTranslations1793900000000 implements MigrationInterface {
    name = 'AddRoomTranslations1793900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rooms" ADD "translations" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "translations"`);
    }
}
