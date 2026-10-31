import { MAX_VALUE_BYTES, SYNCED_KEYS, readState, syncUnavailable, writeState } from "@/lib/userState";

export const dynamic = "force-dynamic";

// Everything saved, for a device to catch up with
export async function GET() {
  const reason = syncUnavailable();
  if (reason) return Response.json({ enabled: false, reason });
  try {
    return Response.json({ enabled: true, state: await readState() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: "Couldn't read saved data" }, { status: 500 });
  }
}

// Saves one key: { key, value, changedAt }
export async function PUT(req) {
  const reason = syncUnavailable();
  if (reason) return Response.json({ enabled: false, reason }, { status: 409 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: true, message: "Send JSON" }, { status: 400 });
  }
  const { key, value, changedAt } = body ?? {};
  if (!SYNCED_KEYS.includes(key) || value === undefined || !Number.isFinite(changedAt)) {
    return Response.json({ error: true, message: "Unknown key or missing value" }, { status: 400 });
  }
  if (JSON.stringify(value).length > MAX_VALUE_BYTES) {
    return Response.json({ error: true, message: "Too large to save" }, { status: 413 });
  }
  try {
    // A device whose clock runs fast would otherwise block every later change
    const when = Math.min(changedAt, Date.now());
    return Response.json({ enabled: true, ...(await writeState(key, value, when)) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: "Couldn't save" }, { status: 500 });
  }
}
