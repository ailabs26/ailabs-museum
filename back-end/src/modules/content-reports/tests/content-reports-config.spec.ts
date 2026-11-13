import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { publicReportsThrottleOptions } from '../content-reports.module';

describe('publicReportsThrottleOptions', () => {
  it('uses the validated reports limit with a 60-second window', () => {
    const requestedKeys: string[] = [];
    const config = {
      getOrThrow: (key: string) => {
        requestedKeys.push(key);
        return 23;
      },
    } as unknown as ConfigService;

    assert.deepEqual(publicReportsThrottleOptions(config), [{ ttl: 60_000, limit: 23 }]);
    assert.deepEqual(requestedKeys, ['reports.publicRateLimit']);
  });
});
