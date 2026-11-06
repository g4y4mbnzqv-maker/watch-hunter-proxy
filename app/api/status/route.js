import { lastRuns } from "@/lib/runLog";

export const dynamic = "force-dynamic";

// When the scheduled jobs last ran, for the Home tab's setup list
export async function GET() {
  try {
    return Response.json({ runs: await lastRuns() });
  } catch (err) {
    console.error(err);
    return Response.json({ runs: null });
  }
}
