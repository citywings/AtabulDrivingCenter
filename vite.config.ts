import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { seoPlugin } from "./vite/plugins/seo";

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_* to client code; the SEO plugin runs in Node and
  // needs the value explicitly, so loadEnv is called here rather than relying
  // on process.env being populated.
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    // Relative base keeps the build portable across machines and hosting roots.
    // NOTE: with a relative base, deploy to a URL that ends in a slash
    // (`/prodrive/`), or ./assets/* resolves against the wrong directory and
    // the module 404s. The head watchdog then reveals all content, so a
    // mis-pathed deploy degrades to visible text instead of an invisible page.
    base: "./",
    build: {
      target: "es2020",
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name][hash][extname]",
          chunkFileNames: "assets/[name][hash].js",
          entryFileNames: "assets/[name][hash].js",
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      seoPlugin({
        // http://localhost:5173 is the agreed stand-in production origin until
        // the domain is delegated: set VITE_SITE_URL in .env.local (or in CI)
        // and every canonical/og:/twitter:/sitemap URL re-derives from it.
        siteUrl: env.VITE_SITE_URL ?? process.env.VITE_SITE_URL,
        buildDate: env.VITE_BUILD_DATE ?? process.env.VITE_BUILD_DATE,
      }),
    ],
  };
});
