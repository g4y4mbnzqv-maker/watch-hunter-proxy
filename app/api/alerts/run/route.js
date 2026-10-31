import { runAlerts } from "@/lib/alerts";
import { refusal } from "@/lib/cronAuth";
import { syncUnavailable } from "@/lib/userState";

export const dynamic = "force-dynamic";
// Several brands are checked, so this needs longer than a normal request
export const maxDuration = 60;

// Called on a schedule (see .github/workflows/deal-alerts.yml) with
// CRON_SECRET as a bearer token, like the daily price run
export async function GET(req) {
  const refused = refusal(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (refused) {
    console.warn(`Deal alerts refused: ${refused}`);
    return Response.json({ error: true, message: "Not allowed" }, { status: 401 });
  }
  const reason = syncUnavailable();
  if (reason) return Response.json({ error: true, message: `Alerts are off: ${reason}` }, { status: 503 });

  const report = await runAlerts();
  return Response.json({ ok: true, report });
}
