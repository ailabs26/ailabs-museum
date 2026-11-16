import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { Repository } from 'typeorm';
import type { Translation } from '../../modules/translations/entities/translation.entity';
import { SUPPORTED_LOCALES } from '../../modules/translations/constants/locales';
import { PUBLIC_UI_STRINGS } from './public-ui-strings';
import { mergeMissingLocales, seedPublicUiStrings } from './seed-translations';

const FRONT_END_SRC = join(__dirname, '../../../../front-end/src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Mọi lời gọi `t('ui.x', 'chữ')` và mục `{ key: 'ui.x', label: 'chữ' }` trong front-end. */
function usedStrings(): Map<string, string> {
  const used = new Map<string, string>();
  const patterns = [
    /\bt\(\s*'(ui\.[\w.-]+)',\s*(?:'([^']*)'|`([^`]*)`)/g,
    /key: '(ui\.[\w.-]+)',\s*label: '([^']*)'/g,
  ];
  for (const file of sourceFiles(FRONT_END_SRC)) {
    const code = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      // Chuỗi trong code viết `\\n` cho xuống dòng; seed lưu ký tự xuống dòng thật.
      for (const match of code.matchAll(pattern)) used.set(match[1], (match[2] ?? match[3]).replace(/\\n/g, '\n'));
    }
  }
  return used;
}

const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('PUBLIC_UI_STRINGS', () => {
  const byKey = new Map(PUBLIC_UI_STRINGS.map((item) => [item.namespace, item]));

  it('mọi chuỗi trong code có trong seed, và bản vi trùng chữ dự phòng', () => {
    const used = usedStrings();
    assert.ok(used.size > 0, 'phải quét được chuỗi trong front-end');
    for (const [key, fallback] of used) {
      assert.ok(byKey.has(key), `thiếu trong seed: ${key}`);
      assert.equal(byKey.get(key)?.values.vi, fallback, `lệch tiếng Việt: ${key}`);
    }
  });

  it('không trùng key; đủ 6 ngôn ngữ; tham số giống nhau ở mọi ngôn ngữ', () => {
    assert.equal(byKey.size, PUBLIC_UI_STRINGS.length);
    for (const { namespace, values } of PUBLIC_UI_STRINGS) {
      for (const locale of SUPPORTED_LOCALES) {
        assert.ok(values[locale]?.trim(), `${namespace} thiếu ${locale}`);
        assert.deepEqual(parameters(values[locale]), parameters(values.vi), `${namespace} lệch tham số ở ${locale}`);
      }
    }
  });
});

describe('seedPublicUiStrings', () => {
  const values = { vi: 'Xin chào', en: 'Hello', fr: 'Bonjour', zh: '你好', ko: '안녕하세요', ja: 'こんにちは' };
  const strings = [{ namespace: 'ui.a', context: 'c', values }, { namespace: 'ui.b', context: 'c', values }];

  function repoWith(entries: Partial<Translation>[]) {
    const saved: Partial<Translation>[] = [];
    const repo = {
      find: async () => entries,
      create: (entry: Partial<Translation>) => entry,
      save: async (items: Partial<Translation>[]) => { saved.push(...items); return items; },
    } as unknown as Pick<Repository<Translation>, 'find' | 'save' | 'create'>;
    return { repo, saved };
  }

  it('giữ bản Admin đã sửa, chỉ điền ngôn ngữ thiếu hoặc trống', () => {
    assert.deepEqual(mergeMissingLocales(values, { vi: 'Admin sửa', ko: '  ' }), { ...values, vi: 'Admin sửa' });
  });

  it('tạo key thiếu, bổ sung ngôn ngữ cho key cũ', async () => {
    const { repo, saved } = repoWith([{ namespace: 'ui.a', values: { vi: 'Admin sửa', en: 'Hello' } }]);
    assert.deepEqual(await seedPublicUiStrings(repo, strings), { created: 1, updated: 1 });
    assert.equal(saved.find((item) => item.namespace === 'ui.a')?.values?.vi, 'Admin sửa');
    assert.equal(saved.find((item) => item.namespace === 'ui.a')?.values?.ko, '안녕하세요');
    assert.equal(saved.find((item) => item.namespace === 'ui.b')?.category, 'ui');
  });

  it('chạy lại khi đã đủ thì không ghi gì', async () => {
    const { repo, saved } = repoWith(strings.map(({ namespace }) => ({ namespace, values })));
    assert.deepEqual(await seedPublicUiStrings(repo, strings), { created: 0, updated: 0 });
    assert.equal(saved.length, 0);
  });
});
