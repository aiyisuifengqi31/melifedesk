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

    const relayUrl = new URL(requestUrl.pathname + requestUrl.search + requestUrl.hash, proxyOrigin);
    if (isRequestInput(input)) {
      return fetchImpl(new Request(relayUrl, input), init);
    }
    return fetchImpl(relayUrl.toString(), init);
  };
}
