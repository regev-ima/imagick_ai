import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

// Resolve a short identifier for the build, in priority order:
//   1. Vercel/CI commit SHA env vars (Vercel sets VERCEL_GIT_COMMIT_SHA)
//   2. Local `git rev-parse` (dev / non-CI builds)
//   3. "dev" fallback if neither is available
function resolveCommitSha(): string {
  const ciSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA;
  if (ciSha) return ciSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const BUILD_COMMIT_SHA = resolveCommitSha();
const BUILD_TIME_ISO = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  define: {
    __APP_BUILD_SHA__: JSON.stringify(BUILD_COMMIT_SHA),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME_ISO),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split heavy or rarely-used dependencies into their own chunks so
        // they don't bloat the main entry. recharts and face-api are only
        // touched on dedicated routes; keeping them out of the initial
        // bundle is a meaningful win on slow networks.
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("face-api.js")) return "face-api";
            if (id.includes("recharts")) return "recharts";
            if (id.includes("framer-motion")) return "framer-motion";
            if (id.includes("@sentry/")) return "sentry";
            if (id.includes("@radix-ui/")) return "radix";
          }
          return undefined;
        },
      },
    },
  },
}));
