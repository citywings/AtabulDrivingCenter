/**
 * Minimal static server for verifying the production build locally.
 * Usage: node scripts/serve-dist.mjs [port]   (default 4173)
 * For real development use `npm run dev` / `npm run preview`.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat as statAsync } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "dist");
const port = Number(process.argv[2] ?? 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    let filePath = normalize(join(root, decodeURIComponent(url.pathname)));
    // Containment with trailing separator: rejects sibling dirs like dist2
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    let found = true;
    try {
      if ((await statAsync(filePath)).isDirectory()) {
        filePath = join(filePath, "index.html");
        found = existsSync(filePath);
      }
    } catch {
      found = false;
    }

    // This site is one document. There are no client-side routes, so a
    // 200 + index.html for every unknown path would be a textbook soft-404:
    // it burns crawl budget and hides a missing /robots.txt or /sitemap.xml
    // behind a page that exists. Files 404; stray extensionless paths
    // consolidate onto the canonical URL.
    if (!found) {
      if (extname(url.pathname)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end("Not found");
        return;
      }
      res.writeHead(301, { Location: "/", "Cache-Control": "no-store" });
      res.end();
      return;
    }

    const type = mime[extname(filePath).toLowerCase()] ?? "application/octet-stream";
    const size = (await statAsync(filePath)).size;
    // Everything under assets/ is content-hashed by Vite, so it can be pinned
    // for a year; documents and crawler files must revalidate on every load.
    const cache = filePath.startsWith(join(root, "assets"))
      ? "public, max-age=31536000, immutable"
      : "no-cache";

    // Range support — browsers require 206 responses for <video> seeking and
    // reliable looping; without it Safari in particular refuses to play.
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start, end;
      if (m && (m[1] || m[2])) {
        if (m[1]) {
          start = Number(m[1]);
          end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        } else {
          // suffix range: last N bytes
          start = Math.max(0, size - Number(m[2]));
          end = size - 1;
        }
      }
      if (start !== undefined && start < size && start <= end) {
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Cache-Control": cache,
        });
        if (req.method === "HEAD") return res.end();
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
      res.writeHead(416, {
        "Content-Range": `bytes */${size}`,
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Range Not Satisfiable");
      return;
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": size,
      "Accept-Ranges": "bytes",
      "Cache-Control": cache,
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`dist served at http://127.0.0.1:${port}`);
});
