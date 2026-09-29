## Submission Notes

### Design decisions — `PATCH /tasks/:id/assign`

- **Validation before lookup (400 before 404):** The route validates the body first (`tasks.js:73-76`), then resolves the task (`tasks.js:78-81`). This matches the existing `PUT /tasks/:id` pattern and means a malformed payload is reported even if the id is also wrong — callers fix their payload before hunting for a missing resource.
- **Empty / whitespace assignee rejected, but stored value is not trimmed:** `validators.js:44-46` rejects `""` and `"   "` so an assignment is never meaningless, but `"  John "` is stored as-is. I chose not to silently mutate user input — trimming would be a surprising side effect; if trimming is desired it should be an explicit product decision.
- **Re-assignment allowed:** `assignTask` overwrites (`taskService.js:84-87`). Blocking re-assignment would need an extra 409/400 path and extra state; for a single-user task tool, overwriting is the simpler default and is explicitly tested (`routes.test.js:392-403`). If the product needs assignment history, that's a schema change, not an endpoint guard.
- **`assignee` is not part of create/PUT:** The feature spec scopes assignment to its own endpoint, so the task shape returned by `POST`/`PUT` is unchanged; `assignee` only appears after a successful assign.

### What I'd test next

If I had more time, I'd verify that `GET /tasks/stats` correctly handles edge cases like tasks with `dueDate: null` and mixed statuses, add a malformed-JSON test (currently returns 500 via `app.js:9-12`, not 400), and add a unit test for `assignTask` directly in `taskService.test.js` (currently only covered through HTTP).

### Surprises in the codebase

One thing that surprised me was the **pagination bug** — using `page * limit` instead of `(page - 1) * limit` is an easy oversight when quickly writing an API, but it fundamentally breaks the expected page 1 behavior (skipping the first `limit` items). I also hadn't realized `completeTask` unconditionally resets `priority` to `'medium'`, which could cause data integrity issues in a real system. Finally, the `status` filter silently bypasses pagination (`tasks.js:14-17` returns before the pagination branch) — I enshrined that behavior in a passing test rather than treating it as a bug.

### Questions before shipping to production

1. Should `completeTask` preserve the original priority, or is resetting to medium intentional?
2. Is the `getByStatus` partial-match behavior (`includes()`) a latent bug waiting to happen with partial status strings?
3. Does the in-memory store need persistence (database migration) for production use?
4. What auth/authorization should protect these routes?
5. Should `status` filter and `page`/`limit` be combinable instead of filter taking precedence?
6. Should malformed JSON bodies return 400 instead of 500?