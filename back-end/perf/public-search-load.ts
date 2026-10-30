import 'reflect-metadata';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ExhibitsController } from '../src/modules/exhibits/controllers/exhibits.controller';
import { ExhibitsService } from '../src/modules/exhibits/services/exhibits.service';
import { PublicModelsService } from '../src/modules/exhibits/services/public-models.service';

/**
 * VT-077 — Harness kiểm chứng tải: 150 tác vụ tìm kiếm ĐỒNG THỜI, mục tiêu p95 ≤ 4.0 s.
 * Đặt NGOÀI `src/` để không bị `nest build` biên dịch vào `dist`.
 *
 * Chạy (transpile-only để không vướng rootDir của tsconfig):
 *   node -r reflect-metadata -r ts-node/register/transpile-only \
 *     perf/public-search-load.ts [concurrency] [rounds] [simDbMs]
 *
 * GIỚI HẠN KẾT LUẬN (trung thực): tầng service/DB được THAY bằng độ trễ mô phỏng
 * (simDbMs, mặc định 25 ms ± jitter) — đây KHÔNG phải Postgres thật. Harness đo overhead
 * thực của pipeline HTTP Nest (routing, ValidationPipe, interceptor, serialize) dưới đồng thời,
 * KHÔNG đo chi phí truy vấn ILIKE/JSONB thật. Số liệu chỉ dùng để: (1) phát hiện regression
 * tương đối, (2) ước lượng cận dưới của p95. Kết luận production cần chạy lại với DB thật.
 */

const CONCURRENCY = Number(process.argv[2] ?? 150);
const ROUNDS = Number(process.argv[3] ?? 20);
const SIM_DB_MS = Number(process.argv[4] ?? 25);
const P95_TARGET_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main(): Promise<void> {
  const service = {
    publicSearch: async (query: Record<string, unknown>) => {
      // Mô phỏng chi phí truy vấn DB bằng độ trễ có jitter (± ~40%).
      await sleep(SIM_DB_MS * (0.8 + Math.random() * 0.4));
      return { items: [], total: 0, page: Number(query.page) || 1, pageSize: Number(query.pageSize) || 20 };
    },
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [ExhibitsController],
    providers: [
      { provide: ExhibitsService, useValue: service },
      { provide: PublicModelsService, useValue: {} },
    ],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  // Agent dùng chung: keepAlive + đủ socket cho mức đồng thời (tránh cạn cổng ephemeral).
  const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });

  const once = (): Promise<number> =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const req = http.get(
        { host: '127.0.0.1', port, path: '/rooms/search?q=gom&page=1&pageSize=20', agent },
        (res) => {
          res.resume(); // tiêu thụ body để giải phóng socket
          res.on('end', () => resolve(res.statusCode === 200 ? Date.now() - t0 : -(Date.now() - t0)));
        },
      );
      req.on('error', () => resolve(-(Date.now() - t0)));
    });

  const latencies: number[] = [];
  let errors = 0;
  const totalStart = Date.now();

  for (let round = 0; round < ROUNDS; round++) {
    const batch = Array.from({ length: CONCURRENCY }, once);
    const results = await Promise.all(batch);
    for (const ms of results) {
      if (ms < 0) errors++;
      latencies.push(Math.abs(ms));
    }
  }

  const wallMs = Date.now() - totalStart;
  agent.destroy();
  await app.close();

  latencies.sort((a, b) => a - b);
  const total = latencies.length;
  const throughput = (total / wallMs) * 1000;
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  console.log('================ VT-077 LOAD TEST: GET /rooms/search ================');
  console.log(`Concurrency       : ${CONCURRENCY} tác vụ đồng thời/vòng`);
  console.log(`Rounds            : ${ROUNDS}  (tổng ${total} request)`);
  console.log(`Simulated DB delay: ${SIM_DB_MS} ms (± jitter)  [KHÔNG phải Postgres thật]`);
  console.log(`Errors (non-200)  : ${errors}`);
  console.log(`Wall time         : ${wallMs} ms   | throughput ~ ${throughput.toFixed(1)} req/s`);
  console.log('---------------------------------------------------------------------');
  console.log(`Latency p50       : ${p50} ms`);
  console.log(`Latency p95       : ${p95} ms    (mục tiêu ≤ ${P95_TARGET_MS} ms)`);
  console.log(`Latency p99       : ${p99} ms`);
  console.log(`Latency max       : ${latencies[total - 1]} ms`);
  console.log('---------------------------------------------------------------------');
  console.log(`KẾT QUẢ: p95 = ${p95} ms  →  ${p95 <= P95_TARGET_MS ? 'ĐẠT' : 'KHÔNG ĐẠT'} mục tiêu 4.0 s`);
  console.log('Giới hạn: service/DB mô phỏng bằng độ trễ; p95 production cần đo lại với Postgres thật.');
  console.log('=====================================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
