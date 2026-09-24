// Shared helpers (no npm dependencies) for The ADHD O/S session API (Netlify Functions v2 + Netlify Blobs).
import { timingSafeEqual } from "node:crypto";

// Store options. Strong consistency: a write at 10:15 PM must be readable
// immediately on another device. (getStore is imported in each function so
// @netlify/blobs resolves from netlify/functions/node_modules.)
export const STORE = { name: "os-sessions", consistency: "strong" };

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const clip = (value, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Single-user prototype auth: a shared secret in the OS_API_TOKEN env var,
// sent by the pages as an x-os-token header. Replace with real auth before other users.
export function authorized(req) {
  const expected = process.env.OS_API_TOKEN || "";
  const received = req.headers.get("x-os-token") || "";
  if (!expected || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
