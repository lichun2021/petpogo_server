# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

There is **no test suite, no linter, no typecheck script** wired up. `nuxt build` is the only correctness gate — when verifying changes, run `npm run build` and check it succeeds.

Deploy SSH key is `lc.pem` in the repo root (gitignored). `.env` holds all secrets and is shipped with the deploy zip.

## Architecture

### Two API surfaces with different auth

The `server/middleware/signature.ts` middleware **only inspects `/sdkapi/**`**. Admin endpoints under `/api/**` are not signature-checked.

- **`/sdkapi/**`** (mobile App): every request must carry `x-timestamp` (ms) and `x-signature` = `md5(timestamp + APP_API_SECRET)`. Timestamp skew > 5min is rejected. Auth (when needed) uses `Authorization: Bearer <ipet_token>` — token validated by `requireAuth(event)` in `server/utils/auth.ts`. `sdkapi/auth/login-pwd.post.ts` (password login) is rate-limited via `server/utils/loginRateLimit.ts`: 5 wrong passwords for the same phone locks that phone out for 15 minutes (`RedisKey.userLoginFail`).
- **`/api/admin/**`** (admin console): JWT auth, enforced by `server/middleware/admin-auth.ts` (checks every `/api/admin/**` path except `login.post.ts` and `captcha.get.ts`). Admins live in `t_admin` (two roles: `super_admin` / `admin`), password hashed with `crypto.scrypt` (`server/utils/password.ts`). `/api/admin/login` is rate-limited the same way as App password login (`RedisKey.adminLoginFail`, 5 attempts / 15min lockout, checked before the captcha/password work), requires a solved slider captcha (`GET /api/admin/captcha` issues a single-use, 120s-TTL challenge in Redis, checked by `captchaToken`/`captchaOffset` in the login body) plus a username/password match against `t_admin`, and issues a 6h JWT via `signJwt()`. **Only one token is valid per admin at a time** — login writes `sha256(token)` to `RedisKey.adminSession(adminId)` (TTL 6h, matches the JWT), and the middleware rejects any token whose hash doesn't match the currently-stored one, so a new login silently invalidates the previous session; `POST /api/admin/logout` clears it early. On first boot with an empty `t_admin` table, `server/plugins/bootstrapAdmin.ts` seeds one `super_admin` row from the `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars — those env vars are bootstrap-only after that. Routes that need `super_admin` (managing other admins, `settings.put`, `push.post`, `fix-video-status`) call `requireSuperAdmin(event)` from `server/utils/adminAuth.ts`, which reads `event.context.admin` set by the middleware. The admin frontend's global `$fetch` is wrapped in `app/plugins/adminAuthInterceptor.client.ts` to redirect to `/admin/login` on any 401 (expired/kicked-out token).

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
- Multi-tab admin UI: `app/layouts/admin.vue` + `app/composables/useTabStore.ts`. Tab state is global via Nuxt `useState` (no Pinia). `<NuxtPage :keepalive>` caches up to 15 page components so switching tabs preserves form state.
- Admin token stored in `localStorage.admin_token`; pages call `/api/admin/**` with `Authorization: Bearer`.
- `/` redirects to `/admin/login` (see `routeRules` in `nuxt.config.ts`).
- UI is `@nuxt/ui` v3 with heroicons; styling is hardcoded amber/orange palette via inline `style=`.

### Database

Schema lives in `sql/init.sql` (single file, ~20 tables, MySQL 8.0+ with JSON columns). Tables are prefixed `t_`. Conventions: `id BIGINT PRIMARY KEY` (Snowflake or AUTO_INCREMENT), soft-delete via `deleted TINYINT DEFAULT 0`, timestamps in `+08:00` (set on the pool, not per-column). There is no migration tool — schema changes are applied by editing `init.sql` and running it manually against the DB.

### Server route layout convention

Nitro file-based routing under `server/routes/`. File suffix determines HTTP method (`.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`). Dynamic segments use `[id]/`. Examples:
- `server/routes/sdkapi/post/[id]/like.post.ts` → `POST /sdkapi/post/:id/like`
- `server/routes/api/admin/users/[id]/vip.put.ts` → `PUT /api/admin/users/:id/vip`

Handlers use `defineEventHandler` and auto-import h3 helpers (`readBody`, `getQuery`, `getHeader`, `createError`). `useDb()`, `useRedis()`, `useRuntimeConfig()`, `generateId()`, `RedisKey`, peer/IM/auth utils are all auto-imported from `server/utils/`.

### Logging

`server/plugins/logger.ts` logs every `/api/**` and `/sdkapi/**` request and response (with 1000-char truncation, body skipped for `/upload`). Set expectations accordingly when grepping production logs.

## Config / environment

All runtime config flows through `nuxt.config.ts` `runtimeConfig` (read via `useRuntimeConfig()`); see that file for the full env var list. Notable env vars when something breaks:
- `PEER_BACKEND_URL` (internal) / `PEER_BACKEND_PUBLIC_URL` (handed to App) — without these, App login dies with `503 对方后台地址未配置`
- `APP_API_SECRET` — signature secret; mismatch = `403 Invalid signature`
- `JWT_SECRET` — admin JWT signing
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — bootstrap creds for the initial `t_admin` super_admin row, only used when that table is empty (defaults `admin` / `PetPogo@Admin2026`)
- `MYSQL_*`, `REDIS_*`, `ALI_SMS_*`, `ALI_OSS_*`, `TENCENT_IM_*`, `AI_SERVICE_URL`

Code, comments, and commit messages are in Chinese. Match the existing language when editing nearby strings/comments.
