# LifeDesk Free Keepalive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failing legacy-project ping with a verified read-only database query against the Supabase project used by the deployed LifeDesk app.

**Architecture:** Keep one small GitHub Actions workflow as the scheduler and use the existing public Supabase configuration already shipped by the app. Query `public.user_kv` through PostgREST three times daily; RLS may return an empty array, which is still a successful database query.

**Tech Stack:** GitHub Actions YAML, Bash/curl, Supabase PostgREST, Jest/TypeScript contract tests

---

### Task 1: Replace the workflow contract

**Files:**
- Modify: `src/__tests__/supabase-keepalive-workflow.test.ts`

- [ ] **Step 1: Write the failing expectations**

Change the contract to require the active project URL, reject the legacy project ID, require `GET /rest/v1/user_kv?select=key&limit=1`, accept a JSON array response, and reject Auth-only endpoints and write methods.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `jest --runInBand src/__tests__/supabase-keepalive-workflow.test.ts`

Expected: FAIL because the workflow still points to the legacy project and `/auth/v1/settings`.

### Task 2: Point keepalive at the real LifeDesk database

**Files:**
- Modify: `.github/workflows/keep-supabase-alive.yml`
- Modify: `README.md`

- [ ] **Step 1: Implement the minimal workflow change**

Rename the workflow to `Keep LifeDesk Supabase active`, set the URL to `https://yzoxgsqucugeatcxcurd.supabase.co`, use the existing LifeDesk publishable key from the local `.env`, and query `user_kv` with a read-only GET request.

- [ ] **Step 2: Validate the response**

Require a non-empty response file whose first non-whitespace character is `[`. Do not require a row because RLS may correctly return `[]` for an anonymous request.

- [ ] **Step 3: Update documentation**

Explain that the workflow protects the active LifeDesk backend, uses only public configuration, performs no writes, and leaves the unrelated legacy project paused.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `jest --runInBand src/__tests__/supabase-keepalive-workflow.test.ts`

Expected: 4 tests passed, 0 failed.

### Task 3: Verify and deploy

**Files:**
- Verify: `.github/workflows/keep-supabase-alive.yml`
- Verify: `src/__tests__/supabase-keepalive-workflow.test.ts`

- [ ] **Step 1: Parse YAML and run security checks**

Parse the workflow with the repository's `yaml` package. Scan for the legacy project ID, `sb_secret_`, `service_role`, JWT-shaped keys, GitHub secrets references, and POST/PUT/PATCH/DELETE requests.

Expected: YAML parse succeeds and security scan has no findings.

- [ ] **Step 2: Check the diff**

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Commit, push, and open a pull request**

Commit the focused change, push `fix/keep-active-lifedesk-free`, and open a PR against `main` with the verification results.

- [ ] **Step 4: Merge and verify the real run**

Merge the PR, locate the `Keep LifeDesk Supabase active` push-triggered run, inspect its job steps, and require conclusion `success` before completing the task.
