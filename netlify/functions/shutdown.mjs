// POST /api/shutdown — saves tonight's Shutdown Sequence session.
// One record per local date; re-submitting the same night overwrites it.
import { getStore } from "@netlify/blobs";
import { STORE, json, authorized, readJson, clip, DATE_RE } from "../lib/os-api.mjs";

const STATUSES = ["completed", "skipped", "urgent"];

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!authorized(req)) return json(401, { error: "Missing or invalid token." });

  const body = await readJson(req);
  if (!body || !DATE_RE.test(body.localDate)) {
    return json(400, { error: "localDate is required (YYYY-MM-DD)." });
  }

  const rating = Number(body.rating);
  const record = {
    type: "shutdown",
    status: STATUSES.includes(body.status) ? body.status : "completed",
    localDate: body.localDate,
    closeTime: clip(body.closeTime, 20),
    wins: Array.isArray(body.wins)
      ? body.wins.map((w) => clip(w, 300)).filter(Boolean).slice(0, 30)
      : [],
    dump: clip(body.dump, 4000),
    reframe: clip(body.reframe, 500),
    firstMove: clip(body.firstMove, 500),
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    src: clip(body.src, 20) || "manual",
    receivedAt: new Date().toISOString(),
  };

  const store = getStore(STORE);
  const key = `shutdown/${record.localDate}`;
  await store.setJSON(key, record);
  await store.setJSON("pointer/latest-shutdown", { key, receivedAt: record.receivedAt });

  return json(200, { ok: true, key });
};

export const config = { path: "/api/shutdown" };
