import { getStore } from "@netlify/blobs";

const EMPTY_COUNTS = Array(64).fill(0);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function todayKey() {
  const d = new Date();
  return `board:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async (req) => {
  const store = getStore({ name: "moods" });
  const key = todayKey();

  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id");
    const entry = await store.getJSON(key, { counts: EMPTY_COUNTS.slice(), users: {} });
    const counts = Array.isArray(entry?.counts) ? entry.counts.map((n) => Number(n) || 0) : EMPTY_COUNTS.slice();
    const users = entry?.users && typeof entry.users === "object" ? entry.users : {};
    const mine = typeof id === "string" && Object.prototype.hasOwnProperty.call(users, id) ? Number(users[id]) : null;
    return jsonResponse({ counts, mine });
  }

  if (req.method === "POST") {
    const payload = await req.json().catch(() => ({}));
    const id = typeof payload.id === "string" ? payload.id : null;
    const cell = Number(payload.cell);

    if (!id || !Number.isInteger(cell) || cell < 0 || cell >= 64) {
      return jsonResponse({ error: "Invalid request." }, 400);
    }

    const entry = await store.getJSON(key, { counts: EMPTY_COUNTS.slice(), users: {} });
    const counts = Array.isArray(entry?.counts) ? entry.counts.map((n) => Number(n) || 0) : EMPTY_COUNTS.slice();
    const users = entry?.users && typeof entry.users === "object" ? entry.users : {};

    const previous = Number(users[id]);
    if (Number.isInteger(previous) && previous >= 0 && previous < 64) {
      counts[previous] = Math.max(0, (counts[previous] || 0) - 1);
    }

    counts[cell] = Math.max(0, (counts[cell] || 0) + 1);
    users[id] = cell;

    await store.setJSON(key, { counts, users });
    return jsonResponse({ counts, mine: cell });
  }

  if (req.method === "DELETE") {
    const payload = await req.json().catch(() => ({}));
    const id = typeof payload.id === "string" ? payload.id : null;

    if (!id) {
      return jsonResponse({ error: "Missing user id." }, 400);
    }

    const entry = await store.getJSON(key, { counts: EMPTY_COUNTS.slice(), users: {} });
    const counts = Array.isArray(entry?.counts) ? entry.counts.map((n) => Number(n) || 0) : EMPTY_COUNTS.slice();
    const users = entry?.users && typeof entry.users === "object" ? entry.users : {};
    const previous = Number(users[id]);

    if (Number.isInteger(previous) && previous >= 0 && previous < 64) {
      counts[previous] = Math.max(0, (counts[previous] || 0) - 1);
      delete users[id];
      await store.setJSON(key, { counts, users });
      return jsonResponse({ counts, mine: null });
    }

    return jsonResponse({ counts, mine: null });
  }

  return jsonResponse({ error: "Method not allowed." }, 405);
};
