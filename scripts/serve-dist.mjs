import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT ?? 8090);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  let filePath = join(root, cleanPath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, cleanPath, "index.html");
  }

  if (!existsSync(filePath)) {
    filePath = join(root, "index.html");
  }

  response.setHeader("Content-Type", contentTypes.get(extname(filePath)) ?? "application/octet-stream");
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
