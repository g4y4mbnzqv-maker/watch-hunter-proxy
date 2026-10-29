import { harvest } from "@/lib/harvest";
import { priceIndexEnabled } from "@/lib/priceIndex";

export const dynamic = "force-dynamic";
// The harvest scans several brands, so it needs longer than a normal request
export const maxDuration = 60;

// Called once a day by Vercel Cron, which sends CRON_SECRET as a bearer
// token. Without CRON_SECRET set, nobody can start a harvest.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: true, message: "Not allowed" }, { status: 401 });
  }
  if (!priceIndexEnabled()) {
    return Response.json({ error: true, message: "No database is connected" }, { status: 503 });
  }

  const report = await harvest();
  return Response.json({ ok: true, report });
}
