import { publish } from "@/lib/ebaySell";
import { failure } from "../_respond";

export const dynamic = "force-dynamic";

// Puts a saved listing live on eBay
export async function POST(req) {
  try {
    const { offerId } = await req.json();
    return Response.json(await publish(offerId));
  } catch (err) {
    return failure(err);
  }
}
