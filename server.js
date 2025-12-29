const express = require("express");
const { nanoid } = require("nanoid");
const db = require("./db");
const app = express();
app.use(express.json());
app.use(express.static("public"));
function now(req) {
  if (process.env.TEST_MODE === "1") {
    const h = req.header("x-test-now-ms");
    if (h) return Number(h);
  }
  return Date.now();
}
app.get("/api/healthz", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});
app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (ttl_seconds !== undefined && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "Invalid ttl_seconds" });
  }

  if (max_views !== undefined && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: "Invalid max_views" });
  }

  const id = nanoid(8);
  const createdAt = now(req);
  const expiresAt = ttl_seconds ? createdAt + ttl_seconds * 1000 : null;

  db.prepare(`
    INSERT INTO pastes (id, content, created_at, expires_at, max_views)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, content, createdAt, expiresAt, max_views ?? null);

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.status(201).json({
    id,
    url: `${baseUrl}/p/${id}`
  });
})
app.get("/api/pastes/:id", (req, res) => {
  const paste = db.prepare("SELECT * FROM pastes WHERE id = ?").get(req.params.id);
  if (!paste) return res.status(404).json({ error: "Not found" });

  const t = now(req);
  if (paste.expires_at && t >= paste.expires_at)
    return res.status(404).json({ error: "Expired" });

  if (paste.max_views !== null && paste.views >= paste.max_views)
    return res.status(404).json({ error: "View limit exceeded" });
  db.prepare("UPDATE pastes SET views = views + 1 WHERE id = ?").run(paste.id);
  res.json({
    content: paste.content,
    remaining_views:
      paste.max_views === null ? null : paste.max_views - (paste.views + 1),
    expires_at: paste.expires_at ? new Date(paste.expires_at).toISOString() : null
  });
});
app.get("/p/:id", (req, res) => {
  const paste = db.prepare("SELECT * FROM pastes WHERE id = ?").get(req.params.id);
  if (!paste) return res.status(404).send("Not Found");

  const t = now(req);
  if (paste.expires_at && t >= paste.expires_at) return res.status(404).send("Expired");
  if (paste.max_views !== null && paste.views >= paste.max_views)
    return res.status(404).send("View limit exceeded");

  db.prepare("UPDATE pastes SET views = views + 1 WHERE id = ?").run(paste.id);

  res.set("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <pre>${escapeHtml(paste.content)}</pre>
      </body>
    </html>
  `);
});
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
