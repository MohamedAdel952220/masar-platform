# Frontend Phase 5 — Teacher App, Completion Report

**Scope:** the Teacher App only. Parent, Reception and Driver were not started.
**Built on:** Phase 1 foundation, Phase 2 backend integration, and the Platform Admin / Dashboard patterns — all consumed as-is.

**Status: complete. All verification gates pass.**

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 10/10 packages, 0 errors |
| `pnpm lint` | ✅ 10/10 packages, **0 errors, 0 warnings** |
| `pnpm format:check` | ✅ All matched files use Prettier code style |
| `pnpm build` | ✅ 6/6 apps (teacher: 543 KB raw / **159 KB gzipped**) |
| Source files changed outside `apps/teacher` | ✅ **0** |
| Files changed under `backend/` | ✅ **0** |

---

## 1. What was built

26 files. All 13 scope areas delivered.

```
src/
├─ styles.css  main.tsx  App.tsx  app/providers.tsx
├─ lib/        format.ts · teacher.ts (scope + quota helpers)
├─ components/ PageHeader · States (Loading/Empty/Error/OutOfScope/QueryState)
└─ routes/
   ├─ router.tsx  TeacherShell.tsx  NotFound.tsx  MoreRoute.tsx
   ├─ auth/       AuthGate.tsx  LoginRoute.tsx        (1  Login flow)
   ├─ HomeRoute            (2  Teacher home)
   ├─ ClassroomRoute       (3  Classroom dashboard)
   ├─ AttendanceRoute      (4  Attendance)
   ├─ StudentsRoute        (5  Student profiles)
   ├─ ObservationsRoute    (6  Daily observations)
   ├─ EvaluationsRoute     (7  Evaluations)
   ├─ AiPolishRoute        (8  AI Polish Note)
   ├─ ReportsRoute         (9  AI Draft Report + 12 Reports)
   ├─ NotificationsRoute   (10 Notifications)
   ├─ ChatRoute            (11 Chat)
   └─ SettingsRoute        (13 Settings)
```

### A different shell, deliberately

This is the first **mobile** portal, so it does not reuse the desktop consoles' side navigation. `TeacherShell` uses a compact top bar plus a **five-tab bottom bar** (Home · Register · Students · Chat · More), with secondary destinations one tap deeper behind *More*. Every tap target is ≥44px, and the layout respects `env(safe-area-inset-bottom)`. This is the §21 accessibility requirement applied to a device held one-handed in a classroom, not a stylistic choice.

---

## 2. Constraints honoured

### Teacher RLS visibility and classroom-only access

**No client-side classroom filtering is applied anywhere.** A teacher's reach is defined server-side by `classroom_id = ANY(public.current_staff_classroom_ids())`; the app simply reads and the database returns what belongs to them. Re-filtering in the client would duplicate policy and risk drifting from it.

This shows up concretely: `ClassroomRoute` reads `academic.classrooms` and, if the result is empty, renders an explicit *"You are not currently assigned to a classroom"* state rather than a blank screen — because under RLS an empty result is a **scope** outcome, not an error. The `OutOfScope` state exists specifically to say that plainly.

PII discipline (§28) is applied on `StudentsRoute`: a teacher sees name, day state, allergies and the emergency contact — what teaching requires. National IDs, parent employment and financial fields are deliberately not surfaced even though the row carries them.

### `retry: false` mutations, no optimism

Five mutations, all via `useRpcMutation` (which hard-codes `retry: false`). `useOptimisticRpcMutation` appears **nowhere** — verified by grep.

| RPC | Screen | Idempotency |
|---|---|---|
| `mark_attendance` | Register | No key — **natural upsert-by-unique-key** on `(child_id, date)`, which §14.3 explicitly exempts. Re-submitting overwrites rather than duplicating. |
| `submit_evaluation` | Evaluations | No key — natural upsert on `(child, lesson)` |
| `send_message` | Chat | Idempotency key |
| `send_report_draft` | Reports | Idempotency key |
| `update_notification_preferences` | Settings | On the optimistic-safe list, but see below |

Worth stating explicitly: `mark_attendance` accepts no idempotency key yet is *not* one of the seven non-idempotent RPCs, and that is correct rather than an oversight — it is a natural upsert, the documented §14.3 exemption. The register screen is built around that: it seeds from the saved register and its button reads **"Update register"** once a day is already marked, so the replace-semantics are visible to the teacher rather than hidden.

`update_notification_preferences` is one of only two RPCs the architecture permits to update optimistically. I deliberately used the **plain** mutation anyway: a settings toggle is not latency-sensitive enough to justify rollback complexity, and the authoritative row is cheap to await. The optimistic path remains available if that trade changes.

### AI usage quotas (§19)

Today's `calls_used` from `reports.ai_usage_counters` is displayed **before the teacher composes** — on both AI screens — so the limit is learned up front rather than at rejection. The cap itself lives in `tenancy.plan_catalog`, which a teacher has no read policy for, so the app shows usage and defers the ceiling to the server; when the cap is hit, the backend's own bilingual message is surfaced verbatim.

Rate limiting on `ai_polish_note` is specified in §28 but **not implemented backend-side** (`BACKEND_CERTIFICATION.md` §7.2). The in-flight lock on the polish button is documented in-code as a **courtesy control, explicitly not a security boundary**.

### Human review before sending AI reports — enforced, not just documented

This is the constraint I took most literally. On `ReportsRoute`, a draft's **Send button stays disabled until the teacher has expanded that specific draft and ticked "I have read this draft and it is accurate."** The acknowledgement is per-draft, so reviewing one report does not unlock another.

```ts
const canSendThis = maySend && !isSent && acknowledged;
```

AI output is always a draft; nothing reaches a guardian without a person having actually read it. Drafting itself (`ai-draft-report`) is treated as the **batch** it is: dispatched and left, with completion arriving via the notification channel rather than by holding a request open.

### Realtime

Three channels, all through `useRealtimeSubscription` (torn down on unmount):

| Channel | Screen |
|---|---|
| `classroom:{id}:day_path` | Home, Observations |
| `conversation:{id}:messages` | Chat |
| `user:{id}:notifications` | Home, Notifications |

Chat subscribes to **one conversation at a time** — the narrowest filter §15 allows — re-subscribing when the open thread changes.

---

## 3. A correctness detail worth recording

`MasarClaims` carries `tenantId`, `role`, `platformAdminTier` and `appAccess` — but **no user id**. The realtime notification channel filters on `recipient_id`, and the Settings screen needs to find the teacher's own `staff_profiles` row.

The correct key is `session.user.id`: Epic 1 keys the identity tables by `auth.users.id`, so `identity.staff_profiles.id` **is** the auth user id — which is also why `create_support_ticket` can use `auth.uid()` as `reported_by`. Each screen derives it from the session with that reasoning recorded inline, rather than inventing a claim that does not exist.

---

## 4. Reused, not rebuilt

- **Design system:** `Avatar`, `Badge`, `Button`, `Card`, `CenteredLayout`, `Icon`, `Input`, `StatCard`, `StatusPill`.
- **Hooks:** `useAcademicList`, `useCommsList`, `useIdentityList`, `useReportsList`, `useRpcMutation`, `useRealtimeSubscription`.
- **Edge Functions:** `ai-polish-note`, `ai-draft-report` via the typed `invokeEdgeFunction`.
- **Auth / i18n:** `signInWithPhone`, `signOut`, `useAuth`, `useLocale`.

`PageHeader` and `States` were duplicated from the Dashboard — this is the **third** portal to need them, which under `FRONTEND_ARCHITECTURE.md` §3 is exactly the point at which they have earned promotion into `@masar/design-system`. That refactor is now concretely justified rather than speculative, and is recommended for the next phase that may touch shared packages. `DataTable` was deliberately **not** carried over: a dense table is the wrong pattern on a phone, so this app uses card lists throughout.

---

## 5. Known limitations

1. **Unverifiable against real data.** The staging database is still empty, so every screen renders its empty state. Classroom scoping, the register write, the AI flows and the realtime handlers are structurally correct but **not empirically confirmed** — the seeded dataset remains the outstanding prerequisite from Phase 1.
2. **Raising a concern is read-only.** §12 gives teachers "C" on concerns, but the deployed RPC catalogue has **no `raise_concern` function**. Writing directly to the table would bypass the "RPC for writes" model, so `ObservationsRoute` reads concerns and creation is recorded as a follow-up rather than worked around.
3. **Marking a notification read is not implemented**, for the same reason — no `mark_notification_read` RPC exists. Read state is displayed but not mutated.
4. **`submit_request` (approvals) is not surfaced.** Teachers may submit event/trip/exam requests (§12 "C own"), but the RPC takes ten parameters across three request types and deserves a dedicated multi-step form rather than a cramped afterthought. Follow-up.
5. **Attendance covers the teacher's first classroom** when several are assigned; a room switcher is present but the register submits one room at a time (which matches `mark_attendance`'s own shape).
6. **No push notifications.** `register_device_token` exists in the API client but requires the Capacitor shell, which is a later roadmap stage.
7. **No tests** — out of scope for this phase.
8. **Bundle 159 KB gzipped**, within the <200 KB mobile budget.

---

## 6. Verification evidence

```
typecheck   → Tasks: 10 successful, 10 total   (0 errors)
lint        → Tasks: 10 successful, 10 total   (0 errors, 0 warnings)
format      → All matched files use Prettier code style
build       → Tasks:  6 successful,  6 total
              teacher: 543.46 kB │ gzip: 159.49 kB

grep useOptimisticRpcMutation   → none
mutations                       → 5, all useRpcMutation (retry:false)
edge functions                  → ai-polish-note, ai-draft-report
realtime channels               → 3
human-review gate               → send disabled until per-draft acknowledgement
AI quota surfaced               → AiPolishRoute, ReportsRoute
source files changed outside app → 0
backend files changed            → 0
```

---

**The Teacher App is complete and compiles cleanly. Parent, Reception and Driver were not started. Stopping here.**
