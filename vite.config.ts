import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

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
