import { auctionEndings, listModels, priceIndexEnabled } from "@/lib/priceIndex";
import { sellingTimes } from "@/lib/sellTiming";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!priceIndexEnabled()) return Response.json({ enabled: false, models: [] });

  try {
    const [models, endings] = await Promise.all([listModels(), auctionEndings()]);
    return Response.json({ enabled: true, models, timing: sellingTimes(endings) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: `Couldn't read the price index: ${err.message}` }, { status: 500 });
  }
}
