import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ---------------- HEALTH CHECK ---------------- */
app.get("/api/healthz", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* ---------------- CREATE PASTE ---------------- */
app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (ttl_seconds && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "Invalid ttl_seconds" });
  }

  if (max_views && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: "Invalid max_views" });
  }

  const id = nanoid(8);
  const now = Date.now();
  const expiresAt = ttl_seconds ? now + ttl_seconds * 1000 : null;

  db.prepare(`
    INSERT INTO pastes (id, content, expires_at, max_views, views)
    VALUES (?, ?, ?, ?, 0)
  `).run(id, content, expiresAt, max_views ?? null);

  res.json({
    id,
    url: `${req.protocol}://${req.get("host")}/p/${id}`
  });
});

/* ---------------- FETCH PASTE API ---------------- */
app.get("/api/pastes/:id", (req, res) => {
  const paste = db.prepare("SELECT * FROM pastes WHERE id = ?").get(req.params.id);
  if (!paste) return res.status(404).json({ error: "Not found" });

  const now =
    process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"]
      ? Number(req.headers["x-test-now-ms"])
      : Date.now();

  if (paste.expires_at && now > paste.expires_at) {
    return res.status(404).json({ error: "Expired" });
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).json({ error: "View limit exceeded" });
  }

  db.prepare("UPDATE pastes SET views = views + 1 WHERE id = ?").run(paste.id);

  res.json({
    content: paste.content,
    remaining_views:
      paste.max_views === null ? null : paste.max_views - paste.views - 1,
    expires_at: paste.expires_at
      ? new Date(paste.expires_at).toISOString()
      : null
  });
});

/* ---------------- VIEW PASTE (HTML) ---------------- */
app.get("/p/:id", (req, res) => {
  const paste = db.prepare("SELECT * FROM pastes WHERE id = ?").get(req.params.id);
  if (!paste) return res.status(404).send("Not found");

  const now = Date.now();
  if (paste.expires_at && now > paste.expires_at) {
    return res.status(404).send("Expired");
  }
  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).send("View limit exceeded");
  }

  res.send(`
    <html>
      <head>
        <title>Paste</title>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: monospace;
            padding: 24px;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        ${paste.content.replace(/</g, "&lt;")}
      </body>
    </html>
  `);
});

/* ---------------- LOCAL ONLY LISTENER ---------------- */
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
  );
}

export default app;
