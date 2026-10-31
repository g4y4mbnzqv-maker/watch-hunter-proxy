import { sendTest } from "@/lib/alerts";
import { syncUnavailable } from "@/lib/userState";

export const dynamic = "force-dynamic";

// Sends a test notification to every signed-up device
export async function POST() {
  const reason = syncUnavailable();
  if (reason) return Response.json({ enabled: false, reason }, { status: 409 });
  try {
    return Response.json({ ok: true, sent: await sendTest() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: "Couldn't send a test alert" }, { status: 500 });
  }
}
