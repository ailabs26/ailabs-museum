import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `hotspots.label` lưu chuỗi JSON song ngữ `{"vi":…,"en":…}` trong khi DTO/cổng duyệt cho phép
 * mỗi ngôn ngữ tới 200 ký tự → varchar(200) tràn (lỗi 500) khi hai tiêu đề cộng lại > ~180 ký tự.
 * varchar → text trên PostgreSQL không rewrite bảng.
 */
export class WidenHotspotLabel1792150000000 implements MigrationInterface {
    name = 'WidenHotspotLabel1792150000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotspots" ALTER COLUMN "label" TYPE text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Không cắt dữ liệu âm thầm: từ chối revert khi đã có tiêu đề dài hơn 200 ký tự.
        const [{ count }] = await queryRunner.query(
            `SELECT COUNT(*)::int AS count FROM "hotspots" WHERE char_length("label") > 200`,
        );
        if (count > 0) {
            throw new Error(`Không thể revert WidenHotspotLabel: còn ${count} hotspot có label dài hơn 200 ký tự.`);
        }
        await queryRunner.query(`ALTER TABLE "hotspots" ALTER COLUMN "label" TYPE character varying(200)`);
    }
}
