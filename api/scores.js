const crypto = require("crypto");
const { get, head, put, BlobNotFoundError } = require("@vercel/blob");

const PATH = "leaderboard/scores.json";
const KEEP = 200, MIN_MS = 10000, MAX_MS = 60 * 60 * 1000;
const RL_WINDOW = 10 * 60 * 1000, RL_MAX = 5;
const BAD = ["시발","씨발","ㅅㅂ","병신","ㅂㅅ","좆","존나","개새","새끼","지랄","미친놈","미친년","닥쳐","느금","니애미","애미","애비","섹스","보지","자지","fuck","shit","bitch","sex","nigg"];
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");

function cleanNick(raw) {
  let n = String(raw || "").normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/[<>&"'`\\/{}\[\]]/g, "").replace(/\s+/g, " ").trim();
  n = Array.from(n).slice(0, 12).join("").trim();
  if (!n) return { err: "닉네임을 입력해 주세요" };
  const flat = n.toLowerCase().replace(/[\s._\-~!@#$%^*()+=|:;,?0-9]/g, "");
  if (BAD.some(b => flat.includes(b))) return { err: "다른 닉네임을 써 주세요" };
  return { n };
}
const cmp = (a, b) => b.s - a.s || a.t - b.t || a.at - b.at;
const pub = e => ({ id: e.id, n: e.n, s: e.s, t: e.t, at: e.at });

async function load(forWrite) {
  let meta = null;
  try { meta = await head(PATH); } catch (e) { if (!(e instanceof BlobNotFoundError)) throw e; }
  if (!meta) return { data: { scores: [], rl: {} }, etag: null };
  const r = await get(PATH, { access: "private", useCache: false, headers: { "accept-encoding": "identity" } });
  if (!r || r.statusCode !== 200) throw new Error("blob read failed");
  const txt = await new Response(r.stream).text();
  let data; try { data = JSON.parse(txt); } catch { data = {}; }
  return { data: { scores: data.scores || [], rl: data.rl || {} }, etag: meta.etag };
}
async function save(data, etag) {
  const opts = { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: !!etag, cacheControlMaxAge: 60 };
  if (etag) opts.ifMatch = etag;
  await put(PATH, JSON.stringify(data), opts);
}
async function mutate(fn) {
  let lastErr;
  for (let a = 0; a < 4; a++) {
    const { data, etag } = await load();
    const out = fn(data);
    if (out && out.noWrite) return out;
    try { await save(data, etag); return out; } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 80 + Math.random() * 200)); }
  }
  throw lastErr;
}
function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method === "GET") {
      const { data } = await load();
      res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
      return res.status(200).json({ top: data.scores.sort(cmp).slice(0, 10).map(pub), total: data.scores.length });
    }
    if (req.method === "POST") {
      const b = body(req);
      const nk = cleanNick(b.nick);
      if (nk.err) return res.status(400).json({ error: nk.err });
      const s = Number(b.score), t = Number(b.ms);
      if (!Number.isInteger(s) || s < 0 || s > 10) return res.status(400).json({ error: "점수가 올바르지 않아요" });
      if (!Number.isFinite(t) || t < MIN_MS || t > MAX_MS) return res.status(400).json({ error: "기록 시간이 올바르지 않아요" });
      const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim() || "unknown";
      const ipk = sha("kq|" + ip).slice(0, 16), now = Date.now();
      const delKey = crypto.randomBytes(12).toString("hex");
      const out = await mutate(data => {
        for (const k of Object.keys(data.rl)) { data.rl[k] = data.rl[k].filter(x => now - x < RL_WINDOW); if (!data.rl[k].length) delete data.rl[k]; }
        const hits = data.rl[ipk] || [];
        if (hits.length >= RL_MAX) return { noWrite: true, limited: true };
        data.rl[ipk] = [...hits, now];
        const e = { id: crypto.randomBytes(6).toString("hex"), n: nk.n, s, t: Math.round(t), at: now, k: sha(delKey) };
        data.scores.push(e); data.scores.sort(cmp);
        const rank = data.scores.indexOf(e) + 1, total = data.scores.length;
        data.scores = data.scores.slice(0, KEEP);
        return { entry: pub(e), rank, total };
      });
      if (out.limited) return res.status(429).json({ error: "잠시 후 다시 등록해 주세요 (10분에 5번까지)" });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ...out, delKey });
    }
    if (req.method === "DELETE") {
      const b = body(req);
      const admin = process.env.LEADERBOARD_ADMIN_KEY;
      const isAdmin = !!(admin && b.adminKey && b.adminKey.length === admin.length && crypto.timingSafeEqual(Buffer.from(String(b.adminKey)), Buffer.from(admin)));
      if (!b.id || (!b.delKey && !isAdmin)) return res.status(400).json({ error: "bad request" });
      const kh = b.delKey ? sha(b.delKey) : null;
      const out = await mutate(data => {
        const before = data.scores.length;
        data.scores = data.scores.filter(e => !(e.id === b.id && (isAdmin || e.k === kh)));
        return before === data.scores.length ? { noWrite: true, deleted: false } : { deleted: true };
      });
      return res.status(out.deleted ? 200 : 404).json(out);
    }
    if (req.method === "PATCH") {
      const b = body(req);
      const admin = process.env.LEADERBOARD_ADMIN_KEY;
      const ak = Buffer.from(String(b.adminKey || "")), ad = Buffer.from(String(admin || ""));
      const isAdmin = !!(admin && ak.length === ad.length && crypto.timingSafeEqual(ak, ad));
      if (!isAdmin) return res.status(403).json({ error: "forbidden" });
      if (!b.id) return res.status(400).json({ error: "bad request" });
      const nk = cleanNick(b.n);
      if (nk.err) return res.status(400).json({ error: nk.err });
      const out = await mutate(data => {
        const e = data.scores.find(x => x.id === String(b.id));
        if (!e) return { noWrite: true, updated: false };
        e.n = nk.n;
        return { updated: true, entry: pub(e) };
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(out.updated ? 200 : 404).json(out);
    }
    res.setHeader("Allow", "GET, POST, DELETE, PATCH");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "잠시 후 다시 시도해 주세요" });
  }
};
