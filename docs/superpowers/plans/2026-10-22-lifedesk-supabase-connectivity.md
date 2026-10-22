# LifeDesk Supabase Connectivity Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore LifeDesk login, avatars, and couple-sharing on networks that reset the project's `supabase.co` connection, while preserving all existing accounts and data on the free tier.

**Architecture:** Add a small, allowlisted Deno Deploy reverse proxy whose only upstream is the active LifeDesk Supabase project. Keep the original Supabase URL when constructing the client so the existing project identity and stored session key remain unchanged; inject a custom fetch that rewrites only network request origins to the Deno relay.

**Tech Stack:** Netlify Functions, standard Web Fetch APIs (also tested under Deno), Expo/React Native, `@supabase/supabase-js`, Node test runner, Jest/TypeScript, GitHub Actions

> **Execution update (2026-10-22):** Deno Deploy account creation returned `403 SIGNUP_UNAVAILABLE`. The audited Fetch API handler remains runtime-neutral and continues to pass under Deno, but production deployment moved to Netlify Functions at `https://lifedesk-supabase-relay.netlify.app`. The Netlify free account was created through browser OAuth, production visibility was explicitly set to public, and both `/health` and a relayed Supabase REST read returned HTTP 200. `netlify/functions/supabase-relay.mjs` and `netlify.toml` are the production deployment contract.

---

## File structure

- `proxy/handler.mjs`: Pure Fetch API request handler. Owns route allowlisting, CORS, upstream header filtering, forwarding, and response hardening.
- `proxy/handler.test.mjs`: Node behavior tests for the proxy handler, using an injected upstream fetch instead of a real network.
- `proxy/main.ts`: Minimal Deno entry point that binds the handler with `Deno.serve()`.
- `proxy/deno.json`: Deno task and deployment metadata for the isolated relay directory.
- `src/auth/supabaseTransport.ts`: App-side origin rewrite function for Supabase's custom fetch hook.
- `src/__tests__/supabase-transport.test.ts`: App transport behavior and regression tests.
- `src/auth/supabaseConfig.ts`: Reads the new public proxy URL without replacing the original Supabase URL.
- `src/auth/supabaseClient.ts`: Injects the proxy-aware fetch into the existing client options.
- `src/__tests__/task2-auth-config.test.ts`: Extends public-config and client-option contracts.
- `.github/workflows/deploy.yml`: Supplies the public Deno relay URL to production web builds.
- `.github/workflows/keep-supabase-alive.yml`: Checks the relay health and performs the existing read-only query through the relay.
- `src/__tests__/supabase-keepalive-workflow.test.ts`: Verifies the production relay is monitored without adding writes or secrets.
- `.env.example` and `README.md`: Document the optional public proxy setting and operational model.

### Task 1: Build the locked-down relay handler with TDD

**Files:**
- Create: `proxy/handler.test.mjs`
- Create: `proxy/handler.mjs`

- [ ] **Step 1: Write failing behavior tests**

Create `proxy/handler.test.mjs` with tests that define the desired interface:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { createRelayHandler } from "./handler.mjs";

const upstreamOrigin = "https://yzoxgsqucugeatcxcurd.supabase.co";
const appOrigin = "https://aiyisuifengqi31.github.io";

test("serves health without contacting Supabase", async () => {
  let calls = 0;
  const handler = createRelayHandler({
    fetchUpstream: async () => {
      calls += 1;
      return new Response("unexpected");
    }
  });
  const response = await handler(new Request("https://relay.example/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { service: "lifedesk-supabase-relay", status: "ok" });
  assert.equal(calls, 0);
});

test("rejects paths outside the Supabase allowlist", async () => {
  const handler = createRelayHandler({ fetchUpstream: globalThis.fetch });
  const response = await handler(new Request("https://relay.example/admin/secrets"));
  assert.equal(response.status, 404);
});

test("forwards an allowed request only to the fixed LifeDesk project", async () => {
  let captured;
  const handler = createRelayHandler({
    fetchUpstream: async (request) => {
      captured = request;
      return Response.json([{ key: "profile" }], { status: 200 });
    }
  });
  const response = await handler(new Request(
    "https://relay.example/rest/v1/user_kv?select=key&limit=1",
    { headers: { apikey: "public-key", origin: appOrigin } }
  ));
  assert.equal(response.status, 200);
  assert.equal(captured.url, `${upstreamOrigin}/rest/v1/user_kv?select=key&limit=1`);
  assert.equal(captured.headers.get("apikey"), "public-key");
  assert.equal(captured.headers.get("host"), null);
  assert.equal(response.headers.get("access-control-allow-origin"), appOrigin);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("forwards a write body exactly once without automatic retry", async () => {
  let calls = 0;
  let capturedBody = "";
  const handler = createRelayHandler({
    fetchUpstream: async (request) => {
      calls += 1;
      capturedBody = await request.text();
      return Response.json({ ok: true });
    }
  });
  const response = await handler(new Request("https://relay.example/rest/v1/user_kv", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"key":"profile"}'
  }));
  assert.equal(response.status, 200);
  assert.equal(capturedBody, '{"key":"profile"}');
  assert.equal(calls, 1);
});

test("handles allowed CORS preflight without contacting Supabase", async () => {
  let calls = 0;
  const handler = createRelayHandler({
    fetchUpstream: async () => {
      calls += 1;
      return new Response();
    }
  });
  const response = await handler(new Request("https://relay.example/auth/v1/token", {
    method: "OPTIONS",
    headers: {
      origin: appOrigin,
      "access-control-request-headers": "apikey,authorization,content-type"
    }
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), appOrigin);
  assert.equal(calls, 0);
});

test("rejects browser origins that do not host LifeDesk", async () => {
  const handler = createRelayHandler({ fetchUpstream: globalThis.fetch });
  const response = await handler(new Request("https://relay.example/rest/v1/user_kv", {
    headers: { origin: "https://attacker.example" }
  }));
  assert.equal(response.status, 403);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test proxy/handler.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `proxy/handler.mjs`.

- [ ] **Step 3: Implement the minimal relay handler**

Create `proxy/handler.mjs`:

```js
const UPSTREAM_ORIGIN = "https://yzoxgsqucugeatcxcurd.supabase.co";
const ALLOWED_PATH_PREFIXES = [
  "/auth/v1/",
  "/rest/v1/",
  "/storage/v1/",
  "/functions/v1/",
  "/realtime/v1/"
];
const ALLOWED_ORIGINS = new Set([
  "https://aiyisuifengqi31.github.io",
  "http://localhost:8081",
  "http://localhost:19006"
]);
const ALLOWED_METHODS = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";

function corsHeaders(origin) {
  const headers = new Headers({
    "access-control-allow-headers": "accept-profile,apikey,authorization,cache-control,content-profile,content-type,prefer,range,x-client-info,x-supabase-api-version,x-upsert",
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-max-age": "86400",
    vary: "Origin"
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function isAllowedPath(pathname) {
  return ALLOWED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function createRelayHandler({ fetchUpstream = globalThis.fetch } = {}) {
  return async function relay(request) {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("origin");

    if (requestUrl.pathname === "/health") {
      return Response.json(
        { service: "lifedesk-supabase-relay", status: "ok" },
        { headers: { "cache-control": "no-store" } }
      );
    }
    if (!isAllowedOrigin(origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!isAllowedPath(requestUrl.pathname)) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, UPSTREAM_ORIGIN);
    const headers = new Headers(request.headers);
    ["host", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-real-ip"].forEach((name) => headers.delete(name));
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual"
    });
    const upstreamResponse = await fetchUpstream(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    corsHeaders(origin).forEach((value, name) => responseHeaders.set(name, value));
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.delete("set-cookie");
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  };
}
```

- [ ] **Step 4: Run the relay tests and verify GREEN**

Run: `node --test proxy/handler.test.mjs`

Expected: 6 tests passed, 0 failed.

- [ ] **Step 5: Commit the relay handler**

```powershell
git add proxy/handler.mjs proxy/handler.test.mjs
git commit -m "feat: add locked-down Supabase relay"
```

### Task 2: Add the Deno entry point and deployment contract

**Files:**
- Create: `proxy/main.ts`
- Create: `proxy/deno.json`
- Create: `src/__tests__/supabase-relay-deployment.test.ts`

- [ ] **Step 1: Write the failing deployment contract test**

Create `src/__tests__/supabase-relay-deployment.test.ts` to read the deployment files and require `Deno.serve`, a local import, no environment-selected upstream, and no high-privilege credentials:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Supabase relay deployment", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("starts the audited local relay handler", () => {
    const main = read("proxy/main.ts");
    expect(main).toContain('import { createRelayHandler } from "./handler.mjs"');
    expect(main).toContain("Deno.serve(createRelayHandler())");
  });

  it("has a repeatable local test task", () => {
    const config = JSON.parse(read("proxy/deno.json"));
    expect(config.tasks.test).toBe("deno test handler.test.mjs");
  });

  it("contains no secret or configurable upstream", () => {
    const source = read("proxy/handler.mjs") + read("proxy/main.ts");
    expect(source).not.toMatch(/service[_-]?role|sb_secret_|Deno\.env|getenv|process\.env/i);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm jest --runInBand src/__tests__/supabase-relay-deployment.test.ts`

Expected: FAIL because `proxy/main.ts` and `proxy/deno.json` do not exist.

- [ ] **Step 3: Add the Deno entry point and config**

Create `proxy/main.ts`:

```ts
import { createRelayHandler } from "./handler.mjs";

Deno.serve(createRelayHandler());
```

Create `proxy/deno.json`:

```json
{
  "tasks": {
    "start": "deno run --allow-net main.ts",
    "test": "deno test handler.test.mjs"
  }
}
```

- [ ] **Step 4: Run the contract and relay tests**

Run:

```powershell
pnpm jest --runInBand src/__tests__/supabase-relay-deployment.test.ts
node --test proxy/handler.test.mjs
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the deployment files**

```powershell
git add proxy/main.ts proxy/deno.json src/__tests__/supabase-relay-deployment.test.ts
git commit -m "feat: prepare Supabase relay deployment"
```

### Task 3: Route the Supabase client through the relay without changing session identity

**Files:**
- Create: `src/__tests__/supabase-transport.test.ts`
- Create: `src/auth/supabaseTransport.ts`
- Modify: `src/auth/supabaseConfig.ts`
- Modify: `src/auth/supabaseClient.ts`
- Modify: `src/__tests__/task2-auth-config.test.ts`

- [ ] **Step 1: Write failing transport tests**

Create `src/__tests__/supabase-transport.test.ts`:

```ts
import { createSupabaseTransport } from "@/auth/supabaseTransport";

describe("Supabase relay transport", () => {
  const supabaseUrl = "https://project.supabase.co";
  const proxyUrl = "https://lifedesk-relay.example";

  it("rewrites only the origin and preserves the complete request", async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, { status: 204 })
    );
    const transport = createSupabaseTransport({ supabaseUrl, proxyUrl, fetchImpl });
    await transport(`${supabaseUrl}/rest/v1/user_kv?select=key`, {
      method: "POST",
      headers: { authorization: "Bearer session", "content-type": "application/json" },
      body: '{"key":"profile"}'
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${proxyUrl}/rest/v1/user_kv?select=key`,
      expect.objectContaining({ method: "POST", body: '{"key":"profile"}' })
    );
  });

  it("uses direct networking when no relay is configured", async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 204 }));
    const transport = createSupabaseTransport({ supabaseUrl, proxyUrl: "", fetchImpl });
    await transport(`${supabaseUrl}/auth/v1/token`, { method: "POST" });
    expect(fetchImpl).toHaveBeenCalledWith(`${supabaseUrl}/auth/v1/token`, { method: "POST" });
  });

  it("does not rewrite unrelated destinations", async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 204 }));
    const transport = createSupabaseTransport({ supabaseUrl, proxyUrl, fetchImpl });
    await transport("https://example.com/health");
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/health", undefined);
  });
});
```

Extend `src/__tests__/task2-auth-config.test.ts` so the expected config includes `proxyUrl`, saves/restores `EXPO_PUBLIC_SUPABASE_PROXY_URL`, and asserts `buildSupabaseClientOptions("web", config).global.fetch` is a function while its auth storage behavior remains unchanged.

- [ ] **Step 2: Run both tests and verify RED**

Run:

```powershell
pnpm jest --runInBand src/__tests__/supabase-transport.test.ts src/__tests__/task2-auth-config.test.ts
```

Expected: FAIL because `supabaseTransport.ts`, `proxyUrl`, and the custom global fetch do not exist.

- [ ] **Step 3: Implement the transport**

Create `src/auth/supabaseTransport.ts`:

```ts
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type SupabaseTransportOptions = {
  fetchImpl?: FetchLike;
  proxyUrl: string;
  supabaseUrl: string;
};

function isRequestInput(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

export function createSupabaseTransport({
  fetchImpl = globalThis.fetch.bind(globalThis),
  proxyUrl,
  supabaseUrl
}: SupabaseTransportOptions): FetchLike {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const proxyOrigin = proxyUrl ? new URL(proxyUrl).origin : "";

  return (input, init) => {
    const rawUrl = isRequestInput(input) ? input.url : input.toString();
    const requestUrl = new URL(rawUrl);
    if (!proxyOrigin || !supabaseOrigin || requestUrl.origin !== supabaseOrigin) {
      return fetchImpl(input, init);
    }
    requestUrl.protocol = new URL(proxyOrigin).protocol;
    requestUrl.host = new URL(proxyOrigin).host;
    if (isRequestInput(input)) {
      return fetchImpl(new Request(requestUrl, input), init);
    }
    return fetchImpl(requestUrl.toString(), init);
  };
}
```

- [ ] **Step 4: Add proxy URL to public config and client options**

Update `SupabasePublicConfig` in `src/auth/supabaseConfig.ts` with `proxyUrl: string`, read `process.env.EXPO_PUBLIC_SUPABASE_PROXY_URL`, and return it without changing the `configured` rule.

Update `buildSupabaseClientOptions` in `src/auth/supabaseClient.ts` to accept the config and add:

```ts
global: {
  fetch: createSupabaseTransport({
    proxyUrl: config.proxyUrl,
    supabaseUrl: config.url
  })
}
```

Call `createClient(config.url, config.anonKey, buildSupabaseClientOptions(Platform.OS, config))`. The first argument must remain `config.url`; do not replace it with the proxy URL.

- [ ] **Step 5: Run the focused tests and typecheck**

Run:

```powershell
pnpm jest --runInBand src/__tests__/supabase-transport.test.ts src/__tests__/task2-auth-config.test.ts
pnpm typecheck
```

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the App transport**

```powershell
git add src/auth/supabaseTransport.ts src/auth/supabaseConfig.ts src/auth/supabaseClient.ts src/__tests__/supabase-transport.test.ts src/__tests__/task2-auth-config.test.ts
git commit -m "fix: route Supabase traffic through optional relay"
```

### Task 4: Deploy the relay to the user's free Deno account

**Files:**
- Verify: `proxy/main.ts`
- Verify: `proxy/handler.mjs`
- Verify: `proxy/deno.json`

- [ ] **Step 1: Install and verify the official Deno CLI**

Install through the official Windows package and verify:

```powershell
winget install --id DenoLand.Deno --exact
deno --version
```

Expected: the CLI prints a Deno 2.x version.

- [ ] **Step 2: Run the relay under Deno locally**

Run:

```powershell
deno task --config proxy/deno.json test
```

Expected: 6 tests passed, 0 failed.

- [ ] **Step 3: Authenticate without sharing credentials**

Run `deno deploy` from `proxy/` in an interactive terminal. Complete the browser/device authorization using the user's GitHub account; Codex must never request or receive the GitHub or Deno password.

- [ ] **Step 4: Create and deploy the free relay app**

From `proxy/`, run the interactive equivalent of:

```powershell
deno deploy create . --app lifedesk-supabase-relay --source local --runtime-mode dynamic --entrypoint main.ts --region global
```

Select the user's free Deno organization when prompted. Record the production URL emitted by Deno, require it to use HTTPS and end in `.deno.net`, and do not store any deploy token in the repository.

- [ ] **Step 5: Verify the deployed health endpoint from the affected network**

Store the exact URL printed by Deno in a shell variable, validate it, and query it:

```powershell
$relayUrl = Read-Host 'Paste the exact Deno production URL'
if ($relayUrl -notmatch '^https://[a-z0-9-]+\.[a-z0-9-]+\.deno\.net/?$') { throw 'Unexpected Deno production URL' }
curl.exe --fail --silent --show-error --max-time 30 "$($relayUrl.TrimEnd('/'))/health"
```

Expected response: `{"service":"lifedesk-supabase-relay","status":"ok"}`.

### Task 5: Wire production builds and monitoring to the deployed relay

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/keep-supabase-alive.yml`
- Modify: `src/__tests__/supabase-keepalive-workflow.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing production wiring assertions**

Extend `src/__tests__/supabase-keepalive-workflow.test.ts` to require the exact deployed Deno URL, `/health`, the existing direct read-only query, and a second read-only `GET /rest/v1/user_kv?select=key&limit=1` through that relay. Require `.github/workflows/deploy.yml` to set `EXPO_PUBLIC_SUPABASE_PROXY_URL` to the same exact public URL. Continue rejecting the legacy project, Auth-only keepalive, writes, GitHub secrets for the public relay URL, JWT-shaped strings, `service_role`, and `sb_secret_`.

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `pnpm jest --runInBand src/__tests__/supabase-keepalive-workflow.test.ts`

Expected: FAIL because production workflows do not contain the deployed relay URL or health check.

- [ ] **Step 3: Add the actual relay URL to production configuration**

Add `EXPO_PUBLIC_SUPABASE_PROXY_URL=` to `.env.example`. In `.github/workflows/deploy.yml`, set `EXPO_PUBLIC_SUPABASE_PROXY_URL` to the exact public URL returned by Deno. Do not use a GitHub secret because the relay URL is public configuration.

Update `.github/workflows/keep-supabase-alive.yml` to:

1. Set `SUPABASE_PROXY_URL` to that same exact URL.
2. Check `"${SUPABASE_PROXY_URL}/health"` with the existing bounded curl settings.
3. Preserve the existing direct `"${SUPABASE_URL}/rest/v1/user_kv?select=key&limit=1"` query so database availability remains independently observable.
4. Add a second `"${SUPABASE_PROXY_URL}/rest/v1/user_kv?select=key&limit=1"` query with `GET` and the existing publishable `apikey` header.
5. Validate both database responses as JSON arrays and keep all no-write guarantees.

Document in `README.md` that the original URL preserves project/session identity while the public proxy URL controls only the network route.

- [ ] **Step 4: Run workflow, relay, transport, YAML, and security checks**

Run:

```powershell
node --test proxy/handler.test.mjs
pnpm jest --runInBand src/__tests__/supabase-relay-deployment.test.ts src/__tests__/supabase-transport.test.ts src/__tests__/task2-auth-config.test.ts src/__tests__/supabase-keepalive-workflow.test.ts
pnpm typecheck
git diff --check
```

Parse both workflow YAML files with the installed `yaml` package. Scan the relay, workflows, and app transport for `service_role`, `sb_secret_`, JWT-shaped credentials, configurable upstream hosts, and logging of authorization/request bodies.

Expected: all focused tests pass, typecheck exits 0, both YAML files parse, security scan has no findings, and diff check exits 0.

- [ ] **Step 5: Commit production wiring**

```powershell
git add .env.example .github/workflows/deploy.yml .github/workflows/keep-supabase-alive.yml src/__tests__/supabase-keepalive-workflow.test.ts README.md
git commit -m "fix: enable LifeDesk Supabase relay in production"
```

### Task 6: Publish and verify the real LifeDesk path

**Files:**
- Verify all files changed in Tasks 1-5.

- [ ] **Step 1: Run the full relevant verification suite**

Re-run Task 5 Step 4 from a clean working tree. Also run the existing cloud-backed storage, partnership, profile, and auth configuration tests selected with Jest paths found by `rg`.

Expected: all relay/connectivity tests pass. If unrelated pre-existing suites fail, record exact suite and test names without claiming the full suite passes.

- [ ] **Step 2: Push and merge through a pull request**

Push `fix/china-supabase-connectivity`, open a PR against `main`, include root-cause evidence and verification results, and squash-merge only after the focused checks pass.

- [ ] **Step 3: Verify real GitHub Actions runs**

Require all of the following after merge:

- `Deploy to GitHub Pages`: completed with conclusion `success`.
- `Keep LifeDesk Supabase active`: the relay health step and read-only database query both completed with conclusion `success`.
- No new repeated/failure loop was triggered by the repository heartbeat.

- [ ] **Step 4: Verify the affected network path**

Read the exact relay URL from the committed production workflow and the existing public key from local configuration without printing either value, then require:

```powershell
$relayUrl = ((Select-String -Path '.github/workflows/deploy.yml' -Pattern 'EXPO_PUBLIC_SUPABASE_PROXY_URL:\s*(https://\S+)').Matches[0].Groups[1].Value).Trim()
$keyLine = Get-Content '.env' | Where-Object { $_ -match '^EXPO_PUBLIC_SUPABASE_(ANON_KEY|PUBLISHABLE_KEY)=' } | Select-Object -First 1
$publicKey = ($keyLine -split '=', 2)[1].Trim()
curl.exe --fail --silent --show-error --max-time 30 --output NUL --write-out "%{http_code}" https://aiyisuifengqi31.github.io/melifedesk/
curl.exe --fail --silent --show-error --max-time 30 "$relayUrl/health"
curl.exe --fail --silent --show-error --max-time 30 -H "apikey: $publicKey" "$relayUrl/rest/v1/user_kv?select=key&limit=1"
```

Expected: App HTTP `200`, relay health JSON, and a Supabase JSON array. The public key must not be echoed in command output.

- [ ] **Step 5: User-visible acceptance**

Ask the user to refresh LifeDesk once. Confirm that the existing session loads the profile avatar and current couple relationship. If the session has naturally expired, confirm a normal login restores the same cloud data. Do not create or delete real shared content without explicit confirmation; use an existing read or a user-created reversible test item for the final shared-data check.

