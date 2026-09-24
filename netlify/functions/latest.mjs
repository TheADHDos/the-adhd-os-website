// GET /api/latest — returns the most recent shutdown and launch sessions.
// Morning Launch uses `firstMove`; a future Shutdown step can use `launch`
// to ask whether this morning's first move actually happened.
import { getStore } from "@netlify/blobs";
import { STORE, json, authorized } from "../lib/os-api.mjs";

// "Last night" = a shutdown saved within this window, regardless of calendar date.
const FRESH_HOURS = 20;

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Use GET." });
  if (!authorized(req)) return json(401, { error: "Missing or invalid token." });

  const store = getStore(STORE);
  const [shutdownPtr, launchPtr] = await Promise.all([
    store.get("pointer/latest-shutdown", { type: "json" }),
    store.get("pointer/latest-launch", { type: "json" }),
  ]);
  const [shutdown, launch] = await Promise.all([
    shutdownPtr ? store.get(shutdownPtr.key, { type: "json" }) : null,
    launchPtr ? store.get(launchPtr.key, { type: "json" }) : null,
  ]);

  const ageHours = shutdown
    ? (Date.now() - Date.parse(shutdown.receivedAt)) / 36e5
    : Infinity;
  const fresh = ageHours <= FRESH_HOURS;

  return json(200, {
    status: fresh ? shutdown.status : "none", // completed | urgent | skipped | none
    firstMove: fresh && shutdown.status !== "skipped" ? shutdown.firstMove || null : null,
    date: fresh ? shutdown.localDate : null,
    shutdown,
    launch,
  });
};

export const config = { path: "/api/latest" };
