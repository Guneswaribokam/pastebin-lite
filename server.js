import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let store;

if (process.env.KV_REST_API_URL) {
  // Vercel KV (production)
  const { kv } = await import("@vercel/kv");
  store = {
    async set(key, value, ttl) {
      await kv.set(key, value, { ex: ttl });
    },
    async get(key) {
      return await kv.get(key);
    }
  };
} else {
  // Local memory store
  const memory = new Map();
  store = {
    async set(key, value, ttl) {
      memory.set(key, value);
      if (ttl) {
        setTimeout(() => memory.delete(key), ttl * 1000);
      }
    },
    async get(key) {
      return memory.get(key);
    }
  };
}

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/pastes", async (req, res) => {
  const { content, ttl_seconds = 3600, max_views = 10 } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  const id = nanoid(8);

  await store.set(
    id,
    {
      content,
      views: max_views
    },
    ttl_seconds
  );

  res.json({
    url: `${req.protocol}://${req.get("host")}/${id}`
  });
});


app.get("/:id", async (req, res) => {
  const data = await store.get(req.params.id);

  if (!data) {
    return res.status(404).send("Paste expired or not found");
  }

  if (data.views <= 0) {
    return res.status(410).send("Paste view limit reached");
  }

  data.views--;

  res.send(`
    <pre style="white-space:pre-wrap;font-family:monospace">
${data.content}
    </pre>
  `);
});


app.get("/health", (_, res) => res.send("OK"));

export default app;
