## 1. Database schema

- [x] 1.1 Add `satiety`, `mood`, `cleanliness`, `background_id`, `model_id`, `stats_updated_at`, `updated_at` columns to `t_pet` in `sql/init.sql`
- [x] 1.2 Create `t_pet_background` table (id, name, image_url, enabled, deleted, created_at, updated_at)
- [x] 1.3 Create `t_pet_model` table (id, name, glb_url, thumbnail_url, enabled, deleted, created_at, updated_at)
- [x] 1.4 Create `t_pet_glb_action` table (id, name, glb_url, preview_url, enabled, deleted, created_at, updated_at) — the standalone animation resource library
- [x] 1.5 Create `t_pet_interaction_type` table (id, code, name, icon_url, `glb_action_id` BIGINT NULL FK -> `t_pet_glb_action.id`, satiety_delta, mood_delta, cleanliness_delta, enabled, deleted, created_at, updated_at) — full CRUD resource, seed 3 initial rows: feed/play/clean (with `glb_action_id` left NULL until an admin maps them)
- [x] 1.6 Create `t_pet_hardware_action_type` table (id, code, name, icon_url, `glb_action_id` BIGINT NULL FK -> `t_pet_glb_action.id`, enabled, deleted, created_at, updated_at) — full CRUD resource, seed 5 initial rows: lying/eating/sitting/walking/standing (with `glb_action_id` left NULL until an admin maps them)
- [x] 1.7 Create `t_pet_event` table (id, `source` ENUM('interaction','hardware_action'), pet_id BIGINT NULL, device_id BIGINT NULL, ref_type_id BIGINT — the `t_pet_interaction_type.id` or `t_pet_hardware_action_type.id` involved, occurred_at DATETIME, created_at) with indexes on pet_id, device_id, and occurred_at — unified append-only log for both interaction and hardware-action activity
- [x] 1.8 Apply updated `sql/init.sql` manually against the local dev DB and confirm no errors

## 2. Redis keys

- [x] 2.1 Add `RedisKey.petAction(deviceId)` helper to `server/utils/redis.ts` following the existing key-map convention

## 3. App-facing pet profile CRUD (`/sdkapi/pet/**`)

- [x] 3.1 Update `server/routes/sdkapi/pet/create.post.ts` to use `generateId()` instead of `insertId`
- [x] 3.2 Add `server/routes/sdkapi/pet/[id].get.ts` — detail, owner-only, excludes deleted
- [x] 3.3 Add `server/routes/sdkapi/pet/[id].put.ts` — update mutable fields, owner-only
- [x] 3.4 Add `server/routes/sdkapi/pet/[id].delete.ts` — soft delete, owner-only
- [x] 3.5 Verify `server/routes/sdkapi/pet/list.get.ts` already excludes deleted pets (add filter if missing)

## 4. Admin pet profile CRUD (`/api/admin/pets/**`)

- [x] 4.1 Add `server/routes/api/admin/pets/list.get.ts` — paginated, filter by user id and/or keyword
- [x] 4.2 Add `server/routes/api/admin/pets/[id].get.ts` — detail, any owner
- [x] 4.3 Add `server/routes/api/admin/pets/[id].put.ts` — edit mutable fields, any owner
- [x] 4.4 Add `server/routes/api/admin/pets/[id].delete.ts` — soft delete, any owner
- [x] 4.5 Add `app/pages/admin/pets/index.vue` — list table + filter bar + edit modal, following `device-events.vue`/`music/index.vue` styling conventions

## 5. Vital stats (satiety / mood / cleanliness)

- [x] 5.1 Add decay + effect computation helper in `server/utils/` (pure function: given last stats + timestamp + elapsed time + decay rates, returns current stats floored at 0/capped at 100)
- [x] 5.2 Add `server/routes/sdkapi/pet/[id]/status.get.ts` — owner-only, returns lazily-decayed current stats without persisting
- [x] 5.3 Add `server/routes/sdkapi/pet/[id]/interact.post.ts` — owner-only, applies decay then the named interaction type's stat effects, persists new stats + `stats_updated_at`, resolves the interaction type's `glb_action_id` to a URL via `t_pet_glb_action`, appends a `{source: 'interaction', pet_id, ref_type_id, occurred_at}` row to `t_pet_event`, and returns updated stats + that animation URL
- [x] 5.4 Reject interactions referencing a disabled or unknown (never created, or since deleted) interaction type with a validation error, and append no `t_pet_event` row for a rejected interaction

## 6. Resource library admin CRUD (backgrounds / models / GLB actions / interaction types)

- [x] 6.1 Add `server/routes/api/admin/pet-resources/upload-sign.post.ts` — OSS presign for image + GLB (`model/gltf-binary`/`.glb`), parameterized by `folder` (`pet-background`|`pet-model`|`pet-glb-action`)
- [x] 6.2 Add `server/routes/api/admin/pet-backgrounds/list.get.ts`, `create.post.ts`, `[id].put.ts`, `[id].delete.ts`
- [x] 6.3 Add `server/routes/api/admin/pet-models/list.get.ts`, `create.post.ts`, `[id].put.ts`, `[id].delete.ts`
- [x] 6.4 Add `server/routes/api/admin/pet-glb-actions/list.get.ts`, `create.post.ts`, `[id].put.ts`, `[id].delete.ts` — CRUD for the standalone animation resource library; `[id].delete.ts` performs the soft delete even if referenced elsewhere (per spec)
- [x] 6.5 Add `server/routes/api/admin/pet-interaction-types/list.get.ts`, `create.post.ts`, `[id].put.ts`, `[id].delete.ts` — full create/list/update/soft-delete; `create`/`update` accept `glb_action_id` (not a GLB URL) and validate it references an existing, non-deleted `t_pet_glb_action` row, plus `satiety_delta`/`mood_delta`/`cleanliness_delta` values
- [x] 6.6 Add `app/pages/admin/virtual-pet/scenes.vue` — four sections/tabs (backgrounds, models, GLB action library, interaction types), all four true add/edit/delete CRUD lists; the GLB action library tab is where GLB files are actually uploaded via the presign endpoint, the interaction type tab's create/edit form picks an existing GLB action resource from a dropdown instead of uploading its own file

## 7. App-facing resource manifest

- [x] 7.1 Add `server/routes/sdkapi/pet/resources.get.ts` — returns enabled backgrounds + models + GLB action resources + interaction types (each interaction type including its resolved `glb_action_id` -> URL) in one response

## 8. Hardware action code CRUD, reporting, polling, and GLB mapping

- [x] 8.1 Add `server/routes/api/admin/pet-hardware-actions/list.get.ts`, `create.post.ts`, `[id].put.ts`, `[id].delete.ts` — full create/list/update/soft-delete for hardware action codes (display name, icon, enabled, `glb_action_id` mapping); validates a submitted `glb_action_id` references an existing, non-deleted `t_pet_glb_action` row, and allows clearing the mapping to null
- [x] 8.2 Add `server/routes/openapi/pet/action/report.post.ts` — signature-protected (reuse `openapi-auth.ts` middleware), validates the reported value is a currently defined, non-deleted `t_pet_hardware_action_type.code` (rejects unknown/deleted codes), writes only the code + timestamp to Redis (`RedisKey.petAction`) and appends a `{source: 'hardware_action', device_id, ref_type_id, occurred_at}` row to `t_pet_event`; never accepts or stores a GLB URL
- [x] 8.3 Add `server/routes/sdkapi/pet/[id]/action.get.ts` — owner-only, resolves pet's associated device, reads the action code from Redis first (falls back to latest matching `t_pet_event` row for that device), then looks up that code's `t_pet_hardware_action_type.glb_action_id` and joins `t_pet_glb_action` to resolve the current animation URL at read time; returns `{code, reportedAt, glbUrl}` with `glbUrl` possibly null if unmapped, and an empty/unknown result if no report has ever been received
- [x] 8.4 Add `app/pages/admin/virtual-pet/actions.vue` — hardware action code CRUD list (add/edit/delete rows: display name/icon/enabled inputs + a dropdown of existing GLB action resources to map/clear per code)

## 9. Unified pet event log and admin query page

- [x] 9.1 Add `server/routes/api/admin/pet-events.get.ts` — paginated, filterable by pet id, device id, source type (interaction|hardware_action), and occurred_at date range, most-recent-first; joins `t_pet_interaction_type`/`t_pet_hardware_action_type` via `ref_type_id` (per `source`) to include the human-readable type name in the response
- [x] 9.2 Add `app/pages/admin/virtual-pet/events.vue` — filter bar (pet/device/source-type/date-range) + event list table, following `device-events.vue` styling conventions

## 10. Verification

- [x] 10.1 Run `npm run build` and confirm it succeeds with no type/build errors
- [x] 10.2 Manually exercise new `/sdkapi/pet/**` endpoints (create, get, update, delete, status, interact, resources, action) against a local/dev DB
- [x] 10.3 Manually exercise new `/api/admin/**` endpoints (including creating and deleting a custom interaction type and a custom hardware action code beyond the seeded ones) via curl against a local server; admin pages exercised via code review (no browser session in this environment)
- [x] 10.4 Manually exercise `/openapi/pet/action/report` with a valid and an invalid signature, and with a valid and a deleted/unknown action code
- [x] 10.5 Manually verify re-mapping a hardware action code to a different GLB action resource is reflected immediately on the next `/sdkapi/pet/[id]/action` poll without needing a fresh hardware report
- [x] 10.6 Manually verify both an interaction and a hardware action report each produce a row in the `/api/admin/pet-events` list, and that a rejected interaction/report produces no row
- [x] 10.7 Run `openspec validate add-virtual-pet-system --strict` and resolve any reported issues
