"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const url = require("url");

function loadEnv(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("//")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

const rootDir = __dirname;
const env = {
  ...loadEnv(path.join(rootDir, "SERVER_ENV.txt")),
  ...loadEnv(path.join(rootDir, ".env.server")),
  HOST: process.env.HOST || undefined,
  PORT: process.env.PORT || undefined,
  PUBLIC_DIR: process.env.PUBLIC_DIR || undefined
};

const host = env.HOST || "0.0.0.0";
const port = Number(env.PORT || 4173);
const publicDir = path.resolve(rootDir, env.PUBLIC_DIR || "public");

if (!fs.existsSync(publicDir)) {
  console.error("Public directory not found:", publicDir);
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8"
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/");
  const pathname = decodeURIComponent(parsed.pathname || "/");

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, host, port }));
    return;
  }

  const safePath = path.normalize(pathname).replace(/^([\\/])+/, "");
  let filePath = path.join(publicDir, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }

  const spaFallback = path.join(publicDir, "index.html");
  if (fs.existsSync(spaFallback)) {
    sendFile(res, spaFallback);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(port, host, () => {
  console.log(`LoversCalendar server started on http://${host}:${port}`);
  console.log(`Serving: ${publicDir}`);
});
