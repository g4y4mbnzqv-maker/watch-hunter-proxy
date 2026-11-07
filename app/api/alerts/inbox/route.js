import { alertInbox } from "@/lib/alerts";

export const dynamic = "force-dynamic";

// The last week of deal alerts, for the Home tab
export async function GET() {
  try {
    return Response.json({ alerts: await alertInbox() });
  } catch (err) {
    console.error(err);
    return Response.json({ alerts: [] });
  }
}
