import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';
import { SupabaseStorageDriver } from '../storage/supabase-storage.driver';

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** `fetch` giả: ghi lại request, trả phản hồi theo hàng đợi. */
class FakeFetch {
  calls: RecordedCall[] = [];
  responses: Response[] = [];
  fn = (async (url: string, init: RequestInit) => {
    this.calls.push({
      url,
      method: String(init.method),
      headers: init.headers as Record<string, string>,
      body: init.body,
    });
    const response = this.responses.shift();
    assert.ok(response, 'thiếu phản hồi giả');
    return response;
  }) as unknown as typeof fetch;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString();
}

describe('SupabaseStorageDriver', () => {
  const key = 'uploads/models/3f0c7a52-1b9e-4f7a-9c41-6a2d8e5b0c11.glb';
  let fake: FakeFetch;
  let driver: SupabaseStorageDriver;

  beforeEach(() => {
    fake = new FakeFetch();
    driver = new SupabaseStorageDriver({
      url: 'https://ref.supabase.co',
      serviceKey: 'service-role-key-for-test',
      bucket: 'aura-media',
      fetchFn: fake.fn,
    });
  });

  describe('put', () => {
    it('POST lên bucket với x-upsert: false + khóa server', async () => {
      fake.responses.push(json(200, { Key: `aura-media/${key}` }));
      const data = Buffer.from('glb');
      await driver.put(key, data);
      const [call] = fake.calls;
      assert.equal(call.method, 'POST');
      assert.equal(call.url, `https://ref.supabase.co/storage/v1/object/aura-media/${key}`);
      assert.equal(call.headers['x-upsert'], 'false');
      assert.equal(call.headers.apikey, 'service-role-key-for-test');
      assert.equal(call.headers.authorization, 'Bearer service-role-key-for-test');
      assert.equal(call.body, data);
    });

    for (const [status, body] of [[409, { statusCode: '409', error: 'Duplicate' }], [400, { statusCode: '409', error: 'Duplicate' }]] as const) {
      it(`key đã tồn tại (HTTP ${status}) → lỗi EEXIST, không ghi đè (BR-21)`, async () => {
        fake.responses.push(json(status, body));
        await assert.rejects(driver.put(key, Buffer.from('x')), { code: 'EEXIST' });
      });
    }

    it('lỗi khác → ném lỗi không mang EEXIST', async () => {
      fake.responses.push(json(500, { message: 'boom' }));
      await assert.rejects(driver.put(key, Buffer.from('x')), (error: NodeJS.ErrnoException) => {
        assert.notEqual(error.code, 'EEXIST');
        assert.match(error.message, /500/);
        return true;
      });
    });
  });

  describe('timeout', () => {
    /** fetch chậm `delayMs` rồi trả `response`, trừ khi bị hủy trước (giống mạng upload chậm). */
    const slowFetch = (delayMs: number, response: () => Response) =>
      ((_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(response()), delayMs);
          init.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('This operation was aborted', 'AbortError'));
          });
        })) as unknown as typeof fetch;

    const slowDriver = (delayMs: number, response: () => Response) =>
      new SupabaseStorageDriver({
        url: 'https://ref.supabase.co',
        serviceKey: 'service-role-key-for-test',
        bucket: 'aura-media',
        timeoutMs: 20,
        uploadTimeoutMs: 1_000,
        fetchFn: slowFetch(delayMs, response),
      });

    it('upload dùng timeout riêng dài hơn — gửi file lớn trên mạng chậm không bị hủy', async () => {
      await slowDriver(80, () => json(200, { Key: 'k' })).put(key, Buffer.from('glb'));
    });

    it('đọc vẫn giữ timeout ngắn chờ header', async () => {
      await assert.rejects(
        slowDriver(80, () => new Response('x', { status: 200 })).read(key),
        /aborted/,
      );
    });
  });

  describe('delete', () => {
    it('DELETE đúng object', async () => {
      fake.responses.push(json(200, { message: 'Successfully deleted' }));
      await driver.delete(key);
      assert.equal(fake.calls[0].method, 'DELETE');
      assert.equal(fake.calls[0].url, `https://ref.supabase.co/storage/v1/object/aura-media/${key}`);
    });

    it('object không tồn tại (404 hoặc 400 + statusCode "404") → bỏ qua', async () => {
      fake.responses.push(json(404, { error: 'not_found' }), json(400, { statusCode: '404', error: 'not_found' }));
      await driver.delete(key);
      await driver.delete(key);
    });

    it('lỗi khác → ném lỗi', async () => {
      fake.responses.push(json(403, { statusCode: '403', message: 'Unauthorized' }));
      await assert.rejects(driver.delete(key), /403/);
    });
  });

  describe('read', () => {
    it('GET qua endpoint authenticated → stream nội dung', async () => {
      fake.responses.push(new Response('glb-content', { status: 200 }));
      const stream = await driver.read(key);
      assert.ok(stream);
      assert.equal(await readAll(stream), 'glb-content');
      assert.equal(fake.calls[0].url, `https://ref.supabase.co/storage/v1/object/authenticated/aura-media/${key}`);
      assert.equal(fake.calls[0].headers.range, undefined);
    });

    it('có Range → gửi header Range, nhận 206', async () => {
      fake.responses.push(new Response('2345', { status: 206 }));
      const stream = await driver.read(key, { start: 2, end: 5 });
      assert.ok(stream);
      assert.equal(await readAll(stream), '2345');
      assert.equal(fake.calls[0].headers.range, 'bytes=2-5');
    });

    it('xin Range mà nhận 200 cả file → ném lỗi (không trả sai đoạn byte)', async () => {
      fake.responses.push(new Response('0123456789', { status: 200 }));
      await assert.rejects(driver.read(key, { start: 2, end: 5 }), /Range/);
    });

    it('object không tồn tại → null', async () => {
      fake.responses.push(json(400, { statusCode: '404', error: 'not_found', message: 'Object not found' }));
      assert.equal(await driver.read(key), null);
    });

    it('lỗi khác → ném lỗi', async () => {
      fake.responses.push(json(500, { message: 'boom' }));
      await assert.rejects(driver.read(key), /500/);
    });
  });
});
