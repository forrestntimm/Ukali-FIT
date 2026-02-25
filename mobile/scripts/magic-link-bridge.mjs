import http from "node:http";

const PORT = Number(process.env.MAGIC_LINK_BRIDGE_PORT || 3000);
const TARGET_DEEP_LINK =
  process.env.EXPO_DEEP_LINK || "exp://127.0.0.1:8081/--/auth/callback";

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ukali Login Redirect</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
      .card { max-width: 640px; margin: 60px auto; background: #111827; border-radius: 14px; padding: 20px; }
      a { color: #60a5fa; }
      code { color: #bfdbfe; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Completing sign in...</h2>
      <p>If the app does not open automatically, tap the link below:</p>
      <p><a id="fallback-link" href="#">Open Ukali App</a></p>
      <p><small>Deep link target: <code>${TARGET_DEEP_LINK}</code></small></p>
    </div>
    <script>
      const target = ${JSON.stringify(TARGET_DEEP_LINK)};
      const suffix = window.location.search + window.location.hash;
      const next = target + suffix;
      const fallback = document.getElementById("fallback-link");
      fallback.href = next;
      window.location.replace(next);
    </script>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  // eslint-disable-next-line no-console
  console.log(`Bridge hit: ${req.method} ${req.url || "/"}`);
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`Magic-link bridge listening on http://127.0.0.1:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Forwarding to deep link: ${TARGET_DEEP_LINK}`);
});
