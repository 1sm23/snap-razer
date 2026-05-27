import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { cloudflare } from "@cloudflare/vite-plugin";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}/` : "/";

export default defineConfig({
  base,
  plugins: [react(), cloudflare()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/testSetup.ts"]
  }
});