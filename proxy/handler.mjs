/* global Headers, Request, Response, URL */

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
const ALLOWED_METHOD_SET = new Set(ALLOWED_METHODS.split(","));

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
    if (!ALLOWED_METHOD_SET.has(request.method)) {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: ALLOWED_METHODS }
      });
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
