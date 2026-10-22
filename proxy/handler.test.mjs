/* global Request, Response */

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

test("rejects methods outside the explicit allowlist", async () => {
  let calls = 0;
  const handler = createRelayHandler({
    fetchUpstream: async () => {
      calls += 1;
      return new Response("unexpected");
    }
  });
  const response = await handler(new Request("https://relay.example/rest/v1/user_kv", {
    method: "PURGE"
  }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  assert.equal(calls, 0);
});
