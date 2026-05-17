import { createServer } from "node:http";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";

const rootDir = new URL("../", import.meta.url).pathname;
const port = Number(process.env.PORT || 8080);
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/transcode") {
      await handleTranscode(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`Multi Funscript Editor listening on http://0.0.0.0:${port}`);
});

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    await pipeline(createReadStream(filePath), res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function handleTranscode(req, res) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (!contentLength) {
    sendJson(res, 400, { error: "Missing request body" });
    return;
  }
  if (contentLength > maxUploadBytes) {
    sendJson(res, 413, { error: "Video is larger than MAX_UPLOAD_BYTES" });
    return;
  }

  const jobId = randomUUID();
  const workDir = join(tmpdir(), `multi-funscript-${jobId}`);
  const inputPath = join(workDir, "input");
  const outputPath = join(workDir, "preview.mp4");

  await fs.mkdir(workDir, { recursive: true });
  try {
    await pipeline(req, createWriteStream(inputPath));
    await runFfmpeg(inputPath, outputPath);

    const stat = await fs.stat(outputPath);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
      "Content-Disposition": "inline; filename=\"preview-h264.mp4\""
    });
    await pipeline(createReadStream(outputPath), res);
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath
    ];
    const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed with code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}
