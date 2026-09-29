# Bug Report — Task Manager API

**Date:** 2026-09-29  
**Test Coverage:** 97% overall (100% on services/routes)  
**Tests Written:** 84 (39 unit + 45 integration)

---

## Bug 1: Pagination Offset Calculation Error — **FIXED**

**File:** `src/services/taskService.js`  
**Function:** `getPaginated(page, limit)` (line 12)  
**Fixed:** 2026-09-29

### Expected Behavior
Page 1 should return the first `limit` items (indices 0 to limit-1).  
Page 2 should return the next `limit` items (indices limit to 2*limit-1).  
Standard 1-indexed pagination: `offset = (page - 1) * limit`.

### Actual Behavior (Before Fix)
`offset = page * limit` — Page 1 skips the first `limit` items.  
Page 1 with limit=10 returns items 11–20 (or empty if fewer than 11 items exist).  
Page 0 works correctly (offset=0), but API doesn't expose page=0.

### How Discovered
Unit test `getPaginated › returns first page with default limit` failed: expected 10 items, got 5 (items 11–15).  
Integration test `GET /tasks › paginates with page and limit` failed: page=1 returned "Task 6" instead of "Task 1".  
Both tests initially written against correct pagination logic; failures revealed the bug.

### Fix Applied
```javascript
// src/services/taskService.js:12
// Before:
const offset = page * limit;
// After:
const offset = (page - 1) * limit; // FIX: 1-indexed pagination, page 1 starts at offset 0
```

**Tests Updated:** Unit tests (`taskService.test.js`) and integration tests (`routes.test.js`) now assert correct pagination behavior.  
**Verification:** All 84 tests pass, 97% coverage maintained.

---

## Bug 2: `completeTask` Resets Priority to Medium Unconditionally

**File:** `src/services/taskService.js`  
**Function:** `completeTask(id)` (lines 63–77, specifically line 69)

### Expected Behavior
Marking a task complete should:
- Set `status = 'done'`
- Set `completedAt = current timestamp`
- **Preserve** existing `priority` (high/medium/low)

### Actual Behavior
`priority` is **always reset to `'medium'`** regardless of original value.

```javascript
const updated = {
  ...task,
  priority: 'medium',  // <-- hardcoded, loses original priority
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### How Discovered
Unit test `completeTask › resets priority to medium (current behavior)` documents this behavior.  
Test creates task with `priority: 'high'`, calls `completeTask`, asserts `priority === 'medium'`.  
This is a test *of current behavior*, not desired behavior — flagged as bug because losing priority data is unexpected for a "complete" action.

### Fix
Remove the hardcoded priority assignment; let spread preserve it:

```javascript
// src/services/taskService.js:67–71
const updated = {
  ...task,
  // priority: 'medium',  // delete this line
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

**Impact:** Medium — affects data integrity for completed tasks.  
**Risk:** Low — one-line removal; existing tests will need updating (the test asserting `priority === 'medium'` should change to assert priority is preserved).

---

## Bug 3: `getByStatus` Uses Partial Match Instead of Exact Match

**File:** `src/services/taskService.js`  
**Function:** `getByStatus(status)` (line 9)

### Expected Behavior
Return tasks where `task.status === status` (exact match).  
Valid statuses: `'todo'`, `'in_progress'`, `'done'`.

### Actual Behavior
Uses `String.prototype.includes()`:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```
This matches substrings:
- `status="in"` → matches `'in_progress'` (and would match `'in_review'` if it existed)
- `status="do"` → matches `'done'`
- `status="todo"` → correctly matches `'todo'` (but also would match `'todo_list'`)

### How Discovered
While writing unit tests for `getByStatus`, considered edge case of partial string input.  
Tested manually: `taskService.getByStatus('in')` returns the `'in_progress'` task.  
No existing test caught this because tests only used valid full status strings.

### Fix
Use strict equality:
```javascript
// src/services/taskService.js:9
// Before:
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
// After:
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

**Impact:** Low–Medium — only affects `GET /tasks?status=` endpoint. Could cause data leakage if caller passes partial strings (e.g., user input not validated).  
**Risk:** Low — simple fix; validators in routes already restrict status to valid enums, so current API usage is safe. But defensive fix prevents future bugs if validation is bypassed.

---

## Summary Table

| # | Location | Severity | Type | Fix Effort | Status |
|---|----------|----------|------|------------|--------|
| 1 | `taskService.js:12` | High | Logic error (pagination) | 1 line | **FIXED** |
| 2 | `taskService.js:69` | Medium | Data loss (priority reset) | 1 line (delete) | Open |
| 3 | `taskService.js:9` | Low | Incorrect filter (partial match) | 1 line | Open |

---

## Recommendation for Day 2

**Bug 1 (pagination) — FIXED** — highest user impact, breaks core list functionality.  
**Bug 2 (priority reset)** — data integrity issue, easy fix.  
**Bug 3** can wait — current validators prevent exploitation, but should be fixed for code correctness.

Remaining fixes are single-line changes in `taskService.js`. Update corresponding tests after each fix.