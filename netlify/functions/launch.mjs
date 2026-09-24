// POST /api/launch — saves this morning's Morning Launch session.
import { getStore } from "@netlify/blobs";
import { STORE, json, authorized, readJson, clip, DATE_RE } from "../lib/os-api.mjs";

const STATES = ["foggy", "functional", "firedup"];

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!authorized(req)) return json(401, { error: "Missing or invalid token." });

  const body = await readJson(req);
  if (!body || !DATE_RE.test(body.localDate)) {
    return json(400, { error: "localDate is required (YYYY-MM-DD)." });
  }

  const record = {
    type: "launch",
    localDate: body.localDate,
    state: STATES.includes(body.state) ? body.state : "unknown",
    firstMove: clip(body.firstMove, 500),
    rerouted: body.rerouted === true,
    fromShutdown: DATE_RE.test(body.fromShutdown) ? body.fromShutdown : null,
    src: clip(body.src, 20) || "manual",
    receivedAt: new Date().toISOString(),
  };

  const store = getStore(STORE);
  const key = `launch/${record.localDate}`;
  await store.setJSON(key, record);
  await store.setJSON("pointer/latest-launch", { key, receivedAt: record.receivedAt });

  return json(200, { ok: true, key });
};

export const config = { path: "/api/launch" };
