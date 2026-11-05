/**
 * Harness tải VT-078: 80 tác vụ upload đồng thời, mục tiêu p95 của POST /upload-jobs ≤ 2,5 s.
 *
 * Chạy: npm run load:upload-jobs
 *   LOAD_CONCURRENCY (mặc định 80), LOAD_RUNS (5), LOAD_FILE_BYTES (2_000_000, bội số của 4),
 *   MEDIA_TEST_DATABASE_URL=postgres://...@localhost/...  → repository PostgreSQL thật
 *   (không đặt → repository fake trong bộ nhớ). Storage luôn là đĩa cục bộ tạm.
 *   LOAD_OUTPUT=đường-dẫn.json để ghi kết quả.
 *   Mỗi lần chạy ghi đỉnh RSS và đỉnh `arrayBuffers` (Buffer file nằm ở đây) của tiến trình server.
 *   LOAD_SAME_PROCESS=1 → client và server chung một tiến trình (chỉ để so sánh: client tranh
 *   event loop với server nên số đo bị lẫn). Mặc định server chạy ở tiến trình con (fork).
 *
 * Client và server vẫn cùng một máy: số đo không đại diện cho production (không có mạng thật,
 * Supabase Storage, TLS, nhiều instance).
 */
import 'reflect-metadata';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { cpus, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { TransactionManager } from '../../../../common/database/transaction.manager';
import { AllExceptionsFilter } from '../../../../common/filters/all-exceptions.filter';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { ResponseInterceptor } from '../../../../common/interceptors/response.interceptor';
import { dataSource as appDataSource } from '../../../../config/data-source';
import { AuditService } from '../../../audit/services/audit.service';
import { User } from '../../../users/entities/user.entity';
import { AdminUploadJobsController } from '../../controllers/admin-upload-jobs.controller';
import { Media } from '../../entities/media.entity';
import { MediaUploadJob } from '../../entities/media-upload-job.entity';
import { MediaUploadJobRepository } from '../../repositories/media-upload-job.repository';
import { MediaRepository } from '../../repositories/media.repository';
import { MediaInspectionService } from '../../services/media-inspection.service';
import { MediaStorageService } from '../../services/media-storage.service';
import { MediaUploadJobService } from '../../services/media-upload-job.service';
import { MEDIA_URL_OPTIONS, MediaUrlService } from '../../services/media-url.service';
import { MediaService } from '../../services/media.service';
import { LocalStorageDriver } from '../../storage/local-storage.driver';
import { MEDIA_STORAGE_DRIVER } from '../../storage/media-storage-driver';
import { FakeMediaRepository, FakeTransactionManager, FakeUploadJobRepository, TEST_MEDIA_URL_OPTIONS } from '../media-test-doubles';
import { buildGlbOfSize } from '../media-test-files';

const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 80);
const RUNS = Number(process.env.LOAD_RUNS ?? 5);
const FILE_BYTES = Number(process.env.LOAD_FILE_BYTES ?? 2_000_000);
const P95_TARGET_MS = 2_500;
const DATABASE_URL = process.env.MEDIA_TEST_DATABASE_URL;
const SAME_PROCESS = process.env.LOAD_SAME_PROCESS === '1';
const useRealDb = !!DATABASE_URL && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(DATABASE_URL);

let actorId: string = randomUUID();

@Injectable()
class LoadAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = {
      id: actorId,
      email: 'load@example.test',
      displayName: 'Load',
      roles: ['editor'],
      permissions: [PERMISSIONS.MEDIA_UPLOAD],
    };
    return true;
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summarize(values: number[]) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return { n: values.length, p50: round(percentile(values, 50)), p95: round(percentile(values, 95)), max: round(Math.max(...values)) };
}

interface MemoryPeak {
  peakRssMb: number;
  peakArrayBuffersMb: number;
}

interface LoadServer {
  url: string;
  idle(): Promise<void>;
  /** Trả đỉnh bộ nhớ từ lần gọi trước rồi đặt lại. */
  memory(): Promise<MemoryPeak>;
  close(): Promise<void>;
}

/** Lấy mẫu bộ nhớ của tiến trình server theo chu kỳ ngắn (đỉnh, không phải giá trị cuối). */
function startMemorySampler() {
  const peak = { rss: 0, arrayBuffers: 0 };
  const sample = () => {
    const usage = process.memoryUsage();
    peak.rss = Math.max(peak.rss, usage.rss);
    peak.arrayBuffers = Math.max(peak.arrayBuffers, usage.arrayBuffers);
  };
  const timer = setInterval(sample, 20);
  return {
    stop: () => clearInterval(timer),
    take: (): MemoryPeak => {
      sample();
      const result = { peakRssMb: Math.round(peak.rss / 1e6), peakArrayBuffersMb: Math.round(peak.arrayBuffers / 1e6) };
      peak.rss = 0;
      peak.arrayBuffers = 0;
      return result;
    },
  };
}

/** Dựng app Nest với pipeline thật, storage đĩa tạm và repository thật/fake. */
async function startServer(): Promise<LoadServer> {
  const workDir = await mkdtemp(join(tmpdir(), 'upload-jobs-load-'));
  let db: DataSource | undefined;
  let mediaRepo: unknown = new FakeMediaRepository();
  let jobRepo: unknown = new FakeUploadJobRepository();
  if (useRealDb) {
    db = new DataSource({ ...appDataSource.options, url: DATABASE_URL, extra: { max: 20 } } as typeof appDataSource.options);
    await db.initialize();
    await db.runMigrations();
    actorId = (await db.getRepository(User).save({ email: `load-${randomUUID().slice(0, 8)}@example.test`, passwordHash: 'x', displayName: 'Load' })).id;
    mediaRepo = new MediaRepository(db.getRepository(Media));
    jobRepo = new MediaUploadJobRepository(db.getRepository(MediaUploadJob));
  }

  const moduleRef = await Test.createTestingModule({
    controllers: [AdminUploadJobsController],
    providers: [
      MediaUploadJobService,
      MediaService,
      MediaInspectionService,
      MediaStorageService,
      MediaUrlService,
      { provide: MEDIA_URL_OPTIONS, useValue: TEST_MEDIA_URL_OPTIONS },
      {
        provide: MEDIA_STORAGE_DRIVER,
        useValue: new LocalStorageDriver({ publicRoot: join(workDir, 'public'), quarantineRoot: join(workDir, 'quarantine') }),
      },
      { provide: MediaRepository, useValue: mediaRepo },
      { provide: MediaUploadJobRepository, useValue: jobRepo },
      { provide: TransactionManager, useValue: new FakeTransactionManager() },
      // Audit không phải đối tượng đo: bỏ ghi DB để harness không cần dọn nhật ký append-only.
      { provide: AuditService, useValue: { recordSafely: async () => undefined } },
      { provide: APP_GUARD, useClass: LoadAuthGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: ['error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const jobs = app.get(MediaUploadJobService);
  const sampler = startMemorySampler();
  return {
    url: `${await app.getUrl()}/admin/media/upload-jobs`,
    idle: () => jobs.whenIdle(),
    memory: async () => sampler.take(),
    close: async () => {
      sampler.stop();
      await app.close();
      if (db) {
        await db.query('DELETE FROM media_upload_jobs WHERE created_by = $1', [actorId]);
        await db.query('DELETE FROM media WHERE created_by = $1', [actorId]);
        await db.query('DELETE FROM users WHERE id = $1', [actorId]);
        await db.destroy();
      }
      await rm(workDir, { recursive: true, force: true });
    },
  };
}

/** Server ở tiến trình con: nhận lệnh `idle`/`close` qua IPC. */
async function runServerChild(): Promise<void> {
  const server = await startServer();
  process.on('message', async (message: { type: string; id: number }) => {
    if (message.type === 'idle') await server.idle();
    const memory = message.type === 'memory' ? await server.memory() : undefined;
    if (message.type === 'close') await server.close();
    process.send?.({ type: 'done', id: message.id, memory });
    if (message.type === 'close') process.exit(0);
  });
  process.send?.({ type: 'ready', url: server.url });
}

/** Fork chính file này với LOAD_ROLE=server, dùng lại `-r ts-node/register`. */
function forkServer(): Promise<LoadServer> {
  const child = fork(__filename, [], { env: { ...process.env, LOAD_ROLE: 'server' }, execArgv: process.execArgv });
  let seq = 0;
  const call = (type: string) =>
    new Promise<MemoryPeak | undefined>((resolve) => {
      const id = ++seq;
      const onMessage = (message: { type: string; id: number; memory?: MemoryPeak }) => {
        if (message.type === 'done' && message.id === id) {
          child.off('message', onMessage);
          resolve(message.memory);
        }
      };
      child.on('message', onMessage);
      child.send({ type, id });
    });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('message', (message: { type: string; url: string }) =>
      resolve({
        url: message.url,
        idle: async () => void (await call('idle')),
        memory: async () => (await call('memory')) as MemoryPeak,
        close: async () => void (await call('close')),
      }),
    );
  });
}

async function main() {
  const server = SAME_PROCESS ? await startServer() : await forkServer();
  const base = server.url;
  const file = new Blob([buildGlbOfSize(FILE_BYTES)], { type: 'model/gltf-binary' });

  async function post(key: string): Promise<{ status: number; id: string; ms: number }> {
    const form = new FormData();
    form.append('file', file, 'load.glb');
    const start = performance.now();
    const res = await fetch(base, { method: 'POST', body: form, headers: { 'Idempotency-Key': key } });
    const body = (await res.json()) as { data?: { id: string } };
    return { status: res.status, id: body.data?.id ?? '', ms: performance.now() - start };
  }

  /** Poll tới khi mọi job kết thúc; trả thời gian từ lúc gửi tới khi thấy trạng thái cuối. */
  async function waitAll(ids: string[], sentAt: number): Promise<{ completionMs: number[]; statuses: Record<string, number>; getMs: number[] }> {
    const pending = new Set(ids);
    const completionMs: number[] = [];
    const getMs: number[] = [];
    const statuses: Record<string, number> = {};
    const deadline = performance.now() + 60_000;
    while (pending.size > 0 && performance.now() < deadline) {
      await Promise.all(
        [...pending].map(async (id) => {
          const start = performance.now();
          const res = await fetch(`${base}/${id}`);
          getMs.push(performance.now() - start);
          const status = ((await res.json()) as { data: { status: string } }).data.status;
          if (status === 'succeeded' || status === 'failed') {
            pending.delete(id);
            completionMs.push(performance.now() - sentAt);
            statuses[status] = (statuses[status] ?? 0) + 1;
          }
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (pending.size > 0) statuses.timeout = pending.size;
    return { completionMs, statuses, getMs };
  }

  const runs = [];
  for (let run = 1; run <= RUNS; run++) {
    // S1: 80 tác vụ khác key cùng lúc.
    const sentAt = performance.now();
    const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => post(randomUUID())));
    const accepted = results.filter((r) => r.status === 202);
    const done = await waitAll(accepted.map((r) => r.id), sentAt);
    await server.idle();

    // S2: 80 retry đồng thời cùng một key → kỳ vọng đúng 1 job (1 lần 202).
    const key = randomUUID();
    const retries = await Promise.all(Array.from({ length: CONCURRENCY }, () => post(key)));
    await server.idle();

    const memory = await server.memory();
    const s1Post = summarize(results.map((r) => r.ms));
    runs.push({
      run,
      memory,
      s1: {
        post: s1Post,
        postStatus: Object.fromEntries([...new Set(results.map((r) => r.status))].map((s) => [s, results.filter((r) => r.status === s).length])),
        meetsTarget: s1Post.p95 <= P95_TARGET_MS,
        getStatus: summarize(done.getMs),
        completion: summarize(done.completionMs),
        jobStatuses: done.statuses,
      },
      s2: {
        post: summarize(retries.map((r) => r.ms)),
        accepted202: retries.filter((r) => r.status === 202).length,
        replay200: retries.filter((r) => r.status === 200).length,
        distinctJobIds: new Set(retries.map((r) => r.id)).size,
      },
    });
    console.log(
      `run ${run}: S1 POST p50=${s1Post.p50}ms p95=${s1Post.p95}ms max=${s1Post.max}ms (${s1Post.p95 <= P95_TARGET_MS ? 'ĐẠT' : 'KHÔNG ĐẠT'} ≤ ${P95_TARGET_MS}ms)` +
        ` | hoàn tất p95=${summarize(done.completionMs).p95}ms ${JSON.stringify(done.statuses)}` +
        ` | S2 202=${runs[runs.length - 1].s2.accepted202} jobId khác nhau=${runs[runs.length - 1].s2.distinctJobIds}` +
        ` | RSS đỉnh=${memory.peakRssMb}MB arrayBuffers đỉnh=${memory.peakArrayBuffersMb}MB`,
    );
  }

  const allPost = runs.flatMap((r) => [r.s1.post.p95]);
  const report = {
    generatedAt: new Date().toISOString(),
    config: { concurrency: CONCURRENCY, runs: RUNS, fileBytes: FILE_BYTES, repository: useRealDb ? 'postgresql-16 (docker, localhost)' : 'in-memory fake', topology: SAME_PROCESS ? 'client+server cùng tiến trình' : 'server ở tiến trình con (fork)', storage: 'local disk (tmp)', p95TargetMs: P95_TARGET_MS },
    machine: { node: process.version, cpus: cpus().length, cpuModel: cpus()[0]?.model, totalMemGb: Math.round(totalmem() / 1e9) },
    runs,
    worstRunPostP95Ms: Math.max(...allPost),
    peakRssMb: Math.max(...runs.map((r) => r.memory.peakRssMb)),
    peakArrayBuffersMb: Math.max(...runs.map((r) => r.memory.peakArrayBuffersMb)),
    allRunsMeetTarget: runs.every((r) => r.s1.meetsTarget),
    idempotencyHeldInAllRuns: runs.every((r) => r.s2.accepted202 === 1 && r.s2.distinctJobIds === 1),
  };
  console.log(`p95 POST tệ nhất qua ${RUNS} lần: ${report.worstRunPostP95Ms} ms; mọi lần đạt mục tiêu: ${report.allRunsMeetTarget}; idempotency giữ ở mọi lần: ${report.idempotencyHeldInAllRuns}`);
  if (process.env.LOAD_OUTPUT) await writeFile(process.env.LOAD_OUTPUT, JSON.stringify(report, null, 2) + '\n');

  await server.close();
}

(process.env.LOAD_ROLE === 'server' ? runServerChild() : main()).catch((error) => {
  console.error(error);
  process.exit(1);
});
