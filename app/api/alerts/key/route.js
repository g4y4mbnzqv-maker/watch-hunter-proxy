import { countSubscriptions, vapidKeys } from "@/lib/alerts";
import { syncUnavailable } from "@/lib/userState";

export const dynamic = "force-dynamic";

// The public push key a phone needs to sign up for alerts. Alerts need the
// same as syncing: a database and a passcode.
export async function GET() {
  const reason = syncUnavailable();
  if (reason) return Response.json({ enabled: false, reason });
  try {
    const { publicKey } = await vapidKeys();
    return Response.json({ enabled: true, publicKey, devices: await countSubscriptions() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: "Couldn't set up alerts" }, { status: 500 });
  }
}
