# VT-081: Configurable public report limit

Branch: `feat/vt081-report-rate-config`
Baseline: `4c2a6d0` (`origin/dev`)
Backend directory: `back-end/`

Set `PUBLIC_REPORT_RATE_LIMIT` to an integer from 1 to 100. It defaults to 5 public reports per client IP per minute. Change the backend environment and restart the service to apply it.

Run the focused checks from `back-end/`:

```sh
npm run test:core
npm run test:reports
npm run typecheck
npm run lint
npm run build
```

The VT-081 rate-limit HTTP harness uses the real Nest validation/response pipeline and throttler with an in-memory service, so it needs no database. Existing controller contract tests keep their throttler stub. The 40-client case simulates distinct IPs with forwarded headers and trusts one proxy only inside the test app; its p95 is a harness measurement, not production or PostgreSQL capacity evidence. The throttler remains process-local, so multiple API instances do not share a quota.
