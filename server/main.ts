import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const app = createApp({
  decksDir: process.env.DECKS_DIR ?? `${root}decks`,
  distDir: process.env.NODE_ENV === "production" ? `${root}dist` : null,
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
