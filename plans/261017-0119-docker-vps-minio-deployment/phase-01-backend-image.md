# Phase 1 — Container hóa back-end

## File
- `back-end/Dockerfile`, `back-end/.dockerignore` (mới)
- `back-end/package.json` (thêm script prod)
- `back-end/src/main.ts` (trust proxy, Swagger theo env)

## Dockerfile (multi-stage)
1. `deps`: `node:20-alpine`, `npm ci`.
2. `build`: copy source, `npm run build` → `dist/`.
3. `runtime`: `node:20-alpine`, `npm ci --omit=dev`, copy `dist/`, `USER node`, `EXPOSE 3001`, `CMD ["node","dist/main.js"]`, `HEALTHCHECK` gọi `GET /api/health`.

`.dockerignore`: `node_modules`, `dist`, `.env*`, `public/media`, `storage`, `**/*.spec.ts`.

## Script prod (không cần ts-node trong image runtime)
```
"migration:run:prod": "typeorm migration:run -d dist/config/data-source.js",
"seed:prod": "node dist/database/seeds/seed.js"
```
Kiểm tra `nest build` có compile `src/database/migrations/*` và `seeds/*` vào `dist/` (nếu `tsconfig.build.json` exclude thì phải sửa).

## Sửa `main.ts`
- `app.getHttpAdapter().getInstance().set('trust proxy', 1)` — 1 hop (Nginx). Kiểm tra audit log ghi đúng IP client.
- Chỉ `SwaggerModule.setup` khi không phải production (D7).
- Xác nhận cookie refresh token có `secure: true` khi production (xem `AuthController`).

## Env bắt buộc (validate trong `env.validation.ts`)
`NODE_ENV=production`, `PORT=3001`, `DATABASE_URL=postgres://aura:***@db:5432/aura_museum`, `FRONTEND_ORIGIN`, `MEDIA_PUBLIC_BASE_URL` (= domain HTTPS), `JWT_ACCESS_SECRET`, `MEDIA_URL_SIGNING_SECRET` (≥ 32 ký tự, sinh ngẫu nhiên).

## Tiêu chí xong
- `docker build` thành công, image runtime < ~250 MB, chạy user non-root.
- Container `migrate` (cùng image, command `npm run migration:run:prod`) chạy migration trên DB trống thành công.
- `npm run typecheck`, `npm run lint`, `npm test` vẫn xanh.
