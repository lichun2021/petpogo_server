# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

**petpogo-server** (萌宠帮) — Nuxt 4 full-stack server providing:
- **Admin web console** at `/admin/**` (Vue pages under `app/pages/admin/`)
- **Admin REST API** at `/api/**` (JWT auth, password-based admin login)
- **Mobile App REST API** at `/sdkapi/**` (signed requests + ipet_token auth)

Single Node process, Nitro server engine (`node-server` preset), deployed via PM2.

## Commands

```bash
npm run dev          # nuxt dev (HMR, vite polling watcher)
npm run build        # outputs to .output/
npm run start        # node .output/server/index.mjs (after build)
npm run preview      # nuxt preview

./deploy.sh          # full build + scp .output to 115.29.196.61:/data/petpogo-server + pm2 restart
./deploy.sh --build  # local build only, no upload
./start.sh           # pm2 start ecosystem.config.js (on server)
./restart.sh         # pm2 restart petpogo-server
./stop.sh
```

Verification: `npm test`, `npm run typecheck`, and `npm run build`. Real MySQL integration tests require their test environment and otherwise skip. After production builds run `npm run check:secrets` with the local environment available; it reports names only, never secret values.

Deploy SSH key is `lc.pem` in the repo root (gitignored). `.env` holds local secrets and must never be shipped with the deploy zip. Production runtime defaults stay secret-free; `scripts/runtime-env.mjs` maps legacy variables to `NUXT_*` at startup. `npm start` loads the local `.env`; deployment includes the same startup mapping.

## Architecture

### Two API surfaces with different auth

The `server/middleware/signature.ts` middleware **only inspects `/sdkapi/**`**. Admin endpoints under `/api/**` are not signature-checked.

- **`/sdkapi/**`** (mobile App): every request must carry `x-timestamp` (ms) and `x-signature` = `md5(timestamp + APP_API_SECRET)`. Timestamp skew > 5min is rejected. Auth (when needed) uses `Authorization: Bearer <ipet_token>` — token validated by `requireAuth(event)` in `server/utils/auth.ts`.
- **`/api/admin/**`** (admin console): JWT auth. Admin login (`/api/admin/login`) checks against `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (no DB user) and issues a 30-day JWT via `signJwt()`.

### Peer iPet backend integration

This server is a **frontend-facing aggregator on top of a separate iPet hardware backend** (the "对方后台"). All HTTP calls to it live in `server/utils/peerBackend.ts`. Critical rules:

- Account mapping: local phone `13800138000` → peer account `13800138000@qq.com`. Password is hardcoded to `'12345678'` for all users — peer backend is essentially trusted on our side.
- On App login (`sdkapi/auth/login.post.ts`): we validate phone+SMS locally, then **synchronously** call `peerLogin()` to obtain `ipet_token` (the user-facing token), AWS Cognito pool, AWS IoT endpoint, and AWS temp creds. All of these are returned to the App so the App can directly talk to the peer backend for pet/device endpoints.
- The `ipet_token` is the **only** session token. We do not sign our own JWTs for App users. We store `sha256(ipet_token) → { userId, phone }` in Redis (key prefix `peer_token:`) for fast O(1) reverse lookup in `requireAuth`.
- `peerBackendPublicUrl` (default `http://49.234.39.11:8006`) is handed to the App as `peer.gatewayUrl` so the App calls peer endpoints directly, not through us.

### IDs and MySQL precision

User IDs use **Snowflake** (`server/utils/snowflake.ts`, EPOCH 2026-01-01, 10 seq bits → 12-13 digit BIGINTs). The MySQL pool in `server/utils/mysql.ts` is configured with `supportBigNumbers: true, bigNumberStrings: true` because mysql2's default truncates 18-digit BIGINTs at `Number.MAX_SAFE_INTEGER`. **All BIGINT columns come back as strings.** When passing IDs back into queries always coerce to string (`String(user.id)`). In `requireAuth` we re-query `t_user.id` and overwrite the session userId to defend against precision drift.

### Redis usage

`server/utils/redis.ts` exports `useRedis()` (singleton ioredis) and a `RedisKey` map. Keys you'll see across the codebase:
- `peer_token:<sha256>` — App session, TTL = peer `expiration` (~12h)
- `sms:code:<phone>` — SMS verification code with attempt counter
- `im:usersig:<userId>` — cached Tencent IM UserSig (6 days)
- `device:mac:<mac>`, `device:position:<mac>` — device state cache
- `granwinDeviceProperties:merchantId:<mid>:mac:<mac>` — **legacy key shape**, kept to interop with peer backend

Always use the `RedisKey` helpers rather than hand-formatting keys.

### External integrations

All in `server/utils/`:
- **`peerBackend.ts`** — iPet backend (`POST /user/register`, `/user/login`, `/user/refresh/token`, `/user/info/update`, all `application/x-www-form-urlencoded`)
- **`tencentIm.ts`** — Tencent IM REST API; `genUserSig()` for client login, `imImportAccount`, `imSendMsg` (single chat, can spoof `From_Account` to any registered user — used for interaction notifications), `imCreateGroup`, etc. SDKAppID is currently the 100-user trial.
- **`aiQuota.ts`** — `t_ai_usage` table, 10/day for normal users, unlimited for VIP. Two flows: `checkAndIncrAiUsage` (charge upfront) vs `checkAiQuota` + `incrAiUsage` (charge on success).
- AI service is at `AI_SERVICE_URL` (default `http://127.0.0.1:8000`), called by `sdkapi/ai/*` and `api/ai/analyze.post.ts`.

### Frontend (admin console)

- **Nuxt 4 compatibility mode** (`future.compatibilityVersion: 4`) — pages, layouts, composables are under `app/`, not the repo root. There's a legacy `composables/useTabStore.ts` at the root that is **not auto-scanned** in compat mode; the live copy is `app/composables/useTabStore.ts` (per commit e98aaba).
- Multi-tab admin UI: `app/layouts/admin.vue` + `app/composables/useTabStore.ts`. Tab state is global via Nuxt `useState` (no Pinia). `<NuxtPage :keepalive>` caches opened list/editor components; closing tabs invalidates their cache. Dynamic post details are not cached. Navigation/title/icon/cache metadata lives in `app/utils/adminPages.ts`.
- Admin token stored in `localStorage.admin_token`; pages call `/api/admin/**` with `Authorization: Bearer`.
- `/` redirects to `/admin/login` (see `routeRules` in `nuxt.config.ts`).
- UI is `@nuxt/ui` v3 with heroicons; styling is hardcoded amber/orange palette via inline `style=`.

### Database

Schema lives in `sql/init.sql` (single file, ~20 tables, MySQL 8.0+ with JSON columns). Tables are prefixed `t_`. Conventions: `id BIGINT PRIMARY KEY` (Snowflake or AUTO_INCREMENT), soft-delete via `deleted TINYINT DEFAULT 0`, timestamps in `+08:00` (set on the pool, not per-column). Incremental migrations are under `migrations/`; use `npm run db:migrate` to apply and `npm run db:check` to verify. Keep `init.sql` aligned for new databases.

### Server route layout convention

Nitro file-based routing under `server/routes/`. File suffix determines HTTP method (`.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`). Dynamic segments use `[id]/`. Examples:
- `server/routes/sdkapi/post/[id]/like.post.ts` → `POST /sdkapi/post/:id/like`
- `server/routes/api/admin/users/[id]/vip.put.ts` → `PUT /api/admin/users/:id/vip`

Handlers use `defineEventHandler` and auto-import h3 helpers (`readBody`, `getQuery`, `getHeader`, `createError`). `useDb()`, `useRedis()`, `useRuntimeConfig()`, `generateId()`, `RedisKey`, peer/IM/auth utils are all auto-imported from `server/utils/`.

### Logging

`server/plugins/logger.ts` writes two records per request with a Beijing-time prefix and requestId. Peer requests include business JSON; token visibility currently follows the user-approved debugging setting `LOG_REDACT_TOKENS` (true hides tokens). Never log passwords or cloud secrets. Propagate upstream failures through request context rather than adding duplicate log lines.

## Config / environment

All runtime config flows through `nuxt.config.ts` `runtimeConfig` (read via `useRuntimeConfig()`); see that file for the full env var list. Notable env vars when something breaks:
- `PEER_BACKEND_URL` (internal) / `PEER_BACKEND_PUBLIC_URL` (handed to App) — without these, App login dies with `503 对方后台地址未配置`
- `APP_API_SECRET` — signature secret; mismatch = `403 Invalid signature`
- `JWT_SECRET` — admin JWT signing
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin login creds (defaults `admin` / `PetPogo@Admin2026`)
- `MYSQL_*`, `REDIS_*`, `ALI_SMS_*`, `ALI_OSS_*`, `TENCENT_IM_*`, `AI_SERVICE_URL`

Code, comments, and commit messages are in Chinese. Match the existing language when editing nearby strings/comments.
