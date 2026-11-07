import { sellStatus } from "@/lib/ebaySell";

export const dynamic = "force-dynamic";

// Whether you're signed in to eBay and ready to list
export async function GET() {
  try {
    return Response.json(await sellStatus());
  } catch (err) {
    console.error(err);
    return Response.json({ connected: false, error: err.message });
  }
}
