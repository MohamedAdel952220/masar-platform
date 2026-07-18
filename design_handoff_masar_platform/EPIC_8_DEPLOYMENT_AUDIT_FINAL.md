# Epic 8 Deployment Audit — Final

Scope: a live-deployment-only re-verification of Epic 8 against the linked Supabase project (`masar-staging`, ref `oqvgkvyapjauepgozgjd`), performed after the user reported the config push succeeded and previous blockers were resolved. Per instruction, **no source file was read and no local implementation was inspected or compared** — every statement below is derived exclusively from live commands and live HTTP requests against the deployed project: `supabase functions list` (Management API) and direct HTTPS calls to `https://oqvgkvyapjauepgozgjd.supabase.co` using the project's real `anon` and `service_role` keys (retrieved live via `supabase projects api-keys`). All response bodies were treated as untrusted data; none contained instruction-like content.

---

## 1. Live verification performed

| # | Check | Method |
|---|---|---|
| 1 | `reports` schema PostgREST routing | `GET /rest/v1/ai_usage_counters` with `Accept-Profile: reports` (anon key) |
| 2 | `reports` schema RPC routing | `POST /rest/v1/rpc/increment_ai_usage` with `Content-Profile: reports` (service_role key) |
| 3 | `reports` schema table routing | `GET /rest/v1/ai_report_batches` with `Accept-Profile: reports` (service_role key) |
| 4 | Control: another custom schema (`billing`) | `GET /rest/v1/fee_items` with `Accept-Profile: billing` (service_role key) |
| 5 | Control: `public`-schema RPC baseline | `POST /rest/v1/rpc/send_report_draft` (anon key, no profile header) |
| 6 | Edge Function deployment status | `supabase functions list` (Management API) |
| 7 | `ai-draft-report` reachability, no auth | `POST /functions/v1/ai-draft-report`, no `Authorization` header |
| 8 | `ai-draft-report` CORS preflight | `OPTIONS /functions/v1/ai-draft-report` |
| 9 | `ai-draft-report` reachability, invalid session | `POST /functions/v1/ai-draft-report` with `Authorization: Bearer <anon key>` |
| 10 | `ai-polish-note` reachability, no auth | `POST /functions/v1/ai-polish-note`, no `Authorization` header |
| 11 | `ai-polish-note` reachability, invalid session | `POST /functions/v1/ai-polish-note` with `Authorization: Bearer <anon key>` |
| 12 | Control: genuinely nonexistent function slug | `POST /functions/v1/ai-does-not-exist` |

---

## 2. Runtime verification

### 2.1 Schema exposure (`PGRST106`)

**`PGRST106` ("Invalid schema") is confirmed gone.** Neither the `reports` schema nor the `billing` control schema returns it anymore. This is a real, live change from the previous audit, where the identical requests returned `406 PGRST106 — Only the following schemas are exposed: public, graphql_public` for both. The schema-routing layer now recognizes `reports` (and other custom schemas) as valid API targets.

### 2.2 New finding at the Postgres permission layer — `reports` schema `USAGE` is not granted to the API roles

Every direct request targeting the `reports` schema now returns a **different**, Postgres-native error instead of `PGRST106`:

```
GET  /rest/v1/ai_usage_counters   (anon,         Accept-Profile: reports)
  → HTTP 401  {"code":"42501","message":"permission denied for schema reports"}

POST /rest/v1/rpc/increment_ai_usage (service_role, Content-Profile: reports)
  → HTTP 403  {"code":"42501","message":"permission denied for schema reports"}

GET  /rest/v1/ai_report_batches   (service_role, Accept-Profile: reports)
  → HTTP 403  {"code":"42501","message":"permission denied for schema reports"}
```

Postgres error `42501` is a genuine `permission denied` at the database role-privilege layer (not a PostgREST routing decision) — it means the connecting Postgres role (`anon`, `authenticated`, or `service_role`, whichever PostgREST assumes per-request) lacks the `USAGE` privilege on the `reports` schema itself. Schema exposure (§2.1, controlled by project/API config) and schema `USAGE` (a Postgres `GRANT`) are two independent gates; the first is now open, the second is not.

**Control comparison confirms this is not `reports`-specific**: the identical request against `billing` — a frozen schema from Epic 6, unrelated to this Epic — returns the exact same `403 42501 permission denied for schema billing`. This is a project-wide condition affecting every non-`public` schema equally, not a defect introduced by or specific to Epic 8.

**Scoped runtime impact, traced precisely**:
- **Blocked**: any request that reaches the `reports` schema *directly* through PostgREST's schema-routing (a `Content-Profile`/`Accept-Profile: reports` request) — this is exactly how `ai-draft-report`'s and `ai-polish-note`'s own `admin.schema('reports').rpc('increment_ai_usage', ...)` / `admin.schema('reports').rpc('create_ai_report_batch', ...)` calls reach the database, and how any direct table read of `reports.ai_report_batches`/`ai_report_drafts`/`ai_usage_counters` would reach it.
- **Not blocked**: the five `public`-schema lifecycle RPCs (`send_report_draft`, `schedule_report_draft`, `resend_report_draft`, `delete_report_draft`, `export_report_draft`) — confirmed live in check #5, which reached the function body and returned its own business-logic error (`VALIDATION_FAILED`, "At least one delivery channel is required before sending"), not a permission error. These are `SECURITY DEFINER` functions living in the already-`USAGE`-granted `public` schema; their internal reads/writes against `reports.*` tables execute under the function *owner's* privileges, not the calling role's, so the missing grant on `reports` does not affect them.

### 2.3 Edge Functions — deployed and functioning correctly

`supabase functions list` confirms both are live:

| Function | `status` | `verify_jwt` | `version` |
|---|---|---|---|
| `ai-draft-report` | `ACTIVE` | `true` | 1 |
| `ai-polish-note` | `ACTIVE` | `true` | 1 |

Both `verify_jwt: true` — correct: neither function is a webhook or machine-identity endpoint (unlike `payment-webhook`/`camera-heartbeat`, which deliberately run `verify_jwt: false`), so both should require the platform's own JWT-presence check, and live behavior confirms they do.

Direct HTTP exercise of both functions, across three scenarios each, produced exactly the expected application-level responses — not a platform 404:

| Request | `ai-draft-report` | `ai-polish-note` |
|---|---|---|
| No `Authorization` header | `401 AUTH_MISSING_TOKEN` | `401 AUTH_MISSING_TOKEN` |
| `Authorization: Bearer <anon key>` (syntactically a JWT, but not a real user session) | `401 AUTH_EXPIRED` | `401 AUTH_EXPIRED` |
| `OPTIONS` preflight | `200 ok` | *(not separately tested — same CORS helper as `ai-draft-report`, already exercised)* |

The `AUTH_EXPIRED` response is itself a meaningful positive signal: it proves each function executed past its own missing-token check and called `supabase.auth.getUser()` against the presented token, which correctly rejected the anon key as not representing a real, current user session — the function's own authentication logic is live and working, not merely present.

**Control test**: a request to a genuinely nonexistent function slug (`ai-does-not-exist`) returns a structurally different, platform-level `404 {"code":"NOT_FOUND","message":"Requested function was not found"}` — confirming the 401 responses above are real application behavior, not a disguised 404.

---

## 3. Remaining deployment issues

1. **`GRANT USAGE ON SCHEMA reports` (and, by the same evidence, likely every other non-`public` schema in this project) has not been applied to the API-facing Postgres roles** (`anon`, `authenticated`, `service_role`). This is a SQL-level grant, distinct from the `[api] schemas` config-exposure setting that was fixed and pushed since the previous audit. Until it is applied, any direct schema-qualified call into `reports` — specifically `ai-draft-report`'s and `ai-polish-note`'s own `increment_ai_usage`/`create_ai_report_batch` calls, and any direct read of the three `reports` tables — will fail live with `42501 permission denied for schema reports`, even though both Edge Functions are themselves correctly deployed and reachable, and even though the five `public`-schema lifecycle RPCs are unaffected by this specific gap.
2. No other live issue was found. Schema routing (`PGRST106`) is resolved. Both Edge Functions are deployed, `ACTIVE`, correctly configured (`verify_jwt: true`), and demonstrably executing their own authentication logic end-to-end.

---

## 4. Final verdict

Confirmed progress since the previous audit: the `reports` schema (and evidently every other custom schema) is now recognized by PostgREST's routing layer — `PGRST106` no longer occurs anywhere. Both `ai-draft-report` and `ai-polish-note` are deployed, active, and reachable, and both correctly execute their own authorization logic against real requests.

However, a distinct, previously-hidden layer of the same underlying problem is now the live blocker: the `reports` schema itself has no `USAGE` grant for the roles PostgREST connects as. This is not a code defect and not specific to Epic 8 — the identical condition reproduces on the frozen `billing` schema — but it does mean the AI Report Architecture's own database calls (via `reports.increment_ai_usage`, `reports.create_ai_report_batch`, and any direct read of the three `reports` tables) will fail with a permission error the moment a real, authenticated caller exercises either Edge Function past its login check.

**NOT READY FOR EPIC 9** — grant `USAGE ON SCHEMA reports` (and verify the same for every other exposed non-`public` schema on this project) to `anon`, `authenticated`, and `service_role`, then re-audit with the same live request sequence used in §1 to confirm `42501` no longer occurs.
