import { addSubscription, removeSubscription } from "@/lib/alerts";
import { syncUnavailable } from "@/lib/userState";

export const dynamic = "force-dynamic";

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Signs this device up for alerts: { subscription } from the browser
export async function POST(req) {
  const reason = syncUnavailable();
  if (reason) return Response.json({ enabled: false, reason }, { status: 409 });
  const body = await readBody(req);
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint) || !subscription.keys) {
    return Response.json({ error: true, message: "Not a push subscription" }, { status: 400 });
  }
  await addSubscription(subscription);
  return Response.json({ ok: true });
}

// Stops alerts to this device: { endpoint }
export async function DELETE(req) {
  const reason = syncUnavailable();
  if (reason) return Response.json({ enabled: false, reason }, { status: 409 });
  const body = await readBody(req);
  if (!body?.endpoint) return Response.json({ error: true, message: "Missing endpoint" }, { status: 400 });
  await removeSubscription(body.endpoint);
  return Response.json({ ok: true });
}
