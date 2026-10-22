import { createRelayHandler } from "../../proxy/handler.mjs";

const relay = createRelayHandler();

export default (request) => relay(request);

export const config = {
  path: [
    "/health",
    "/auth/v1/*",
    "/rest/v1/*",
    "/storage/v1/*",
    "/functions/v1/*",
    "/realtime/v1/*"
  ]
};
