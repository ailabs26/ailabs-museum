import 'reflect-metadata';
import { In, Repository } from 'typeorm';
import { dataSource } from '../../config/data-source';
import { Translation } from '../../modules/translations/entities/translation.entity';
import { PUBLIC_UI_STRINGS, PublicUiString } from './public-ui-strings';

/** Bản Admin đã nhập được giữ; chỉ điền ngôn ngữ còn thiếu hoặc còn trống. */
export function mergeMissingLocales(seed: PublicUiString['values'], existing: Record<string, string>): Record<string, string> {
  const kept = Object.fromEntries(Object.entries(existing).filter(([, text]) => text.trim()));
  return { ...seed, ...kept };
}

/** Thêm chuỗi còn thiếu và điền ngôn ngữ còn thiếu, không ghi đè bản Admin đã sửa (chạy lại an toàn). */
export async function seedPublicUiStrings(
  repo: Pick<Repository<Translation>, 'find' | 'save' | 'create'>,
  strings: readonly PublicUiString[] = PUBLIC_UI_STRINGS,
): Promise<{ created: number; updated: number }> {
  const existing = await repo.find({ where: { namespace: In(strings.map((item) => item.namespace)) } });
  const byNamespace = new Map(existing.map((entry) => [entry.namespace, entry]));
  const changed: Translation[] = [];
  let created = 0;
  for (const { namespace, context, values } of strings) {
    const entry = byNamespace.get(namespace);
    if (!entry) {
      changed.push(repo.create({ namespace, context, category: 'ui', values }));
      created++;
      continue;
    }
    const merged = mergeMissingLocales(values, entry.values);
    if (Object.keys(merged).some((locale) => merged[locale] !== entry.values[locale])) {
      entry.values = merged;
      changed.push(entry);
    }
  }
  if (changed.length) await repo.save(changed);
  return { created, updated: changed.length - created };
}

/** Chỉ đụng bảng `translations`: chạy trên DB dùng chung mà không chạy cả seed. */
async function run(): Promise<void> {
  await dataSource.initialize();
  const { created, updated } = await seedPublicUiStrings(dataSource.getRepository(Translation));
  console.log(`Chuỗi giao diện: thêm ${created}, bổ sung ngôn ngữ cho ${updated}.`);
  await dataSource.destroy();
}

if (require.main === module) {
  run().catch((error) => { console.error(error); process.exit(1); });
}
