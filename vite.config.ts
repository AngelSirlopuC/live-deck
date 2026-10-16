import { defineConfig } from "vitest/config";

const serverPort = Number(process.env.PORT ?? 8787);
const http = `http://localhost:${serverPort}`;

export default defineConfig({
  root: "web",
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 5180,
    strictPort: true,
    host: true,
    proxy: {
      "/api": http,
      "/decks": http,
      "/ws": { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
