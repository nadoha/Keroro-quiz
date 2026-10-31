const crypto = require("crypto");
const { get, head, put, BlobNotFoundError } = require("@vercel/blob");
const PATH = "stats/daily.json";
const seoulDate = (ms) => new Date((ms || Date.now()) + 9 * 3600e3).toISOString().slice(0, 10);

async function load() {
  let meta = null;
  try { meta = await head(PATH); } catch (e) { if (!(e instanceof BlobNotFoundError)) throw e; }
  if (!meta) return { data: { days: {} }, etag: null };
  const r = await get(PATH, { access: "private", useCache: false, headers: { "accept-encoding": "identity" } });
  if (!r || r.statusCode !== 200) throw new Error("blob read failed");
  let data; try { data = JSON.parse(await new Response(r.stream).text()); } catch { data = {}; }
  return { data: { days: data.days || {} }, etag: meta.etag };
}
async function bump(field) {
  let lastErr;
  for (let a = 0; a < 5; a++) {
    const { data, etag } = await load();
    const d = seoulDate();
    const day = data.days[d] || (data.days[d] = { visitors: 0, plays: 0 });
    day[field] = (day[field] || 0) + 1;
    const opts = { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: !!etag, cacheControlMaxAge: 60 };
    if (etag) opts.ifMatch = etag;
    try { await put(PATH, JSON.stringify(data), opts); return; } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 80 + Math.random() * 250)); }
  }
  throw lastErr;
}
function isAdmin(req) {
  const admin = process.env.LEADERBOARD_ADMIN_KEY;
  const given = String(req.headers["x-admin-key"] || (req.query && req.query.key) || "");
  const a = Buffer.from(given), b = Buffer.from(String(admin || ""));
  return !!(admin && a.length === b.length && crypto.timingSafeEqual(a, b));
}
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method === "POST") {
      let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
      const e = b && b.e;
      if (e !== "v" && e !== "p") return res.status(400).json({ error: "bad request" });
      await bump(e === "v" ? "visitors" : "plays");
      return res.status(204).end();
    }
    if (req.method === "GET") {
      if (!isAdmin(req)) return res.status(403).json({ error: "forbidden" });
      const { data } = await load();
      const n = Math.min(90, Math.max(1, parseInt((req.query && req.query.days) || "14", 10) || 14));
      const recent = [];
      for (let k = 0; k < n; k++) { const d = seoulDate(Date.now() - k * 864e5); recent.push({ date: d, ...(data.days[d] || { visitors: 0, plays: 0 }) }); }
      const totals = Object.values(data.days).reduce((t, x) => ({ visitors: t.visitors + (x.visitors || 0), plays: t.plays + (x.plays || 0) }), { visitors: 0, plays: 0 });
      return res.status(200).json({ timezone: "Asia/Seoul", today: recent[0], recent, totals, since: Object.keys(data.days).sort()[0] || null });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) { console.error(e); return res.status(500).json({ error: "error" }); }
};
