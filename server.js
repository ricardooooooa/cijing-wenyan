const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleConfigRequest, handleTranslateRequest, resolveAiConfig } = require("./lib/ai-core");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 4173);

loadLocalEnv();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/config") {
      await handleConfigRequest(request, response, process.env);
      return;
    }

    if (url.pathname === "/api/translate") {
      await handleTranslateRequest(request, response, process.env);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    sendJson(response, 500, {
      error: "服务器处理失败",
      detail: error.message
    });
  }
});

server.listen(port, () => {
  const config = resolveAiConfig(process.env);
  const mode = config.apiKey ? `${config.label} / ${config.model}` : "offline preview";
  console.log(`Wenyan app running at http://localhost:${port} (${mode})`);
});

function serveStatic(pathname, response, headOnly) {
  const decodedPath = decodeURIComponent(pathname);
  const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(publicDir, normalized);

  if (decodedPath === "/" || decodedPath.endsWith("/")) {
    filePath = path.join(filePath, "index.html");
  }

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });

    if (headOnly) {
      response.end();
      return;
    }

    fs.createReadStream(filePath).pipe(response);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function loadLocalEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim().replace(/^\uFEFF/, "");
    const value = trimmed
      .slice(equalsIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
