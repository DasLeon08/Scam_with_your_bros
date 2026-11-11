import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // settings come from the .env in the project root
  const env = loadEnv(mode, "..", "VITE_");
  return {
    envDir: "..",
    define: { __SERVER_URL__: JSON.stringify(env.VITE_SERVER_URL ?? "") },
    build: { outDir: "../dist", emptyOutDir: true, assetsInlineLimit: 0 },
    server: { strictPort: true },
  };
});
