import { saveLocation } from "@/lib/ebaySell";
import { failure } from "../_respond";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { postcode } = await req.json();
    await saveLocation(postcode);
    return Response.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}
