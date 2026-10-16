import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = process.env;
const production = env.NODE_ENV === "production";
const port = Number(env.PORT ?? 8787);
const host = env.HOST ?? "0.0.0.0";

const adminKey = env.ADMIN_KEY?.trim() || null;
if (production && !adminKey) {
  console.error("ADMIN_KEY is required in production: it protects session creation.");
  process.exit(1);
}

const app = createApp({
  decksDir: env.DECKS_DIR ?? `${root}decks`,
  distDir: production ? `${root}dist` : null,
  adminKey,
  publicBaseUrl: env.PUBLIC_BASE_URL?.trim() || null,
  trustProxy: env.TRUST_PROXY === "1",
  allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  giphyKey: env.GIPHY_API_KEY?.trim() || null,
});

const server = createServer(app.handle);
app.attach(server);
server.listen(port, host, () => console.log(`live-deck listening on http://${host}:${port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close();
    server.close(() => process.exit(0));
  });
}
