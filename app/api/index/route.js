import { listModels, priceIndexEnabled } from "@/lib/priceIndex";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!priceIndexEnabled()) return Response.json({ enabled: false, models: [] });

  try {
    return Response.json({ enabled: true, models: await listModels() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: `Couldn't read the price index: ${err.message}` }, { status: 500 });
  }
}
